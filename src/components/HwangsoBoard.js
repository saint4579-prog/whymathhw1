'use client';

import { useMemo, useState } from 'react';
import HwangsoListTable from './HwangsoListTable';
import { HWANGSO_UNITS } from '@/lib/hwangso';
import { isSolved } from '@/lib/problemUtils';

// [황소 중2상 1차단평대비] 전용 현황판.
// 상단에 [1단원]/[2단원]/[3단원] 서브 필터 버튼을 두고, 선택한 단원의 문제만 목록으로 보여준다.
// 검색/상태 필터/오늘의 학습 목표(체크박스)는 다른 현황판과 같은 방식으로 동작한다.
export default function HwangsoBoard({ problems, onSolve, onSolveGoal }) {
  const [activeUnit, setActiveUnit] = useState('U1');
  const [selected, setSelected] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 단원별 문제 개수 (서브 필터 버튼에 뱃지로 표시)
  const unitCounts = useMemo(() => {
    const counts = {};
    problems.forEach((p) => {
      counts[p.unit] = (counts[p.unit] || 0) + 1;
    });
    return counts;
  }, [problems]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko');
    return problems.filter((p) => {
      if (p.unit !== activeUnit) return false;
      const solved = isSolved(p);
      const statusMatches =
        statusFilter === 'all' ||
        (statusFilter === 'unsolved' && !solved) ||
        (statusFilter === 'solved' && solved) ||
        (statusFilter === 'correct' && p.isCorrect === 'O') ||
        (statusFilter === 'wrong' && p.isCorrect === 'X');
      if (!statusMatches) return false;
      if (!query) return true;
      return (
        String(p.title || '').toLocaleLowerCase('ko').includes(query) ||
        String(p.conceptName || '').toLocaleLowerCase('ko').includes(query) ||
        String(p.numberLabel || '').includes(query)
      );
    });
  }, [problems, activeUnit, search, statusFilter]);

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

  const handleSetDailyGoal = () => {
    const goalList = problems.filter((p) => selected.has(p.rowNumber));
    if (goalList.length === 0) return;
    onSolveGoal(goalList);
  };

  return (
    <div className="space-y-3">
      {/* 서브 필터: 단원 선택 */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
        <span className="px-1 text-xs font-bold text-amber-600">📘 단원 선택</span>
        {HWANGSO_UNITS.map((unit) => {
          const count = unitCounts[unit.id] || 0;
          const active = activeUnit === unit.id;
          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => setActiveUnit(unit.id)}
              className={`rounded-full px-5 py-2 text-sm font-extrabold shadow-sm transition ${
                active
                  ? 'bg-rose-400 text-white shadow-rose-200'
                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              }`}
            >
              {unit.label}
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  active ? 'bg-white/30 text-white' : 'bg-white text-rose-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 검색 / 상태 필터 */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">문제 검색</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">🔎</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="문항, 개념, 문제 번호로 검색"
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

      {/* 오늘의 학습 목표로 설정 */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-rose-100 bg-white p-3 shadow-lg shadow-amber-100/60">
        <button
          type="button"
          onClick={handleSetDailyGoal}
          disabled={selectedCount === 0}
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🎯 오늘의 학습 목표로 설정 ({selectedCount}개)
        </button>
      </div>

      <HwangsoListTable
        problems={filtered}
        onSolve={onSolve}
        selectable
        selectedRows={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        emptyMessage={
          (unitCounts[activeUnit] || 0) === 0
            ? '이 단원 문제는 아직 준비 중이에요.'
            : '검색 조건에 맞는 문제가 없어요.'
        }
      />
    </div>
  );
}
