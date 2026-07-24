'use client';

import { useMemo, useState } from 'react';
import ProblemListTable from './ProblemListTable';
import { isSolved, extractPageNumber } from '@/lib/problemUtils';
import { buildHintResultMessage, prepareGeminiHint } from '@/lib/geminiPrompt';
import { CHARACTERS } from '@/lib/characters';
import CharacterMascot from './CharacterMascot';

function SummaryCard({ label, value, character }) {
  const theme = character ? CHARACTERS[character] : null;
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 bg-white p-4 text-center shadow-lg ${
        theme ? `${theme.ring} ${theme.glow}` : 'border-rose-100 shadow-amber-100/60'
      }`}
    >
      {character && (
        <CharacterMascot
          name={character}
          height={46}
          animate="none"
          className="absolute -right-1 -top-1 opacity-90"
        />
      )}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const total = problems.length;
  const solvedCount = problems.filter(isSolved).length;
  const correctCount = problems.filter((p) => p.isCorrect === 'O').length;
  const selectedCount = selectedRows.size;
  const filteredProblems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko');

    return problems.filter((problem) => {
      const solved = isSolved(problem);
      const statusMatches =
        statusFilter === 'all' ||
        (statusFilter === 'unsolved' && !solved) ||
        (statusFilter === 'solved' && solved) ||
        (statusFilter === 'correct' && problem.isCorrect === 'O') ||
        (statusFilter === 'wrong' && problem.isCorrect === 'X');

      if (!statusMatches) return false;
      if (!query) return true;

      const code = String(problem.code || '').toLocaleLowerCase('ko');
      const rowNumber = String(problem.rowNumber || '');
      const pageNumber = String(extractPageNumber(problem.code) || '');
      return code.includes(query) || rowNumber.includes(query) || pageNumber === query;
    });
  }, [problems, searchQuery, statusFilter]);

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
      const result = await prepareGeminiHint(selected);
      alert(buildHintResultMessage(result));
    } catch (e) {
      alert('클립보드 복사에 실패했습니다.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="sticky top-[var(--app-header-height)] z-20 -mx-4 mb-4 space-y-3 bg-gradient-to-b from-amber-50 via-amber-50/95 to-amber-50/80 px-4 pb-3 pt-1 backdrop-blur md:-mx-6 md:px-6">
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="전체 문제" value={total} character="elephant" />
          <SummaryCard label="풀이 완료" value={solvedCount} character="chick" />
          <SummaryCard label="정답 수" value={correctCount} character="fox" />
        </div>

        <div className="rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
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

        <div className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">문제 검색</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">🔎</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="파일명, 문제 번호, 쪽수로 검색"
              className="w-full rounded-full border-2 border-amber-100 py-2 pl-11 pr-4 text-sm text-stone-600 outline-none placeholder:text-stone-300 focus:border-rose-300"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold text-amber-600">
            상태
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-full border-2 border-amber-100 bg-white px-4 py-2 text-sm font-bold text-stone-600 outline-none focus:border-rose-300"
            >
              <option value="all">전체</option>
              <option value="unsolved">미풀이</option>
              <option value="solved">풀이 완료</option>
              <option value="correct">정답 O</option>
              <option value="wrong">오답 X</option>
            </select>
          </label>
          <span className="rounded-full bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500">
            {filteredProblems.length}개 찾았어요
          </span>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-500 hover:bg-stone-200"
            >
              필터 초기화
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
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
      </div>

      <ProblemListTable
        problems={filteredProblems}
        onSolve={onSolve}
        selectable
        selectedRows={selectedRows}
        onToggleRow={onToggleRow}
        onToggleAll={() => onToggleAll(filteredProblems.map((problem) => problem.rowNumber))}
        emptyMessage="검색 조건에 맞는 문제가 없어요."
      />
    </div>
  );
}
