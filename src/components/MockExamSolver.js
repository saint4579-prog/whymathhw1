'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ProblemSolverCanvas from './ProblemSolverCanvas';
import ImageLightbox from './ImageLightbox';
import { toViewableImageUrl } from '@/lib/api';
import { buildHintResultMessage, prepareGeminiHint } from '@/lib/geminiPrompt';

const PHASE = { SOLVING: 'SOLVING', GRADING: 'GRADING' };

function formatMinSec(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// 해설 이미지를 힌트 단계에 따라 위에서부터 조금씩만 보여준다.
// hintLevel: 0=숨김, 1=첫 줄만(약 14%), 2=세로 절반(50%), 3=전체 보기
function RevealableExplanation({ src, hintLevel, alt }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [naturalRatio, setNaturalRatio] = useState(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    setContainerWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!src) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-sky-400">
        😢 이 문제는 저장된 해설 이미지가 없어요.
      </p>
    );
  }

  const fullHeight = naturalRatio && containerWidth ? containerWidth * naturalRatio : null;
  const revealRatio = hintLevel === 0 ? 0 : hintLevel === 1 ? 0.14 : hintLevel === 2 ? 0.5 : 1;
  const visibleHeight = fullHeight != null ? Math.max(0, fullHeight * revealRatio) : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-sky-200 bg-white transition-[height] duration-300 ease-out"
      style={{ height: hintLevel === 0 ? 56 : Math.max(56, visibleHeight) }}
    >
      {hintLevel === 0 ? (
        <p className="flex h-full items-center justify-center px-2 text-center text-sm font-semibold text-sky-400">
          🔒 힌트를 요청하면 해설이 조금씩 보여요
        </p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={(event) => setNaturalRatio(event.target.naturalHeight / event.target.naturalWidth)}
          className="absolute left-0 top-0 w-full"
          style={fullHeight ? { height: fullHeight } : undefined}
        />
      )}
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
        <h2 className="mt-3 text-xl font-extrabold text-stone-700">모의고사 채점 끝! 정말 잘했어요!</h2>
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

