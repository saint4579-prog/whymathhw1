'use client';

import { useEffect, useState } from 'react';
import {
  CATEGORIES,
  DEFAULT_END_HOUR,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_WORKBOOKS,
  MISS_STRATEGY,
  SLOT_MINUTE_OPTIONS,
  TIMETABLE_MAX_HOUR,
  TIMETABLE_START_HOUR,
  UNITS,
  addDays,
  listStudyDates,
  toDateKey,
} from '@/lib/planner';
import {
  formatDday,
} from '@/lib/smartSchedule';
import {
  Field,
  Modal,
  PillButton,
} from './PlannerParts';

// 스터디 플래너에서 띄우는 입력창들.

export function ExamGoalSuggestion({ examConfig, completedProblems = 0, onAdd }) {
  const today = toDateKey();
  const configured = Boolean(examConfig?.examDate) && Number(examConfig?.totalProblems) > 0;
  const scopeLabel = examConfig?.scopeLabel || '시험 범위';
  const remaining = Math.max(0, Math.round(Number(examConfig?.totalProblems) || 0) - completedProblems);

  const [total, setTotal] = useState(remaining);
  const [endDate, setEndDate] = useState(examConfig?.examDate || addDays(today, 13));

  // 시험 설정이 바뀌면 추천값을 다시 채운다.
  useEffect(() => {
    setTotal(remaining);
    setEndDate(examConfig?.examDate || addDays(today, 13));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examConfig?.examDate, examConfig?.totalProblems, completedProblems]);

  if (!configured) {
    return (
      <div className="mb-3 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 px-4 py-3 text-center text-sm font-bold text-stone-500">
        📅 <span className="text-rose-500">[월간 플래너]</span> 탭에서 시험 날짜와 범위를 저장하면,
        여기에 추천 진도가 자동으로 떠요! 🐾
      </div>
    );
  }

  const studyDays = listStudyDates(today, endDate, [], []).length;
  const perDay = studyDays > 0 ? Math.ceil(Math.max(0, Number(total) || 0) / studyDays) : Number(total) || 0;

  return (
    <div className="mb-3 rounded-2xl border-2 border-rose-100 bg-rose-50/50 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-rose-500">🐶 강아지 튜터 추천 목표 · {scopeLabel}</p>
        <span className="rounded-full bg-rose-400 px-3 py-1 text-xs font-black text-white">
          {formatDday(examConfig.examDate)}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold text-stone-500">남은 문제 수(수정 가능)</span>
          <input
            type="number"
            min="1"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-full rounded-2xl border-2 border-amber-100 bg-white px-4 py-2 text-right font-extrabold text-stone-700 outline-none focus:border-rose-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold text-stone-500">끝내는 날(수정 가능)</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-2xl border-2 border-amber-100 bg-white px-4 py-2 font-bold text-stone-700 outline-none focus:border-rose-300"
          />
        </label>
      </div>
      <p className="mt-2 rounded-2xl bg-white px-4 py-2 text-center text-sm font-extrabold text-rose-500">
        🐾 {studyDays}일 동안 하루 {perDay}문제씩 풀면 끝나요!
      </p>
      <button
        type="button"
        disabled={Number(total) <= 0}
        onClick={() =>
          onAdd({
            category: 'HW_HWANGSO',
            workbook: scopeLabel,
            title: `${scopeLabel} 시험대비`,
            unit: 'problem',
            totalAmount: Math.max(0, Math.round(Number(total) || 0)),
            startDate: today,
            endDate,
          })
        }
        className="mt-2 w-full rounded-full bg-rose-400 px-5 py-2.5 text-sm font-extrabold text-white shadow-md hover:bg-rose-500 disabled:bg-stone-200 disabled:text-stone-400"
      >
        🎯 이 추천을 기간 목표로 추가하기
      </button>
    </div>
  );
}


export function hourLabel(h) {
  if (h === 24) return '밤 12시';
  if (h < 12) return `아침 ${h}시`;
  if (h === 12) return '낮 12시';
  return `오후 ${h - 12}시`;
}


