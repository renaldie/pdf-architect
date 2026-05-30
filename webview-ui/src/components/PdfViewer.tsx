import React, { useEffect, useState, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { workerReady, pdfjsLib } from '../utils/pdfWorker';

// ─── Coordinate helpers ────────────────────────────────────────────────────────

/** Convert a click on the rendered canvas to PDF coordinate space (origin: bottom-left). */
function canvasClickToPdfCoords(
  e: React.MouseEvent<HTMLDivElement>,
  canvas: HTMLCanvasElement,
  pdfScale: number,
  pageHeightPts: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  // CSS may scale the canvas element — account for that
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = cssX * scaleX;
  const canvasY = cssY * scaleY;
  // canvas → PDF: undo render scale, flip y-axis
  return {
    x: canvasX / pdfScale,
    y: pageHeightPts - canvasY / pdfScale,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SignaturePlacement {
  dataUrl: string;
  /** Signature dimensions in PDF points (approx 200×80 pts default) */
  pdfW: number;
  pdfH: number;
}

interface PdfViewerProps {
  pdfBytes: Uint8Array;
  /** When set, the viewer enters signature-placement mode. Click a page to place. */
  sigPlacement?: SignaturePlacement | null;
  onPageCountLoaded?: (count: number) => void;
  onSignaturePlaced?: (
    pageIndex: number,
    pdfX: number,
    pdfY: number,
    pdfW: number,
    pdfH: number
  ) => void;
}

// ─── PdfViewer ────────────────────────────────────────────────────────────────

export const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfBytes,
  sigPlacement,
  onPageCountLoaded,
  onSignaturePlaced,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await workerReady;
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({
          data: pdfBytes.slice(),
          useSystemFonts: true,
          verbosity: 0,
        }).promise;
        if (cancelled) { doc.destroy(); return; }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        onPageCountLoaded?.(doc.numPages);
      } catch (err) {
        if (!cancelled) console.error('[PDF Architect] Load error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfBytes]);

  const placing = !!sigPlacement;

  return (
    <div className={`pdf-pages-container${placing ? ' signature-placing' : ''}`}>
      {placing && (
        <div className="placement-banner">
          ✍️ Click on a page to place your signature — press Escape to cancel
        </div>
      )}
      {Array.from({ length: numPages }, (_, i) => (
        <PdfPage
          key={i + 1}
          pageNumber={i + 1}
          pdfDoc={pdfDoc}
          sigPlacement={sigPlacement}
          onPlace={(pdfX, pdfY, pdfW, pdfH) => onSignaturePlaced?.(i, pdfX, pdfY, pdfW, pdfH)}
        />
      ))}
    </div>
  );
};

// ─── PdfPage ──────────────────────────────────────────────────────────────────

const RENDER_SCALE = 1.5;

const PdfPage: React.FC<{
  pageNumber: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  sigPlacement?: SignaturePlacement | null;
  onPlace: (pdfX: number, pdfY: number, pdfW: number, pdfH: number) => void;
}> = ({ pageNumber, pdfDoc, sigPlacement, onPlace }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const pageRef = useRef<pdfjsLib.PDFPageProxy | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { rootMargin: '500px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current) return;
    let task: pdfjsLib.RenderTask | null = null;
    let alive = true;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        pageRef.current = page;
        if (!alive || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        task = page.render({ canvasContext: ctx as any, viewport });
        await task.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException')
          console.error(`[PDF Architect] Page ${pageNumber} render error:`, e);
      }
    })();
    return () => { alive = false; task?.cancel(); };
  }, [pdfDoc, pageNumber, isVisible]);

  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [droppedPos, setDroppedPos] = useState<{ x: number; y: number; pdfX: number; pdfY: number } | null>(null);

  useEffect(() => {
    if (!sigPlacement) {
      setCursorPos(null);
      setDroppedPos(null);
    }
  }, [sigPlacement]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sigPlacement || droppedPos) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    if (!droppedPos) setCursorPos(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sigPlacement || !canvasRef.current || !pageRef.current || droppedPos) return;
    const { width: pageW, height: pageH } = pageRef.current.getViewport({ scale: 1 });
    const { x, y } = canvasClickToPdfCoords(e, canvasRef.current, RENDER_SCALE, pageH);
    const pdfW = sigPlacement.pdfW;
    const pdfH = sigPlacement.pdfH;
    const placedX = Math.max(0, Math.min(x - pdfW / 2, pageW - pdfW));
    const placedY = Math.max(0, Math.min(y - pdfH / 2, pageH - pdfH));
    const rect = e.currentTarget.getBoundingClientRect();
    setDroppedPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pdfX: placedX,
      pdfY: placedY
    });
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sigPlacement && droppedPos) {
      onPlace(droppedPos.pdfX, droppedPos.pdfY, sigPlacement.pdfW, sigPlacement.pdfH);
      setDroppedPos(null);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDroppedPos(null);
  };

  let overlayCssW = 200;
  let overlayCssH = 70;
  if (sigPlacement && pageRef.current && wrapperRef.current) {
    const pageW = pageRef.current.getViewport({scale: 1}).width;
    const scale = wrapperRef.current.clientWidth / pageW;
    overlayCssW = sigPlacement.pdfW * scale;
    overlayCssH = sigPlacement.pdfH * scale;
  }

  const showOverlay = sigPlacement && (cursorPos || droppedPos);
  const overlayPos = droppedPos || cursorPos;

  return (
    <div
      ref={wrapperRef}
      className="pdf-page-wrapper"
      style={{ minHeight: '800px', width: '600px' }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="pdf-page-canvas" />
      <div className="pdf-page-number">Page {pageNumber}</div>
      
      {showOverlay && overlayPos && (
        <div
          style={{
            position: 'absolute',
            left: overlayPos.x,
            top: overlayPos.y,
            width: overlayCssW,
            height: overlayCssH,
            transform: 'translate(-50%, -50%)',
            pointerEvents: droppedPos ? 'auto' : 'none',
            zIndex: 10,
            border: droppedPos ? '2px dashed var(--vscode-focusBorder)' : 'none',
            boxShadow: droppedPos ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
          }}
        >
          <img src={sigPlacement.dataUrl} style={{ width: '100%', height: '100%', opacity: droppedPos ? 1 : 0.6, objectFit: 'contain' }} />
          {droppedPos && (
            <div style={{ position: 'absolute', bottom: -44, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, background: 'var(--vscode-editor-background)', padding: 4, borderRadius: 6, border: '1px solid var(--vscode-panel-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              <button className="icon-btn" onClick={handleCancel} title="Cancel">
                <X size={16} color="var(--vscode-errorForeground)" />
              </button>
              <button className="icon-btn" onClick={handleConfirm} title="Confirm">
                <Check size={16} color="var(--vscode-testing-iconPassed)" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