// [영재원 대비_모의고사] 전용 풀이/채점 화면.
// queue의 각 항목은 { rowNumber, number, code, questionImageUrl, answerImageUrl, explanationImageUrl, ... } 형태다.
//
// 1) SOLVING: 문제 이미지 + 캔버스로 손으로 풀어본다. (일반 문제풀이와 동일한 흐름)
// 2) GRADING: 문제/내가 쓴 풀이(읽기 전용)를 위에, 정답/해설을 아래에 나눠 보여준다.
//    해설은 기본적으로 가려져 있고, 1차/2차 힌트 버튼으로 첫 줄 → 절반까지만 점점 보여준다.
export default function MockExamSolver({ queue, setQueue, index, setIndex, onGrade, queueLabel, onFinish }) {
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
  // 문제코드 -> 아이가 타이핑한 답. 풀이 단계에서 모아 두고 채점 단계에서 보여 준다.
  const [typedAnswers, setTypedAnswers] = useState({});
  const setTypedAnswer = (key, value) => {
    if (!key) return;
    setTypedAnswers((prev) => ({ ...prev, [key]: value }));
  };
  const [hintLevel, setHintLevel] = useState(0);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [imageFitMode, setImageFitMode] = useState('contain');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [copyingHint, setCopyingHint] = useState(false);
  const [penColor, setPenColor] = useState('#1e293b');
  const [penTool, setPenTool] = useState('pen');

  const problem = queue[index];
  const problemKey = problem?.code ?? null;
  const isSolving = phase === PHASE.SOLVING;
  const isLastInQueue = index >= queue.length - 1;

  // 채점 화면에서 읽기 전용으로 보여줄, 아이가 쓴 풀이(저장된 캔버스 PNG dataURL).
  const myDrawing = problemKey ? savedDrawingsRef.current[problemKey] ?? null : null;
  const questionImageUrl = toViewableImageUrl(problem?.questionImageUrl);
  const answerImageUrl = toViewableImageUrl(problem?.answerImageUrl);
  const explanationImageUrl = problem?.explanationImageUrl
    ? toViewableImageUrl(problem.explanationImageUrl)
    : null;

  const setSavedDrawing = (key, dataURL) => {
    if (!key) return;
    savedDrawingsRef.current = { ...savedDrawingsRef.current, [key]: dataURL };
    forceSavedDrawingsUpdate((n) => n + 1);
  };

  const setSolveTime = (key, seconds) => {
    if (!key) return;
    solveTimesRef.current = { ...solveTimesRef.current, [key]: seconds };
  };

  useEffect(() => {
    if (phase !== PHASE.SOLVING) return undefined;
    solveStartRef.current = Date.now();
    setElapsedTimeSec(0);
    const timerId = window.setInterval(() => {
      setElapsedTimeSec(Math.floor((Date.now() - solveStartRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [problemKey, phase]);

  // SOLVING 화면과 GRADING 화면은 서로 다른 <Canvas> 요소를 쓴다.
  // 그래서 SOLVING→GRADING 전환 시점에 캔버스를 저장하려 하면, 이미 새로 마운트된
  // (빈) GRADING 캔버스를 읽어 방금 쓴 풀이를 덮어써 버린다.
  // → 저장/복원은 "풀이 중 다른 문제로 넘어갈 때(SOLVING→SOLVING)"에만 한다.
  //   SOLVING→GRADING 전환 시의 저장은 enterGrading에서 이미 처리한다.
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

    // 풀이 중일 때만 저장된 그림을 캔버스에 복원한다. (채점 화면은 img로 보여주므로 캔버스를 건드리지 않는다.)
    if (phase === PHASE.SOLVING) {
      const sourceDataURL = problemKey ? savedDrawingsRef.current[problemKey] ?? null : null;
      canvasRef.current?.restore(sourceDataURL);
      setHasCanvasContent(Boolean(sourceDataURL));
    }
    setHintLevel(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemKey, phase]);

  // 채점 모드로 전환하되, 실제로 손글씨를 쓴(푼) 문제만 채점 대상으로 남긴다.
  // (4번만 풀고 채점을 눌러도 빈 캔버스인 1~3번은 제외된다.)
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

  // 모의고사 문제는 imageUrl 대신 questionImageUrl을 쓰므로, 힌트 헬퍼가 기대하는 형태로 맞춰 전달한다.
  const handleHint = async () => {
    if (!problem || copyingHint) return;
    setCopyingHint(true);
    try {
      const result = await prepareGeminiHint([
        { code: `모의고사_${problem.number}.png`, imageUrl: problem.questionImageUrl },
      ]);
      alert(buildHintResultMessage(result));
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    } finally {
      setCopyingHint(false);
    }
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

  if (!problem) {
    return (
      <p className="py-20 text-center text-amber-500">
        🐶 풀이할 모의고사 문제가 없어요. 전체 현황판에서 [출발! 🐾] 버튼으로 문제를 선택해주세요.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {!isSolving && (
        <div className="mb-3 rounded-2xl bg-sky-100 px-4 py-3 text-center text-sm font-extrabold text-sky-700">
          💯 채점 시간이에요! 정답과 해설을 보고 스스로 채점해봐요
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-500">
          {queueLabel && (
            <span className="mr-2 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-500">
              🐾 {queueLabel}
            </span>
          )}
          {index + 1} / {queue.length} · 모의고사 {problem.number}번
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
                disabled={!questionImageUrl}
                className="rounded-full border-2 border-rose-200 bg-white px-4 py-1.5 text-xs font-bold text-rose-500 shadow-sm hover:bg-rose-50 disabled:opacity-40"
              >
                🔍 크게 보기
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={copyingHint || !questionImageUrl}
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
        <div className="flex h-[calc(100vh-140px)] flex-col gap-3">
          <div className="relative min-h-0 flex-1">
            <ProblemSolverCanvas
              ref={canvasRef}
              bgImage={questionImageUrl}
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
          {/* 문제 + 내가 쓴 풀이(읽기 전용) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="flex min-h-[240px] items-center justify-center overflow-auto rounded-3xl border-4 border-dashed border-amber-200 bg-amber-50/40 p-3 shadow-lg shadow-amber-100/60">
              {questionImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={questionImageUrl}
                  alt={`모의고사 ${problem.number}번 문제`}
                  className="max-h-[38vh] max-w-full rounded-2xl border-4 border-white object-contain shadow-md"
                />
              ) : (
                <p className="text-amber-400">문제 이미지가 없습니다.</p>
              )}
            </section>
            <section className="relative flex min-h-[240px] items-center justify-center overflow-auto rounded-3xl border-4 border-dashed border-rose-200 bg-white p-2">
              {myDrawing ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={myDrawing}
                  alt="내가 쓴 풀이"
                  className="max-h-[38vh] max-w-full object-contain"
                />
              ) : (
                <p className="text-sm font-semibold text-stone-400">✏️ 쓴 풀이가 없어요</p>
              )}
              <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-stone-500 shadow-sm">
                ✏️ 내가 쓴 풀이
              </span>
            </section>
          </div>

          {/* 아이가 타이핑으로 낸 답. 모의고사는 정답이 이미지라 자동채점은 하지 않고 보여만 준다. */}
          <TypedAnswerVerdict
            typed={typedAnswers[problemKey] ?? ''}
            correctAnswer={problem?.answer ?? ''}
          />

          {/* 정답 + 해설(힌트로 단계적 공개) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border-4 border-dashed border-rose-200 bg-rose-50/40 p-3 shadow-lg shadow-rose-100/60">
              <h3 className="mb-2 text-center text-sm font-extrabold text-rose-500">✅ 정답</h3>
              <div className="flex min-h-[200px] items-center justify-center overflow-auto rounded-2xl bg-white p-2">
                {answerImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={answerImageUrl}
                    alt={`모의고사 ${problem.number}번 정답`}
                    className="max-h-[40vh] max-w-full object-contain"
                  />
                ) : (
                  <p className="py-10 text-center text-sm font-semibold text-rose-300">
                    저장된 정답 이미지가 없어요 😢
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border-4 border-dashed border-sky-200 bg-sky-50/40 p-3 shadow-lg shadow-sky-100/60">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-sky-600">📖 해설</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setHintLevel((lv) => Math.max(lv, 1))}
                    disabled={!explanationImageUrl}
                    className="rounded-full bg-sky-400 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-500 disabled:opacity-40"
                  >
                    💡 1차 힌트 (첫 줄)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHintLevel((lv) => Math.max(lv, 2))}
                    disabled={!explanationImageUrl}
                    className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-600 disabled:opacity-40"
                  >
                    💡💡 2차 힌트 (절반)
                  </button>
                  <button
                    type="button"
                    onClick={() => setHintLevel(3)}
                    disabled={!explanationImageUrl}
                    className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-40"
                  >
                    🔓 전체 보기
                  </button>
                </div>
              </div>
              <RevealableExplanation
                src={explanationImageUrl}
                hintLevel={hintLevel}
                alt={`모의고사 ${problem.number}번 해설`}
              />
            </section>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleGrade('O')}
              disabled={submitting}
              className="rounded-3xl bg-rose-400 px-2 py-6 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60 md:text-2xl"
            >
              {submitting ? '🐾 멍멍이가 기록 중이에요...' : '최고예요! 🐶 (O)'}
            </button>
            <button
              type="button"
              onClick={() => handleGrade('X')}
              disabled={submitting}
              className="rounded-3xl bg-orange-400 px-2 py-6 text-lg font-extrabold text-white shadow-lg shadow-amber-200 hover:bg-orange-500 disabled:cursor-wait disabled:opacity-60 md:text-2xl"
            >
              {submitting ? '🐾 멍멍이가 기록 중이에요...' : '다시 도전! 🦴 (X)'}
            </button>
          </div>
        </div>
      )}

      {isLightboxOpen && questionImageUrl && (
        <ImageLightbox
          imageUrl={questionImageUrl}
          alt={`모의고사 ${problem.number}번 문제`}
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
