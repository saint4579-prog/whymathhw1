'use client';

import { useEffect, useMemo, useState } from 'react';
import ProblemListTable from './ProblemListTable';
import CharacterMascot from './CharacterMascot';
import {
  getDueProblems,
  getReviewState,
  buildTaxonomy,
  filterByTaxonomy,
  describeStage,
} from '@/lib/reviewSchedule';

function Dropdown({ label, value, onChange, options, disabled }) {
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block text-xs font-extrabold text-stone-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border-2 border-amber-100 bg-white px-3 py-2.5 text-sm font-bold text-stone-700 disabled:bg-stone-50 disabled:text-stone-300"
      >
        <option value="all">전체</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label} ({o.count})
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * 망각곡선 복습 화면.
 *
 * 복습 기준은 구글 시트의 학습기록(historyLogs)이다. 그래서 아이패드에서 푼 것도
 * 노트북에서 복습으로 뜨고, 체크리스트에서 체크한 날짜도 그대로 기준이 된다.
 *
 * 교재가 세 개로 늘어나면서 복습 목록이 뒤섞이면 아이가 뭘 해야 할지 몰라지므로,
 * 대분류(교재) → 중분류(단원/차시) → 소분류(개념)로 좁혀 볼 수 있게 했다.
 */
export default function ReviewMode({ problems, onSolve, onStartReview }) {
  const [ready, setReady] = useState(false);
  const [workbook, setWorkbook] = useState('all');
  const [middle, setMiddle] = useState('all');
  const [small, setSmall] = useState('all');

  // 복습 계산에 localStorage 폴백이 섞여 있어 서버 렌더 결과와 어긋날 수 있다.
  // 브라우저에서 한 번 그린 뒤에 계산한다.
  useEffect(() => {
    setReady(true);
  }, []);

  // 복습 대상 전체 (분류 필터를 걸기 전)
  const dueAll = useMemo(() => (ready ? getDueProblems(problems) : []), [ready, problems]);

  // 드롭다운 항목은 '복습 대상' 기준으로 만든다. 그래야 고를 수 있는 게 전부 실제로 있다.
  const taxonomy = useMemo(() => buildTaxonomy(dueAll), [dueAll]);
  const bigNode = taxonomy.find((b) => b.key === workbook) ?? null;
  const middleNode = bigNode?.middles.find((m) => m.key === middle) ?? null;

  // 상위 분류를 바꾸면 하위 선택은 초기화한다.
  useEffect(() => {
    setMiddle('all');
    setSmall('all');
  }, [workbook]);
  useEffect(() => {
    setSmall('all');
  }, [middle]);

  const dueProblems = useMemo(
    () => filterByTaxonomy(dueAll, { workbook, middle, small }),
    [dueAll, workbook, middle, small]
  );

  // 오래 밀린 것부터 먼저 보여 준다.
  const sorted = useMemo(() => {
    const now = Date.now();
    return [...dueProblems].sort(
      (a, b) => getReviewState(b, now).daysLate - getReviewState(a, now).daysLate
    );
  }, [dueProblems]);

  const overdue = useMemo(() => {
    const now = Date.now();
    return sorted.filter((p) => getReviewState(p, now).daysLate >= 3).length;
  }, [sorted]);

  if (!ready) {
    return <p className="py-16 text-center text-amber-500">🐾 복습 대상을 킁킁 찾는 중...</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-lg shadow-amber-100/60">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <CharacterMascot name="raccoon" height={46} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-500">
              🔄 한 번 맞히면 다음 복습은 더 나중에 (1일 → 3일 → 7일 → 14일 → 30일)
            </p>
            <h2 className="text-lg font-extrabold text-stone-700">
              복습할 문제 <span className="text-rose-500">{sorted.length}</span>개
              {overdue > 0 && (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-500">
                  3일 넘게 밀린 것 {overdue}개
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onStartReview(sorted)}
            disabled={sorted.length === 0}
            className="ml-auto shrink-0 rounded-full bg-rose-400 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🔄 지금 복습 시작 ({sorted.length}개)
          </button>
        </div>

        {/* 대 / 중 / 소 분류 */}
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Dropdown label="교재 (대분류)" value={workbook} onChange={setWorkbook} options={taxonomy} />
          <Dropdown
            label="단원 (중분류)"
            value={middle}
            onChange={setMiddle}
            options={bigNode?.middles ?? []}
            disabled={!bigNode || (bigNode.middles ?? []).length === 0}
          />
          <Dropdown
            label="개념 (소분류)"
            value={small}
            onChange={setSmall}
            options={middleNode?.smalls ?? []}
            disabled={!middleNode || (middleNode.smalls ?? []).length === 0}
          />
        </div>

        {workbook === 'all' && taxonomy.length > 1 && (
          <p className="mt-2 text-xs font-bold text-stone-400">
            🐾 교재를 고르면 단원과 개념까지 좁혀서 볼 수 있어요.
          </p>
        )}
        {workbook === 'mockExam' && (
          <p className="mt-2 text-xs font-bold text-stone-400">모의고사는 단원 구분이 없어요.</p>
        )}
      </div>

      {/* 복습 단계 요약 */}
      {sorted.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((stage) => {
            const count = sorted.filter((p) => getReviewState(p).stage === stage).length;
            if (count === 0) return null;
            return (
              <span
                key={stage}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-500 shadow-sm"
              >
                {describeStage(stage)} · {count}개
              </span>
            );
          })}
        </div>
      )}

      <ProblemListTable
        problems={sorted}
        onSolve={(rowNumber) => onSolve(rowNumber, sorted)}
        emptyMessage={
          dueAll.length > 0
            ? '이 분류에는 복습할 문제가 없어요. 다른 교재나 단원을 골라 보세요 🐶'
            : '지금 복습할 문제가 없습니다. 문제를 더 풀면 이곳에 복습 목록이 쌓여요! 🐶'
        }
      />
    </div>
  );
}
