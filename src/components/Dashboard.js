'use client';

import { useMemo, useState } from 'react';
import ProblemListTable from './ProblemListTable';
import MockExamBoard from './MockExamBoard';
import HwangsoBoard from './HwangsoBoard';
import { hwangsoConceptList, HWANGSO_UNITS, unitLabel } from '@/lib/hwangso';
import { isSolved, extractPageNumber } from '@/lib/problemUtils';
import { buildHintResultMessage, prepareGeminiHint } from '@/lib/geminiPrompt';
import { CHARACTERS } from '@/lib/characters';
import CharacterMascot from './CharacterMascot';

const WORKBOOKS = [
  { id: 'yi', label: '와이수학-대수-공통수학1' },
  { id: 'mockExam', label: '영재원 대비_모의고사' },
  { id: 'hwangso', label: '황소 중2상 1차단평대비' },
];

function WorkbookTabs({ activeWorkbook, onWorkbookChange }) {
  return (
    <div className="mb-4 flex flex-wrap justify-center gap-2">
      {WORKBOOKS.map((wb) => (
        <button
          key={wb.id}
          type="button"
          onClick={() => onWorkbookChange(wb.id)}
          className={`rounded-full px-5 py-2 text-sm font-extrabold shadow-sm transition ${
            activeWorkbook === wb.id
              ? 'bg-rose-400 text-white shadow-rose-200'
              : 'bg-white text-amber-600 hover:bg-amber-50'
          }`}
        >
          {wb.label}
        </button>
      ))}
    </div>
  );
}

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

function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

// 단원별 대표 주제명. (통계 첫 줄에 "1단원 유리수와 순환소수 ..." 처럼 보여줄 때 사용)
const HWANGSO_UNIT_THEMES = {
  U1: '유리수와 순환소수',
};

// [황소 중2상 1차단평대비] 상세 통계 패널.
// 상단 [1단원]/[2단원]/[3단원] 탭으로 단원을 고르면, 그 단원의 진도와 개념탐구별 정답률만 보여준다.
function HwangsoStatsPanel({ problems }) {
  const [activeStatsTab, setActiveStatsTab] = useState('U1');

  const unitProblems = problems.filter((p) => p.unit === activeStatsTab);
  const total = unitProblems.length;
  const solved = unitProblems.filter(isSolved).length;
  const theme = HWANGSO_UNIT_THEMES[activeStatsTab];

  const conceptStats = hwangsoConceptList(activeStatsTab).map((concept) => {
    const list = unitProblems.filter((p) => p.conceptId === concept.id);
    const correct = list.filter((p) => p.isCorrect === 'O').length;
    return { ...concept, total: list.length, correct, pct: percent(correct, list.length) };
  });

  const hasData = conceptStats.length > 0;

  return (
    <div className="flex-1 rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-lg shadow-amber-100/60">
      {/* 제목 + 단원 탭 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-amber-600">📊 상세 통계</h3>
        <div className="flex gap-1">
          {HWANGSO_UNITS.map((unit) => {
            const active = activeStatsTab === unit.id;
            return (
              <button
                key={unit.id}
                type="button"
                onClick={() => setActiveStatsTab(unit.id)}
                className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                  active
                    ? 'bg-rose-400 text-white shadow-sm shadow-rose-200'
                    : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                }`}
              >
                {unit.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-stone-700">
        통계 : {unitLabel(activeStatsTab)}
        {theme ? ` ${theme}` : ''} 학습개수{' '}
        <span className="text-stone-800">
          {solved}/{total}
        </span>{' '}
        <span className="font-extrabold text-rose-500">→ {percent(solved, total)}%</span>
      </p>

      {hasData ? (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
          {conceptStats.map((concept) => (
            <li key={concept.id} className="rounded-2xl bg-amber-50/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-stone-600">
                  개탐{concept.num} 정답률{' '}
                  <span className="text-xs font-semibold text-amber-500">({concept.name})</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-stone-700">
                  {concept.correct}/{concept.total}{' '}
                  <span className="font-extrabold text-rose-500">→ {concept.pct}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400 transition-all"
                  style={{ width: `${concept.pct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-amber-50/50 px-4 py-8 text-center text-sm font-bold text-stone-400">
          🐾 {unitLabel(activeStatsTab)}은 업데이트 예정입니다
        </p>
      )}
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
  activeWorkbook,
  onWorkbookChange,
  mockExamProblems = [],
  onSolveMockExam,
  onSolveMockGoal,
  hwangsoProblems = [],
  onSolveHwangso,
  onSolveHwangsoGoal,
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

  if (activeWorkbook === 'mockExam') {
    const mockTotal = mockExamProblems.length;
    const mockSolvedCount = mockExamProblems.filter(isSolved).length;
    const mockCorrectCount = mockExamProblems.filter((p) => p.isCorrect === 'O').length;
    return (
      <div className="mx-auto max-w-6xl">
        <WorkbookTabs activeWorkbook={activeWorkbook} onWorkbookChange={onWorkbookChange} />
        <div className="mb-4 grid grid-cols-3 gap-3">
          <SummaryCard label="전체 문제" value={mockTotal} character="elephant" />
          <SummaryCard label="풀이 완료" value={mockSolvedCount} character="chick" />
          <SummaryCard label="정답 수" value={mockCorrectCount} character="fox" />
        </div>
        <MockExamBoard
          problems={mockExamProblems}
          onSolve={onSolveMockExam}
          onSolveGoal={onSolveMockGoal}
        />
      </div>
    );
  }

  if (activeWorkbook === 'hwangso') {
    const hwangsoTotal = hwangsoProblems.length;
    const hwangsoSolvedCount = hwangsoProblems.filter(isSolved).length;
    const hwangsoCorrectCount = hwangsoProblems.filter((p) => p.isCorrect === 'O').length;
    return (
      <div className="mx-auto max-w-6xl">
        <WorkbookTabs activeWorkbook={activeWorkbook} onWorkbookChange={onWorkbookChange} />
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {/* 좌측: 폭을 줄인 요약 카드 3개 */}
          <div className="grid grid-cols-3 gap-3 lg:w-[340px] lg:shrink-0">
            <SummaryCard label="전체 문제" value={hwangsoTotal} character="elephant" />
            <SummaryCard label="풀이 완료" value={hwangsoSolvedCount} character="chick" />
            <SummaryCard label="정답 수" value={hwangsoCorrectCount} character="fox" />
          </div>
          {/* 우측: 상세 통계 패널 */}
          <HwangsoStatsPanel problems={hwangsoProblems} />
        </div>
        <HwangsoBoard
          problems={hwangsoProblems}
          onSolve={onSolveHwangso}
          onSolveGoal={onSolveHwangsoGoal}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="sticky top-[var(--app-header-height)] z-20 -mx-4 mb-4 space-y-3 bg-gradient-to-b from-amber-50 via-amber-50/95 to-amber-50/80 px-4 pb-3 pt-1 backdrop-blur md:-mx-6 md:px-6">
        <WorkbookTabs activeWorkbook={activeWorkbook} onWorkbookChange={onWorkbookChange} />
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
