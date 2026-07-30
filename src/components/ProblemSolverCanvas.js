'use client';

import { forwardRef, useState } from 'react';
import Canvas, { ERASER_SIZES } from './Canvas';
import { PEN_COLORS } from './CanvasToolbar';

const ERASER_SIZE_OPTIONS = [
  { key: 'small', label: '얇게', value: ERASER_SIZES.small, dot: 10 },
  { key: 'medium', label: '보통', value: ERASER_SIZES.medium, dot: 16 },
  { key: 'large', label: '굵게', value: ERASER_SIZES.large, dot: 24 },
];



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
    // 캔버스를 화면보다 크게 넓힌 상태에서는 도구를 화면에 고정해야 한다.
    // 그러지 않으면 캔버스와 함께 스크롤돼서 화면 밖으로 사라진다.
    pinTools = false,
  },
  ref
) {
  // 지우개 설정. 화면을 옮겨도 유지되도록 이 컴포넌트가 직접 들고 있는다.
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES.medium);
  const [eraserMode, setEraserMode] = useState('pixel');

  return (
    <div className="relative h-full w-full">
      <Canvas
        ref={ref}
        bgImage={bgImage}
        bgOpacity={1}
        bgPosition="top"
        color={color}
        tool={tool}
        eraserSize={eraserSize}
        eraserMode={eraserMode}
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
            className={`${
              pinTools ? 'fixed bottom-6 left-6' : 'absolute bottom-4 left-4'
            } z-30 rounded-full border-2 border-rose-100 bg-white/95 px-4 py-2.5 text-sm font-extrabold text-stone-600 shadow-xl backdrop-blur transition hover:bg-rose-50 disabled:opacity-40`}
          >
            🗑️ 다시 풀기
          </button>

          {/* 지금 어떤 지우개인지 알려 주는 표시 */}
          {tool === 'eraser' && eraserMode !== 'pixel' && (
            <span className={`${pinTools ? 'fixed bottom-[5.5rem] right-6' : 'absolute bottom-[4.5rem] right-4'} z-30 rounded-full bg-sky-400 px-3 py-1 text-xs font-extrabold text-white shadow-lg`}>
              {eraserMode === 'stroke' ? '획 지우개' : '영역 지우개'}
            </span>
          )}

          {/* 우측 하단: 둥근 플로팅 팔레트 */}
          <div
            className={`${
              pinTools ? 'fixed bottom-6 right-6' : 'absolute bottom-4 right-4'
            } z-30 flex items-center gap-2 rounded-[1.75rem] border-2 border-rose-100 bg-white/95 p-2 shadow-xl backdrop-blur`}
          >
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
            {/* 지우개. 길게 누르기는 애플펜슬로 잘 안 먹혀서, 옵션을 항상 툴바에 펼쳐 둔다. */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onToolChange('eraser');
                setEraserMode('pixel');
              }}
              aria-pressed={tool === 'eraser' && eraserMode === 'pixel'}
              aria-label="지우개"
              className={`rounded-full px-3 py-2 text-base shadow-sm transition disabled:opacity-40 ${
                tool === 'eraser' && eraserMode === 'pixel'
                  ? 'bg-sky-400 text-white'
                  : 'border-2 border-sky-100 bg-white hover:bg-sky-50'
              }`}
            >
              🧽
            </button>

            {/* 지우개 크기: 동그라미 크기가 곧 실제 크기 */}
            <div className="flex items-center gap-1">
              {ERASER_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setEraserSize(opt.value);
                    onToolChange('eraser');
                  }}
                  aria-pressed={eraserSize === opt.value}
                  aria-label={`지우개 ${opt.label}`}
                  className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition disabled:opacity-40 ${
                    eraserSize === opt.value ? 'bg-sky-400' : 'border-2 border-sky-100 bg-white hover:bg-sky-50'
                  }`}
                >
                  <span
                    className={`rounded-full ${eraserSize === opt.value ? 'bg-white' : 'bg-stone-300'}`}
                    style={{ width: opt.dot, height: opt.dot }}
                  />
                </button>
              ))}
            </div>

            {/* 획 / 영역 지우개 */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setEraserMode('stroke');
                onToolChange('eraser');
              }}
              aria-pressed={tool === 'eraser' && eraserMode === 'stroke'}
              aria-label="획 지우개"
              className={`rounded-full px-2.5 py-2 text-xs font-extrabold shadow-sm transition disabled:opacity-40 ${
                tool === 'eraser' && eraserMode === 'stroke'
                  ? 'bg-sky-400 text-white'
                  : 'border-2 border-sky-100 bg-white text-sky-600 hover:bg-sky-50'
              }`}
            >
              획
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setEraserMode('area');
                onToolChange('eraser');
              }}
              aria-pressed={tool === 'eraser' && eraserMode === 'area'}
              aria-label="영역 지우개"
              className={`rounded-full px-2.5 py-2 text-xs font-extrabold shadow-sm transition disabled:opacity-40 ${
                tool === 'eraser' && eraserMode === 'area'
                  ? 'bg-sky-400 text-white'
                  : 'border-2 border-sky-100 bg-white text-sky-600 hover:bg-sky-50'
              }`}
            >
              영역
            </button>

            {/* 되돌리기 */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => ref?.current?.undo?.()}
              aria-label="방금 쓴 것 되돌리기"
              className="rounded-full border-2 border-amber-100 bg-white px-2.5 py-2 text-base shadow-sm transition hover:bg-amber-50 disabled:opacity-40"
            >
              ↩️
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default ProblemSolverCanvas;
