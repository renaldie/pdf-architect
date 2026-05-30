#!/usr/bin/env node
/**
 * Copies pdfjs-dist's standard_fonts and cmaps into public/ so that
 * Vite will include them in dist/ and VS Code webviews can load them
 * locally without any network requests.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const copies = [
  {
    src: path.join(root, 'node_modules', 'pdfjs-dist', 'standard_fonts'),
    dest: path.join(root, 'public', 'standard_fonts'),
  },
  {
    src: path.join(root, 'node_modules', 'pdfjs-dist', 'cmaps'),
    dest: path.join(root, 'public', 'cmaps'),
  },
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

let allOk = true;
for (const { src, dest } of copies) {
  if (!fs.existsSync(src)) {
    console.error(`[copy-pdf-assets] Source not found: ${src}`);
    allOk = false;
    continue;
  }
  copyDir(src, dest);
  console.log(`[copy-pdf-assets] Copied  ${path.relative(root, src)}  →  ${path.relative(root, dest)}`);
}

if (!allOk) process.exit(1);
