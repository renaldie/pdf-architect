import * as vscode from 'vscode';
import { PdfEditorProvider } from './PdfEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // Register our custom editor provider for PDF files
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'pdf-architect.pdfEditor',
      new PdfEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true, // Keep PDF state when switching tabs
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );
}

export function deactivate() {}
