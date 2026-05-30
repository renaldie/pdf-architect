import { PDFDocument } from 'pdf-lib';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PageRange {
  start: number; // 1-indexed
  end: number;   // 1-indexed, inclusive
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/** Parse a range string like "1-3, 5, 7-9" into PageRange objects. */
export function parsePageRanges(input: string, totalPages: number): PageRange[] {
  const ranges: PageRange[] = [];
  for (const part of input.split(',').map(s => s.trim())) {
    if (!part) continue;
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (
        Number.isInteger(a) && Number.isInteger(b) &&
        a >= 1 && b <= totalPages && a <= b
      ) {
        ranges.push({ start: a, end: b });
      }
    } else {
      const n = Number(part);
      if (Number.isInteger(n) && n >= 1 && n <= totalPages) {
        ranges.push({ start: n, end: n });
      }
    }
  }
  return ranges;
}

// ── Operations ────────────────────────────────────────────────────────────────

/** Merge multiple PDFs (in order) into a single PDF document. */
export async function mergePdfs(pdfBytesArray: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of pdfBytesArray) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  return merged.save();
}

/**
 * Split a PDF into multiple documents, one per PageRange.
 * Returns the Uint8Array for each part in the same order as `ranges`.
 */
export async function splitPdf(
  pdfBytes: Uint8Array,
  ranges: PageRange[]
): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const parts: Uint8Array[] = [];
  for (const { start, end } of ranges) {
    const dst = await PDFDocument.create();
    // pdf-lib page indices are 0-based
    const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
    const copied = await dst.copyPages(src, indices);
    copied.forEach(p => dst.addPage(p));
    parts.push(await dst.save());
  }
  return parts;
}

/**
 * Embed a signature image (PNG data URL) onto a specific page of the PDF.
 * Coordinates are in PDF-space (origin at bottom-left, y going up).
 */
export async function addSignatureToPdf(
  pdfBytes: Uint8Array,
  signatureDataUrl: string,
  pageIndex: number,  // 0-based
  pdfX: number,
  pdfY: number,
  pdfW: number,
  pdfH: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const page = pdfDoc.getPages()[pageIndex];
  if (!page) throw new Error(`Page ${pageIndex} not found.`);

  // Convert base64 data URL → raw bytes
  const base64 = signatureDataUrl.split(',')[1];
  const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const isPng = signatureDataUrl.startsWith('data:image/png');
  const img = isPng
    ? await pdfDoc.embedPng(imgBytes)
    : await pdfDoc.embedJpg(imgBytes);

  page.drawImage(img, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });
  return pdfDoc.save();
}
