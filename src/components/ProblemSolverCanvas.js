'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import Canvas, { ERASER_SIZES } from './Canvas';
import { PEN_COLORS } from './CanvasToolbar';

// 지우개 버튼을 이만큼 누르고 있으면 옵션이 열린다.
// 3초는 아이가 기다리기 답답하고, 0.6초로도 실수로 열리는 일은 거의 없다.
const LONG_PRESS_MS = 600;

const ERASER_SIZE_OPTIONS = [
  { key: 'small', label: '얇게', value: ERASER_SIZES.small, dot: 10 },
  { key: 'medium', label: '보통', value: ERASER_SIZES.medium, dot: 16 },
  { key: 'large', label: '굵게', value: ERASER_SIZES.large, dot: 24 },
];

const ERASER_MODE_OPTIONS = [
  { key: 'pixel', label: '문지르기', hint: '지나간 자리만 지워요' },
  { key: 'stroke', label: '획 지우개', hint: '닿은 글씨 한 획이 통째로 지워져요' },
  { key: 'area', label: '영역 지우개', hint: '네모를 그리면 그 안이 다 지워져요' },
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
  },
  ref
) {
  // 지우개 설정. 화면을 옮겨도 유지되도록 이 컴포넌트가 직접 들고 있는다.
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES.medium);
  const [eraserMode, setEraserMode] = useState('pixel');
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimerRef = useRef(null);

  // 길게 누르기 시작 / 취소
  const startPress = () => {
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setMenuOpen(true), LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimerRef.current);

  useEffect(() => () => clearTimeout(pressTimerRef.current), []);

  const activeMode = ERASER_MODE_OPTIONS.find((m) => m.key === eraserMode);

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
            className="absolute bottom-4 left-4 z-30 rounded-full border-2 border-rose-100 bg-white/95 px-4 py-2.5 text-sm font-extrabold text-stone-600 shadow-xl backdrop-blur transition hover:bg-rose-50 disabled:opacity-40"
          >
            🗑️ 다시 풀기
          </button>

          {/* 지금 어떤 지우개인지 알려 주는 표시 */}
          {tool === 'eraser' && eraserMode !== 'pixel' && (
            <span className="absolute bottom-[4.5rem] right-4 z-30 rounded-full bg-sky-400 px-3 py-1 text-xs font-extrabold text-white shadow-lg">
              {activeMode?.label}
            </span>
          )}

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
            {/* 지우개: 짧게 누르면 지우개 선택, 0.6초 이상 누르면 옵션이 열린다. */}
            <div className="relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToolChange('eraser')}
                onPointerDown={startPress}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => {
                  // 길게 누르면 브라우저 기본 메뉴가 뜨는 걸 막는다.
                  e.preventDefault();
                  setMenuOpen(true);
                }}
                aria-pressed={tool === 'eraser'}
                aria-label="지우개 (길게 누르면 옵션)"
                className={`relative rounded-full px-3 py-2 text-base shadow-sm transition disabled:opacity-40 ${
                  tool === 'eraser' ? 'bg-sky-400 text-white' : 'border-2 border-sky-100 bg-white hover:bg-sky-50'
                }`}
              >
                🧽
                {/* 옵션이 있다는 표시 */}
                <span className="absolute bottom-0.5 right-1 text-[9px] leading-none opacity-70">⋯</span>
              </button>

              {menuOpen && (
                <>
                  {/* 바깥을 누르면 닫힌다 */}
                  <button
                    type="button"
                    aria-label="지우개 옵션 닫기"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div className="absolute bottom-full right-0 z-50 mb-3 w-60 rounded-3xl border-2 border-sky-100 bg-white p-4 shadow-2xl">
                    <p className="mb-2 text-xs font-extrabold text-stone-500">🧽 지우개 크기</p>
                    <div className="mb-4 flex gap-2">
                      {ERASER_SIZE_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setEraserSize(opt.value);
                            onToolChange('eraser');
                          }}
                          className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-bold transition ${
                            eraserSize === opt.value
                              ? 'bg-sky-400 text-white'
                              : 'bg-sky-50 text-stone-500 hover:bg-sky-100'
                          }`}
                        >
                          <span
                            className={`rounded-full ${eraserSize === opt.value ? 'bg-white' : 'bg-stone-300'}`}
                            style={{ width: opt.dot, height: opt.dot }}
                          />
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <p className="mb-2 text-xs font-extrabold text-stone-500">✂️ 지우는 방법</p>
                    <div className="space-y-1.5">
                      {ERASER_MODE_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setEraserMode(opt.key);
                            onToolChange('eraser');
                            setMenuOpen(false);
                          }}
                          className={`w-full rounded-2xl px-3 py-2 text-left transition ${
                            eraserMode === opt.key
                              ? 'bg-sky-400 text-white'
                              : 'bg-sky-50 text-stone-600 hover:bg-sky-100'
                          }`}
                        >
                          <span className="block text-sm font-extrabold">{opt.label}</span>
                          <span
                            className={`block text-[11px] font-bold ${
                              eraserMode === opt.key ? 'text-sky-50' : 'text-stone-400'
                            }`}
                          >
                            {opt.hint}
                          </span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        ref?.current?.undo?.();
                        setMenuOpen(false);
                      }}
                      className="mt-3 w-full rounded-2xl bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-700 hover:bg-amber-100"
                    >
                      ↩️ 방금 쓴 것 하나 되돌리기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default ProblemSolverCanvas;
