'use client';

import ProblemListTable from './ProblemListTable';
import { isWrong } from '@/lib/problemUtils';

export default function WrongNotebook({ problems, onSolve }) {
  const wrongProblems = problems.filter(isWrong);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 rounded-3xl border-2 border-rose-100 bg-white p-4 text-center shadow-lg shadow-amber-100/60">
        <p className="mb-1 text-xs font-semibold text-amber-500">🦴 다시 찾아야 할 뼈다귀 수</p>
        <p className="text-2xl font-extrabold text-orange-600">{wrongProblems.length}</p>
      </div>

      <ProblemListTable
        problems={wrongProblems}
        onSolve={onSolve}
        emptyMessage="오답 문제가 없습니다. 아직 틀린 문제가 없어요! 🐶💖"
      />
    </div>
  );
}
