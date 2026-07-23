'use client';

import { useEffect, useState } from 'react';
import ProblemListTable from './ProblemListTable';
import { getDueRowNumbers } from '@/lib/reviewSchedule';

// 구글 시트에는 마지막 풀이 시각이 없으므로, 이 기기(localStorage)에 기록된 복습 주기를 기준으로
// 복습이 필요한 문제를 계산한다. 복습 기록이 없는 기존 풀이 문제는 즉시 복습 대상으로 취급한다.
export default function ReviewMode({ problems, onSolve, onStartReview }) {
  const [dueRowNumbers, setDueRowNumbers] = useState(null);

  useEffect(() => {
    setDueRowNumbers(getDueRowNumbers(problems));
  }, [problems]);

  if (dueRowNumbers === null) {
    return <p className="py-16 text-center text-amber-500">🐾 복습 대상을 킁킁 찾는 중...</p>;
  }

  const dueSet = new Set(dueRowNumbers);
  const dueProblems = problems.filter((p) => dueSet.has(p.rowNumber));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-lg shadow-amber-100/60">
        <div className="text-center">
          <p className="mb-1 text-xs font-semibold text-amber-500">🔄 복습이 필요한 문제</p>
          <p className="text-2xl font-extrabold text-rose-500">{dueProblems.length}</p>
        </div>
        <button
          type="button"
          onClick={() => onStartReview(dueProblems)}
          disabled={dueProblems.length === 0}
          className="ml-auto rounded-full bg-rose-400 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🔄 지금 복습 시작하기 ({dueProblems.length}개)
        </button>
      </div>

      <ProblemListTable
        problems={dueProblems}
        onSolve={(rowNumber) => onSolve(rowNumber, dueProblems)}
        emptyMessage="지금 복습할 문제가 없습니다. 문제를 더 풀면 이곳에 복습 목록이 쌓여요! 🐶"
      />
    </div>
  );
}
