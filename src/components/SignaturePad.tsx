import { useRef, useEffect, useState } from 'react';

export interface Sig {
  role: string;
  name: string;
  date: string;
  data: string; // base64 PNG or ''
}

export function emptySignatories(completedBy = '', keyWorker = '', responsible = ''): Sig[] {
  const today = new Date().toLocaleDateString('en-GB');
  return [
    { role: 'Completed By', name: completedBy, date: today, data: '' },
    { role: 'Responsible Person', name: responsible, date: '', data: '' },
    { role: 'Senior / Key Worker', name: keyWorker, date: '', data: '' },
    { role: 'Service Manager', name: '', date: '', data: '' },
  ];
}

// ─── Single Signature Pad ────────────────────────────────────────────────────
interface PadProps {
  label: string;
  value: string;
  onChange: (base64: string) => void;
}

export function SignaturePad({ label, value, onChange }: PadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(!value);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore existing sig on mount / value change
  useEffect(() => {
    if (!value || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = value;
    setIsEmpty(false);
  }, []); // only on mount

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setIsEmpty(false);
  };

  const onEnd = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const base64 = canvasRef.current?.toDataURL('image/png') || '';
    onChange(base64);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange('');
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9;
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        const out = canvas.toDataURL('image/png');
        onChange(out);
        setIsEmpty(false);
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <div className={`relative border rounded-lg overflow-hidden ${isEmpty ? 'border-dashed border-[#2a4060]' : 'border-[#2a4060]'}`}
        style={{ background: '#fff' }}>
        {isEmpty && (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-300 pointer-events-none select-none">
            Sign here
          </span>
        )}
        <canvas
          ref={canvasRef}
          width={300}
          height={80}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={onStart}
          onMouseMove={onMove}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
        />
      </div>
      <div className="flex gap-2 mt-0.5">
        <button onClick={clear}
          className="text-[10px] text-gray-500 hover:text-red-400 font-medium">
          Clear
        </button>
        <span className="text-gray-700">·</span>
        <button onClick={() => fileRef.current?.click()}
          className="text-[10px] text-teal-500 hover:text-teal-300 font-medium">
          Upload image
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>
    </div>
  );
}

// ─── Signature Panel (all 4 signatories) ────────────────────────────────────
interface PanelProps {
  sigs: Sig[];
  onChange: (sigs: Sig[]) => void;
}

export function SignaturePanel({ sigs, onChange }: PanelProps) {
  const update = (i: number, patch: Partial<Sig>) => {
    const next = [...sigs];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <div>
      <h2 className="text-base font-bold text-white mb-1">Signatures</h2>
      <p className="text-xs text-gray-500 mb-5">
        Draw your signature using mouse or touch, or upload an image. Signatures will be embedded in the printed PDF.
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {sigs.map((sig, i) => (
          <div key={i} className="bg-[#0a1120] border border-[#1e3050] rounded-xl p-4">
            <SignaturePad
              label={sig.role}
              value={sig.data}
              onChange={data => update(i, { data })}
            />
            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Name</label>
                <input
                  value={sig.name}
                  onChange={e => update(i, { name: e.target.value })}
                  placeholder={sig.role}
                  className="w-full bg-[#0c1525] border border-[#1e3050] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Date</label>
                <input
                  value={sig.date}
                  onChange={e => update(i, { date: e.target.value })}
                  placeholder="DD/MM/YYYY"
                  className="w-full bg-[#0c1525] border border-[#1e3050] rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
