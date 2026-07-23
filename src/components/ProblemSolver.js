'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Canvas from './Canvas';
import { toViewableImageUrl } from '@/lib/api';
import { copyHintPrompt } from '@/lib/geminiPrompt';

const DRAFT_PREFIX = 'problem-canvas-draft:';
const LAYOUT_MODE_KEY = 'problem-solver-layout-mode';
const inMemoryDrafts = new Map();

function getProblemKey(problem) {
  const id = problem?.rowNumber ?? problem?.code;
  return id == null ? null : String(id);
}

function readDraft(key) {
  if (!key) return null;
  const memoryDraft = inMemoryDrafts.get(key);
  if (memoryDraft) return memoryDraft;
  try {
    const storedDraft = window.sessionStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (storedDraft) inMemoryDrafts.set(key, storedDraft);
    return storedDraft;
  } catch {
    return null;
  }
}

function writeDraft(key, dataURL) {
  if (!key) return;
  if (!dataURL) {
    removeDraft(key);
    return;
  }
  inMemoryDrafts.set(key, dataURL);
  try {
    window.sessionStorage.setItem(`${DRAFT_PREFIX}${key}`, dataURL);
  } catch {
    // sessionStorage 용량을 넘겨도 현재 탭에서는 메모리 사본으로 계속 보존한다.
  }
}

