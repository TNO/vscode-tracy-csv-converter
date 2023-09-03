'use strict';

import * as vscode from 'vscode';
import * as converters from './converters'; // might want to change into a *

const TRACY_EDITOR = 'tno.tracy';

export function activate(context: vscode.ExtensionContext) {
	const contents: {[s: string]: string} = {};

	const provider = new class implements vscode.TextDocumentContentProvider {
		onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
		onDidChange = this.onDidChangeEmitter.event;
		provideTextDocumentContent(uri: vscode.Uri): string {
			const content = contents[uri.path];
			delete contents[uri.path];
			return content;
		}
	};
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(converters.SCHEME, provider));

	const multiConverterCommand = vscode.commands.registerCommand("extension.tracyMultiCsvConverter", async () => {
		vscode.window.showOpenDialog({ canSelectMany: true, openLabel: "Open", canSelectFolders: false }).then(fileURIs => {
			if (fileURIs) {
				//console.log("There are %d files selected.", fileURI.length);
				const new_file_uri = vscode.Uri.parse(`${converters.SCHEME}:multiparsed.tracy.json`);

				Promise.all(fileURIs.map(async file => { // wait for all files to be read
					return (await vscode.workspace.openTextDocument(file)).getText(); // TODO: find whether documents are opened as streams
				})).then(async files_contents => {
					// console.log("Found %d files' contents", files_contents.length);
					const converted = converters.multiConverter(files_contents); // TODO: add the sorted column and the comparator
					// console.log("Converted the selected file(s), string length %d", converted.length);
					contents[new_file_uri.path] = JSON.stringify(converted);
					await vscode.commands.executeCommand('vscode.openWith', new_file_uri, TRACY_EDITOR);
				});
			}
		});
		
	});
	context.subscriptions.push(multiConverterCommand);

	const disposable = vscode.commands.registerCommand(converters.COMMAND_ID, async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const choice = await vscode.window.showQuickPick(Object.keys(converters.CONVERTERS));
			if (choice) {
				const converter = converters.CONVERTERS[choice];
				const uri = vscode.Uri.parse(`${converters.SCHEME}:${editor.document.fileName.replace(".csv", ".tracy.json")}`);
				if (choice.endsWith("!")) { // TODO: Basic identifier, change to a more sophisticated method of determining whether special actions have to be taken
					// Define-your-own / DIY csv converter
					getCSVInfo(editor.document).then(async csvInfo => {
						const converted = converter(editor.document.getText(), converters.COL_DELIMITERS[csvInfo[1]], converters.ROW_DELIMITERS[csvInfo[0]], csvInfo[2]); // this gets the document from that is currently open in the editor
						// what I want is to be able to select multiple files not in the editor
						contents[uri.path] = JSON.stringify(converted);
						await vscode.commands.executeCommand('vscode.openWith', uri, TRACY_EDITOR);
					});					
				} else {
					const converted = converter(editor.document.getText());
					contents[uri.path] = JSON.stringify(converted);
					await vscode.commands.executeCommand('vscode.openWith', uri, TRACY_EDITOR);
				}
				//await vscode.commands.executeCommand('vscode.openWith', uri, TRACY_EDITOR);
			}
		}
	});
	context.subscriptions.push(disposable);
}

async function getCSVInfo(doc: vscode.TextDocument) : Promise<[string, string, string | undefined]> { // Use this function to ask the user what format the csv file is in
	const row_delimiter = await vscode.window.showQuickPick(Object.keys(converters.ROW_DELIMITERS), {title: "What symbol divides the rows?"});
	if (!row_delimiter) return Promise.reject(); // user has cancelled the operation
	const col_delimiter = await vscode.window.showQuickPick(Object.keys(converters.COL_DELIMITERS), {title: "What symbol divides the columns?"});
	if (!col_delimiter) return Promise.reject(); // user has cancelled the operation
	const headers = converters.getHeaders(doc.lineAt(0).text, converters.COL_DELIMITERS[col_delimiter]);
	// TODO: currently there is no way to cancel the operation at this stage, maybe change it so that it is possible
	const sort_column = await vscode.window.showQuickPick(headers, { title: "Sort by which column? (Esc for no sorting)" }); // undefined means no sorting
	return [row_delimiter, col_delimiter, sort_column];
}
