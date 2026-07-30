'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ProblemSolverCanvas from './ProblemSolverCanvas';
import { useCanvasExpander } from './CanvasExpander';
import TypedAnswerField, { TypedAnswerVerdict } from './TypedAnswerField';
import ImageLightbox from './ImageLightbox';
import { toViewableImageUrl } from '@/lib/api';
import { buildHintResultMessage, prepareGeminiHint } from '@/lib/geminiPrompt';
import CharacterMascot from './CharacterMascot';

const LAYOUT_MODE_KEY = 'problem-solver-layout-mode';
const PHASE = { SOLVING: 'SOLVING', GRADING: 'GRADING' };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMinSec(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
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
        <p className="text-4xl">🎉</p>
        <div className="mt-1 flex items-end justify-center gap-1">
          <CharacterMascot name="frog" height={56} delay={0} />
          <CharacterMascot name="chick" height={64} delay={140} />
          <CharacterMascot name="fox" height={64} delay={280} />
          <CharacterMascot name="penguin" height={56} delay={420} />
        </div>
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
  // 문제코드 -> 아이가 타이핑한 답. 풀이 단계에서 모아 두고 채점 단계에서 보여 준다.
  const [typedAnswers, setTypedAnswers] = useState({});
  const setTypedAnswer = (key, value) => {
    if (!key) return;
    setTypedAnswers((prev) => ({ ...prev, [key]: value }));
  };
  const [penColor, setPenColor] = useState('#1e293b');
  const [penTool, setPenTool] = useState('pen');
  // 캔버스를 아래/오른쪽으로 넓히는 기능. 문제 이미지가 화면을 꽉 채워 쓸 곳이 없을 때 쓴다.
  const expander = useCanvasExpander(canvasRef, 'yi-canvas-expand');

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

  // 채점 모드로 전환한다. 이때 "실제로 손글씨를 쓴(푼)" 문제만 채점 대상으로 남긴다.
  // (예: 4번만 풀고 채점을 눌러도 1~3번은 빈 캔버스이므로 제외된다.)
  // upToIndex가 주어지면 그 인덱스까지만 후보로 본다.
  const enterGrading = (upToIndex = queue.length - 1) => {
    // 현재 보고 있던 문제의 캔버스와 풀이 시간을 먼저 저장해 둔다.
    const curKey = problemKey;
    if (curKey) {
      const dataURL = canvasRef.current?.getDataURL() ?? null;
      setSavedDrawing(curKey, dataURL);
      const timeSec = Math.max(1, Math.floor((Date.now() - solveStartRef.current) / 1000));
      setSolveTime(curKey, timeSec);
    }
    const candidates = queue.slice(0, upToIndex + 1);
    const attempted = candidates.filter((p) => p.code && savedDrawingsRef.current[p.code]);
    const gradingQueue = attempted.length > 0 ? attempted : problem ? [problem] : [];
    setQueue(gradingQueue);
    setPhase(PHASE.GRADING);
    setIndex(0);
  };

  const goToNext = () => {
    if (submitting) return;
    if (isSolving && isLastInQueue) {
      // 오늘 목표량을 다 풀었으니 채점 모드로 전환한다. (푼 문제만 채점)
      enterGrading();
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
      await onGrade(problem, isCorrect, canvasImage, solveTimeSec, typedAnswers[problemKey] ?? '');
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
    const confirmed = window.confirm('지금까지 실제로 푼 문제만 바로 채점할까요?');
    if (!confirmed) return;
    // 현재 인덱스까지 후보로 두고, 그중 손글씨를 쓴 문제만 채점한다.
    enterGrading(index);
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

  return (
    <div className="mx-auto max-w-5xl">
      {!isSolving && (
        <div className="mb-3 rounded-2xl bg-sky-100 px-4 py-3 text-center text-sm font-extrabold text-sky-700">
          💯 채점 시간이에요! 멍멍이와 함께 확인해봐요
        </div>
      )}

      {/* 상단 정보 + 우측 툴바 */}
      <div className="mb-3 flex min-h-[44px] flex-nowrap items-center justify-between gap-2 overflow-x-auto">
        <p className="text-sm font-semibold text-stone-500">
          {queueLabel && (
            <span className="mr-2 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-500">
              🐾 {queueLabel}
            </span>
          )}
          {index + 1} / {queue.length} · {problem.code}
          {isSolving ? (
            <span className="ml-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
              ⏱️ {formatMinSec(elapsedTimeSec)}
            </span>
          ) : (
            <span className="ml-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">
              ⏱️ 풀이시간 {formatMinSec(solveTimesRef.current[problemKey] ?? 0)}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isSolving && (
            <>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                disabled={!viewableImageUrl}
                className="rounded-full border-2 border-rose-200 bg-white px-4 py-1.5 text-xs font-bold text-rose-500 shadow-sm hover:bg-rose-50 disabled:opacity-40"
              >
                🔍 크게 보기
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={copyingHint}
                className="rounded-full border-2 border-sky-200 bg-white px-4 py-1.5 text-xs font-bold text-sky-500 shadow-sm hover:bg-sky-50 disabled:opacity-50"
              >
                🐶 마법 힌트 💡
              </button>
              <button
                type="button"
                onClick={handleStopAndGrade}
                disabled={!canStopAndGrade || submitting}
                className="rounded-full border-2 border-orange-200 bg-white px-4 py-1.5 text-xs font-bold text-orange-600 shadow-sm hover:bg-orange-50 disabled:opacity-40"
              >
                🛑 여기까지만 풀고 채점하기
              </button>
            </>
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

      {/* 단일 통합 캔버스: 두 단계 모두 사용 (풀이=편집, 채점=읽기전용으로 문제 위 내 풀이 확인) */}
      <div className="flex h-[calc(100vh-140px)] flex-col gap-3">
        {isSolving && <div className="shrink-0">{expander.controls}</div>}
        <div {...expander.wrapperProps}>
          <div className="relative" style={expander.innerStyle}>
            <ProblemSolverCanvas
              ref={canvasRef}
              bgImage={viewableImageUrl}
              color={penColor}
              tool={penTool}
              onColorChange={setPenColor}
              onToolChange={setPenTool}
              onReset={handleResetCanvas}
              onDrawEnd={setHasCanvasContent}
              disabled={!isSolving || submitting}
              showTools={isSolving}
              pinTools={expander.expanded}
            />
          </div>
        </div>
        {/* 펜이 말을 안 들을 때를 위한 타이핑 답 입력.
            와이수학 문제집은 시트에 정답 텍스트가 없어 자동채점은 되지 않고,
            채점 단계에서 아이가 적은 답을 다시 보여 주는 역할만 한다. */}
        {isSolving ? (
          <TypedAnswerField
            value={typedAnswers[problemKey] ?? ''}
            onChange={(value) => setTypedAnswer(problemKey, value)}
            disabled={submitting}
          />
        ) : (
          <TypedAnswerVerdict
            typed={typedAnswers[problemKey] ?? ''}
            correctAnswer={problem?.answer ?? ''}
          />
        )}
        <div className="min-h-16 shrink-0">
          {isSolving ? (
            <button
              type="button"
              onClick={goToNext}
              disabled={submitting}
              className="h-16 w-full rounded-3xl bg-gradient-to-r from-rose-400 to-amber-400 px-2 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:from-rose-500 hover:to-amber-500 disabled:cursor-wait disabled:opacity-60 md:text-xl"
            >
              {isLastInQueue ? '🎉 다 풀었어요! 채점 시작하기' : '다음 문제 ➡️'}
            </button>
          ) : (
            <div className="grid h-16 grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleGrade('O')}
                disabled={submitting}
                className="rounded-3xl bg-rose-400 px-2 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60 md:text-xl"
              >
                {submitting ? '🐾 보관 중이에요...' : '최고예요! 🐶 (O)'}
              </button>
              <button
                type="button"
                onClick={() => handleGrade('X')}
                disabled={submitting}
                className="rounded-3xl bg-orange-400 px-2 text-lg font-extrabold text-white shadow-lg shadow-amber-200 hover:bg-orange-500 disabled:cursor-wait disabled:opacity-60 md:text-xl"
              >
                {submitting ? '🐾 보관 중이에요...' : '다시 도전! 🦴 (X)'}
              </button>
            </div>
          )}
        </div>
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