function removeDraft(key) {
  if (!key) return;
  inMemoryDrafts.delete(key);
  try {
    window.sessionStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch {
    // 저장소 접근이 막힌 브라우저에서도 메모리 사본 삭제는 이미 완료되었다.
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function ImageLightbox({ imageUrl, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const changeScale = (delta) => {
    setScale((current) => clamp(current + delta, 0.5, 5));
  };

  const startGesture = () => {
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      const [first, second] = points;
      gestureRef.current = {
        type: 'pinch',
        distance: Math.hypot(second.x - first.x, second.y - first.y) || 1,
        midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        scale,
        offset,
      };
    } else if (points.length === 1) {
      gestureRef.current = { type: 'drag', point: points[0], offset };
    }
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const gesture = gestureRef.current;

    if (points.length >= 2 && gesture?.type === 'pinch') {
      const [first, second] = points;
      const distance = Math.hypot(second.x - first.x, second.y - first.y) || 1;
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      setScale(clamp(gesture.scale * (distance / gesture.distance), 0.5, 5));
      setOffset({
        x: gesture.offset.x + midpoint.x - gesture.midpoint.x,
        y: gesture.offset.y + midpoint.y - gesture.midpoint.y,
      });
    } else if (points.length === 1 && gesture?.type === 'drag') {
      setOffset({
        x: gesture.offset.x + points[0].x - gesture.point.x,
        y: gesture.offset.y + points[0].y - gesture.point.y,
      });
    }
  };

  const handlePointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    startGesture();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-stone-900/90 p-3 backdrop-blur-sm md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} 크게 보기`}
    >
      <div className="z-10 mb-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => changeScale(0.25)}
          className="rounded-full border-2 border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-500 shadow-lg hover:bg-rose-50"
        >
          ＋ 확대
        </button>
        <button
          type="button"
          onClick={() => changeScale(-0.25)}
          className="rounded-full border-2 border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-600 shadow-lg hover:bg-amber-50"
        >
          － 축소
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="rounded-full border-2 border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-600 shadow-lg hover:bg-sky-50"
        >
          🐾 원본 크기
        </button>
        <span className="rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-stone-500">
          {Math.round(scale * 100)}%
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-rose-500 md:right-5 md:top-5"
      >
        닫기 ✕
      </button>
      <div
        className="relative flex min-h-0 flex-1 cursor-grab touch-none select-none items-center justify-center overflow-hidden rounded-3xl border-4 border-dashed border-amber-200/70 bg-amber-50/10 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          draggable={false}
          className="pointer-events-none max-h-[82vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transformOrigin: 'center',
          }}
        />
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-white/70">
        두 손가락으로 확대·축소하고, 끌어서 원하는 곳을 살펴보세요.
      </p>
    </div>
  );
}

// queue: 현재 풀이 세션에서 순회할 문제 배열
// queueLabel: 화면 상단에 표시할 현재 세션 이름
export default function ProblemSolver({ queue, index, setIndex, onGrade, queueLabel }) {
  const canvasRef = useRef(null);
  const splitContainerRef = useRef(null);
  const activeDraftKeyRef = useRef(null);
  const timerStartedAtRef = useRef(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [elapsedTimeSec, setElapsedTimeSec] = useState(0);
  const [copyingHint, setCopyingHint] = useState(false);
  const [layoutMode, setLayoutMode] = useState('horizontal');
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const [imageFitMode, setImageFitMode] = useState('contain');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const problem = queue[index];
  const problemKey = getProblemKey(problem);
  const viewableImageUrl = toViewableImageUrl(problem?.imageUrl);

  useEffect(() => {
    timerStartedAtRef.current = Date.now();
    setElapsedTimeSec(0);
    const timerId = window.setInterval(() => {
      setElapsedTimeSec(Math.floor((Date.now() - timerStartedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [problemKey]);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(LAYOUT_MODE_KEY);
    if (savedMode === 'horizontal' || savedMode === 'vertical') {
      setLayoutMode(savedMode);
    }
  }, []);

  const saveCanvasForKey = useCallback((key) => {
    if (!key) return;
    writeDraft(key, canvasRef.current?.getDataURL() ?? null);
  }, []);

  // 문제 전환 직전의 그림을 저장하고, 전환된 문제의 그림을 첫 페인트 전에 복원한다.
  useLayoutEffect(() => {
    const previousKey = activeDraftKeyRef.current;
    if (previousKey && previousKey !== problemKey) saveCanvasForKey(previousKey);
    activeDraftKeyRef.current = problemKey;
    canvasRef.current?.restore(readDraft(problemKey));
  }, [problemKey, saveCanvasForKey]);

  useEffect(
    () => () => {
      saveCanvasForKey(activeDraftKeyRef.current);
    },
    [saveCanvasForKey]
  );

  const navigateTo = (nextIndex) => {
    if (submitting || nextIndex === index || nextIndex < 0 || nextIndex >= queue.length) return;
    saveCanvasForKey(problemKey);
    setIndex(nextIndex);
  };

  const goToNext = () => navigateTo(index + 1);
  const goToPrev = () => navigateTo(index - 1);

  const handleGrade = async (isCorrect) => {
    if (!problem || submitting) return;
    const canvasDataURL = canvasRef.current?.getDataURL() ?? null;
    const solveTimeSec = Math.max(
      1,
      Math.floor((Date.now() - timerStartedAtRef.current) / 1000)
    );
    setSubmitting(true);
    try {
      await onGrade(problem, isCorrect, canvasDataURL, solveTimeSec);
      canvasRef.current?.clear();
      removeDraft(problemKey);
      if (index + 1 < queue.length) setIndex(index + 1);
    } catch (error) {
      writeDraft(problemKey, canvasDataURL);
      alert(error.message || '채점 결과 전송에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    canvasRef.current?.clear();
    removeDraft(problemKey);
  };

  const handleHint = async () => {
    if (!problem || copyingHint) return;
    setCopyingHint(true);
    try {
      await copyHintPrompt([problem]);
      alert('🐾 멍멍이가 가져온 제미나이 힌트 프롬프트가 복사되었어요! 🦴');
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    } finally {
      setCopyingHint(false);
    }
  };

  const toggleLayoutMode = () => {
    const nextMode = layoutMode === 'horizontal' ? 'vertical' : 'horizontal';
    saveCanvasForKey(problemKey);
    setLayoutMode(nextMode);
    window.localStorage.setItem(LAYOUT_MODE_KEY, nextMode);
    window.requestAnimationFrame(() => canvasRef.current?.resize());
  };

  const handleSplitterPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDraggingSplitter(true);
  };

  const handleSplitterPointerMove = (event) => {
    if (!isDraggingSplitter || !splitContainerRef.current) return;
    event.preventDefault();
    const rect = splitContainerRef.current.getBoundingClientRect();
    setSplitRatio(clamp(((event.clientX - rect.left) / rect.width) * 100, 20, 80));
  };

  const finishSplitterDrag = (event) => {
    if (!isDraggingSplitter) return;
    event.preventDefault();
    setIsDraggingSplitter(false);
    window.requestAnimationFrame(() => canvasRef.current?.resize());
  };

  if (!problem) {
    return (
      <p className="py-20 text-center text-amber-500">
        🐶 풀이할 문제가 없어요. 다른 탭에서 [출발! 🐾] 버튼으로 문제를 선택해주세요.
      </p>
    );
  }

  const horizontal = layoutMode === 'horizontal';
  const problemPanelStyle = horizontal ? { '--split-ratio': `${splitRatio}%` } : undefined;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-500">
          {queueLabel && (
            <span className="mr-2 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-500">
              🐾 {queueLabel}
            </span>
          )}
          {index + 1} / {queue.length} · {problem.code}
          <span className="ml-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-600">
            ⏱️ {String(Math.floor(elapsedTimeSec / 60)).padStart(2, '0')}:
            {String(elapsedTimeSec % 60).padStart(2, '0')}
          </span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={toggleLayoutMode}
            className="rounded-full border-2 border-rose-100 bg-white px-4 py-1.5 text-xs font-bold text-rose-500 shadow-sm hover:bg-rose-50"
          >
            {horizontal ? '↔️ 옆으로 보기 (현재)' : '↕️ 위아래로 보기 (현재)'}
          </button>
          <button
            type="button"
            onClick={goToPrev}
            disabled={index === 0 || submitting}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-600 shadow-sm disabled:opacity-40"
          >
            ⬅ 이전
          </button>
          <button
            type="button"
            onClick={goToNext}
            disabled={index >= queue.length - 1 || submitting}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-amber-600 shadow-sm disabled:opacity-40"
          >
            다음 ➡
          </button>
        </div>
      </div>

      <div
        ref={splitContainerRef}
        className={
          horizontal
            ? `flex h-[calc(100vh-140px)] flex-col gap-6 lg:flex-row lg:gap-0 ${
                isDraggingSplitter ? 'select-none' : ''
              }`
            : 'flex flex-col gap-4 overflow-y-auto'
        }
      >
        <section
          className={`relative flex min-w-0 flex-col overflow-hidden rounded-3xl border-4 border-dashed border-amber-200 bg-amber-50/40 p-3 shadow-lg shadow-amber-100/60 ${
            horizontal ? 'min-h-[320px] lg:h-full lg:basis-[var(--split-ratio)]' : 'max-h-[35vh]'
          }`}
          style={problemPanelStyle}
        >
          <div className="z-10 mb-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setImageFitMode((mode) => (mode === 'contain' ? 'width' : 'contain'))}
              className="rounded-full border-2 border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-50"
            >
              {imageFitMode === 'contain' ? '📐 전체 보기' : '↔️ 너비 맞춤'}
            </button>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              disabled={!viewableImageUrl}
              className="rounded-full border-2 border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-500 shadow-sm hover:bg-rose-50 disabled:opacity-40"
            >
              🔍 크게 보기
            </button>
            <button
              type="button"
              onClick={handleHint}
              disabled={copyingHint}
              className="rounded-full border-2 border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-500 shadow-sm hover:bg-sky-50 disabled:opacity-50"
            >
              🐶 마법 힌트 💡
            </button>
          </div>
          <span className="pointer-events-none absolute left-3 top-3 select-none text-2xl">🐶</span>
          <div
            className={`min-h-0 flex-1 rounded-2xl ${
              imageFitMode === 'width'
                ? 'overflow-y-auto'
                : 'flex items-center justify-center overflow-hidden'
            }`}
          >
            {viewableImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewableImageUrl}
                alt={problem.code}
                onClick={() => setIsLightboxOpen(true)}
                className={
                  imageFitMode === 'width'
                    ? 'h-auto w-full cursor-zoom-in rounded-2xl border-4 border-white object-contain shadow-md'
                    : `max-w-full cursor-zoom-in rounded-2xl border-4 border-white object-contain shadow-md ${
                        horizontal ? 'max-h-[70vh]' : 'max-h-full'
                      }`
                }
              />
            ) : (
              <p className="py-16 text-center text-amber-400">이미지가 없습니다.</p>
            )}
          </div>
        </section>

        {horizontal && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="문제와 필기 영역 너비 조절"
            aria-valuemin={20}
            aria-valuemax={80}
            aria-valuenow={Math.round(splitRatio)}
            tabIndex={0}
            className={`group hidden w-8 shrink-0 touch-none select-none items-center justify-center self-stretch lg:flex ${
              isDraggingSplitter ? 'cursor-col-resize' : 'cursor-ew-resize'
            }`}
            onPointerDown={handleSplitterPointerDown}
            onPointerMove={handleSplitterPointerMove}
            onPointerUp={finishSplitterDrag}
            onPointerCancel={finishSplitterDrag}
          >
            <div className="flex h-full w-2 items-center justify-center rounded-full bg-amber-200 transition-colors group-hover:bg-rose-300">
              <span className="rounded-full bg-white px-1 py-2 text-sm shadow-md">🐾</span>
            </div>
          </div>
        )}

        <section
          className={`flex min-w-0 flex-1 flex-col gap-3 ${
            horizontal ? 'min-h-[430px] lg:h-full' : 'min-h-[350px]'
          }`}
        >
          <div className="relative min-h-[260px] flex-1">
            <Canvas ref={canvasRef} disabled={isDraggingSplitter || submitting} />
            <button
              type="button"
              onClick={handleClear}
              disabled={submitting}
              className="absolute right-2 top-2 rounded-full border-2 border-rose-100 bg-white/90 px-3 py-1.5 text-xs font-bold text-stone-500 shadow-sm hover:bg-rose-50 disabled:opacity-40"
            >
              🧹 지우개(전체 삭제)
            </button>
          </div>
          <div className="grid min-h-24 shrink-0 grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleGrade('O')}
              disabled={submitting}
              className="rounded-3xl bg-rose-400 px-2 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60 md:text-2xl"
            >
              {submitting ? '🐾 멍멍이가 드라이브에 풀이를 보관 중이에요...' : '최고예요! 🐶 (O)'}
            </button>
            <button
              type="button"
              onClick={() => handleGrade('X')}
              disabled={submitting}
              className="rounded-3xl bg-orange-400 px-2 text-lg font-extrabold text-white shadow-lg shadow-amber-200 hover:bg-orange-500 disabled:cursor-wait disabled:opacity-60 md:text-2xl"
            >
              {submitting ? '🐾 멍멍이가 드라이브에 풀이를 보관 중이에요...' : '다시 도전! 🦴 (X)'}
            </button>
          </div>
        </section>
      </div>

      {isLightboxOpen && viewableImageUrl && (
        <ImageLightbox
          imageUrl={viewableImageUrl}
          alt={problem.code}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
}
