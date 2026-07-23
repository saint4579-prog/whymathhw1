'use client';

import { useState } from 'react';
import ProblemListTable from './ProblemListTable';
import { isSolved, extractPageNumber } from '@/lib/problemUtils';
import { copyHintPrompt } from '@/lib/geminiPrompt';

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-3xl border-2 border-rose-100 bg-white p-4 text-center shadow-lg shadow-amber-100/60">
      <p className="mb-1 text-xs font-semibold text-amber-500">{label}</p>
      <p className="text-2xl font-extrabold text-stone-700">{value}</p>
    </div>
  );
}

export default function Dashboard({
  problems,
  onSolve,
  selectedRows,
  onToggleRow,
  onToggleAll,
  onSetDailyGoal,
  onSelectRange,
  onDeselectRange,
}) {
  const [copying, setCopying] = useState(false);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const total = problems.length;
  const solvedCount = problems.filter(isSolved).length;
  const correctCount = problems.filter((p) => p.isCorrect === 'O').length;
  const selectedCount = selectedRows.size;

  const getRangeRowNumbers = () => {
    const start = parseInt(startPage, 10);
    if (Number.isNaN(start)) return null;
    const endParsed = endPage.trim() === '' ? start : parseInt(endPage, 10);
    const end = Number.isNaN(endParsed) ? start : endParsed;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    return problems
      .filter((p) => {
        const page = extractPageNumber(p.code);
        return page >= lo && page <= hi;
      })
      .map((p) => p.rowNumber);
  };

  const handleApplyRange = () => {
    const rowNumbers = getRangeRowNumbers();
    if (!rowNumbers || rowNumbers.length === 0) return;
    onSelectRange(rowNumbers);
  };

  const handleClearRange = () => {
    const rowNumbers = getRangeRowNumbers();
    if (!rowNumbers || rowNumbers.length === 0) return;
    onDeselectRange(rowNumbers);
  };

  const handleHintForSelected = async () => {
    const selected = problems.filter((p) => selectedRows.has(p.rowNumber));
    if (selected.length === 0 || copying) return;
    setCopying(true);
    try {
      await copyHintPrompt(selected);
      alert('🐾 멍멍이가 가져온 제미나이 힌트 프롬프트가 복사되었어요! 🦴');
    } catch (e) {
      alert('클립보드 복사에 실패했습니다.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 grid grid-cols-3 gap-3">
        <SummaryCard label="전체 문제" value={total} />
        <SummaryCard label="풀이 완료" value={solvedCount} />
        <SummaryCard label="정답 수" value={correctCount} />
      </div>

      <div className="mb-4 rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
        <p className="mb-2 px-1 text-xs font-bold text-amber-600">🐾 쪽수 범위로 콕 찍어 선택하기</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-500">시작 쪽수</span>
            <input
              type="number"
              inputMode="numeric"
              value={startPage}
              onChange={(e) => setStartPage(e.target.value)}
              placeholder="1"
              className="w-20 rounded-full border-2 border-amber-100 px-4 py-2 text-sm text-stone-600 focus:border-rose-300 focus:outline-none"
            />
          </label>
          <span className="text-amber-400">~</span>
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-500">끝 쪽수</span>
            <input
              type="number"
              inputMode="numeric"
              value={endPage}
              onChange={(e) => setEndPage(e.target.value)}
              placeholder="5"
              className="w-20 rounded-full border-2 border-amber-100 px-4 py-2 text-sm text-stone-600 focus:border-rose-300 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleApplyRange}
            className="rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500"
          >
            🐶 선택 적용
          </button>
          <button
            type="button"
            onClick={handleClearRange}
            className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-200"
          >
            해당 범위 해제
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
        <button
          type="button"
          onClick={() => onSetDailyGoal()}
          disabled={selectedCount === 0}
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🎯 오늘의 학습 목표로 설정 ({selectedCount}개)
        </button>
        <button
          type="button"
          onClick={handleHintForSelected}
          disabled={selectedCount === 0 || copying}
          className="rounded-full bg-sky-300 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🐶 멍멍이의 마법 힌트 요청 💡
        </button>
      </div>

      <ProblemListTable
        problems={problems}
        onSolve={onSolve}
        selectable
        selectedRows={selectedRows}
        onToggleRow={onToggleRow}
        onToggleAll={onToggleAll}
      />
    </div>
  );
}
