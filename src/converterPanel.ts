import vscode from 'vscode';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { SCHEME, TRACY_EDITOR } from './constants';
import { DEFAULT_COMPARATOR, multiTracyCombiner, CONVERTERS } from './converters';
import { Ext2WebMessage, Web2ExtMessage } from './communicationProtocol';
import { getAnswers, getDateStringTimezone } from './utility';
import { FileSizeEstimator, MediumFileSizeEstimator } from './fileSizeEstimator';
import { statSync } from 'fs';
import { ConversionHandler } from './converterHandler';

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
	private _fileSizeEstimator: FileSizeEstimator;
	private _converter: ConversionHandler;

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
		this._fileSizeEstimator = new MediumFileSizeEstimator();
		this._converter = new ConversionHandler((fileName: string) => statSync(fileName).mtimeMs);
		this._converter.addConverter("CSV automatic", CONVERTERS.TRACY_STREAM_PAPAPARSER);
		this._converter.addConverter("CSV standard (deprecated)", CONVERTERS.TRACY_STRING_STANDARD_CONVERTER);
		this._converter.addConverter("XML format (unimplemented)", CONVERTERS.TRACY_XML);
		this._converter.addConverter("Tracy JSON", CONVERTERS.TRACY_JSON_READER);

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
			console.log("Extension received message:", message);
			switch (message?.command) {
				case 'initialize':
					this.sendMessage({
						command: 'initialize',
						converters: this._converter.getConvertersList(),
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
				case "read-metadata": {
					const fileNames = Object.keys(message.files);
					const converters = fileNames.map(fileName => this._converter.getConverterKey(message.files[fileName].converter));
					this._converter.getMetadata(fileNames, converters, message.options).then(settledPromises => {
						// Get the data of the fulfilled promises and the error messages of the rejected promises
						const [fFileNames, metadatas, rFileNames, rMessages] = getAnswers(fileNames, settledPromises);

						// Update file size estimator
						this._fileSizeEstimator.clear();
						fFileNames.forEach((f, i) => this._fileSizeEstimator.addFile(f, metadatas[i]));
						
						// Check if dates ok
						const timezones: [number, string][] = metadatas.map(m => m.firstDate).map((d, i) => [i, getDateStringTimezone(d)] as [number, string | undefined])
							.filter(t => t[1] !== undefined) as [number, string][];
						if (timezones.length > 0) this.sendMessage({ command: 'warning', file_names: timezones.map(t => fFileNames[t[0]]), messages: timezones.map(t => "Detected timezone formatting: " + t[1]) });

						// Get the edge dates
						const earliest = metadatas.map(m => m.firstDate).filter(m => dayjs(m).isValid()).sort(DEFAULT_COMPARATOR)[0];
						const latest = metadatas.map(m => m.lastDate).filter(m => dayjs(m).isValid()).sort(DEFAULT_COMPARATOR).at(-1)!;

						this.sendMessage({ command: "metadata", totalStartDate: earliest, totalEndDate: latest, metadata: metadatas });

						// Report errors
						if (rFileNames.length > 0) this.sendMessage({ command: 'error', file_names: rFileNames, messages: rMessages });
					});
					return;
				}
				case 'get-file-size': {
					// Can't have fs in webview, so this happens here.
					const size = this._fileSizeEstimator.estimateSize(message.date_start, message.date_end);
					this.sendMessage({ command: 'size-estimate', size });
					break;
				}
				case 'submit': {
					const fileNames = Object.keys(message.files);
					const converters = fileNames.map((fileName) => this._converter.getConverterKey(message.files[fileName].converter));
					this._converter.getConversion(fileNames, converters, message.constraints).then((settledPromises) => {
						// Get the data of the fulfilled promises and the error messages of the rejected promises
						const [_, dataArray, rFileNames, rMessages] = getAnswers(fileNames, settledPromises);
						if (rFileNames.length > 0) { // If any file failes to be read, then stop the entire process
							this.sendMessage({ command: "error", file_names: rFileNames, messages: rMessages });
							this.sendMessage({ command: "submit-message", text: "CONVERSION ERROR: A file failed to convert." });
							return;
						}
						const newFileUri = vscode.Uri.parse(`${SCHEME}:multiparsed.tracy.json`);
						const converted = multiTracyCombiner(dataArray);
						if (converted.length === 0) {
							this.sendMessage({ command: "submit-message", text: "COMBINATION ERROR: There is nothing to combine.\
								Please select a timerange that contains at least a few entries."});
							return;
						}
						const convertedString = JSON.stringify(converted);
						// console.log("Output size in Bytes", convertedString.length);
						ConverterPanel._setTracyContent(newFileUri.path, convertedString);

						vscode.commands.executeCommand('vscode.openWith', newFileUri, TRACY_EDITOR);
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
