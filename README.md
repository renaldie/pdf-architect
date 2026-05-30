# PDF Architect

PDF Architect is a powerful, lightning-fast PDF editing extension built entirely within VS Code. It provides a sleek, modern interface allowing you to view and manipulate PDFs without ever leaving your editor. 

Built using `React`, `Vite`, `pdf.js` (for high-performance rendering via Web Workers), and `pdf-lib` (for binary manipulation).

## ✨ Features

- **Blazing Fast Viewing**: Reads and renders even massive PDFs instantly using background Web Workers, bypassing standard UI thread blocking.
- **Add Signatures**: Draw a signature or upload an image file (PNG/JPEG) and place it absolutely anywhere on the document with precision drag-and-drop mechanics.
- **Merge PDFs**: Easily combine multiple PDF files into one. Drag to reorder them exactly how you want them appended to the current document.
- **Split PDFs**: Extract custom page ranges (e.g. `1-3, 5, 8-10`) or automatically split documents into equal chunks (e.g. every `N` pages).
- **Export to Images**: Convert specific pages or entire documents into high-quality `PNG` or `JPEG` images instantly.

## 🛠️ Project Structure

The project is split into a VS Code Extension backend and a React WebView frontend. The structure is meticulously organized for readability and slimness.

```text
pdf-architect/
├── src/                       (VS Code Extension Backend)
│   ├── extension.ts           (Entry point & command registration)
│   └── PdfEditorProvider.ts   (Custom Editor provider, manages IPC & file saving)
├── webview-ui/src/            (React Frontend Engine)
│   ├── App.tsx                (Main application orchestrator)
│   ├── main.tsx               (React entry point)
│   ├── index.css              (Centralized modern styling & CSS variables)
│   ├── components/            (Modular UI Components)
│   │   ├── PdfViewer.tsx      (The core PDF canvas rendering engine)
│   │   ├── SignatureModal.tsx (Draw/Upload signature logic)
│   │   ├── MergeModal.tsx     (File selection and reordering UI)
│   │   ├── SplitModal.tsx     (Custom range parsing and preview UI)
│   │   └── ExportModal.tsx    (Image format & scaling selection)
│   └── utils/                 (Processing & Background Workers)
│       ├── pdfOperations.ts   (pdf-lib binary manipulation wrappers)
│       └── pdfWorker.ts       (Web Worker configuration for pdf.js)
```

## 🚀 Development Setup

1. **Install Dependencies**
   Install packages for both the backend extension and the frontend webview:
   ```bash
   bun install
   cd webview-ui && bun install && cd ..
   ```

2. **Build the Webview UI**
   The React frontend must be compiled into standard JavaScript/CSS for the VS Code webview to load it:
   ```bash
   bun run build:webview
   ```

3. **Run in VS Code**
   Press `F5` in VS Code. This will automatically compile the TypeScript backend and launch the Extension Development Host. Open any `.pdf` file to launch PDF Architect!

## 🔒 Security

This extension is built with a security-first approach:
- **Strict Content Security Policy (CSP)**: The WebView is entirely isolated. It is blocked from making any external network requests, ensuring your PDF data can never leave your machine.
- **Path Sanitization**: Backend endpoints strictly validate and sanitize all filenames to prevent path traversal vulnerabilities.
- **Audited Dependencies**: Core libraries (like `pdfjs-dist`) are continuously audited and patched against arbitrary code execution exploits.

## 🤖 CI/CD Automation

This project is configured with ready-to-use GitHub Actions:
- **Build VSIX Artifact**: Triggers on every push and PR to `main`, automatically testing the build and outputting a downloadable `.vsix` artifact.
- **Release Automation**: Automatically compiles and attaches the final `.vsix` extension package to your GitHub Releases whenever a new release is published.