export function TimetableSetup({ slotMinutes, startHour, endHour, onConfirm }) {
  const [minutes, setMinutes] = useState(slotMinutes || DEFAULT_SLOT_MINUTES);
  const [start, setStart] = useState(startHour ?? TIMETABLE_START_HOUR);
  const [end, setEnd] = useState(endHour || DEFAULT_END_HOUR);

  // 선택 가능한 시작 시각(오전 6시 ~ 밤 11시)과, 시작 이후의 끝 시각.
  const startOptions = Array.from(
    { length: TIMETABLE_MAX_HOUR - 1 - 6 + 1 },
    (_, i) => 6 + i
  );
  const endOptions = Array.from(
    { length: TIMETABLE_MAX_HOUR - start },
    (_, i) => start + 1 + i
  );

  const chooseStart = (h) => {
    setStart(h);
    if (end <= h) setEnd(Math.min(TIMETABLE_MAX_HOUR, h + 1)); // 끝이 시작보다 앞서지 않게 보정
  };

  return (
    <div className="space-y-5 rounded-2xl bg-amber-50 p-5">
      <div>
        <p className="mb-2 text-sm font-extrabold text-stone-700">
          1️⃣ 몇 분 단위로 계획할래요?
        </p>
        <div className="flex gap-2">
          {SLOT_MINUTE_OPTIONS.map((option) => (
            <PillButton key={option} active={minutes === option} onClick={() => setMinutes(option)}>
              {option}분
            </PillButton>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-extrabold text-stone-700">
          2️⃣ 몇 시부터 몇 시까지 계획을 세울래요?
        </p>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-extrabold text-stone-500">시작 시간</p>
            <div className="flex flex-wrap gap-2">
              {startOptions.map((option) => (
                <PillButton
                  key={option}
                  active={start === option}
                  onClick={() => chooseStart(option)}
                  className="px-3 py-1.5 text-xs"
                >
                  {hourLabel(option)}
                </PillButton>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-extrabold text-stone-500">끝 시간</p>
            <div className="flex flex-wrap gap-2">
              {endOptions.map((option) => (
                <PillButton
                  key={option}
                  active={end === option}
                  onClick={() => setEnd(option)}
                  className="px-3 py-1.5 text-xs"
                >
                  {hourLabel(option)}
                </PillButton>
              ))}
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onConfirm(minutes, start, end)}
        className="w-full rounded-full bg-rose-400 px-5 py-3 font-extrabold text-white shadow-md hover:bg-rose-500"
      >
        🐶 시간표 만들기 ({hourLabel(start)} ~ {hourLabel(end)})
      </button>
    </div>
  );
}


export function GoalFormModal({ onClose, onSubmit }) {
  const today = toDateKey();
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [workbook, setWorkbook] = useState(DEFAULT_WORKBOOKS[CATEGORIES[0].key][0]);
  const [customWorkbook, setCustomWorkbook] = useState('');
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('page');
  const [totalAmount, setTotalAmount] = useState(60);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 13));

  const options = DEFAULT_WORKBOOKS[category] ?? [];
  const finalWorkbook = workbook === '__custom__' ? customWorkbook : workbook;
  const previewDays = listStudyDates(startDate, endDate, [], []).length;
  const perDay = previewDays > 0 ? Math.ceil(Number(totalAmount || 0) / previewDays) : 0;

  return (
    <Modal title="새 목표 만들기" subtitle="기간을 정하면 하루 권장량을 계산해 줄게요" onClose={onClose}>
      <div className="space-y-4">
        <Field label="어떤 공부예요?">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <PillButton
                key={c.key}
                active={category === c.key}
                onClick={() => {
                  setCategory(c.key);
                  setWorkbook(DEFAULT_WORKBOOKS[c.key]?.[0] ?? '__custom__');
                }}
                className="px-3 py-1.5 text-xs"
              >
                {c.emoji} {c.label}
              </PillButton>
            ))}
          </div>
        </Field>

        <Field label="문제집">
          <select
            value={workbook}
            onChange={(e) => setWorkbook(e.target.value)}
            className="w-full rounded-2xl border-2 border-amber-100 bg-white px-4 py-2 font-bold text-stone-700"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value="__custom__">✏️ 직접 입력하기</option>
          </select>
          {workbook === '__custom__' && (
            <input
              value={customWorkbook}
              onChange={(e) => setCustomWorkbook(e.target.value)}
              placeholder="문제집 이름을 적어 주세요"
              className="mt-2 w-full rounded-2xl border-2 border-amber-100 px-4 py-2 font-bold text-stone-700"
            />
          )}
        </Field>

        <Field label="목표 이름 (비워 두면 문제집 이름으로 해요)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 와이수학 1권 2주 안에 끝내기"
            className="w-full rounded-2xl border-2 border-amber-100 px-4 py-2 font-bold text-stone-700"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="세는 단위">
            <div className="flex gap-2">
              {UNITS.map((u) => (
                <PillButton key={u.key} active={unit === u.key} onClick={() => setUnit(u.key)} className="px-3 py-1.5 text-xs">
                  {u.emoji} {u.label}
                </PillButton>
              ))}
            </div>
          </Field>
          <Field label={`전체 ${unit === 'problem' ? '문제 수' : '페이지 수'}`}>
            <input
              type="number"
              min="1"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full rounded-2xl border-2 border-amber-100 px-4 py-2 text-right font-extrabold text-stone-700"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="시작일">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl border-2 border-amber-100 px-4 py-2 font-bold text-stone-700"
            />
          </Field>
          <Field label="끝내는 날">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-2xl border-2 border-amber-100 px-4 py-2 font-bold text-stone-700"
            />
          </Field>
        </div>

        <p className="rounded-2xl bg-rose-50 p-4 text-center text-sm font-extrabold text-rose-500">
          🐾 {previewDays}일 동안 하루 {perDay}
          {unit === 'problem' ? '문제' : '페이지'}씩 하면 끝나요!
        </p>

        <button
          type="button"
          disabled={!finalWorkbook || Number(totalAmount) <= 0}
          onClick={() =>
            onSubmit({
              category,
              workbook: finalWorkbook,
              title: title || finalWorkbook,
              unit,
              totalAmount,
              startDate,
              endDate,
            })
          }
          className="w-full rounded-full bg-rose-400 px-5 py-3 font-extrabold text-white shadow-md hover:bg-rose-500 disabled:bg-stone-200 disabled:text-stone-400"
        >
          🐶 이 목표로 시작하기
        </button>
      </div>
    </Modal>
  );
}


