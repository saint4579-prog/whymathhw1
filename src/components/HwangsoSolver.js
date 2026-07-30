'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ProblemSolverCanvas from './ProblemSolverCanvas';
import TypedAnswerField, { TypedAnswerVerdict } from './TypedAnswerField';
import ImageLightbox from './ImageLightbox';
import CharacterMascot from './CharacterMascot';

const LAYOUT_MODE_KEY = 'hwangso-solver-layout-mode';
const PHASE = { SOLVING: 'SOLVING', GRADING: 'GRADING' };

function formatMinSec(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// navigator.clipboard가 막힌 환경(비보안 컨텍스트 등)까지 고려한 복사 헬퍼.
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
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
        </div>
        <h2 className="mt-3 text-xl font-extrabold text-stone-700">단평 대비 끝! 정말 잘했어요!</h2>
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

// [황소 중2상 1차단평대비] 전용 풀이/채점 화면. (모의고사 화면과 동일한 흐름으로 업그레이드)
//
// 1) SOLVING: 문제 이미지 + 캔버스를 좌우/상하로 배치(레이아웃 토글)해 손으로 푼다.
//    문제만 풀고 [여기까지만 풀고 채점하기]로 바로 채점에 들어갈 수 있다.
// 2) GRADING: 실제로 푼(캔버스를 건드린) 문제만 모아, 문제/내 풀이를 위에 나란히 보여주고
//    아래에 CSV의 진짜 정답 텍스트를 크게 띄운 뒤 O / △ / X 로 스스로 채점한다.
export default function HwangsoSolver({ queue, setQueue, index, setIndex, onGrade, queueLabel, onFinish }) {
  const canvasRef = useRef(null);
  const activeKeyRef = useRef(null);
  const activePhaseRef = useRef(PHASE.SOLVING);
  const solveStartRef = useRef(Date.now());
  const savedDrawingsRef = useRef({});
  const solveTimesRef = useRef({});

  const [phase, setPhase] = useState(PHASE.SOLVING);
  const [, forceSavedDrawingsUpdate] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedTimeSec, setElapsedTimeSec] = useState(0);
  const [hasCanvasContent, setHasCanvasContent] = useState(false);
  // 문제코드 → 아이가 타이핑한 답. 풀이 단계에서 모아 두고 채점 단계에서 정답과 맞춰 본다.
  const [typedAnswers, setTypedAnswers] = useState({});
  const setTypedAnswer = (key, value) => {
    if (!key) return;
    setTypedAnswers((prev) => ({ ...prev, [key]: value }));
  };
  const [layoutMode, setLayoutMode] = useState('horizontal');
  const [imageFitMode, setImageFitMode] = useState('contain');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [copyingHint, setCopyingHint] = useState(false);
  const [penColor, setPenColor] = useState('#1e293b');
  const [penTool, setPenTool] = useState('pen');

  const problem = queue[index];
  const problemKey = problem?.code ?? null;
  const imageUrl = problem?.imageUrl ?? null;
  const isSolving = phase === PHASE.SOLVING;
  const isLastInQueue = index >= queue.length - 1;
  const horizontal = layoutMode === 'horizontal';

  // 채점 화면에서 읽기 전용으로 보여줄, 아이가 쓴 풀이(저장된 캔버스 PNG dataURL)
  const myDrawing = problemKey ? savedDrawingsRef.current[problemKey] ?? null : null;

  const setSavedDrawing = (key, dataURL) => {
    if (!key) return;
    savedDrawingsRef.current = { ...savedDrawingsRef.current, [key]: dataURL };
    forceSavedDrawingsUpdate((n) => n + 1);
  };

  const setSolveTime = (key, seconds) => {
    if (!key) return;
    solveTimesRef.current = { ...solveTimesRef.current, [key]: seconds };
  };

  // 저장해 둔 레이아웃(옆으로/위아래로) 불러오기
  useEffect(() => {
    const saved = window.localStorage.getItem(LAYOUT_MODE_KEY);
    if (saved === 'horizontal' || saved === 'vertical') setLayoutMode(saved);
  }, []);

  // SOLVING 단계에서만 문제별 풀이 시간을 잰다.
  useEffect(() => {
    if (phase !== PHASE.SOLVING) return undefined;
    solveStartRef.current = Date.now();
    setElapsedTimeSec(0);
    const timerId = window.setInterval(() => {
      setElapsedTimeSec(Math.floor((Date.now() - solveStartRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [problemKey, phase]);

  // 문제/단계 전환 시: 이전 문제 캔버스 저장(풀이 중이었을 때만) + 새 문제 그림 복원
  useLayoutEffect(() => {
    const previousKey = activeKeyRef.current;
    const previousPhase = activePhaseRef.current;
    const stillSolving = previousPhase === PHASE.SOLVING && phase === PHASE.SOLVING;

    if (stillSolving && previousKey && previousKey !== problemKey) {
      const dataURL = canvasRef.current?.getDataURL() ?? null;
      setSavedDrawing(previousKey, dataURL);
      const timeSec = Math.max(1, Math.floor((Date.now() - solveStartRef.current) / 1000));
      setSolveTime(previousKey, timeSec);
    }

    activeKeyRef.current = problemKey;
    activePhaseRef.current = phase;

    if (phase === PHASE.SOLVING) {
      const sourceDataURL = problemKey ? savedDrawingsRef.current[problemKey] ?? null : null;
      canvasRef.current?.restore(sourceDataURL);
      setHasCanvasContent(Boolean(sourceDataURL));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemKey, phase]);

  const toggleLayout = () => {
    const next = horizontal ? 'vertical' : 'horizontal';
    setLayoutMode(next);
    window.localStorage.setItem(LAYOUT_MODE_KEY, next);
    // 레이아웃이 바뀌면 캔버스 크기가 달라지므로 다시 맞춰 그린다.
    window.requestAnimationFrame(() => canvasRef.current?.resize());
  };

  // 채점 모드로 전환. 실제로 손글씨를 쓴(푼) 문제만 채점 대상으로 남긴다.
  const enterGrading = (upToIndex = queue.length - 1) => {
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
      enterGrading();
      return;
    }
    if (index + 1 < queue.length) setIndex(index + 1);
  };

  const goToPrev = () => {
    if (submitting || index === 0) return;
    setIndex(index - 1);
  };

  const handleResetCanvas = () => {
    canvasRef.current?.clear();
    setHasCanvasContent(false);
  };

  const canStopAndGrade = isSolving && (index > 0 || hasCanvasContent);
  const handleStopAndGrade = () => {
    if (!canStopAndGrade || submitting) return;
    if (!window.confirm('지금까지 실제로 푼 문제만 바로 채점할까요?')) return;
    enterGrading(index);
  };

  // 마법 힌트: 제미나이에 붙여넣을 프롬프트(정답 포함)를 클립보드에 복사한다.
  const handleHint = async () => {
    if (!problem || copyingHint) return;
    setCopyingHint(true);
    try {
      const answerText = problem.answer ? problem.answer : '(정답 미입력)';
      const prompt = `이 문제에 대해 답은 절대 먼저 알려주지 말고, 단계별로 힌트만 제공해 줘. 내가 답을 맞췄을 때만 정답이라고 칭찬해 줘. (참고로 이 문제의 실제 정답은 ${answerText} 야.)`;
      await copyToClipboard(prompt);
      alert('🐶 마법 힌트 프롬프트를 복사했어요!\n제미나이(Gemini)에 붙여넣고 문제 사진을 함께 올려 물어보세요. 🐾');
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    } finally {
      setCopyingHint(false);
    }
  };

  const handleGrade = async (mark) => {
    if (!problem || submitting) return;
    const canvasImage = problemKey ? savedDrawingsRef.current[problemKey] ?? null : null;
    const solveTimeSec = problemKey ? solveTimesRef.current[problemKey] ?? 1 : 1;
    setSubmitting(true);
    try {
      await onGrade(problem, mark, canvasImage, solveTimeSec);
      if (isLastInQueue) {
        setIsCelebrationOpen(true);
      } else {
        setIndex(index + 1);
      }
    } catch (error) {
      alert(error?.message || '채점 결과를 저장하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!problem) {
    return (
      <p className="py-20 text-center text-amber-500">
        🐶 풀이할 문제가 없어요. 현황판에서 [출발! 🐾] 버튼으로 문제를 선택해주세요.
      </p>
    );
  }

  const problemLabel = `${problem.unitLabel ?? ''} ${problem.conceptId ?? ''}${
    problem.numberLabel ? ` ${problem.numberLabel}번` : ''
  }`.trim();

  return (
    <div className="mx-auto max-w-6xl">
      {!isSolving && (
        <div className="mb-3 rounded-2xl bg-sky-100 px-4 py-3 text-center text-sm font-extrabold text-sky-700">
          💯 채점 시간이에요! 정답을 보고 스스로 채점해봐요
        </div>
      )}

      {/* 상단 정보 + 우측 툴바 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-500">
          {queueLabel && (
            <span className="mr-2 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-500">
              🐾 {queueLabel}
            </span>
          )}
          {index + 1} / {queue.length} · {problemLabel}
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
          {isSolving && (
            <>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                disabled={!imageUrl}
                className="rounded-full border-2 border-rose-200 bg-white px-4 py-1.5 text-xs font-bold text-rose-500 shadow-sm hover:bg-rose-50 disabled:opacity-40"
              >
                🔍 크게 보기
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={copyingHint || !imageUrl}
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

      {isSolving ? (
        // 단일 통합 캔버스: 문제 이미지가 배경으로 깔리고 그 위에 바로 풀이를 쓴다.
        <div className="flex h-[calc(100vh-150px)] flex-col gap-3">
          <div className="relative min-h-0 flex-1">
            <ProblemSolverCanvas
              ref={canvasRef}
              bgImage={imageUrl}
              color={penColor}
              tool={penTool}
              onColorChange={setPenColor}
              onToolChange={setPenTool}
              onReset={handleResetCanvas}
              onDrawEnd={setHasCanvasContent}
              disabled={submitting}
            />
          </div>
          {/* 펜이 말을 안 들을 때를 위한 타이핑 답 입력. 채점은 다음 단계에서 한다. */}
          <TypedAnswerField
            value={typedAnswers[problemKey] ?? ''}
            onChange={(value) => setTypedAnswer(problemKey, value)}
            disabled={submitting}
          />
          <button
            type="button"
            onClick={goToNext}
            disabled={submitting}
            className="h-16 w-full shrink-0 rounded-3xl bg-gradient-to-r from-rose-400 to-amber-400 px-2 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:from-rose-500 hover:to-amber-500 disabled:cursor-wait disabled:opacity-60 md:text-xl"
          >
            {isLastInQueue ? '🎉 다 풀었어요! 채점 시작하기' : '다음 문제 ➡️'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 상단 2단: 문제 이미지 + 내가 쓴 풀이 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="relative flex min-h-[240px] items-center justify-center overflow-auto rounded-3xl border-4 border-dashed border-amber-200 bg-amber-50/40 p-3 shadow-lg shadow-amber-100/60">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={problemLabel}
                  className="max-h-[42vh] max-w-full rounded-2xl border-4 border-white object-contain shadow-md"
                />
              ) : (
                <p className="text-amber-400">문제 이미지가 없습니다.</p>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-amber-700 shadow-sm">
                📄 문제
              </span>
            </section>
            <section className="relative flex min-h-[240px] items-center justify-center overflow-auto rounded-3xl border-4 border-dashed border-rose-200 bg-white p-2">
              {myDrawing ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={myDrawing} alt="내가 쓴 풀이" className="max-h-[42vh] max-w-full object-contain" />
              ) : (
                <p className="text-sm font-semibold text-stone-400">✏️ 쓴 풀이가 없어요</p>
              )}
              <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-stone-500 shadow-sm">
                ✏️ 내가 쓴 풀이
              </span>
            </section>
          </div>

          {/* 아이가 타이핑으로 답을 냈다면, 정답 위에 자동채점 결과를 먼저 보여 준다. */}
          <TypedAnswerVerdict
            typed={typedAnswers[problemKey] ?? ''}
            correctAnswer={problem.answer ?? ''}
          />

          {/* 하단 전체: 진짜 정답 텍스트 크게 */}
          <section className="rounded-3xl border-4 border-dashed border-sky-200 bg-sky-50/50 p-6 text-center shadow-lg shadow-sky-100/60">
            <h3 className="mb-2 text-sm font-extrabold text-sky-600">✅ 정답</h3>
            {problem.answer ? (
              <p className="text-4xl font-black text-sky-700 md:text-5xl">{problem.answer}</p>
            ) : (
              <p className="py-4 text-lg font-bold text-sky-300">
                이 문제는 아직 정답이 입력되지 않았어요 😢
              </p>
            )}
          </section>

          {/* 자가 채점 버튼 3개 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleGrade('O')}
              disabled={submitting}
              className="rounded-3xl bg-rose-400 px-2 py-6 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60 md:text-xl"
            >
              {submitting ? '🐾 기록 중...' : '최고예요! 🐶 (O)'}
            </button>
            <button
              type="button"
              onClick={() => handleGrade('△')}
              disabled={submitting}
              className="rounded-3xl bg-amber-400 px-2 py-6 text-lg font-extrabold text-white shadow-lg shadow-amber-200 hover:bg-amber-500 disabled:cursor-wait disabled:opacity-60 md:text-xl"
            >
              {submitting ? '🐾 기록 중...' : '아깝다! 이해했어 🐥 (△)'}
            </button>
            <button
              type="button"
              onClick={() => handleGrade('X')}
              disabled={submitting}
              className="rounded-3xl bg-orange-400 px-2 py-6 text-lg font-extrabold text-white shadow-lg shadow-amber-200 hover:bg-orange-500 disabled:cursor-wait disabled:opacity-60 md:text-xl"
            >
              {submitting ? '🐾 기록 중...' : '다시 도전! 🦴 (X)'}
            </button>
          </div>
        </div>
      )}

      {isLightboxOpen && imageUrl && (
        <ImageLightbox imageUrl={imageUrl} alt={problemLabel} onClose={() => setIsLightboxOpen(false)} />
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
