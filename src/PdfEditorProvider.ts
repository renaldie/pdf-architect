import * as vscode from 'vscode';
import * as path from 'path';

export class PdfEditorProvider implements vscode.CustomReadonlyEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const distBase = path.join(this.context.extensionPath, 'webview-ui', 'dist');

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(distBase)],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage(async (e) => {
      switch (e.type) {

        // ── Initial load ────────────────────────────────────────────────────
        case 'ready': {
          const fileData = await vscode.workspace.fs.readFile(document.uri);
          const exactBuffer = fileData.buffer.slice(
            fileData.byteOffset,
            fileData.byteOffset + fileData.byteLength
          );
          webviewPanel.webview.postMessage({
            type: 'load',
            data: exactBuffer,
            fileName: path.basename(document.uri.fsPath, '.pdf')
          });
          break;
        }

        // ── Overwrite the current file ──────────────────────────────────────
        case 'save': {
          await vscode.workspace.fs.writeFile(document.uri, new Uint8Array(e.data));
          vscode.window.showInformationMessage('PDF saved.');
          break;
        }

        // ── Save to a new file (merge result, etc.) ─────────────────────────
        case 'saveAs': {
          const defaultUri = vscode.Uri.file(
            path.join(path.dirname(document.uri.fsPath), e.fileName ?? 'output.pdf')
          );
          const saveUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'PDF Files': ['pdf'] },
          });
          if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, new Uint8Array(e.data));
            vscode.window.showInformationMessage(`Saved: ${path.basename(saveUri.fsPath)}`);
          }
          break;
        }

        // ── Save each split part next to the original ───────────────────────
        case 'splitPdf': {
          const dir = path.dirname(document.uri.fsPath);
          const base = path.basename(document.uri.fsPath, '.pdf');
          const parts: number[][] = e.parts;
          for (let i = 0; i < parts.length; i++) {
            const paddedIdx = String(i + 1).padStart(3, '0');
            const outUri = vscode.Uri.file(
              path.join(dir, `${base}_${paddedIdx}.pdf`)
            );
            await vscode.workspace.fs.writeFile(outUri, new Uint8Array(parts[i]));
          }
          vscode.window.showInformationMessage(
            `Split into ${parts.length} file(s) in the same folder.`
          );
          break;
        }

        // ── Export pages as images ──────────────────────────────────────────
        case 'exportImages': {
          const images: { name: string; data: string }[] = e.images;
          if (!images.length) break;

          // Let the user choose a destination folder
          const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Export images here',
          });

          if (folders && folders[0]) {
            const dir = folders[0];
            for (const img of images) {
              const safeName = path.basename(img.name);
              const fileUri = vscode.Uri.joinPath(dir, safeName);
              // img.data is base64 (without the data:… prefix)
              const bytes = Buffer.from(img.data, 'base64');
              await vscode.workspace.fs.writeFile(fileUri, new Uint8Array(bytes));
            }
            vscode.window.showInformationMessage(
              `Exported ${images.length} image(s) to ${folders[0].fsPath}`
            );
          }
          break;
        }

        // ── Surface webview errors in the VS Code UI ────────────────────────
        case 'error': {
          vscode.window.showErrorMessage(`PDF Architect: ${e.message}`);
          break;
        }
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'webview-ui', 'dist', 'assets', 'index.js'))
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'webview-ui', 'dist', 'assets', 'index.css'))
    );

    // font-src blob: is required for pdfjs @font-face rules (embedded PDF fonts).
    // Without it, the browser silently blocks font loads and pdfjs waits ~30s.
    const csp = [
      `default-src 'none'`,
      `font-src blob: data: ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' blob:`,
      `worker-src ${webview.cspSource} blob: data:`,
      `connect-src ${webview.cspSource} blob: data:`,
      `img-src ${webview.cspSource} blob: data:`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link href="${styleUri}" rel="stylesheet">
  <title>PDF Architect</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
