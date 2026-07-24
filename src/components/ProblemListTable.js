'use client';

import { useState } from 'react';
import { isSolved } from '@/lib/problemUtils';
import ProblemDetailModal from './ProblemDetailModal';
import ProblemHistoryModal from './ProblemHistoryModal';
import CharacterMascot from './CharacterMascot';

function StatusBadge({ problem }) {
  if (!isSolved(problem)) {
    return (
      <span className="inline-block rounded-full bg-lime-50 px-3 py-1 text-xs font-bold text-lime-700">
        풀어볼까? 🐾
      </span>
    );
  }
  if (problem.isCorrect === 'O') {
    return (
      <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
        참 잘했어요! 🐶💖
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-orange-700">
      뼈다귀 다시 찾기! 🦴✨
    </span>
  );
}

// 복습 횟수 뱃지: 클릭하면 해당 문제의 날짜별 풀이 기록(historyLogs) 모달이 열린다.
function ReviewCountBadge({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="cursor-pointer rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-600 transition hover:bg-sky-100 hover:shadow-sm"
    >
      {count > 0 ? `${count}회 풀음 🐾` : '0회'}
    </button>
  );
}

// 전체 현황판 / 오답노트 / 망각곡선 복습 탭에서 공용으로 쓰는 문제 목록 테이블.
// selectable이 true일 때만 체크박스 열이 표시된다 (오늘의 학습 목표 선택용).
export default function ProblemListTable({
  problems,
  onSolve,
  selectable = false,
  selectedRows,
  onToggleRow,
  onToggleAll,
  emptyMessage = '표시할 문제가 없습니다.',
}) {
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [historyProblem, setHistoryProblem] = useState(null);

  if (problems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <CharacterMascot name="penguin" height={70} animate="wiggle" />
        <p className="text-center text-amber-500">🐾 {emptyMessage}</p>
      </div>
    );
  }

  const allSelected = selectable && problems.length > 0 && problems.every((p) => selectedRows.has(p.rowNumber));

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
            <th className="w-16 px-4 py-3">번호</th>
            <th className="px-4 py-3">문제 파일명</th>
            <th className="w-36 px-4 py-3">상태</th>
            <th className="w-28 px-4 py-3">복습 횟수</th>
            <th className="w-24 px-4 py-3">액션</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((p, index) => (
            <tr
              key={p.rowNumber ?? index}
              tabIndex={0}
              onClick={() => setSelectedProblem(p)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedProblem(p);
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
                    aria-label={`${p.code} 선택`}
                    className="h-4 w-4 accent-rose-400"
                  />
                </td>
              )}
              <td className="px-4 py-2 text-amber-400">{index + 1}</td>
              <td className="px-4 py-2 font-medium text-stone-600">
                <span className="underline decoration-amber-200 decoration-2 underline-offset-4">{p.code}</span>
              </td>
              <td className="px-4 py-2">
                <StatusBadge problem={p} />
              </td>
              <td className="px-4 py-2">
                <ReviewCountBadge
                  count={Number(p.reviewCount) || (Array.isArray(p.historyLogs) ? p.historyLogs.length : 0)}
                  onClick={() => setHistoryProblem(p)}
                />
              </td>
              <td className="px-4 py-2">
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
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      {selectedProblem && (
        <ProblemDetailModal problem={selectedProblem} onClose={() => setSelectedProblem(null)} />
      )}
      {historyProblem && (
        <ProblemHistoryModal problem={historyProblem} onClose={() => setHistoryProblem(null)} />
      )}
    </>
  );
}
