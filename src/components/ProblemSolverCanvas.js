'use client';

import { forwardRef } from 'react';
import Canvas from './Canvas';
import { PEN_COLORS } from './CanvasToolbar';

// 모든 문제집(와이수학·영재원·황소)의 [문제 풀기] 화면에 공통으로 쓰는 '단일 통합 캔버스'.
//
// - 문제 이미지가 캔버스 배경(bgImage)으로 전체에 깔리고, 그 위에 애플펜슬로 직접 밑줄/풀이를 쓴다.
// - 우측 하단: 둥근 플로팅 팔레트(색상 + 펜/지우개)
// - 좌측 하단: 다시 풀기(초기화)
// - ref는 내부 Canvas로 그대로 forward → 부모의 저장/복원(getDataURL/restore/clear/resize) 로직이 그대로 동작한다.
const ProblemSolverCanvas = forwardRef(function ProblemSolverCanvas(
  {
    bgImage,
    color,
    tool,
    onColorChange,
    onToolChange,
    onDrawEnd,
    onReset,
    disabled = false,
    showTools = true,
  },
  ref
) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        ref={ref}
        bgImage={bgImage}
        bgOpacity={1}
        bgPosition="top"
        color={color}
        tool={tool}
        disabled={disabled}
        onDrawEnd={onDrawEnd}
      />

      {showTools && (
        <>
          {/* 좌측 하단: 다시 풀기(초기화) */}
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="absolute bottom-4 left-4 z-30 rounded-full border-2 border-rose-100 bg-white/95 px-4 py-2.5 text-sm font-extrabold text-stone-600 shadow-xl backdrop-blur transition hover:bg-rose-50 disabled:opacity-40"
          >
            🗑️ 다시 풀기
          </button>

          {/* 우측 하단: 둥근 플로팅 팔레트 */}
          <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-[1.75rem] border-2 border-rose-100 bg-white/95 p-2 shadow-xl backdrop-blur">
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
                    className={`h-8 w-8 rounded-full ${c.swatch} ring-2 ring-offset-2 transition disabled:opacity-40 ${
                      active ? 'ring-stone-500' : 'ring-transparent hover:ring-stone-200'
                    }`}
                  />
                );
              })}
            </div>
            <span className="mx-0.5 h-7 w-px bg-rose-100" />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToolChange('pen')}
              aria-pressed={tool === 'pen'}
              aria-label="펜"
              className={`rounded-full px-3 py-2 text-base shadow-sm transition disabled:opacity-40 ${
                tool === 'pen' ? 'bg-rose-400 text-white' : 'border-2 border-rose-100 bg-white hover:bg-rose-50'
              }`}
            >
              ✏️
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onToolChange('eraser')}
              aria-pressed={tool === 'eraser'}
              aria-label="지우개"
              className={`rounded-full px-3 py-2 text-base shadow-sm transition disabled:opacity-40 ${
                tool === 'eraser' ? 'bg-sky-400 text-white' : 'border-2 border-sky-100 bg-white hover:bg-sky-50'
              }`}
            >
              🧽
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default ProblemSolverCanvas;
