'use strict';

import * as vscode from 'vscode';
import * as converters from './converters'; // might want to change into a *
import { ConverterPanel } from './ConverterReactPanel';

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
		// Create and show panel
		ConverterPanel.createOrShow(context.extensionUri, (path, content) => { contents[path] = content });
	});
	

	const disposable = vscode.commands.registerCommand(converters.COMMAND_ID, async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const choice = await vscode.window.showQuickPick(Object.keys(converters.CONVERTERS));
			if (choice) {
				const converter = converters.CONVERTERS[choice];
				const uri = vscode.Uri.parse(`${converters.SCHEME}:${editor.document.fileName.replace(".csv", ".tracy.json")}`);
				if (choice === "Define custom converter") {
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

	context.subscriptions.push(multiConverterCommand);
	context.subscriptions.push(disposable);
}

/**
 * Asks the users the documents delimiters and which header to sort by if any.
 * @param doc The document to get the headers from
 * @returns a tuple of the row delimiter, column delimiter, and the column/header to sort by
 */
async function getCSVInfo(doc: vscode.TextDocument) : Promise<[string, string, string | undefined]> { // Use this function to ask the user what format the csv file is in
	const rowDelimiter = await vscode.window.showQuickPick(Object.keys(converters.ROW_DELIMITERS), {title: "What symbol divides the rows?"});
	if (!rowDelimiter) return Promise.reject(); // user has cancelled the operation
	const colDelimiter = await vscode.window.showQuickPick(Object.keys(converters.COL_DELIMITERS), {title: "What symbol divides the columns?"});
	if (!colDelimiter) return Promise.reject(); // user has cancelled the operation
	const headers = doc.getText().slice(0, doc.getText().indexOf(converters.ROW_DELIMITERS[rowDelimiter])).split(converters.COL_DELIMITERS[colDelimiter]);
	const sortColumn = await vscode.window.showQuickPick(headers, { title: "Sort by which column? (Esc for no sorting)" }); // undefined means no sorting
	return [rowDelimiter, colDelimiter, sortColumn];
}
