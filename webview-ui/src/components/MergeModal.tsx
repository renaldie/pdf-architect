import React, { useState, useRef } from 'react';
import { X, Trash2, ArrowUp, ArrowDown, Loader } from 'lucide-react';
import { mergePdfs } from '../utils/pdfOperations';

interface MergeModalProps {
  currentPdfBytes: Uint8Array;
  fileName: string;
  onClose: () => void;
  onMerged: (bytes: Uint8Array) => void;
}

interface PdfFile {
  name: string;
  bytes: Uint8Array;
  sizeKb: number;
}

export const MergeModal: React.FC<MergeModalProps> = ({ currentPdfBytes, fileName, onClose, onMerged }) => {
  const [files, setFiles] = useState<PdfFile[]>([{
    name: `${fileName} (this file)`,
    bytes: currentPdfBytes,
    sizeKb: Math.round(currentPdfBytes.length / 1024)
  }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const readFiles = (fileList: FileList) => {
    Array.from(fileList).forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        const bytes = new Uint8Array(e.target!.result as ArrayBuffer);
        setFiles(prev => [...prev, { name: f.name, bytes, sizeKb: Math.round(f.size / 1024) }]);
      };
      reader.readAsArrayBuffer(f);
    });
  };



  const move = (index: number, dir: -1 | 1) => {
    setFiles(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const merge = async () => {
    if (files.length === 0) { setError('Add at least one PDF to merge.'); return; }
    setLoading(true);
    setError('');
    try {
      const allBytes = files.map(f => f.bytes);
      const merged = await mergePdfs(allBytes);
      onMerged(merged);
    } catch (e: any) {
      setError(e.message || 'Merge failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Merge PDFs</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="form-hint" style={{ marginBottom: 12 }}>
            Drag to reorder. The files will be merged from top to bottom.
          </p>

          {/* Drop zone */}
          <div
            className="drop-zone"
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-zone-icon">📂</div>
            <div className="drop-zone-text">Click here to select PDF files</div>
          </div>
          <input ref={inputRef} type="file" accept=".pdf" multiple hidden
            onChange={e => e.target.files && readFiles(e.target.files)} />

          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={i} className="file-list-item">
                  <span style={{ fontSize: 14 }}>📄</span>
                  <span className="file-list-item-name">{f.name}</span>
                  <span className="file-list-item-size">{f.sizeKb} KB</span>
                  <button className="icon-btn" onClick={() => move(i, -1)} style={{ padding: 2 }}><ArrowUp size={12} /></button>
                  <button className="icon-btn" onClick={() => move(i, 1)} style={{ padding: 2 }}><ArrowDown size={12} /></button>
                  <button className="icon-btn" onClick={() => remove(i)} style={{ padding: 2 }}><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          )}

          {error && <p style={{ color: '#e06c75', fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={merge} disabled={loading || files.length < 2}>
            {loading ? <><Loader size={14} style={{ marginRight: 6, animation: 'spin 1s linear infinite' }} />Merging…</> : `Merge ${files.length} PDFs`}
          </button>
        </div>
      </div>
    </div>
  );
};
