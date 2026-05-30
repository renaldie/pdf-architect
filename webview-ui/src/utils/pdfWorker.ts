import * as pdfjsLib from 'pdfjs-dist';

// Ensure Vite emits pdf.worker.min.mjs alongside index.js in dist/assets/
import 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Fetch the worker script and wrap it in a same-origin blob: URL.
// A blob: URL inherits the page's origin, bypassing the SecurityError that
// occurs when pdfjs tries `new Worker(vscode-resource://...)` — a different
// origin from the webview document at vscode-webview://[uuid]/.
// We start this immediately at module-load time so it runs in parallel with
// the extension reading the PDF file.
export const workerReady: Promise<void> = (async () => {
  const src = new URL(
    /* @vite-ignore */ './pdf.worker.min.mjs',
    import.meta.url
  );
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } catch (err) {
    console.warn('[PDF Architect] Worker blob fetch failed, using direct URL:', err);
    pdfjsLib.GlobalWorkerOptions.workerSrc = src.href;
  }
})();

export { pdfjsLib };
