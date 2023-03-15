'use strict';

import * as vscode from 'vscode';
import { COMMAND_ID, SCHEME, CONVERTERS } from './converters';

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
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider));

	const disposable = vscode.commands.registerCommand(COMMAND_ID, async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const choice = await vscode.window.showQuickPick(Object.keys(CONVERTERS));
			if (choice) {
				const converter = CONVERTERS[choice];
				const uri = vscode.Uri.parse(`${SCHEME}:${editor.document.fileName}`);
				const converted = converter(editor.document.getText());
				contents[uri.path] = JSON.stringify(converted);
				await vscode.commands.executeCommand('vscode.openWith', uri, TRACY_EDITOR);
			}
		}
	});
	context.subscriptions.push(disposable);
}