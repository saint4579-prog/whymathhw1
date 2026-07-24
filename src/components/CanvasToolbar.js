'use client';

// 답 쓰는 공간(캔버스)에서 쓰는 펜 색상 선택 + 지우개 도구 모음.
export const PEN_COLORS = [
  { value: '#1e293b', label: '검정', swatch: 'bg-slate-800' },
  { value: '#ef4444', label: '빨강', swatch: 'bg-red-500' },
  { value: '#2563eb', label: '파랑', swatch: 'bg-blue-600' },
  { value: '#16a34a', label: '초록', swatch: 'bg-green-600' },
  { value: '#f59e0b', label: '주황', swatch: 'bg-amber-500' },
];

export default function CanvasToolbar({ color, tool, onColorChange, onToolChange, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-rose-100 bg-white/90 px-3 py-2 shadow-sm">
      <span className="text-xs font-bold text-amber-500">🎨 색</span>
      <div className="flex items-center gap-1.5">
        {PEN_COLORS.map((c) => {
          const active = tool === 'pen' && color === c.value;
          return (
            <button
              key={c.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                onColorChange(c.value);
                onToolChange('pen');
              }}
              aria-label={`${c.label} 펜`}
              aria-pressed={active}
              className={`h-7 w-7 rounded-full ${c.swatch} ring-2 ring-offset-2 transition disabled:opacity-40 ${
                active ? 'ring-stone-400' : 'ring-transparent hover:ring-stone-200'
              }`}
            />
          );
        })}
      </div>
      <span className="mx-1 h-6 w-px bg-rose-100" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToolChange('pen')}
        aria-pressed={tool === 'pen'}
        className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition disabled:opacity-40 ${
          tool === 'pen'
            ? 'bg-rose-400 text-white'
            : 'border-2 border-rose-100 bg-white text-rose-500 hover:bg-rose-50'
        }`}
      >
        ✏️ 펜
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToolChange('eraser')}
        aria-pressed={tool === 'eraser'}
        className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition disabled:opacity-40 ${
          tool === 'eraser'
            ? 'bg-sky-400 text-white'
            : 'border-2 border-sky-100 bg-white text-sky-500 hover:bg-sky-50'
        }`}
      >
        🧽 지우개
      </button>
    </div>
  );
}
