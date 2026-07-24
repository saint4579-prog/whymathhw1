'use client';

import { useMemo, useState } from 'react';
import MockExamListTable from './MockExamListTable';
import { isSolved } from '@/lib/problemUtils';
import { buildHintResultMessage, prepareGeminiHint } from '@/lib/geminiPrompt';

// [영재원 대비_모의고사] 전용 현황판.
// 문제 검색 / 상태 필터 / 번호 범위 선택 / 체크박스로 오늘의 학습 목표 만들기 / 마법 힌트를
// 와이수학 현황판과 똑같은 방식으로 제공한다. 선택 상태는 이 화면 안에서만 쓰이므로 로컬 상태로 관리한다.
export default function MockExamBoard({ problems, onSolve, onSolveGoal }) {
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startNum, setStartNum] = useState('');
  const [endNum, setEndNum] = useState('');
  const [copying, setCopying] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim();
    return problems.filter((p) => {
      const solved = isSolved(p);
      const statusMatches =
        statusFilter === 'all' ||
        (statusFilter === 'unsolved' && !solved) ||
        (statusFilter === 'solved' && solved) ||
        (statusFilter === 'correct' && p.isCorrect === 'O') ||
        (statusFilter === 'wrong' && p.isCorrect === 'X');
      if (!statusMatches) return false;
      if (!query) return true;
      return String(p.number || '').includes(query);
    });
  }, [problems, search, statusFilter]);

  const selectedCount = selected.size;

  const toggleRow = (rowNumber) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const toggleAll = (rowNumbers) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = rowNumbers.length > 0 && rowNumbers.every((rn) => prev.has(rn));
      rowNumbers.forEach((rn) => {
        if (allSelected) next.delete(rn);
        else next.add(rn);
      });
      return next;
    });
  };

  const getRangeRowNumbers = () => {
    const start = parseInt(startNum, 10);
    if (Number.isNaN(start)) return null;
    const endParsed = endNum.trim() === '' ? start : parseInt(endNum, 10);
    const end = Number.isNaN(endParsed) ? start : endParsed;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    return problems
      .filter((p) => {
        const num = Number(p.number);
        return num >= lo && num <= hi;
      })
      .map((p) => p.rowNumber);
  };

  const applyRange = (add) => {
    const rowNumbers = getRangeRowNumbers();
    if (!rowNumbers || rowNumbers.length === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      rowNumbers.forEach((rn) => (add ? next.add(rn) : next.delete(rn)));
      return next;
    });
  };

  const handleSetDailyGoal = () => {
    const goalList = problems.filter((p) => selected.has(p.rowNumber));
    if (goalList.length === 0) return;
    onSolveGoal(goalList);
  };

  const handleHintForSelected = async () => {
    const chosen = problems.filter((p) => selected.has(p.rowNumber));
    if (chosen.length === 0 || copying) return;
    setCopying(true);
    try {
      const adapted = chosen.map((p) => ({
        code: `모의고사_${p.number}.png`,
        imageUrl: p.questionImageUrl,
      }));
      const result = await prepareGeminiHint(adapted);
      alert(buildHintResultMessage(result));
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
        <p className="mb-2 px-1 text-xs font-bold text-amber-600">🐾 문제 번호 범위로 콕 찍어 선택하기</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-500">시작 번호</span>
            <input
              type="number"
              inputMode="numeric"
              value={startNum}
              onChange={(e) => setStartNum(e.target.value)}
              placeholder="1"
              className="w-20 rounded-full border-2 border-amber-100 px-4 py-2 text-sm text-stone-600 focus:border-rose-300 focus:outline-none"
            />
          </label>
          <span className="text-amber-400">~</span>
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-500">끝 번호</span>
            <input
              type="number"
              inputMode="numeric"
              value={endNum}
              onChange={(e) => setEndNum(e.target.value)}
              placeholder="10"
              className="w-20 rounded-full border-2 border-amber-100 px-4 py-2 text-sm text-stone-600 focus:border-rose-300 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => applyRange(true)}
            className="rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500"
          >
            🐶 선택 적용
          </button>
          <button
            type="button"
            onClick={() => applyRange(false)}
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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="문제 번호로 검색"
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
          {filtered.length}개 찾았어요
        </span>
        {(search || statusFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
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
          onClick={handleSetDailyGoal}
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

      <MockExamListTable
        problems={filtered}
        onSolve={onSolve}
        selectable
        selectedRows={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        emptyMessage="검색 조건에 맞는 문제가 없어요."
      />
    </div>
  );
}
