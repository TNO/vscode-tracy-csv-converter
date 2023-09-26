import vscode from 'vscode';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { DEFAULT_COMPARATOR, NEW_CONVERTERS, SCHEME, getConversion, getHeaders, getTimestamps, multiTracyCombiner } from './converters';
import { Ext2WebMessage, Web2ExtMessage } from './WebviewCommunication';
import { getAnswers, getFulfilled } from './utility';

dayjs.extend(utc);

// A lot of the code here is from https://github.com/rebornix/vscode-webview-react/blob/master/ext-src/extension.ts
export class ConverterPanel {
    // track current panel
    public static currentPanel: ConverterPanel | undefined;

	private static readonly viewType = 'tracyCSVConverterOptions';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private static _setTracyContent: (p: string, c: string) => void;

    public static createOrShow(extensionUri: vscode.Uri, tracyContentSetter: (p: string, c: string) => void) {
        const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
		this._setTracyContent = tracyContentSetter;

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
		this._panel = vscode.window.createWebviewPanel(ConverterPanel.viewType, "Tracy Reader Options", column, {
			// Enable javascript in the webview
			enableScripts: true,

			// And restric the webview to only loading content from our extension's `out` directory.
			localResourceRoots: [
				vscode.Uri.joinPath(extensionUri, "out"),
			]
		});
		
		// Set the webview's initial html content 
		this._panel.webview.html = this._getHtmlForWebview();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage((message: Web2ExtMessage | undefined) => {
			console.debug("Extension received message:", message);
			switch (message?.command) {
				case 'initialize':
					this.sendMessage({
						command: 'initialize',
						converters: Object.keys(NEW_CONVERTERS),
					});
					return;
				case 'add-files':
					vscode.window.showOpenDialog({ canSelectMany: true, openLabel: "Open", canSelectFolders: false }).then((files) => { if (files) {
						// Tell the webview to display the files
						this.sendMessage({
							command: "add-files",
							data: files.map((f) => f.path.substring(1))
						});
					}});
					return;
				case 'read-headers':
					getHeaders(message.fileNames, message.converters.map((converter_number: number) => Object.keys(NEW_CONVERTERS)[converter_number])).then((settledPromises) => {
						// For all the fulfilled promises
						const [fFileNames, fHeaders, rFileNames, rMessages] = getAnswers<string, string[]>(message.fileNames, settledPromises);
						if (fFileNames.length > 0) this.sendMessage({ command: 'headers', file_names: fFileNames, data: fHeaders });
						if (rFileNames.length > 0) this.sendMessage({ command: 'error', file_names: rFileNames, messages: rMessages });
					}).catch((e) => console.error("Read headers error:", e));
					return;
				case 'read-dates': {
					const fileNames = Object.keys(message.files);
					const converters = fileNames.map((file_name) => Object.keys(NEW_CONVERTERS)[message.files[file_name].converter]);
					getTimestamps(fileNames, converters).then((settledPromises) => {
						// Get the edge dates
						const [_fFileNames, date_strings, rFileNames, rMessages] = getAnswers(fileNames, settledPromises);
						const earliest = date_strings.map((d) => d[0]).sort(DEFAULT_COMPARATOR)[0];
						const latest = date_strings.map((d) => d[1]).sort(DEFAULT_COMPARATOR).at(-1)!;

						this.sendMessage({ command: 'edge-dates', date_start: earliest, date_end: latest });

						rFileNames.forEach((f, i) => console.log("Could not get dates of file", f, ":", rMessages[i]));
					}).catch((e) => console.error("Read date error:", e));

					return;
				}
				case 'submit': {
					const fileNames = Object.keys(message.files);
					const converters = fileNames.map((file_name) => Object.keys(NEW_CONVERTERS)[message.files[file_name].converter]);
					getConversion(fileNames, converters, message.constraints).then((settledPromises) => {
						const dataArray = getFulfilled(settledPromises);
						const newFileUri = vscode.Uri.parse(`${SCHEME}:multiparsed.tracy.json`);
						const converted = multiTracyCombiner(dataArray);
						if (converted.length === 0) {
							this.sendMessage({ command: "submit-message", text: "COMBINATION ERROR: There is nothing to combine. Please select a timerange that contains at least a few entries."});
							return;
						}
						ConverterPanel._setTracyContent(newFileUri.path, JSON.stringify(converted));

						vscode.commands.executeCommand('vscode.openWith', newFileUri, 'tno.tracy');
						this.dispose();
						
					}, (e) => this.sendMessage({ command: "submit-message", text: "CONVERSION ERROR: " + e}))
					.catch((e) => {
						this.sendMessage({ command: "submit-message", text: "COMBINATION ERROR: " + e });
					});
					return;
				}
			}
		}, null, this._disposables);
	}

	// Use this for explicit typing
	private sendMessage(message: Ext2WebMessage) {
		this._panel.webview.postMessage(message);
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