export function TaskFormModal({ onClose, onSubmit }) {
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [workbook, setWorkbook] = useState(DEFAULT_WORKBOOKS[CATEGORIES[0].key][0]);
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('page');
  const [amount, setAmount] = useState(5);
  const [minutes, setMinutes] = useState(30);

  const options = DEFAULT_WORKBOOKS[category] ?? [];

  return (
    <Modal title="할 일 직접 추가" subtitle="오늘만 하는 공부도 여기에 담아요" onClose={onClose}>
      <div className="space-y-4">
        <Field label="어떤 공부예요?">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <PillButton
                key={c.key}
                active={category === c.key}
                onClick={() => {
                  setCategory(c.key);
                  setWorkbook(DEFAULT_WORKBOOKS[c.key]?.[0] ?? '');
                }}
                className="px-3 py-1.5 text-xs"
              >
                {c.emoji} {c.label}
              </PillButton>
            ))}
          </div>
        </Field>
        <Field label="문제집 / 교재">
          <select
            value={workbook}
            onChange={(e) => setWorkbook(e.target.value)}
            className="w-full rounded-2xl border-2 border-amber-100 bg-white px-4 py-2 font-bold text-stone-700"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="할 일 이름">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 3단원 복습하기"
            className="w-full rounded-2xl border-2 border-amber-100 px-4 py-2 font-bold text-stone-700"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="단위">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-2xl border-2 border-amber-100 bg-white px-3 py-2 font-bold text-stone-700"
            >
              {UNITS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="목표량">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border-2 border-amber-100 px-3 py-2 text-right font-extrabold text-stone-700"
            />
          </Field>
          <Field label="예상 시간(분)">
            <input
              type="number"
              min="10"
              step="10"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-full rounded-2xl border-2 border-amber-100 px-3 py-2 text-right font-extrabold text-stone-700"
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={Number(amount) <= 0}
          onClick={() => onSubmit({ category, workbook, title: title || workbook, unit, amount, minutes })}
          className="w-full rounded-full bg-rose-400 px-5 py-3 font-extrabold text-white shadow-md hover:bg-rose-500 disabled:bg-stone-200 disabled:text-stone-400"
        >
          🐾 할 일 담기
        </button>
      </div>
    </Modal>
  );
}


export function MissStrategyModal({ tasks, onClose, onSelect }) {
  const totalShort = tasks.reduce(
    (sum, t) => sum + Math.max(0, t.amount - (t.done ? t.amount : Number(t.doneAmount) || 0)),
    0
  );
  return (
    <Modal
      title="못 끝낸 공부, 어떻게 할까요?"
      subtitle="괜찮아요! 방법을 골라 보세요 🐶"
      onClose={onClose}
    >
      <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-center text-sm font-bold text-stone-600">
        오늘 남은 양은 모두 <span className="text-rose-500">{totalShort}</span>만큼이에요.
      </p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onSelect(MISS_STRATEGY.PUSH)}
          className="w-full rounded-2xl border-2 border-amber-100 bg-white p-4 text-left hover:border-rose-200"
        >
          <p className="font-extrabold text-stone-700">⏭️ 내일로 미루기</p>
          <p className="mt-1 text-xs font-bold text-stone-400">
            못 한 만큼을 내일 하루에 그대로 얹어요. 내일이 조금 바빠지지만 계획은 그대로예요.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onSelect(MISS_STRATEGY.REDISTRIBUTE)}
          className="w-full rounded-2xl border-2 border-amber-100 bg-white p-4 text-left hover:border-rose-200"
        >
          <p className="font-extrabold text-stone-700">➗ 남은 날에 골고루 다시 나누기</p>
          <p className="mt-1 text-xs font-bold text-stone-400">
            남은 전체 분량을 남은 공부일 수로 다시 나눠요. 하루가 조금씩만 늘어나서 부담이 적어요.
          </p>
        </button>
      </div>
    </Modal>
  );
}

