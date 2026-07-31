'use client';

import { solvedToday } from '@/lib/problemUtils';

import { useState } from 'react';
import ProblemHistoryModal from './ProblemHistoryModal';

function StatusBadge({ isCorrect }) {
  if (isCorrect === 'O') {
    return (
      <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
        참 잘했어요! 🐶💖
      </span>
    );
  }
  if (isCorrect === 'X') {
    return (
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-orange-700">
        뼈다귀 다시 찾기! 🦴✨
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-lime-50 px-3 py-1 text-xs font-bold text-lime-700">
      풀어볼까? 🐾
    </span>
  );
}

// [영재원 대비_모의고사] 전용 문제 목록 테이블. 문제/정답/해설 3장이 한 세트인 모의고사 문항을
// 번호순으로 보여준다. reviewCount 뱃지는 기존 ProblemHistoryModal을 그대로 재사용한다.
export default function MockExamListTable({
  problems,
  onSolve,
  selectable = false,
  selectedRows,
  onToggleRow,
  onToggleAll,
  emptyMessage = '표시할 문제가 없습니다.',
}) {
  const [historyProblem, setHistoryProblem] = useState(null);

  if (problems.length === 0) {
    return <p className="py-16 text-center text-amber-500">🐾 {emptyMessage}</p>;
  }

  const allSelected =
    selectable && problems.length > 0 && problems.every((p) => selectedRows.has(p.rowNumber));

  return (
    <>
      <div className="overflow-x-auto rounded-3xl border-2 border-rose-100 bg-white shadow-lg shadow-amber-100/60">
        <table className="min-w-full text-sm">
          <thead className="bg-amber-50 text-left text-amber-700">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleAll?.(problems.map((problem) => problem.rowNumber))}
                    aria-label="전체 선택"
                    className="h-4 w-4 accent-rose-400"
                  />
                </th>
              )}
              <th className="w-20 px-4 py-3">번호</th>
              <th className="px-4 py-3">상태</th>
              <th className="w-28 px-4 py-3">복습 횟수</th>
              <th className="w-24 px-4 py-3">액션</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p, index) => {
            const reviewCount = Number(p.reviewCount) || 0;
            return (
              <tr
                key={p.rowNumber ?? index}
                tabIndex={0}
                onClick={() => setHistoryProblem(p)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setHistoryProblem(p);
                  }
                }}
                className="cursor-pointer border-t border-rose-50 hover:bg-amber-50/60 focus:bg-amber-50/60 focus:outline-none"
              >
                {selectable && (
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(p.rowNumber)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onToggleRow?.(p.rowNumber)}
                      aria-label={`모의고사 ${p.number}번 선택`}
                      className="h-4 w-4 accent-rose-400"
                    />
                  </td>
                )}
                <td className="px-4 py-2 font-bold text-stone-600">{p.number}번</td>
                <td className="px-4 py-2">
                  <StatusBadge isCorrect={p.isCorrect} />
                </td>
                <td className="px-4 py-2">
                  <span className="inline-block rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600">
                    {reviewCount > 0 ? `${reviewCount}회 풀음 🐾` : '0회'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {/* 오늘 푼 문제는 내일까지 잠근다. */}
                  {solvedToday(p) ? (
                    <span
                      title="오늘 푼 문제예요. 내일 다시 풀 수 있어요"
                      className="inline-block cursor-not-allowed rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700"
                    >
                      오늘 완료 · 내일 다시
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSolve(p.rowNumber);
                      }}
                      className="rounded-full bg-rose-400 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500"
                    >
                      출발! 🐾
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
      {historyProblem && (
        <ProblemHistoryModal problem={historyProblem} onClose={() => setHistoryProblem(null)} />
      )}
    </>
  );
}
