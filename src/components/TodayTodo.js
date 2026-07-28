'use client';

import { useEffect, useMemo, useState } from 'react';
import CharacterMascot from './CharacterMascot';
import { toDateKey, addDays, buildTasksForDate } from '@/lib/planner';
import {
  generateSmartSchedule,
  daysUntil,
  formatDday,
  normalizeExams,
  pickPrimaryExam,
  examToConfig,
} from '@/lib/smartSchedule';
import {
  subjectsOn,
  allAcademySubjects,
  getNextAcademyDate,
  WEEKDAY_KO,
  SUBJECT_COLOR,
} from '@/lib/academy';
import { fetchPlanner, savePlanner } from '@/lib/api';

// 오늘 할 일 항목의 출처 유형별 배지. (요구사항 4: 어떤 유형인지 한눈에 구분)
const TYPE_BADGE = {
  academy: { label: '🏫 학원 숙제', cls: 'bg-violet-100 text-violet-700' },
  goal: { label: '🎯 기간 목표', cls: 'bg-rose-100 text-rose-600' },
  carryover: { label: '⏭️ 어제 이월', cls: 'bg-orange-100 text-orange-700' },
  schedule: { label: '⏰ 추천 시간표', cls: 'bg-sky-100 text-sky-700' },
  manual: { label: '✏️ 직접', cls: 'bg-amber-100 text-amber-700' },
};

function TypeBadge({ type }) {
  const badge = TYPE_BADGE[type] || TYPE_BADGE.manual;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

function DdayBadge({ dueDate }) {
  const label = formatDday(dueDate);
  const d = daysUntil(dueDate);
  const cls =
    d == null
      ? 'bg-stone-100 text-stone-500'
      : d < 0
        ? 'bg-red-100 text-red-600'
        : d === 0
          ? 'bg-rose-500 text-white'
          : d <= 1
            ? 'bg-rose-100 text-rose-600'
            : 'bg-amber-100 text-amber-700';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>
      {label}
    </span>
  );
}

// 알림장/메모 열기 버튼. 메모가 있으면 진한 색으로 강조한다.
function MemoButton({ hasMemo, open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title="알림장/메모"
      className={`shrink-0 rounded-full px-2.5 py-1 text-sm shadow-sm transition ${
        hasMemo ? 'bg-amber-300 text-amber-900' : 'bg-stone-100 text-stone-400 hover:bg-amber-100'
      }`}
    >
      💬
    </button>
  );
}

// 아래로 펼쳐지는 긴 메모(알림장) 편집 패널. flex-wrap 안에서 w-full로 다음 줄에 놓인다.
function MemoPanel({ value, onChange }) {
  return (
    <div className="mt-2 w-full">
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="학원 알림장(카톡/문자) 내용을 붙여넣거나 메모하세요..."
        className="w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 p-3 text-sm font-semibold text-stone-700 outline-none focus:border-rose-300"
      />
    </div>
  );
}

