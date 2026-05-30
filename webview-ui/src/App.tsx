import { useEffect, useState, useCallback } from 'react';
import { Save, Plus, Scissors, Image as ImageIcon, FileSignature } from 'lucide-react';
import './index.css';

import { PdfViewer } from './components/PdfViewer';
import type { SignaturePlacement } from './components/PdfViewer';
import { SignatureModal } from './components/SignatureModal';
import { MergeModal } from './components/MergeModal';
import { SplitModal } from './components/SplitModal';
import { ExportModal } from './components/ExportModal';
import { addSignatureToPdf } from './utils/pdfOperations';

// @ts-ignore
const vscode = acquireVsCodeApi();

type Modal = 'signature' | 'merge' | 'split' | 'export' | null;

function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [activeModal, setActiveModal] = useState<Modal>(null);
  /** Signature awaiting placement; null = not in placement mode */
  const [sigPlacement, setSigPlacement] = useState<SignaturePlacement | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [fileName, setFileName] = useState('document');

  // ── VS Code IPC ──────────────────────────────────────────────────────────

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'load') {
        setPdfBytes(new Uint8Array(msg.data));
        setFileName(msg.fileName || 'document');
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Cancel placement mode with Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSigPlacement(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prevent VS Code's default drag-and-drop overlay ("Hold Shift to drop into editor")
  useEffect(() => {
    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    // We add it to the capturing phase so it stops anything else from handling it
    window.addEventListener('dragover', preventDrag, { capture: true });
    window.addEventListener('drop', preventDrag, { capture: true });
    return () => {
      window.removeEventListener('dragover', preventDrag, { capture: true });
      window.removeEventListener('drop', preventDrag, { capture: true });
    };
  }, []);

  // ── Status flash helper ───────────────────────────────────────────────────

  const flash = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  // ── Save current PDF ─────────────────────────────────────────────────────

  const handleSave = () => {
    if (!pdfBytes) return;
    vscode.postMessage({ type: 'save', data: Array.from(pdfBytes) });
    flash('Saved ✓');
  };

  // ── Signature ─────────────────────────────────────────────────────────────

  const handleSignatureConfirm = (dataUrl: string) => {
    setActiveModal(null);
    // A4 page is 595 pts wide; default signature width ≈ 200 pts, height ≈ 70 pts
    setSigPlacement({ dataUrl, pdfW: 200, pdfH: 70 });
  };

  const handleSignaturePlaced = useCallback(async (
    pageIndex: number,
    pdfX: number, pdfY: number,
    pdfW: number, pdfH: number
  ) => {
    if (!sigPlacement || !pdfBytes) return;
    setSigPlacement(null);
    try {
      const updated = await addSignatureToPdf(
        pdfBytes, sigPlacement.dataUrl,
        pageIndex, pdfX, pdfY, pdfW, pdfH
      );
      setPdfBytes(updated);
      flash('Signature added ✓');
    } catch (e: any) {
      vscode.postMessage({ type: 'error', message: e.message });
    }
  }, [sigPlacement, pdfBytes]);

  // ── Merge ─────────────────────────────────────────────────────────────────

  const handleMerged = (merged: Uint8Array) => {
    setActiveModal(null);
    // Save merged result as a new file via the extension
    vscode.postMessage({ type: 'saveAs', data: Array.from(merged), fileName: 'merged.pdf' });
    flash('Merged PDF saved ✓');
  };

  // ── Split ─────────────────────────────────────────────────────────────────

  const handleSplit = (parts: Uint8Array[]) => {
    setActiveModal(null);
    vscode.postMessage({
      type: 'splitPdf',
      parts: parts.map(p => Array.from(p)),
    });
    flash(`Split into ${parts.length} files ✓`);
  };

  // ── Export images ─────────────────────────────────────────────────────────

  const handleExport = (images: { name: string; data: string }[]) => {
    setActiveModal(null);
    vscode.postMessage({ type: 'exportImages', images });
    flash(`Exporting ${images.length} image(s)…`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app-container">
      <div className="toolbar">
        <div className="toolbar-group">
          <button
            className={`icon-btn${sigPlacement ? ' active' : ''}`}
            title="Add Signature"
            onClick={() => sigPlacement ? setSigPlacement(null) : setActiveModal('signature')}
          >
            <FileSignature size={18} />
            <span>Signature</span>
          </button>
          <button className="icon-btn" title="Export as Images" onClick={() => setActiveModal('export')}>
            <ImageIcon size={18} />
            <span>Export</span>
          </button>
          <div className="divider" />
          <button className="icon-btn" title="Merge PDFs" onClick={() => setActiveModal('merge')}>
            <Plus size={18} />
            <span>Merge</span>
          </button>
          <button className="icon-btn" title="Split PDF" onClick={() => setActiveModal('split')}>
            <Scissors size={18} />
            <span>Split</span>
          </button>
        </div>
        <div className="toolbar-group">
          {statusMsg && (
            <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginRight: 8 }}>
              {statusMsg}
            </span>
          )}
          <button className="icon-btn save-btn" title="Save Document" onClick={handleSave}>
            <Save size={18} />
            <span>Save</span>
          </button>
        </div>
      </div>

      <main className="document-view">
        {isLoading ? (
          <div className="status-text">Loading PDF…</div>
        ) : (
          <PdfViewer
            pdfBytes={pdfBytes!}
            sigPlacement={sigPlacement}
            onPageCountLoaded={setTotalPages}
            onSignaturePlaced={handleSignaturePlaced}
          />
        )}
      </main>

      {/* ── Modals ── */}
      {activeModal === 'signature' && (
        <SignatureModal
          onClose={() => setActiveModal(null)}
          onConfirm={handleSignatureConfirm}
        />
      )}
      {activeModal === 'merge' && pdfBytes && (
        <MergeModal
          currentPdfBytes={pdfBytes}
          fileName={fileName}
          onClose={() => setActiveModal(null)}
          onMerged={handleMerged}
        />
      )}
      {activeModal === 'split' && pdfBytes && (
        <SplitModal
          pdfBytes={pdfBytes}
          totalPages={totalPages}
          onClose={() => setActiveModal(null)}
          onSplit={handleSplit}
        />
      )}
      {activeModal === 'export' && pdfBytes && (
        <ExportModal
          pdfBytes={pdfBytes}
          fileName={fileName}
          totalPages={totalPages}
          onClose={() => setActiveModal(null)}
          onExport={handleExport}
        />
      )}
    </div>
  );
}

export default App;
