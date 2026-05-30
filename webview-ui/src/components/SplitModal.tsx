import React, { useState } from 'react';
import { X, Scissors, Loader } from 'lucide-react';
import { parsePageRanges, splitPdf } from '../utils/pdfOperations';
import type { PageRange } from '../utils/pdfOperations';

interface SplitModalProps {
  pdfBytes: Uint8Array;
  totalPages: number;
  onClose: () => void;
  onSplit: (parts: Uint8Array[]) => void;
}

export const SplitModal: React.FC<SplitModalProps> = ({ pdfBytes, totalPages, onClose, onSplit }) => {
  const [mode, setMode] = useState<'ranges' | 'every'>('ranges');
  const [rangeInput, setRangeInput] = useState('');
  const [everyN, setEveryN] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const computedRanges = (): PageRange[] => {
    if (mode === 'every') {
      const n = Math.max(1, everyN);
      const ranges: PageRange[] = [];
      for (let i = 1; i <= totalPages; i += n) {
        ranges.push({ start: i, end: Math.min(i + n - 1, totalPages) });
      }
      return ranges;
    }
    return parsePageRanges(rangeInput, totalPages);
  };

  const ranges = computedRanges();

  const split = async () => {
    if (ranges.length < 2) { setError('Need at least 2 parts to split.'); return; }
    setLoading(true);
    setError('');
    try {
      const parts = await splitPdf(pdfBytes, ranges);
      onSplit(parts);
    } catch (e: any) {
      setError(e.message || 'Split failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Split PDF</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="form-hint" style={{ marginBottom: 16 }}>
            Document has <strong style={{ color: 'var(--vscode-editor-foreground)' }}>{totalPages} pages</strong>.
            Split parts will be saved next to the original file.
          </p>

          <div className="form-group">
            <label className="form-label">Split method</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn ${mode === 'ranges' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('ranges')}>
                Custom ranges
              </button>
              <button
                className={`btn ${mode === 'every' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('every')}>
                Every N pages
              </button>
            </div>
          </div>

          {mode === 'ranges' ? (
            <div className="form-group">
              <label className="form-label">Page ranges</label>
              <input
                className="form-input"
                placeholder={`e.g. 1-3, 4-6, 7-${totalPages}`}
                value={rangeInput}
                onChange={e => { setRangeInput(e.target.value); setError(''); setPreviewExpanded(false); }}
              />
              <span className="form-hint">Separate ranges with commas. Single pages are allowed.</span>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Pages per part</label>
              <input
                className="form-input"
                type="number" min={1} max={totalPages - 1}
                value={everyN}
                onChange={e => { setEveryN(Number(e.target.value)); setPreviewExpanded(false); }}
                style={{ width: 80 }}
              />
            </div>
          )}

          {ranges.length > 0 && (
            <>
              <p className="form-hint" style={{ marginBottom: 8 }}>Preview — {ranges.length} part(s):</p>
              <div className="split-preview">
                {ranges.slice(0, previewExpanded ? ranges.length : 10).map((r, i) => (
                  <span key={i} className="split-chip">
                    Part {i + 1}: pp. {r.start}{r.start !== r.end ? `–${r.end}` : ''}
                  </span>
                ))}
                {!previewExpanded && ranges.length > 10 && (
                  <span className="split-chip" style={{ cursor: 'pointer', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }} onClick={() => setPreviewExpanded(true)}>
                    + {ranges.length - 10} more...
                  </span>
                )}
              </div>
            </>
          )}

          {error && <p style={{ color: '#e06c75', fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={split} disabled={loading || ranges.length < 2}>
            {loading
              ? <><Loader size={14} style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />Splitting…</>
              : <><Scissors size={14} style={{ marginRight: 6 }} />Split into {ranges.length} files</>}
          </button>
        </div>
      </div>
    </div>
  );
};