const uid = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// [오늘 할 일] 탭 — 세 출처(학원 숙제 · 기간 목표 · 어제 이월)를 하나로 통합해서 보여준다.
// 데이터는 스터디 플래너와 같은 GAS 플래너 블롭에 저장되어 새로고침/기기 변경에도 유지된다.
export default function TodayTodo({ userName, examConfig, completedProblems = 0 }) {
  const today = toDateKey();
  const yesterday = addDays(today, -1);

  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [hwSubject, setHwSubject] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [openMemoKey, setOpenMemoKey] = useState(null); // 열려 있는 메모(알림장) 아코디언 키

  // ---- 로딩: GAS(플래너 블롭)에서 goals/days/examConfig/academyHomework 를 한 번에 불러온다 ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { planner } = await fetchPlanner(userName);
        if (!cancelled) setBlob(planner || { goals: [], days: {}, academyHomework: [] });
      } catch {
        if (!cancelled) setBlob({ goals: [], days: {}, academyHomework: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userName]);

  // 학원 숙제 추가 폼의 기본 과목 = 오늘 다니는 학원 (없으면 전체 첫 과목)
  useEffect(() => {
    const todaySubjects = subjectsOn(today);
    setHwSubject(todaySubjects[0] || allAcademySubjects()[0] || '');
  }, [today]);

  // ---- 저장: 블롭을 통째로 저장(로컬 캐시 + GAS). goals/days 등 다른 필드는 보존된다 ----
  const updateBlob = (recipe) => {
    setBlob((prev) => {
      const base = prev || { goals: [], days: {}, academyHomework: [] };
      const next = recipe(base);
      savePlanner(next, userName).catch(() => {}); // 실패해도 로컬 캐시에는 남음
      return next;
    });
  };

  const setTodayTodos = (updater) => {
    updateBlob((prev) => {
      const days = { ...(prev.days || {}) };
      const day = { ...(days[today] || {}) };
      day.todos = updater(day.todos || []);
      days[today] = day;
      return { ...prev, days };
    });
  };

  const setAcademy = (updater) => {
    updateBlob((prev) => ({ ...prev, academyHomework: updater(prev.academyHomework || []) }));
  };

  // ---- 파생 데이터 ----
  const days = blob?.days || {};
  const todayTodos = useMemo(() => days[today]?.todos || [], [days, today]);
  const carryOver = useMemo(
    () => (days[yesterday]?.todos || []).filter((t) => !t.done),
    [days, yesterday]
  );
  const academyHomework = blob?.academyHomework || [];
  const goals = blob?.goals || [];
  // 여러 시험 중 가장 임박한 시험을 스마트 시간표에 쓴다. (블롭 우선, 없으면 상위에서 내려준 examConfig)
  const effectiveExam = useMemo(() => {
    const primary = pickPrimaryExam(normalizeExams(blob?.exams ?? blob?.examConfig), today);
    return primary ? examToConfig(primary) : examConfig;
  }, [blob, examConfig, today]);

  const goalTasksToday = useMemo(() => buildTasksForDate(goals, today), [goals, today]);
  const academyDueToday = useMemo(
    () => academyHomework.filter((h) => !h.done && h.dueDate && h.dueDate <= today),
    [academyHomework, today]
  );

  const schedule = useMemo(
    () =>
      generateSmartSchedule({
        totalProblems: effectiveExam?.totalProblems,
        completedProblems,
        examDate: effectiveExam?.examDate,
        today,
        scopeLabel: effectiveExam?.scopeLabel || '시험 범위',
        unit: '문제',
      }),
    [effectiveExam, completedProblems, today]
  );

  const alreadyAdded = (sourceId) => todayTodos.some((t) => t.sourceId === sourceId);

  // ---- 액션 ----
  const addTodo = (item) => {
    if (item.sourceId && alreadyAdded(item.sourceId)) return;
    setTodayTodos((list) => [...list, { id: uid(), done: false, ...item }]);
  };
  const toggleTodo = (id) =>
    setTodayTodos((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const removeTodo = (id) => setTodayTodos((list) => list.filter((t) => t.id !== id));

  const handleAddManual = () => {
    const text = input.trim();
    if (!text) return;
    addTodo({ text, type: 'manual' });
    setInput('');
  };

  const handleAddAcademyHw = () => {
    const title = hwTitle.trim();
    if (!title || !hwSubject) return;
    const dueDate = getNextAcademyDate(hwSubject, today);
    setAcademy((list) => [
      ...list,
      { id: uid(), subject: hwSubject, title, assignedDate: today, dueDate, done: false, memo: '' },
    ]);
    setHwTitle('');
  };
  const toggleAcademyHw = (id) =>
    setAcademy((list) => list.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
  const removeAcademyHw = (id) => setAcademy((list) => list.filter((h) => h.id !== id));

  // 긴 메모(알림장) 편집: 학원 숙제 / 오늘 할 일 각각에 저장한다.
  const setAcademyMemo = (id, memo) =>
    setAcademy((list) => list.map((h) => (h.id === id ? { ...h, memo } : h)));
  const setTodoMemo = (id, memo) =>
    setTodayTodos((list) => list.map((t) => (t.id === id ? { ...t, memo } : t)));
  const toggleMemo = (key) => setOpenMemoKey((k) => (k === key ? null : key));

  const doneCount = todayTodos.filter((t) => t.done).length;
  const todaySubjects = subjectsOn(today);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <CharacterMascot name="chick" height={64} />
        <p className="text-lg text-amber-700">🐾 오늘 할 일을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── 강아지 튜터 추천 시간표 (시험 대비) ───────────────────────── */}
      {!dismissed && (
        <div className="relative overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-br from-rose-50 to-amber-50 p-5 shadow-xl shadow-amber-100/70">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="추천 닫기"
            className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-sm font-bold text-stone-400 shadow-sm hover:bg-rose-50 hover:text-rose-500"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <CharacterMascot name="chick" height={54} />
            <div>
              <p className="text-xs font-bold text-rose-400">🐾 강아지 튜터의 스마트 추천</p>
              <h2 className="text-xl font-extrabold text-stone-700">🐶 멍멍! 오늘의 추천 일정이에요!</h2>
            </div>
          </div>

          {schedule.hasExam ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-full bg-rose-400 px-3 py-1 text-white shadow-sm">{schedule.ddayLabel}</span>
                <span className="rounded-full bg-white px-3 py-1 text-stone-600 shadow-sm">📅 시험 {schedule.examDate}</span>
                <span className="rounded-full bg-white px-3 py-1 text-stone-600 shadow-sm">📚 남은 {schedule.remaining}문제</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 shadow-sm">
                  🎯 오늘 목표 {schedule.todayQuota}문제{schedule.isWeekendToday ? ' (주말 +50%)' : ''}
                </span>
              </div>
              {schedule.blocks.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {schedule.blocks.map((block) => {
                    const added = alreadyAdded(`sched-${block.id}`);
                    return (
                      <li
                        key={block.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amber-100 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-stone-700">⏰ {block.timeLabel}</p>
                          <p className="text-xs font-bold text-stone-500">
                            {effectiveExam?.scopeLabel || ''} {block.count}
                            {block.unit} 풀기
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addTodo({ text: block.text, type: 'schedule', sourceId: `sched-${block.id}` })}
                          disabled={added}
                          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold shadow-sm transition ${
                            added ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-400 text-white hover:bg-rose-500'
                          }`}
                        >
                          {added ? '추가됨 ✓' : '＋ 내 일정에 추가'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl bg-white px-4 py-6 text-center text-sm font-bold text-emerald-500">
                  🎉 시험 범위를 다 풀었어요! 오늘은 가볍게 복습해볼까요?
                </p>
              )}
              <p className="mt-3 text-center text-xs font-bold text-stone-400">
                🐕 하루 평균 {schedule.dailyAverage}문제씩 풀면 시험 전에 딱 끝나요!
              </p>
            </>
          ) : (
            <p className="mt-4 rounded-2xl bg-white px-4 py-6 text-center text-sm font-bold text-stone-500">
              📅 아직 시험 정보가 없어요. <span className="text-rose-500">[월간 플래너]</span> 탭에서 시험 날짜와 범위를 먼저 입력해 주세요! 🐾
            </p>
          )}
        </div>
      )}

      {/* ── 요구사항 1: 어제 못한 일 (추천 할 일) ───────────────────── */}
      {carryOver.length > 0 && (
        <div className="rounded-[2rem] border-4 border-orange-200 bg-orange-50/70 p-5 shadow-xl shadow-orange-100/60">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-orange-700">⏭️ 어제 못한 일 (추천 할 일)</h3>
            <button
              type="button"
              onClick={() => carryOver.forEach((t) => addTodo({ text: t.text, type: 'carryover', sourceId: `carry-${t.id}` }))}
              className="rounded-full bg-orange-400 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-500"
            >
              전부 오늘로 가져오기
            </button>
          </div>
          <p className="mb-3 text-xs font-bold text-orange-500">
            🐾 어제 다 못한 일이에요. 오늘 이어서 해볼까요? 클릭하면 아래 오늘 할 일에 담겨요.
          </p>
          <ul className="space-y-2">
            {carryOver.map((t) => {
              const added = alreadyAdded(`carry-${t.id}`);
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border-2 border-orange-100 bg-white px-4 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <TypeBadge type={t.type || 'manual'} />
                    <span className="truncate text-sm font-bold text-stone-700">{t.text}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addTodo({ text: t.text, type: 'carryover', sourceId: `carry-${t.id}` })}
                    disabled={added}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                      added ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-400 text-white hover:bg-orange-500'
                    }`}
                  >
                    {added ? '담음 ✓' : '＋ 오늘로'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── 요구사항 3: 학원 숙제 (다음 등원일 = D-day 자동 계산) ────── */}
      <div className="rounded-[2rem] border-4 border-white bg-white p-5 shadow-xl shadow-amber-100/70">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold text-stone-700">🏫 학원 숙제</h3>
          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600">
            오늘({WEEKDAY_KO[new Date().getDay()]}) 학원: {todaySubjects.length ? todaySubjects.join(', ') : '없음'}
          </span>
        </div>
        <p className="mb-3 text-xs font-bold text-stone-400">
          🐾 학원 다녀와 숙제를 적으면, 다음 등원일이 자동으로 제출 마감일(D-day)로 정해져요.
        </p>

        {/* 학원 숙제 추가 폼 */}
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={hwSubject}
            onChange={(e) => setHwSubject(e.target.value)}
            className="rounded-full border-2 border-amber-100 bg-white px-3 py-2 text-sm font-bold text-stone-700 outline-none focus:border-rose-300"
          >
            {allAcademySubjects().map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={hwTitle}
            onChange={(e) => setHwTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAcademyHw()}
            placeholder="예) 27~35쪽 풀기"
            className="min-w-[160px] flex-1 rounded-full border-2 border-amber-100 px-4 py-2 text-sm font-bold text-stone-700 outline-none focus:border-rose-300"
          />
          <button
            type="button"
            onClick={handleAddAcademyHw}
            className="shrink-0 rounded-full bg-violet-400 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-500"
          >
            숙제 추가
          </button>
        </div>
        {hwSubject && (
          <p className="mb-3 rounded-2xl bg-violet-50 px-4 py-2 text-center text-xs font-bold text-violet-600">
            📌 지금 추가하면 <b>{hwSubject}</b> 다음 수업일{' '}
            <b>{getNextAcademyDate(hwSubject, today) || '없음'}</b>
            {getNextAcademyDate(hwSubject, today)
              ? ` (${WEEKDAY_KO[new Date(getNextAcademyDate(hwSubject, today).replace(/-/g, '/')).getDay()]})`
              : ''}{' '}
            까지가 D-day예요.
          </p>
        )}

        {/* 학원 숙제 목록 */}
        {academyHomework.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 p-5 text-center text-sm font-bold text-stone-400">
            아직 등록한 학원 숙제가 없어요 🐾
          </p>
        ) : (
          <ul className="space-y-2">
            {[...academyHomework]
              .sort((a, b) => (a.done === b.done ? String(a.dueDate).localeCompare(String(b.dueDate)) : a.done ? 1 : -1))
              .map((h) => {
                const inToday = alreadyAdded(`aca-${h.id}`);
                return (
                  <li
                    key={h.id}
                    className={`flex flex-wrap items-center gap-2 rounded-2xl border-2 px-4 py-2.5 ${
                      h.done ? 'border-emerald-200 bg-emerald-50' : 'border-violet-100 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleAcademyHw(h.id)}
                      aria-pressed={h.done}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-black transition ${
                        h.done ? 'bg-emerald-400 text-white' : 'bg-violet-100 text-violet-600'
                      }`}
                    >
                      {h.done ? '✓' : ''}
                    </button>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${SUBJECT_COLOR[h.subject] || 'bg-stone-100 text-stone-600'}`}
                    >
                      {h.subject}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-sm font-bold ${h.done ? 'text-emerald-600 line-through' : 'text-stone-700'}`}>
                      {h.title}
                    </span>
                    {!h.done && <DdayBadge dueDate={h.dueDate} />}
                    <MemoButton
                      hasMemo={Boolean(h.memo)}
                      open={openMemoKey === `aca-${h.id}`}
                      onClick={() => toggleMemo(`aca-${h.id}`)}
                    />
                    {!h.done && !inToday && (
                      <button
                        type="button"
                        onClick={() =>
                          addTodo({
                            text: `[${h.subject}] ${h.title}`,
                            type: 'academy',
                            sourceId: `aca-${h.id}`,
                            memo: h.memo || '',
                          })
                        }
                        className="shrink-0 rounded-full bg-violet-400 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-violet-500"
                      >
                        ＋ 오늘로
                      </button>
                    )}
                    {inToday && <span className="shrink-0 text-[11px] font-bold text-emerald-500">담음 ✓</span>}
                    <button
                      type="button"
                      onClick={() => removeAcademyHw(h.id)}
                      className="shrink-0 rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-400 hover:bg-rose-100 hover:text-rose-500"
                    >
                      삭제
                    </button>
                    {openMemoKey === `aca-${h.id}` && (
                      <MemoPanel value={h.memo} onChange={(v) => setAcademyMemo(h.id, v)} />
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      {/* ── 요구사항 4-B: 기간 목표 오늘 분량 ──────────────────────── */}
      {goalTasksToday.length > 0 && (
        <div className="rounded-[2rem] border-4 border-rose-100 bg-rose-50/50 p-5 shadow-xl shadow-rose-100/50">
          <h3 className="mb-3 text-lg font-extrabold text-rose-600">🎯 오늘의 기간 목표 분량</h3>
          <ul className="space-y-2">
            {goalTasksToday.map((task) => {
              const text = `${task.title} ${task.amount}${task.unit === 'problem' ? '문제' : 'p'}`;
              const added = alreadyAdded(`goal-${task.id}`);
              return (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-2xl border-2 border-rose-100 bg-white px-4 py-2.5">
                  <span className="truncate text-sm font-bold text-stone-700">{text}</span>
                  <button
                    type="button"
                    onClick={() => addTodo({ text, type: 'goal', sourceId: `goal-${task.id}` })}
                    disabled={added}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                      added ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-400 text-white hover:bg-rose-500'
                    }`}
                  >
                    {added ? '담음 ✓' : '＋ 오늘로'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── 요구사항 4: 통합 오늘 할 일 (A+B+C 합쳐서 유형 배지로 구분) ── */}
      <div className="rounded-[2rem] border-4 border-white bg-white p-5 shadow-xl shadow-amber-100/70">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-stone-700">✅ 오늘 할 일</h3>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">
            {doneCount} / {todayTodos.length} 완료
          </span>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
            placeholder="직접 할 일을 적어 보세요 (예: 오답 정리하기)"
            className="flex-1 rounded-full border-2 border-amber-100 px-4 py-2 text-sm font-bold text-stone-700 outline-none focus:border-rose-300"
          />
          <button
            type="button"
            onClick={handleAddManual}
            className="shrink-0 rounded-full bg-rose-400 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500"
          >
            추가
          </button>
        </div>

        {todayTodos.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 p-6 text-center text-sm font-bold text-stone-400">
            아직 담은 할 일이 없어요. 위 추천(학원 숙제 · 기간 목표 · 어제 이월)에서 담거나 직접 적어 보세요 🐾
          </p>
        ) : (
          <ul className="space-y-2">
            {todayTodos.map((todo) => (
              <li
                key={todo.id}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3 transition ${
                  todo.done ? 'border-emerald-200 bg-emerald-50' : 'border-amber-100 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleTodo(todo.id)}
                  aria-pressed={todo.done}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black transition ${
                    todo.done ? 'bg-emerald-400 text-white' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {todo.done ? '✓' : ''}
                </button>
                <TypeBadge type={todo.type} />
                <span className={`min-w-0 flex-1 text-sm font-bold ${todo.done ? 'text-emerald-600 line-through' : 'text-stone-700'}`}>
                  {todo.text}
                </span>
                <MemoButton
                  hasMemo={Boolean(todo.memo)}
                  open={openMemoKey === `todo-${todo.id}`}
                  onClick={() => toggleMemo(`todo-${todo.id}`)}
                />
                <button
                  type="button"
                  onClick={() => removeTodo(todo.id)}
                  className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-400 hover:bg-rose-100 hover:text-rose-500"
                >
                  삭제
                </button>
                {openMemoKey === `todo-${todo.id}` && (
                  <MemoPanel value={todo.memo} onChange={(v) => setTodoMemo(todo.id, v)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
