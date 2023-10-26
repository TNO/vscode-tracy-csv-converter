'use strict';

import * as vscode from 'vscode';
import { COMMAND_ID_CURRENT, COMMAND_ID_MULTIPLE, SCHEME, TRACY_EDITOR } from './constants';
import { CONVERTERS } from './converters'; // might want to change into a *
import { ConverterPanel } from './converterPanel';
import { ConversionHandler } from './converterHandler';
import { statSync } from 'fs';

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
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider));

	const conversionHandler = new ConversionHandler((fileName: string) => statSync(fileName).mtimeMs);
	conversionHandler.addConverter("CSV automatic", CONVERTERS.TRACY_STREAM_PAPAPARSER);
	conversionHandler.addConverter("CSV standard (deprecated)", CONVERTERS.TRACY_STRING_STANDARD_CONVERTER);
	conversionHandler.addConverter("XML format (unimplemented)", CONVERTERS.TRACY_XML);
	conversionHandler.addConverter("Tracy JSON", CONVERTERS.TRACY_JSON_READER);

	const multiConverterCommand = vscode.commands.registerCommand(COMMAND_ID_MULTIPLE, async () => {
		// Create and show panel
		ConverterPanel.createOrShow(context.extensionUri, conversionHandler, (path, content) => { contents[path] = content });
	});
	

	const disposable = vscode.commands.registerCommand(COMMAND_ID_CURRENT, async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const choice = await vscode.window.showQuickPick(conversionHandler.getConvertersList());
			if (choice) {
				const uri = vscode.Uri.parse(`${SCHEME}:${editor.document.fileName.replace(/\.csv|\.txt/gi, ".tracy.json")}`);
				try {
					const converter = conversionHandler.getConverter(choice);
					const converted = await converter.fileReader(editor.document.uri.fsPath).then(data => converter.getData(data as never));
					contents[uri.path] = JSON.stringify(converted);
				} catch (e) {
					console.log(e);
				}
				await vscode.commands.executeCommand('vscode.openWith', uri, TRACY_EDITOR);
			}
		} else {
			vscode.window.showErrorMessage("Current document is not open in a text editor.");
		}
	});

	context.subscriptions.push(multiConverterCommand);
	context.subscriptions.push(disposable);
}
