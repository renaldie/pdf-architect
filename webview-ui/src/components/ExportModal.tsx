import React, { useState } from 'react';
import { X, Image, Loader } from 'lucide-react';
import { workerReady, pdfjsLib } from '../utils/pdfWorker';

interface ExportModalProps {
  pdfBytes: Uint8Array;
  fileName: string;
  totalPages: number;
  onClose: () => void;
  onExport: (images: { name: string; data: string }[]) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ pdfBytes, fileName, totalPages, onClose, onExport }) => {
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [scale, setScale] = useState(2);
  const [pageRange, setPageRange] = useState<'all' | 'custom'>('all');
  const [rangeInput, setRangeInput] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getPageNums = (): number[] => {
    if (pageRange === 'all') return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums: number[] = [];
    for (const part of rangeInput.split(',').map(s => s.trim())) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        if (a >= 1 && b <= totalPages && a <= b)
          for (let i = a; i <= b; i++) nums.push(i);
      } else {
        const n = Number(part);
        if (n >= 1 && n <= totalPages) nums.push(n);
      }
    }
    return [...new Set(nums)].sort((a, b) => a - b);
  };

  const exportImages = async () => {
    const pageNums = getPageNums();
    if (pageNums.length === 0) { setError('No valid pages selected.'); return; }
    setLoading(true);
    setProgress(0);
    setError('');
    try {
      await workerReady;
      const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(), useSystemFonts: true, verbosity: 0 }).promise;
      const images: { name: string; data: string }[] = [];
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format;

      for (let i = 0; i < pageNums.length; i++) {
        const pageNum = pageNums[i];
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;

        // Fill white background for JPEG (no transparency)
        if (format === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvasContext: ctx as any, viewport }).promise;
        const dataUrl = canvas.toDataURL(mimeType, format === 'jpeg' ? 0.92 : undefined);
        images.push({ name: `${fileName}_${String(pageNum).padStart(3, '0')}.${ext}`, data: dataUrl.split(',')[1] });
        setProgress(Math.round(((i + 1) / pageNums.length) * 100));
      }

      doc.destroy();
      onExport(images);
    } catch (e: any) {
      setError(e.message || 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  const pageNums = getPageNums();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Export as Images</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Format</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['png', 'jpeg'] as const).map(f => (
                <button key={f}
                  className={`btn ${format === f ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormat(f)}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Resolution</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([1, 2, 3] as const).map(s => (
                <button key={s}
                  className={`btn ${scale === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setScale(s)}>
                  {s}× {s === 1 ? '(72 dpi)' : s === 2 ? '(144 dpi)' : '(216 dpi)'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Pages</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className={`btn ${pageRange === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPageRange('all')}>All {totalPages} pages</button>
              <button className={`btn ${pageRange === 'custom' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPageRange('custom')}>Custom range</button>
            </div>
            {pageRange === 'custom' && (
              <input
                className="form-input"
                placeholder={`e.g. 1-3, 5, 7-${totalPages}`}
                value={rangeInput}
                onChange={e => { setRangeInput(e.target.value); setError(''); }}
              />
            )}
          </div>

          {loading && (
            <div className="progress-bar-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}

          {error && <p style={{ color: '#e06c75', fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={exportImages}
            disabled={loading || (pageRange === 'custom' && pageNums.length === 0)}>
            {loading
              ? <><Loader size={14} style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />{progress}%</>
              : <><Image size={14} style={{ marginRight: 6 }} />Export {pageRange === 'all' ? totalPages : pageNums.length} image(s)</>}
          </button>
        </div>
      </div>
    </div>
  );
};
