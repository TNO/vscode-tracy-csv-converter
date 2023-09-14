import vscode from 'vscode';
import { COMPARATORS, CONVERTERS, multiTracyCombiner, SCHEME } from './converters';

// A lot of the code here is from https://github.com/rebornix/vscode-webview-react/blob/master/ext-src/extension.ts
export class ConverterPanel {
    // track current panel
    public static currentPanel: ConverterPanel | undefined;

	private static readonly viewType = 'tracyCSVConverterOptions';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private static _setTracyContent: (p: string, c: string) => void; // TODO: is this the best way to do this?

    public static createOrShow(extensionUri: vscode.Uri, tracyConventSetter: (p: string, c: string) => void) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
		this._setTracyContent = tracyConventSetter;

		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (ConverterPanel.currentPanel) {
			ConverterPanel.currentPanel._panel.reveal(column);
		} else {
			ConverterPanel.currentPanel = new ConverterPanel(extensionUri, column || vscode.ViewColumn.One);
		}
    }

    private constructor(extensionUri: vscode.Uri, column: vscode.ViewColumn) {
		this._extensionUri = extensionUri;

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(ConverterPanel.viewType, "Tracy CSV Converter Options", column, {
			// Enable javascript in the webview
			enableScripts: true,

			// And restric the webview to only loading content from our extension's `out` directory.
			localResourceRoots: [
				vscode.Uri.joinPath(extensionUri, "out"),
				// vscode.Uri.joinPath(extensionUri, "")
			]
		});
		
		// Set the webview's initial html content 
		this._panel.webview.html = this._getHtmlForWebview();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(message => {
			console.log("Received message:", JSON.stringify(message));
			switch (message?.command) {
				case 'alert':
					vscode.window.showErrorMessage(message?.text);
					return;
				case 'update':
					this._panel.webview.postMessage({

					});
					return;
				case 'add-files':
					vscode.window.showOpenDialog({ canSelectMany: true, openLabel: "Open", canSelectFolders: false }).then((files) => { if (files) {
						// Tell the webview to display the files
						this._panel.webview.postMessage({
							command: "add-files",
							data: files.map((f) => f.path)
						});
					}});
					return;
				case 'read-headers':
					// read the requested text document, get the headers
					vscode.workspace.openTextDocument(message.file).then(async (doc) => {
						const data = message.converter === "Define custom converter" ? CONVERTERS[message.converter](doc.getText(), message.coldel, message.rowdel) : CONVERTERS[message.converter](doc.getText());
						const headers = Object.keys(data[0]); // TODO: find a better way to do this, this is very inefficient
						await this._panel.webview.postMessage({ command: 'headers', data: headers, file: message.file });
					});
					return;
				case 'submit':
					Promise.all(message.files.map(async (file: string, index: number) => {
						return CONVERTERS[message.file_converters[index]]((await vscode.workspace.openTextDocument(file)).getText()) as {[s: string]: string}[];
					}))// wait for all files to be read
					.then(async files_contents => { 
						const new_file_uri = vscode.Uri.parse(`${SCHEME}:multiparsed.tracy.json`);
						
						// Convert the files, set the content of the tracy editor, close the selection webview, open the tracy editor
						const converted = multiTracyCombiner(files_contents, message.file_headers, COMPARATORS[message.comparator]);
						console.log("Converted the selected file(s), string length %d", converted.length);
						ConverterPanel._setTracyContent(new_file_uri.path, JSON.stringify(converted));
						this.dispose();

						await vscode.commands.executeCommand('vscode.openWith', new_file_uri, 'tno.tracy');	
					});
					return;
			}
		}, null, this._disposables);
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public dispose() {
		ConverterPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _getHtmlForWebview() {
		const scriptUri = getUri(this._panel.webview, this._extensionUri, ["out", "Ux", "main.js"]);

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta name="theme-color" content="#000000">
				<title>Tracy Converter React App</title>
			</head>

			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathlist: string[]) {
	return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathlist));
}

function getNonce() {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
