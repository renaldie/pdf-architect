import React, { useRef, useState, useEffect } from 'react';
import { X, Trash2, Check, Upload } from 'lucide-react';

interface SignatureModalProps {
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ onClose, onConfirm }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onConfirm(ev.target!.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Resize canvas to its displayed size on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width } = canvas.getBoundingClientRect();
    canvas.width = width * window.devicePixelRatio;
    canvas.height = 180 * window.devicePixelRatio;
    canvas.style.height = '180px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left), y: (t.clientY - rect.top) };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current || !lastPos.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    // Smooth with quadratic bezier
    const midX = (lastPos.current.x + pos.x) / 2;
    const midY = (lastPos.current.y + pos.y) / 2;
    ctx.quadraticCurveTo(lastPos.current.x, lastPos.current.y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    lastPos.current = pos;
  };

  const stopDraw = () => { drawing.current = false; lastPos.current = null; };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const confirm = () => {
    if (isEmpty) return;
    const canvas = canvasRef.current!;
    // Crop to tight bounding box so we don't embed a giant transparent image
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h2 className="modal-title">Draw Signature</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="form-hint" style={{ marginBottom: 12 }}>
            Draw your signature below. It will be placed on the page when you click a location.
          </p>
          <div className="sig-canvas-wrap">
            <canvas
              ref={canvasRef}
              style={{ width: '100%', touchAction: 'none' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {isEmpty && (
              <span className="sig-hint">Sign here</span>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileUpload} />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} style={{ marginRight: 6 }} />Upload Image
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={clear}>
              <Trash2 size={14} style={{ marginRight: 6 }} />Clear
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={confirm} disabled={isEmpty}>
              <Check size={14} style={{ marginRight: 6 }} />Place Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
