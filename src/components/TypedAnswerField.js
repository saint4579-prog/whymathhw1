'use client';

import { useMemo } from 'react';
import { checkAnswer, getJudgeMode } from '@/lib/answerCheck';

// 자주 쓰는 수학 기호. 한글 키보드에서 찾기 번거로운 것만 골랐다.
const SYMBOLS = ['/', ',', '=', '-', '.', 'x', 'y', 'a', 'b'];

/**
 * [풀이 단계] 캔버스 아래에 놓는 타이핑 답 입력창.
 *
 * 애플펜슬이 말을 안 들을 때도 아이가 답을 낼 수 있게 하는 게 목적이다.
 * 여기서는 채점하지 않고 답만 받아 둔다. 실제 채점은 이 화면의 흐름대로
 * '채점 단계'에서 정답과 나란히 놓고 이뤄진다.
 */
export default function TypedAnswerField({ value = '', onChange, disabled = false }) {
  return (
    <div className="shrink-0 rounded-3xl border-2 border-amber-200 bg-white/90 p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-sm font-extrabold text-stone-500">⌨️ 내 답</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          placeholder="펜이 안 되면 여기에 답을 적어도 돼요.  예) 67   4, 5   19/4"
          className="min-w-0 flex-1 rounded-2xl border-2 border-amber-100 bg-white px-4 py-2.5 text-lg font-extrabold text-stone-700 placeholder:text-xs placeholder:font-bold placeholder:text-stone-300 disabled:bg-stone-50"
        />
        <div className="flex shrink-0 flex-wrap gap-1">
          {SYMBOLS.map((sym) => (
            <button
              key={sym}
              type="button"
              disabled={disabled}
              onClick={() => onChange(`${value}${sym}`)}
              className="h-9 w-9 rounded-xl bg-amber-50 text-sm font-extrabold text-stone-500 shadow-sm transition hover:bg-amber-100 disabled:opacity-40"
            >
              {sym}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
            className="h-9 rounded-xl bg-amber-50 px-3 text-xs font-bold text-stone-400 shadow-sm transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
          >
            지우기
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * [채점 단계] 아이가 타이핑한 답과 자동채점 결과를 보여 준다.
 *
 * 정답이 단순하면(auto) 맞았는지 여기서 바로 알려 주고, 아이는 O 버튼만 누르면 된다.
 * 정답이 ①②/(1)(2)처럼 복합이거나 비어 있으면 자동채점을 하지 않고, 아이가 정답을
 * 보고 직접 판단하게 둔다. 애매한 걸 억지로 맞히려다 맞은 답을 틀렸다고 하면
 * 아이가 앱을 믿지 않게 되기 때문이다.
 */
export function TypedAnswerVerdict({ typed = '', correctAnswer = '' }) {
  const mode = useMemo(() => getJudgeMode(correctAnswer), [correctAnswer]);
  const result = useMemo(
    () => (typed.trim() ? checkAnswer(typed, correctAnswer) : null),
    [typed, correctAnswer]
  );

  if (!typed.trim()) return null;

  const isCorrect = result?.verdict === 'correct';
  const isWrong = result?.verdict === 'wrong';

  return (
    <div
      className={`rounded-3xl border-4 border-dashed p-4 text-center shadow-lg ${
        isCorrect
          ? 'border-emerald-300 bg-emerald-50/60 shadow-emerald-100/60'
          : isWrong
            ? 'border-rose-300 bg-rose-50/60 shadow-rose-100/60'
            : 'border-stone-200 bg-stone-50/60'
      }`}
    >
      <h3 className="mb-1 text-sm font-extrabold text-stone-500">⌨️ 내가 타이핑한 답</h3>
      <p className="text-3xl font-black text-stone-700 md:text-4xl">{typed}</p>

      {mode === 'auto' ? (
        <p
          className={`mt-3 inline-block rounded-full px-4 py-2 text-base font-extrabold ${
            isCorrect ? 'bg-emerald-400 text-white' : 'bg-rose-400 text-white'
          }`}
        >
          {isCorrect ? '자동채점: 정답이에요! 🎉' : '자동채점: 아쉬워요 🐾'}
        </p>
      ) : (
        <p className="mt-3 inline-block rounded-full bg-sky-100 px-4 py-2 text-sm font-bold text-sky-700">
          {mode === 'none'
            ? '정답이 등록되지 않아 스스로 채점해요'
            : '정답이 여러 갈래라 스스로 채점해요'}
        </p>
      )}
    </div>
  );
}
