'use client';

import { useMemo, useState } from 'react';
import {
  CATEGORIES,
  listStudyDates,
  summarizeGoal,
  weekdayLabel,
} from '@/lib/planner';
import {
  WEEKDAYS,
} from './PlannerParts';

// 목록의 한 줄씩.
// TaskRow = 오늘 할 일 한 줄, GoalCard = 목표 하나.

export function TaskRow({ task, assigned, justChecked, onToggle, onStep, onDuplicate, onRemove }) {
  const category = CATEGORIES.find((c) => c.key === task.category);
  const unitLabel = task.unit === 'problem' ? '문제' : 'p';
  const doneAmount = task.done ? task.amount : Math.max(0, Number(task.doneAmount) || 0);
  const rate = task.amount > 0 ? Math.min(1, doneAmount / task.amount) : 0;
  const started = !task.done && doneAmount > 0;

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={task.done}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border-2 p-3 transition select-none ${
          task.done
            ? 'border-emerald-300 bg-emerald-50'
            : started
              ? 'border-amber-200 bg-amber-50/60 hover:border-rose-200'
              : 'border-amber-100 bg-white hover:border-rose-200'
        } ${justChecked ? 'animate-task-pop' : ''}`}
      >
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black transition ${
            task.done ? 'bg-emerald-400 text-white' : 'bg-amber-100 text-amber-700'
          } ${justChecked ? 'animate-check-stamp' : ''}`}
          aria-hidden="true"
        >
          {task.done ? '✓' : category?.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-base font-extrabold ${
              task.done ? 'text-emerald-600 line-through' : 'text-stone-700'
            }`}
          >
            {task.title || task.workbook}
          </p>
          <p className="truncate text-xs font-bold text-stone-400">
            {category?.label} · {task.workbook}
            {assigned && ' · ⏰ 시간표에 있음'}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white">
              <span
                className={`block h-full rounded-full transition-all duration-300 ${
                  task.done ? 'bg-emerald-400' : 'bg-rose-300'
                }`}
                style={{ width: `${Math.round(rate * 100)}%` }}
              />
            </span>
            <span className="shrink-0 text-xs font-extrabold text-stone-500">
              {doneAmount} / {task.amount}
              {unitLabel}
            </span>
          </div>
        </div>

        {/* 조금씩 한 날을 위한 −/+ 버튼. 카드 토글과 겹치지 않게 클릭 전파를 막는다. */}
        <div
          className="flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={doneAmount <= 0}
            className="h-10 w-10 rounded-full bg-white text-lg font-black text-stone-500 shadow-sm transition hover:bg-amber-100 disabled:opacity-30"
            aria-label="한 만큼 줄이기"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={doneAmount >= task.amount}
            className="h-10 w-10 rounded-full bg-white text-lg font-black text-rose-500 shadow-sm transition hover:bg-rose-100 disabled:opacity-30"
            aria-label="한 만큼 늘리기"
          >
            +
          </button>
          {/* 비슷한 공부를 여러 번 할 때, 처음부터 다시 적지 않고 하나 더 만든다. */}
          <button
            type="button"
            onClick={onDuplicate}
            className="ml-1 rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-500 transition hover:bg-amber-100 hover:text-amber-700"
          >
            복사
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-400 transition hover:bg-rose-100 hover:text-rose-500"
          >
            삭제
          </button>
        </div>
      </div>
    </li>
  );
}


export function GoalCard({ goal, todayKey, onRemove, onToggleHoliday, onToggleRestWeekday }) {
  const [open, setOpen] = useState(false);
  const category = CATEGORIES.find((c) => c.key === goal.category);
  const summary = summarizeGoal(goal, todayKey);
  const unitLabel = goal.unit === 'problem' ? '문제' : 'p';
  const upcoming = useMemo(
    () => listStudyDates(goal.startDate, goal.endDate, [], []).slice(0, 21),
    [goal.startDate, goal.endDate]
  );
  const holidaySet = new Set(goal.holidays ?? []);

  return (
    <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{category?.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold text-stone-700">{goal.title || goal.workbook}</p>
          <p className="truncate text-xs font-bold text-stone-400">
            {category?.label} · {goal.startDate} ~ {goal.endDate}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-400 hover:text-rose-500"
        >
          삭제
        </button>
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-300 to-amber-300"
          style={{ width: `${Math.min(100, Math.round(summary.progressRate * 100))}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-stone-500">
        <span>
          📚 {summary.done} / {summary.total}
          {unitLabel}
        </span>
        <span>🗓️ 남은 공부일 {summary.remainingDays}일</span>
        <span className="text-rose-500">
          🐾 하루 {summary.perDay}
          {unitLabel}씩
        </span>
        {goal.carryOver > 0 && <span className="text-amber-600">⏭️ 밀린 양 {goal.carryOver}{unitLabel}</span>}
        {summary.isFinished && <span className="text-emerald-500">🎉 다 끝냈어요!</span>}
        {summary.isOverdue && <span className="text-rose-500">⏰ 기간이 지났어요</span>}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 w-full rounded-full bg-white px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
      >
        {open ? '휴일 설정 접기 ▲' : '🛌 공부 안 하는 날 정하기 ▼'}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-xs font-bold text-stone-500">매주 쉬는 요일</p>
            <div className="flex gap-1">
              {WEEKDAYS.map((label, index) => {
                const active = (goal.restWeekdays ?? []).includes(index);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onToggleRestWeekday(index)}
                    className={`h-8 w-8 rounded-full text-xs font-extrabold ${
                      active ? 'bg-rose-400 text-white' : 'bg-white text-stone-500 hover:bg-amber-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold text-stone-500">콕 집어 쉬는 날 (누르면 휴일)</p>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
              {upcoming.map((d) => {
                const active = holidaySet.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onToggleHoliday(d)}
                    className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                      active ? 'bg-rose-400 text-white' : 'bg-white text-stone-500 hover:bg-amber-100'
                    }`}
                  >
                    {d.slice(5)} {weekdayLabel(d)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 시간(24시각)을 사람이 읽는 라벨로. 7 -> 아침 7시, 13 -> 오후 1시, 24 -> 밤 12시
