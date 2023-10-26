'use strict';

import * as vscode from 'vscode';
import { COMMAND_ID_CURRENT, COMMAND_ID_MULTIPLE, SCHEME, TRACY_EDITOR } from './constants';
import * as converters from './converters'; // might want to change into a *
import { ConverterPanel } from './converterPanel';

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

	const multiConverterCommand = vscode.commands.registerCommand(COMMAND_ID_MULTIPLE, async () => {
		// Create and show panel
		ConverterPanel.createOrShow(context.extensionUri, (path, content) => { contents[path] = content });
	});
	

	const disposable = vscode.commands.registerCommand(COMMAND_ID_CURRENT, async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const choice = await vscode.window.showQuickPick(Object.keys(converters.CONVERTERS));
			if (choice) {
				const uri = vscode.Uri.parse(`${SCHEME}:${editor.document.fileName.replace(/\.csv|\.txt/gi, ".tracy.json")}`);
				try {
					const converter = converters.CONVERTERS[choice];
					const converted = await converter.fileReader(editor.document.uri.fsPath).then(data => converter.getData(data as never));
					contents[uri.path] = JSON.stringify(converted);
				} catch (e) {
					console.log(e);
				}
				await vscode.commands.executeCommand('vscode.openWith', uri, TRACY_EDITOR);
			}
		}
	});

	context.subscriptions.push(multiConverterCommand);
	context.subscriptions.push(disposable);
}
