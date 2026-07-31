'use client';

import { solvedToday } from '@/lib/problemUtils';

function StatusBadge({ isCorrect }) {
  if (isCorrect === 'O') {
    return (
      <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
        참 잘했어요! 🐶💖
      </span>
    );
  }
  if (isCorrect === '△') {
    return (
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
        아깝다! 이해했어 🐥
      </span>
    );
  }
  if (isCorrect === 'X') {
    return (
      <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
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

// 채점 기록(O/△/X) 표시. 실제 정답 텍스트는 절대 노출하지 않고, 과거 채점 결과만 기호로 보여준다.
// 예) OOO(3연속 정답), OXO(맞고 틀리고 맞음), △(이해함), X(한 번 틀림), -(아직 안 풂)
const MARK_COLORS = { O: 'text-rose-500', '△': 'text-amber-500', X: 'text-orange-500' };

function RecordMarks({ logs }) {
  const marks = (Array.isArray(logs) ? logs : [])
    .map((log) => (['O', '△', 'X'].includes(log?.isCorrect) ? log.isCorrect : null))
    .filter(Boolean);

  if (marks.length === 0) {
    return <span className="font-mono text-stone-300">-</span>;
  }

  return (
    <span className="font-mono text-sm font-extrabold tracking-tight">
      {marks.map((mark, i) => (
        <span key={i} className={MARK_COLORS[mark] ?? 'text-stone-400'}>
          {mark}
        </span>
      ))}
    </span>
  );
}

// [황소 중2상 1차단평대비] 문제 목록 테이블.
// 파일명 대신 "개념탐구N _ 유형번호 _개념명" 형태의 직관적인 제목을 보여준다.
export default function HwangsoListTable({
  problems,
  onSolve,
  selectable = false,
  selectedRows,
  onToggleRow,
  onToggleAll,
  emptyMessage = '표시할 문제가 없습니다.',
}) {
  if (problems.length === 0) {
    return <p className="py-16 text-center text-amber-500">🐾 {emptyMessage}</p>;
  }

  const allSelected =
    selectable && problems.length > 0 && problems.every((p) => selectedRows.has(p.rowNumber));

  return (
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
            <th className="px-4 py-3">문항</th>
            <th className="w-28 px-4 py-3">채점 기록</th>
            <th className="px-4 py-3">상태</th>
            <th className="w-24 px-4 py-3">액션</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((p, index) => (
            <tr
              key={p.rowNumber ?? index}
              className="border-t border-rose-50 hover:bg-amber-50/60"
            >
              {selectable && (
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(p.rowNumber)}
                    onChange={() => onToggleRow?.(p.rowNumber)}
                    aria-label={`${p.title} 선택`}
                    className="h-4 w-4 accent-rose-400"
                  />
                </td>
              )}
              <td className="px-4 py-2 font-bold text-stone-600">{index + 1}</td>
              <td className="px-4 py-2 font-semibold text-stone-600">{p.title}</td>
              <td className="px-4 py-2">
                <RecordMarks logs={p.historyLogs} />
              </td>
              <td className="px-4 py-2">
                <StatusBadge isCorrect={p.isCorrect} />
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
                    onClick={() => onSolve(p.rowNumber)}
                    className="rounded-full bg-rose-400 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500"
                  >
                    출발! 🐾
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
