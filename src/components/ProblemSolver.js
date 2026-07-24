'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Canvas from './Canvas';
import { toViewableImageUrl } from '@/lib/api';
import { buildHintResultMessage, prepareGeminiHint } from '@/lib/geminiPrompt';

const LAYOUT_MODE_KEY = 'problem-solver-layout-mode';
const PHASE = { SOLVING: 'SOLVING', GRADING: 'GRADING' };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMinSec(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
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

function CelebrationModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="채점 완료"
    >
      <div className="w-full max-w-sm rounded-[2rem] border-4 border-white bg-gradient-to-b from-amber-50 to-rose-50 p-6 text-center shadow-2xl">
        <p className="text-6xl">🎉🐶🦴</p>
        <h2 className="mt-3 text-xl font-extrabold text-stone-700">오늘 채점 끝! 정말 잘했어요!</h2>
        <p className="mt-2 text-sm font-semibold text-stone-500">멍멍이가 오늘도 열심히 도와줬어요 🐾</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-rose-400 py-3 font-extrabold text-white shadow-lg shadow-rose-200 hover:bg-rose-500"
        >
          대시보드로 돌아가기 🏠
        </button>
      </div>
    </div>
  );
}

// queue: 현재 풀이 세션에서 순회할 문제 배열
// queueLabel: 화면 상단에 표시할 현재 세션 이름
// onFinish: 채점(GRADING) 단계에서 마지막 문제까지 채점을 마쳤을 때 호출 (대시보드로 복귀)
//
// 학습은 두 단계(phase)로 진행된다.
// 1) SOLVING: 문제를 차례로 풀며 캔버스 그림을 problem.code를 키로 삼아 savedDrawings에 임시 저장한다.
//    O/X 채점 버튼은 숨기고, 대신 [다음 문제]/[채점 시작하기] 버튼만 노출한다.
// 2) GRADING: 처음 문제로 돌아가 savedDrawings에 저장해둔 손글씨를 읽기 전용 캔버스로 보여주며 O/X로 채점한다.
export default function ProblemSolver({ queue, setQueue, index, setIndex, onGrade, queueLabel, onFinish }) {
  const canvasRef = useRef(null);
  const splitContainerRef = useRef(null);
  const activeKeyRef = useRef(null);
  const activePhaseRef = useRef(PHASE.SOLVING);
  const solveStartRef = useRef(Date.now());
  const savedDrawingsRef = useRef({});
  const solveTimesRef = useRef({});

  const [phase, setPhase] = useState(PHASE.SOLVING);
  const [, forceSavedDrawingsUpdate] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedTimeSec, setElapsedTimeSec] = useState(0);
  const [copyingHint, setCopyingHint] = useState(false);
  const [layoutMode, setLayoutMode] = useState('horizontal');
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const [imageFitMode, setImageFitMode] = useState('contain');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [hasCanvasContent, setHasCanvasContent] = useState(false);

  const problem = queue[index];
  const problemKey = problem?.code ?? null;
  const viewableImageUrl = toViewableImageUrl(problem?.imageUrl);
  const isSolving = phase === PHASE.SOLVING;
  const isLastInQueue = index >= queue.length - 1;

  const setSavedDrawing = (key, dataURL) => {
    if (!key) return;
    savedDrawingsRef.current = { ...savedDrawingsRef.current, [key]: dataURL };
    forceSavedDrawingsUpdate((n) => n + 1);
  };

  const setSolveTime = (key, seconds) => {
    if (!key) return;
    solveTimesRef.current = { ...solveTimesRef.current, [key]: seconds };
  };

  // SOLVING 단계에서만 문제별 풀이 시간을 잰다. GRADING에서는 저장해둔 시간을 그대로 사용한다.
  useEffect(() => {
    if (phase !== PHASE.SOLVING) return undefined;
    solveStartRef.current = Date.now();
    setElapsedTimeSec(0);
    const timerId = window.setInterval(() => {
      setElapsedTimeSec(Math.floor((Date.now() - solveStartRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [problemKey, phase]);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(LAYOUT_MODE_KEY);
    if (savedMode === 'horizontal' || savedMode === 'vertical') {
      setLayoutMode(savedMode);
    }
  }, []);

  // 문제/단계 전환 직전(SOLVING이었을 때만) 캔버스와 풀이 시간을 저장하고,
  // 전환된 문제의 저장된 그림을 복원한다. (GRADING에서는 읽기 전용으로 그대로 복원)
  useLayoutEffect(() => {
    const previousKey = activeKeyRef.current;
    const previousPhase = activePhaseRef.current;
    const wasSolving = previousPhase === PHASE.SOLVING;
    const transitioned = previousKey !== problemKey || previousPhase !== phase;

    if (wasSolving && transitioned && previousKey) {
      const dataURL = canvasRef.current?.getDataURL() ?? null;
      setSavedDrawing(previousKey, dataURL);
      const timeSec = Math.max(1, Math.floor((Date.now() - solveStartRef.current) / 1000));
      setSolveTime(previousKey, timeSec);
    }

    activeKeyRef.current = problemKey;
    activePhaseRef.current = phase;

    const sourceDataURL = problemKey ? savedDrawingsRef.current[problemKey] ?? null : null;
    canvasRef.current?.restore(sourceDataURL);
    setHasCanvasContent(Boolean(sourceDataURL));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemKey, phase]);

  const goToNext = () => {
    if (submitting) return;
    if (isSolving && isLastInQueue) {
      // 오늘 목표량을 다 풀었으니 채점 모드로 전환하고 처음 문제로 되돌아간다.
      setPhase(PHASE.GRADING);
      setIndex(0);
      return;
    }
    if (index + 1 < queue.length) setIndex(index + 1);
  };

  const goToPrev = () => {
    if (submitting || index === 0) return;
    setIndex(index - 1);
  };

  const handleGrade = async (isCorrect) => {
    if (!problem || submitting) return;
    const canvasImage = problemKey ? savedDrawingsRef.current[problemKey] ?? null : null;
    const solveTimeSec = problemKey ? solveTimesRef.current[problemKey] ?? 1 : 1;
    setSubmitting(true);
    try {
      await onGrade(problem, isCorrect, canvasImage, solveTimeSec);
      if (isLastInQueue) {
        setIsCelebrationOpen(true);
      } else {
        setIndex(index + 1);
      }
    } catch (error) {
      alert(error.message || '채점 결과 전송에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetCanvas = () => {
    canvasRef.current?.clear();
    setHasCanvasContent(false);
  };

  // 아이가 원하는 만큼만 풀고 바로 채점 모드로 넘어가고 싶을 때 사용한다.
  // index 0 ~ 현재 index까지, 즉 실제로 풀이한 문제만 추려서 채점 대상 큐로 재설정한다.
  const canStopAndGrade = isSolving && (index > 0 || hasCanvasContent);

  const handleStopAndGrade = () => {
    if (!canStopAndGrade || submitting) return;
    const solvedCount = index + 1;
    const confirmed = window.confirm(`지금까지 푼 ${solvedCount}문제만 바로 채점할까요?`);
    if (!confirmed) return;
    setQueue(queue.slice(0, solvedCount));
    setPhase(PHASE.GRADING);
    setIndex(0);
  };

  const handleHint = async () => {
    if (!problem || copyingHint) return;
    setCopyingHint(true);
    try {
      const result = await prepareGeminiHint([problem]);
      alert(buildHintResultMessage(result));
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    } finally {
      setCopyingHint(false);
    }
  };

  const toggleLayoutMode = () => {
    const nextMode = layoutMode === 'horizontal' ? 'vertical' : 'horizontal';
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
      {!isSolving && (
        <div className="mb-3 rounded-2xl bg-sky-100 px-4 py-3 text-center text-sm font-extrabold text-sky-700">
          💯 채점 시간이에요! 멍멍이와 함께 확인해봐요
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-500">
          {queueLabel && (
            <span className="mr-2 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-500">
              🐾 {queueLabel}
            </span>
          )}
          {index + 1} / {queue.length} · {problem.code}
          {isSolving ? (
            <span className="ml-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-600">
              ⏱️ {formatMinSec(elapsedTimeSec)}
            </span>
          ) : (
            <span className="ml-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">
              ⏱️ 풀이시간 {formatMinSec(solveTimesRef.current[problemKey] ?? 0)}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={toggleLayoutMode}
            className="rounded-full border-2 border-rose-100 bg-white px-4 py-1.5 text-xs font-bold text-rose-500 shadow-sm hover:bg-rose-50"
          >
            {horizontal ? '↔️ 옆으로 보기 (현재)' : '↕️ 위아래로 보기 (현재)'}
          </button>
          {isSolving && (
            <button
              type="button"
              onClick={handleStopAndGrade}
              disabled={!canStopAndGrade || submitting}
              className="rounded-full border-2 border-orange-200 bg-white px-4 py-1.5 text-xs font-bold text-orange-600 shadow-sm hover:bg-orange-50 disabled:opacity-40"
            >
              🛑 여기까지만 풀고 채점하기
            </button>
          )}
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
            disabled={(!isSolving && index >= queue.length - 1) || submitting}
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
            <Canvas
              ref={canvasRef}
              disabled={!isSolving || isDraggingSplitter || submitting}
              onDrawEnd={setHasCanvasContent}
            />
            {isSolving && (
              <button
                type="button"
                onClick={handleResetCanvas}
                disabled={submitting}
                className="absolute right-2 top-2 rounded-full border-2 border-rose-100 bg-white/90 px-3 py-1.5 text-xs font-bold text-stone-500 shadow-sm hover:bg-rose-50 disabled:opacity-40"
              >
                🗑️ 다시 풀기 (초기화)
              </button>
            )}
          </div>
          <div className="min-h-24 shrink-0">
            {isSolving ? (
              <button
                type="button"
                onClick={goToNext}
                disabled={submitting}
                className="h-full w-full rounded-3xl bg-gradient-to-r from-rose-400 to-amber-400 px-2 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:from-rose-500 hover:to-amber-500 disabled:cursor-wait disabled:opacity-60 md:text-2xl"
              >
                {isLastInQueue ? '🎉 다 풀었어요! 채점 시작하기' : '다음 문제 ➡️'}
              </button>
            ) : (
              <div className="grid h-full grid-cols-2 gap-3">
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
            )}
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

      {isCelebrationOpen && (
        <CelebrationModal
          onClose={() => {
            setIsCelebrationOpen(false);
            onFinish?.();
          }}
        />
      )}
    </div>
  );
}
