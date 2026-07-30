'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CharacterMascot from './CharacterMascot';
import {
  fetchPlanner,
  savePlanner,
  awardPlannerPoints,
  readPlannerCache,
  writePlannerCache,
} from '@/lib/api';
import {
  CATEGORIES,
  DEFAULT_WORKBOOKS,
  UNITS,
  SLOT_MINUTE_OPTIONS,
  TIMETABLE_START_HOUR,
  TIMETABLE_MAX_HOUR,
  DEFAULT_END_HOUR,
  DEFAULT_SLOT_MINUTES,
  MISS_STRATEGY,
  calcPlannerMaxPoints,
  toDateKey,
  addDays,
  weekdayLabel,
  buildTimeSlots,
  currentSlotIndex,
  slotSpanForTask,
  buildTasksForDate,
  calcDayStats,
  calcPointDelta,
  calcPlannerPoints,
  cheerMessage,
  createEmptyDayPlan,
  createTask,
  createGoal,
  summarizeGoal,
  recalcAfterMiss,
  listStudyDates,
} from '@/lib/planner';
import { daysUntil, formatDday } from '@/lib/smartSchedule';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ---------------------------------------------------------------------------
// 작은 UI 조각들
// ---------------------------------------------------------------------------

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-[2rem] border-4 border-white bg-white p-4 shadow-xl shadow-amber-100/70 md:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionTitle({ emoji, title, subtitle, right }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs font-bold text-rose-400">{subtitle}</p>
        <h3 className="text-lg font-extrabold text-stone-700">
          {emoji} {title}
        </h3>
      </div>
      {right}
    </div>
  );
}

function PillButton({ active, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? 'bg-rose-400 text-white shadow-md shadow-rose-200'
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** 과목 비중 도넛 차트 (외부 라이브러리 없이 SVG로 직접 그린다) */
function SubjectDonut({ shares, mode = 'planned', size = 148 }) {
  const key = mode === 'done' ? 'doneShare' : 'plannedShare';
  const visible = shares.filter((s) => s[key] > 0);
  const total = visible.reduce((sum, s) => sum + s[key], 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border-8 border-amber-100 text-center text-xs font-bold text-stone-400"
        style={{ width: size, height: size }}
      >
        아직 기록이
        <br />
        없어요 🐾
      </div>
    );
  }

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="과목 비중">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#FEF3C7" strokeWidth="18" />
      {visible.map((share) => {
        const ratio = share[key] / total;
        const dash = ratio * circumference;
        const el = (
          <circle
            key={share.subject}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={share.color}
            strokeWidth="18"
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        className="fill-stone-500"
        style={{ fontSize: 12, fontWeight: 700 }}
      >
        과목 비중
      </text>
      <text x="50%" y="66%" textAnchor="middle" style={{ fontSize: 20 }}>
        🐶
      </text>
    </svg>
  );
}

/** 달성률 원형 게이지 */
function AchievementRing({ rate, size = 116 }) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.min(1, Math.max(0, rate)) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#FFE4E6" strokeWidth="14" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FB7185"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-rose-500">{Math.round(rate * 100)}%</span>
        <span className="text-[10px] font-bold text-stone-400">오늘 달성률</span>
      </div>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${maxWidth} overflow-hidden rounded-[2rem] border-4 border-white bg-amber-50 shadow-2xl`}>
        <div className="flex items-center gap-3 bg-gradient-to-r from-rose-100 to-amber-100 p-5">
          <span className="text-3xl">🐶</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-rose-500">{subtitle}</p>
            <h2 className="text-xl font-extrabold text-stone-700">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-rose-500 shadow-sm hover:bg-rose-50"
          >
            닫기 ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

// 월간 플래너에서 저장한 시험 설정을 바탕으로 '추천 기간 목표'를 보여주는 폼.
// 추천 진도(하루 권장량)를 자동 계산하고, 사용자가 총량/마감일을 수정한 뒤 목표로 저장할 수 있다.
function ExamGoalSuggestion({ examConfig, completedProblems = 0, onAdd }) {
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

export default function StudyPlanner({ userName, onPointsAwarded, examConfig, completedProblems = 0 }) {
  const todayKey = toDateKey();
  const [date, setDate] = useState(todayKey);
  const [planner, setPlanner] = useState(() => ({ goals: [], days: {} }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  // 구글 시트 저장이 실패한 이유. null이면 정상.
  const [saveError, setSaveError] = useState(null);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [slotPickerIndex, setSlotPickerIndex] = useState(null);
  // 시간표 칸에 넣으려고 고른 할 일. 고른 뒤 '몇 분?'을 정하면 배정이 끝난다.
  const [pickedTaskId, setPickedTaskId] = useState(null);
  const [missModal, setMissModal] = useState(null);
  const [statsMode, setStatsMode] = useState('planned');
  // 방금 체크한 할 일 id. 체크한 카드에만 짧게 축하 애니메이션을 준다.
  const [justCheckedId, setJustCheckedId] = useState(null);

  const timetableRef = useRef(null);
  const saveTimerRef = useRef(null);
  const celebrateTimerRef = useRef(null);
  const loadedRef = useRef(false);

  // 화면을 떠날 때 남은 타이머를 정리한다.
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    },
    []
  );

  // ---- 로딩 -------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = readPlannerCache(userName);
      if (cached && alive) setPlanner(normalizePlanner(cached));
      const { planner: remote, error } = await fetchPlanner(userName);
      if (!alive) return;
      if (remote) setPlanner(normalizePlanner(remote));
      if (error && !remote) setNotice('오프라인 상태예요. 계획은 이 기기에 저장할게요 🐾');
      setLoading(false);
      loadedRef.current = true;
    })();
    return () => {
      alive = false;
    };
  }, [userName]);

  // ---- 자동 저장(디바운스) -----------------------------------------------
  const persist = useCallback(
    (next) => {
      writePlannerCache(userName, next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await savePlanner(next, userName);
          setSaveError(null);
        } catch (error) {
          // 원인을 숨기면 고칠 수가 없다. 실제 메시지를 그대로 보여 준다.
          setSaveError(String(error?.message || error));
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [userName]
  );

  const update = useCallback(
    (recipe) => {
      setPlanner((prev) => {
        const next = recipe(prev);
        if (loadedRef.current) persist(next);
        return next;
      });
    },
    [persist]
  );

  const day = planner.days[date] ?? createEmptyDayPlan(date);
  const goals = planner.goals ?? [];

  const setDay = useCallback(
    (recipe) => {
      update((prev) => {
        const current = prev.days[date] ?? createEmptyDayPlan(date);
        return { ...prev, days: { ...prev.days, [date]: recipe(current) } };
      });
    },
    [date, update]
  );

  // ---- 파생값 -----------------------------------------------------------
  const slots = useMemo(
    () => buildTimeSlots(day.startHour, day.endHour, day.slotMinutes),
    [day.startHour, day.endHour, day.slotMinutes]
  );
  const stats = useMemo(() => calcDayStats(day.tasks), [day.tasks]);
  const tasksById = useMemo(
    () => Object.fromEntries(day.tasks.map((t) => [t.id, t])),
    [day.tasks]
  );
  const assignedTaskIds = useMemo(
    () => new Set(Object.values(day.assignments ?? {})),
    [day.assignments]
  );

  // 시간표 진입 시 현재 시각으로 스크롤
  useEffect(() => {
    if (!day.setupDone || slots.length === 0 || date !== todayKey) return;
    const container = timetableRef.current;
    if (!container) return;
    const index = currentSlotIndex(slots);
    const row = container.querySelector(`[data-slot="${index}"]`);
    if (row) {
      container.scrollTop = Math.max(0, row.offsetTop - container.clientHeight / 3);
    }
  }, [day.setupDone, slots, date, todayKey]);

  // ---- 액션 -------------------------------------------------------------

  const handleAutoFill = () => {
    const generated = buildTasksForDate(goals, date);
    if (generated.length === 0) {
      setNotice('오늘 배정할 목표가 없어요. 먼저 기간 목표를 만들어 볼까요? 🦴');
      return;
    }
    setDay((prev) => {
      const existingGoalIds = new Set(prev.tasks.map((t) => t.goalId).filter(Boolean));
      const fresh = generated.filter((t) => !existingGoalIds.has(t.goalId));
      return { ...prev, tasks: [...prev.tasks, ...fresh] };
    });
    setNotice(null);
  };

  const handleAddTask = (draft) => {
    setDay((prev) => ({ ...prev, tasks: [...prev.tasks, createTask(draft)] }));
    setTaskModalOpen(false);
  };

  const handleRemoveTask = (taskId) => {
    setDay((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      assignments: Object.fromEntries(
        Object.entries(prev.assignments ?? {}).filter(([, id]) => id !== taskId)
      ),
    }));
  };

  // 할 일 하나를 끝낼 때마다 바로 체크한다.
  // 체크한 순간 통계·진행바·예상 포인트가 즉시 갱신되고, 짧은 반응 애니메이션이 나간다.
  // (실제 포인트 지급은 하루를 마감할 때 한 번에 이뤄진다.)
  const handleToggleTask = (taskId) => {
    let becameDone = false;
    let allDone = false;

    setDay((prev) => {
      const tasks = prev.tasks.map((t) => {
        if (t.id !== taskId) return t;
        becameDone = !t.done;
        return { ...t, done: becameDone, doneAmount: becameDone ? t.amount : 0 };
      });
      allDone = tasks.length > 0 && tasks.every((t) => t.done);
      return { ...prev, tasks };
    });

    if (becameDone) {
      celebrate(taskId);
      setNotice(
        allDone
          ? '오늘 계획을 전부 해냈어요! 아래 버튼으로 마감하고 포인트를 받아요 🐶🎉'
          : '하나 끝! 잘하고 있어요 🐾'
      );
    } else {
      setNotice(null);
    }
  };

  // −/+ 버튼: 조금씩 한 날을 위해 1씩 올리고 내린다. 목표량에 닿으면 자동으로 완료 처리.
  const handleStepTask = (taskId, delta) => {
    let becameDone = false;

    setDay((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const current = t.done ? t.amount : Math.max(0, Number(t.doneAmount) || 0);
        const doneAmount = Math.max(0, Math.min(t.amount, current + delta));
        const done = t.amount > 0 && doneAmount >= t.amount;
        becameDone = done && !t.done;
        return { ...t, doneAmount, done };
      }),
    }));

    if (becameDone) {
      celebrate(taskId);
      setNotice('하나 끝! 잘하고 있어요 🐾');
    }
  };

  // 방금 체크한 카드에만 잠깐 애니메이션 클래스를 붙였다 뗀다.
  const celebrate = (taskId) => {
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    setJustCheckedId(taskId);
    celebrateTimerRef.current = setTimeout(() => setJustCheckedId(null), 450);
  };

  /**
   * 할 일을 시간표에 넣는다. 소요 시간만큼 여러 칸을 이어서 차지한다.
   *
   * 예전에는 한 칸에 할 일 하나만 들어갔다. 그래서 3시간 걸리는 공부를 넣으려면
   * '단평준비1'~'단평준비6'처럼 가짜 할 일 6개를 만들어 한 칸씩 배정해야 했다.
   * 이제 120분짜리 할 일을 30분 단위 시간표의 13시에 넣으면 13:00~15:00 네 칸이
   * 한 덩어리로 채워진다. 30분짜리는 한 칸만 쓰므로 짧은 공부도 그대로 잘 들어간다.
   *
   * @param slotIndex 시작 칸
   * @param taskId    넣을 할 일 (null이면 비우기)
   * @param minutes   이 할 일에 쓸 시간(분). 생략하면 할 일에 적힌 예상 시간을 쓴다.
   */
  const handleAssignSlot = (slotIndex, taskId, minutes) => {
    setDay((prev) => {
      const next = { ...(prev.assignments ?? {}) };
      const slotMinutes = prev.slotMinutes || DEFAULT_SLOT_MINUTES;
      const task = prev.tasks.find((t) => t.id === taskId);
      const useMinutes = Number(minutes) || Number(task?.minutes) || slotMinutes;
      // 몇 칸을 차지하는지. 최소 한 칸.
      const span = Math.max(1, Math.ceil(useMinutes / slotMinutes));
      // 같은 할 일이 다른 칸에 이미 있으면 옮기는 것으로 처리한다.
      Object.keys(next).forEach((key) => {
        if (next[key] === taskId) delete next[key];
      });

      if (!taskId) {
        // 비우기: 이 칸이 속한 덩어리 전체를 지운다.
        // (긴 할 일의 중간 칸을 눌러도 그 할 일이 통째로 빠지도록)
        const target = prev.assignments?.[slotIndex];
        if (target) {
          Object.keys(next).forEach((key) => {
            if (next[key] === target) delete next[key];
          });
        } else {
          delete next[slotIndex];
        }
        return { ...prev, assignments: next };
      }

      // 차지할 칸들을 먼저 비운다. 먼저 있던 할 일은 통째로 밀려난다.
      for (let i = 0; i < span; i += 1) {
        const occupant = next[slotIndex + i];
        if (occupant && occupant !== taskId) {
          Object.keys(next).forEach((key) => {
            if (next[key] === occupant) delete next[key];
          });
        }
      }
      for (let i = 0; i < span; i += 1) {
        next[slotIndex + i] = taskId;
      }

      // 할 일에 적힌 예상 시간도 실제 배정한 시간에 맞춰 둔다.
      // 그래야 통계의 '계획한 시간'과 시간표가 어긋나지 않는다.
      const tasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, minutes: span * slotMinutes } : t
      );
      return { ...prev, assignments: next, tasks };
    });
    setSlotPickerIndex(null);
  };

  /**
   * 시간표 자동 채우기.
   * 아직 배정되지 않은 할 일들을 시작 시각부터 순서대로, 각자의 예상 시간만큼 붙여 놓는다.
   * 칸을 하나씩 눌러 고르는 수고를 없애기 위한 기능이다.
   */
  const handleAutoArrange = () => {
    setDay((prev) => {
      const slotMinutes = prev.slotMinutes || DEFAULT_SLOT_MINUTES;
      const total = buildTimeSlots(prev.startHour, prev.endHour, slotMinutes).length;
      const next = {};
      let cursor = 0;
      let placed = 0;
      let overflow = 0;

      prev.tasks.forEach((task) => {
        const span = Math.max(1, Math.ceil((Number(task.minutes) || slotMinutes) / slotMinutes));
        if (cursor + span > total) {
          overflow += 1;
          return;
        }
        for (let i = 0; i < span; i += 1) next[cursor + i] = task.id;
        cursor += span;
        placed += 1;
      });

      setNotice(
        overflow > 0
          ? `${placed}개를 시간표에 놓았어요. ${overflow}개는 시간이 부족해서 못 넣었어요 🐾`
          : `할 일 ${placed}개를 순서대로 놓았어요! 마음에 안 들면 칸을 눌러 바꿔요 🐶`
      );
      return { ...prev, assignments: next };
    });
  };

  /**
   * 어제(또는 가장 최근에 계획을 세운 날) 계획을 그대로 오늘로 가져온다.
   * 완료 표시와 진행량은 초기화해서, 어제 한 것이 오늘 한 것으로 잘못 잡히지 않게 한다.
   */
  const handleCopyPreviousDay = () => {
    const source = findRecentPlannedDate(planner.days, date);
    if (!source) {
      setNotice('가져올 지난 계획이 없어요 🦴');
      return;
    }
    const from = planner.days[source];
    const idMap = {};
    const tasks = (from.tasks ?? []).map((task) => {
      const fresh = { ...task, id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      idMap[task.id] = fresh.id;
      // 어제의 성과는 지운다. 계획만 베껴 온다.
      fresh.done = false;
      fresh.doneAmount = 0;
      return fresh;
    });
    const assignments = {};
    Object.entries(from.assignments ?? {}).forEach(([slot, taskId]) => {
      if (idMap[taskId]) assignments[slot] = idMap[taskId];
    });

    setDay((prev) => ({
      ...prev,
      slotMinutes: from.slotMinutes ?? prev.slotMinutes,
      startHour: from.startHour ?? prev.startHour,
      endHour: from.endHour ?? prev.endHour,
      setupDone: true,
      tasks: [...prev.tasks, ...tasks],
      assignments: { ...(prev.assignments ?? {}), ...assignments },
    }));
    setNotice(`${source} 계획에서 할 일 ${tasks.length}개를 가져왔어요 🐶`);
  };

  /** 할 일 하나를 그대로 하나 더 만든다. (비슷한 공부를 여러 번 할 때) */
  const handleDuplicateTask = (taskId) => {
    setDay((prev) => {
      const origin = prev.tasks.find((t) => t.id === taskId);
      if (!origin) return prev;
      const copy = {
        ...origin,
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        done: false,
        doneAmount: 0,
      };
      // 원본 바로 뒤에 끼워 넣어야 목록에서 찾기 쉽다.
      const at = prev.tasks.findIndex((t) => t.id === taskId);
      const tasks = [...prev.tasks];
      tasks.splice(at + 1, 0, copy);
      return { ...prev, tasks };
    });
  };

  const handleAddGoal = (draft) => {
    update((prev) => ({ ...prev, goals: [...prev.goals, createGoal(draft)] }));
    setGoalModalOpen(false);
  };

  const handleRemoveGoal = (goalId) => {
    update((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== goalId) }));
  };

  const handleToggleHoliday = (goalId, dateKey) => {
    update((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const holidays = new Set(g.holidays ?? []);
        if (holidays.has(dateKey)) holidays.delete(dateKey);
        else holidays.add(dateKey);
        return { ...g, holidays: [...holidays].sort() };
      }),
    }));
  };

  const handleToggleRestWeekday = (goalId, weekday) => {
    update((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const rest = new Set(g.restWeekdays ?? []);
        if (rest.has(weekday)) rest.delete(weekday);
        else rest.add(weekday);
        return { ...g, restWeekdays: [...rest].sort() };
      }),
    }));
  };

  // 하루 마감: 포인트 지급 + 목표 진행도 반영 + 미달성 처리 안내
  const handleCloseDay = async () => {
    if (day.tasks.length === 0) {
      setNotice('오늘 할 일이 없어요. 먼저 계획을 세워 볼까요? 🐾');
      return;
    }
    const delta = calcPointDelta(day.tasks, day.pointsAwarded);
    const earned = calcPlannerPoints(day.tasks);

    // 완료한 만큼 각 목표의 누적 진행도에 더한다.
    update((prev) => {
      const gains = {};
      day.tasks.forEach((t) => {
        if (!t.goalId) return;
        const done = t.done ? t.amount : Math.max(0, Number(t.doneAmount) || 0);
        gains[t.goalId] = (gains[t.goalId] || 0) + done;
      });
      const prevAwarded = prev.days[date]?.pointsAwarded ?? 0;
      const prevGains = prev.days[date]?.appliedGains ?? {};
      return {
        ...prev,
        goals: prev.goals.map((g) =>
          gains[g.id] != null
            ? {
                ...g,
                // 재마감해도 중복 누적되지 않도록 이전에 반영한 양을 뺀다.
                completedAmount: Math.max(
                  0,
                  (Number(g.completedAmount) || 0) - (prevGains[g.id] || 0) + gains[g.id]
                ),
              }
            : g
        ),
        days: {
          ...prev.days,
          [date]: {
            ...(prev.days[date] ?? createEmptyDayPlan(date)),
            closed: true,
            pointsAwarded: Math.max(prevAwarded, earned),
            appliedGains: gains,
          },
        },
      };
    });

    if (delta > 0) {
      try {
        await awardPlannerPoints(date, delta, stats.achievementRate, userName);
        onPointsAwarded?.(delta, date);
        setNotice(`오늘 계획 ${Math.round(stats.achievementRate * 100)}% 달성! 💰 ${delta}P 받았어요 🎉`);
      } catch {
        onPointsAwarded?.(delta, date);
        setNotice(`💰 ${delta}P 획득! (서버 반영은 잠시 후 다시 시도할게요 🐾)`);
      }
    } else {
      setNotice('오늘 기록을 저장했어요 🐾');
    }

    // 못 끝낸 목표가 있으면 처리 방법을 묻는다.
    const missed = day.tasks.filter(
      (t) => t.goalId && (t.done ? t.amount : Number(t.doneAmount) || 0) < t.amount
    );
    if (missed.length > 0) setMissModal({ tasks: missed });
  };

  const handleApplyMissStrategy = (strategy) => {
    update((prev) => {
      let nextGoals = prev.goals;
      (missModal?.tasks ?? []).forEach((task) => {
        nextGoals = nextGoals.map((g) => {
          if (g.id !== task.goalId) return g;
          const done = task.done ? task.amount : Number(task.doneAmount) || 0;
          const { goal } = recalcAfterMiss(g, date, task.amount, done, strategy);
          return goal;
        });
      });
      return { ...prev, goals: nextGoals };
    });
    setMissModal(null);
    setNotice(
      strategy === MISS_STRATEGY.PUSH
        ? '못 한 만큼 내일로 옮겼어요. 내일 조금만 더 힘내요! 🐶'
        : '남은 기간에 맞춰 골고루 다시 나눴어요. 부담 없이 가요 🐾'
    );
  };

  // ---- 렌더 -------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <CharacterMascot name="chick" height={64} />
        <p className="text-lg text-amber-700">🐾 오늘의 계획을 가져오는 중...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* 상단: 날짜 + 달성률 + 통계 */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CharacterMascot name="hedgehog" height={54} />
            <div>
              <p className="text-xs font-bold text-rose-400">🐾 오늘 내가 정한 계획, 내가 해내기</p>
              <h2 className="text-2xl font-extrabold text-stone-700">📝 나의 스터디 플래너</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(addDays(date, -1))}
              className="rounded-full bg-amber-100 px-4 py-2 font-extrabold text-amber-700 hover:bg-amber-200"
              aria-label="어제"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setDate(todayKey)}
              className="min-w-44 rounded-full bg-rose-400 px-5 py-2 text-sm font-extrabold text-white shadow-md"
            >
              {date} ({weekdayLabel(date)}) {date === todayKey ? '· 오늘' : ''}
            </button>
            <button
              type="button"
              onClick={() => setDate(addDays(date, 1))}
              className="rounded-full bg-amber-100 px-4 py-2 font-extrabold text-amber-700 hover:bg-amber-200"
              aria-label="내일"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[auto_auto_1fr]">
          <div className="flex items-center justify-center">
            <AchievementRing rate={stats.achievementRate} />
          </div>
          <div className="flex flex-col items-center justify-center gap-2">
            <SubjectDonut shares={stats.subjectShares} mode={statsMode} />
            <div className="flex gap-1">
              <PillButton
                active={statsMode === 'planned'}
                onClick={() => setStatsMode('planned')}
                className="px-3 py-1 text-xs"
              >
                계획
              </PillButton>
              <PillButton
                active={statsMode === 'done'}
                onClick={() => setStatsMode('done')}
                className="px-3 py-1 text-xs"
              >
                완료
              </PillButton>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatBox emoji="📖" label="공부한 페이지" value={`${stats.donePages} / ${stats.plannedPages}p`} tone="rose" />
            <StatBox emoji="✏️" label="푼 문제" value={`${stats.doneProblems} / ${stats.plannedProblems}문제`} tone="sky" />
            <StatBox emoji="✅" label="끝낸 할 일" value={`${stats.doneCount} / ${stats.taskCount}개`} tone="emerald" />
            <StatBox emoji="⏱️" label="계획한 시간" value={`${Math.round(stats.totalMinutes / 60 * 10) / 10}시간`} tone="violet" />
            <StatBox emoji="💰" label="예상 포인트 (30분당 30P)" value={`${calcPlannerPoints(day.tasks)}P / ${calcPlannerMaxPoints(day.tasks)}P`} tone="amber" />
            <div className="col-span-2 flex items-center justify-center rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 p-3 text-center text-sm font-bold text-rose-500 sm:col-span-1">
              {cheerMessage(stats.achievementRate)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {stats.subjectShares.map((share) => (
            <span
              key={share.subject}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-stone-600"
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: share.color }} />
              {share.subject} {Math.round((statsMode === 'done' ? share.doneShare : share.plannedShare) * 100)}%
            </span>
          ))}
          {saving && <span className="text-xs font-bold text-stone-400">저장 중... 🐾</span>}
          {!saving && !saveError && (
            <span className="text-xs font-bold text-emerald-500">구글 시트에 저장됨 ✓</span>
          )}
        </div>

        {notice && (
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-500">{notice}</p>
        )}

        {saveError && (
          <div className="mt-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-extrabold text-amber-700">
              ⚠️ 구글 시트에 저장하지 못했어요. (계획은 이 브라우저에 보관 중이라 사라지지 않아요)
            </p>
            <p className="mt-1 break-all text-xs font-bold text-stone-500">사유: {saveError}</p>
            <p className="mt-1 text-xs font-bold text-stone-400">
              {saveError.includes('콘텐츠 코드')
                ? '이 메시지는 예전 버전의 앱스 스크립트가 응답했다는 뜻이에요. 앱스 스크립트에서 [배포 → 배포 관리 → 수정 → 버전: 새 버전]으로 다시 배포해 주세요.'
                : '앱스 스크립트를 고친 뒤 ‘새 배포’를 만들었는지, .env.local의 주소가 그 새 배포 주소인지 확인해 주세요.'}
            </p>
          </div>
        )}
      </Card>

      {/* 기간 목표 */}
      <Card>
        <SectionTitle
          emoji="🎯"
          subtitle="기간을 정하면 하루 권장량을 자동으로 나눠 줄게요"
          title="나의 기간 목표"
          right={
            <button
              type="button"
              onClick={() => setGoalModalOpen(true)}
              className="rounded-full bg-rose-400 px-4 py-2 text-sm font-extrabold text-white shadow-md hover:bg-rose-500"
            >
              + 목표 만들기
            </button>
          }
        />
        <ExamGoalSuggestion
          examConfig={examConfig}
          completedProblems={completedProblems}
          onAdd={handleAddGoal}
        />
        {goals.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 p-6 text-center text-sm font-bold text-stone-400">
            아직 목표가 없어요. &ldquo;와이수학 1권을 2주 안에 끝내기&rdquo; 같은 목표를 만들어 볼까요? 🦴
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                todayKey={date}
                onRemove={() => handleRemoveGoal(goal.id)}
                onToggleHoliday={(d) => handleToggleHoliday(goal.id, d)}
                onToggleRestWeekday={(w) => handleToggleRestWeekday(goal.id, w)}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 오늘 할 일 */}
        <Card>
          <SectionTitle
            emoji="📋"
            subtitle="시간표에 넣기 전에 먼저 할 일을 적어요"
            title="오늘 할 일"
            right={
              <div className="flex gap-2">
                <PillButton onClick={handleAutoFill}>🐶 목표에서 담기</PillButton>
                <PillButton onClick={handleCopyPreviousDay}>📋 지난 계획 복사</PillButton>
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(true)}
                  className="rounded-full bg-rose-400 px-4 py-2 text-sm font-extrabold text-white shadow-md hover:bg-rose-500"
                >
                  + 직접 추가
                </button>
              </div>
            }
          />
          {day.tasks.length > 0 && (
            <p className="mb-2 rounded-2xl bg-amber-50 px-4 py-2 text-center text-xs font-bold text-stone-500">
              🐾 하나 끝낼 때마다 카드를 눌러 바로 체크하세요. 조금만 했으면 −/+ 로 표시해요.
            </p>
          )}
          {day.tasks.length === 0 ? (
            <p className="rounded-2xl bg-amber-50 p-6 text-center text-sm font-bold text-stone-400">
              오늘 할 일을 담아 주세요 🐾
            </p>
          ) : (
            <ul className="space-y-2">
              {day.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  assigned={assignedTaskIds.has(task.id)}
                  justChecked={justCheckedId === task.id}
                  onToggle={() => handleToggleTask(task.id)}
                  onStep={(delta) => handleStepTask(task.id, delta)}
                  onDuplicate={() => handleDuplicateTask(task.id)}
                  onRemove={() => handleRemoveTask(task.id)}
                />
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={handleCloseDay}
            className="mt-4 w-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-5 py-3 text-base font-extrabold text-white shadow-lg shadow-rose-200 hover:from-rose-500 hover:to-amber-500"
          >
            🐾 오늘 공부 끝! 지금 마감하면 💰 {calcPointDelta(day.tasks, day.pointsAwarded)}P
          </button>
          <p className="mt-2 text-center text-xs font-bold text-stone-400">
            시간표는 &lsquo;가이드&rsquo;일 뿐이에요. 시간을 못 지켜도 괜찮아요 — 오늘 정한 양을 다 하는 게 더 중요해요! 🐶
          </p>
        </Card>

        {/* 시간표 */}
        <Card>
          <SectionTitle
            emoji="⏰"
            subtitle="빈칸을 눌러서 할 일을 넣어요 (끌지 않아도 돼요!)"
            title="오늘의 시간표"
            right={
              day.setupDone ? (
                <div className="flex gap-2">
                <PillButton onClick={handleAutoArrange}>✨ 자동 채우기</PillButton>
                <PillButton onClick={() => setDay((prev) => ({ ...prev, setupDone: false }))}>
                  ⚙️ 다시 설정
                </PillButton>
                </div>
              ) : null
            }
          />

          {!day.setupDone ? (
            <TimetableSetup
              slotMinutes={day.slotMinutes}
              startHour={day.startHour}
              endHour={day.endHour}
              onConfirm={(slotMinutes, startHour, endHour) =>
                setDay((prev) => ({
                  ...prev,
                  slotMinutes,
                  startHour,
                  endHour,
                  setupDone: true,
                  assignments: {},
                }))
              }
            />
          ) : (
            <div
              ref={timetableRef}
              className="max-h-[520px] overflow-y-auto rounded-2xl border-2 border-amber-100 bg-amber-50/40 p-2"
            >
              {slots.map((slot) => {
                const taskId = day.assignments?.[slot.index];
                const task = taskId ? tasksById[taskId] : null;
                const category = task ? CATEGORIES.find((c) => c.key === task.category) : null;
                const isNow =
                  date === todayKey && currentSlotIndex(slots) === slot.index;
                // 긴 할 일이 여러 칸을 차지할 때, 제목은 첫 칸에만 쓰고 나머지 칸은
                // 같은 색 띠만 이어 그린다. 그래야 한 덩어리로 보인다.
                const isBlockStart = !task || day.assignments?.[slot.index - 1] !== taskId;
                const isBlockEnd = !task || day.assignments?.[slot.index + 1] !== taskId;
                if (task && !isBlockStart) {
                  return (
                    <button
                      key={slot.index}
                      data-slot={slot.index}
                      type="button"
                      onClick={() => setSlotPickerIndex(slot.index)}
                      className={`-mt-1.5 mb-1.5 flex w-full items-stretch gap-3 border-2 border-transparent px-2 text-left ${
                        isNow ? 'bg-rose-50' : ''
                      }`}
                    >
                      <span className="w-14 shrink-0 pt-1 text-[11px] font-bold text-stone-300">
                        {slot.label}
                      </span>
                      <span
                        className={`min-h-8 flex-1 ${isBlockEnd ? 'rounded-b-xl' : ''}`}
                        style={{ backgroundColor: `${category?.color ?? '#F9A8D4'}55` }}
                      />
                      {isNow && <span className="shrink-0 text-lg">🐕</span>}
                    </button>
                  );
                }
                return (
                  <button
                    key={slot.index}
                    data-slot={slot.index}
                    type="button"
                    onClick={() => setSlotPickerIndex(slot.index)}
                    className={`mb-1.5 flex w-full items-center gap-3 rounded-2xl border-2 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                      isNow ? 'border-rose-300 bg-rose-50' : 'border-transparent bg-white'
                    }`}
                  >
                    <span className="w-14 shrink-0 text-xs font-extrabold text-stone-400">
                      {slot.label}
                    </span>
                    {task ? (
                      <span
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2"
                        style={{ backgroundColor: `${category?.color ?? '#F9A8D4'}55` }}
                      >
                        <span className="text-lg">{category?.emoji ?? '🐶'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-extrabold text-stone-700">
                            {task.title || task.workbook}
                          </span>
                          <span className="block truncate text-[11px] font-bold text-stone-500">
                            {category?.label} · {task.amount}
                            {task.unit === 'problem' ? '문제' : 'p'}
                          </span>
                        </span>
                        {task.done && <span className="text-lg">✅</span>}
                      </span>
                    ) : (
                      <span className="flex-1 rounded-xl border-2 border-dashed border-amber-200 px-3 py-2 text-xs font-bold text-stone-300">
                        + 여기를 눌러 할 일 넣기
                      </span>
                    )}
                    {isNow && <span className="shrink-0 text-lg">🐕</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 모달들 */}
      {goalModalOpen && (
        <GoalFormModal onClose={() => setGoalModalOpen(false)} onSubmit={handleAddGoal} />
      )}
      {taskModalOpen && (
        <TaskFormModal onClose={() => setTaskModalOpen(false)} onSubmit={handleAddTask} />
      )}
      {slotPickerIndex !== null && (
        <Modal
          title={`${slots[slotPickerIndex]?.label} 에 뭘 할까요?`}
          subtitle="할 일을 고르고, 얼마나 걸릴지 정해요"
          onClose={() => {
            setSlotPickerIndex(null);
            setPickedTaskId(null);
          }}
        >
          {/* 시간 선택은 반드시 목록 '위'에 있어야 한다.
              아래에 두면 할 일이 여러 개일 때 화면 밖으로 밀려서, 아이가 할 일을 눌러도
              아무 변화가 없는 것처럼 보인다. 그러면 시간을 못 정하고 전부 한 칸(기본값)으로만
              들어가고, 3시간짜리 공부를 '단평준비1~6'으로 쪼개는 수밖에 없어진다. */}
          {pickedTaskId ? (
            <div className="mb-4 rounded-2xl border-2 border-rose-200 bg-amber-50 p-4">
              <p className="mb-1 text-sm font-extrabold text-stone-700">
                ⏱️ &lsquo;{day.tasks.find((t) => t.id === pickedTaskId)?.title || '고른 할 일'}&rsquo;
                은 얼마나 걸릴까요?
              </p>
              <p className="mb-3 text-xs font-bold text-stone-400">
                {slots[slotPickerIndex]?.label} 부터 이만큼 시간표를 차지해요
              </p>
              <div className="flex flex-wrap gap-2">
                {DURATION_CHOICES.filter((m) => m >= (day.slotMinutes || DEFAULT_SLOT_MINUTES)).map(
                  (minutes) => (
                    <PillButton
                      key={minutes}
                      onClick={() => {
                        handleAssignSlot(slotPickerIndex, pickedTaskId, minutes);
                        setPickedTaskId(null);
                      }}
                      className="px-4 py-2.5 text-base"
                    >
                      {formatDuration(minutes)}
                    </PillButton>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => setPickedTaskId(null)}
                className="mt-3 text-xs font-bold text-stone-400 underline"
              >
                다른 할 일 고르기
              </button>
            </div>
          ) : (
            day.tasks.length > 0 && (
              <p className="mb-3 rounded-2xl bg-amber-50 px-4 py-2 text-center text-xs font-bold text-stone-500">
                🐾 할 일을 누르면 여기에 시간 선택이 나와요
              </p>
            )
          )}

          {day.tasks.length === 0 ? (
            <p className="p-4 text-center text-sm font-bold text-stone-400">
              먼저 &lsquo;오늘 할 일&rsquo;에 계획을 담아 주세요 🐾
            </p>
          ) : (
            <ul className="space-y-2">
              {day.tasks.map((task) => {
                const category = CATEGORIES.find((c) => c.key === task.category);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setPickedTaskId(task.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-3 text-left shadow-sm hover:border-rose-200 ${
                        pickedTaskId === task.id ? 'border-rose-300' : 'border-white'
                      }`}
                    >
                      <span className="text-2xl">{category?.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-extrabold text-stone-700">
                          {task.title || task.workbook}
                        </span>
                        <span className="block truncate text-xs font-bold text-stone-400">
                          {category?.label} · {task.amount}
                          {task.unit === 'problem' ? '문제' : 'p'} · 약 {task.minutes}분
                        </span>
                      </span>
                      {assignedTaskIds.has(task.id) && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">
                          이미 배정됨
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              handleAssignSlot(slotPickerIndex, null);
              setPickedTaskId(null);
            }}
            className="mt-3 w-full rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-500 hover:bg-stone-200"
          >
            이 칸 비우기
          </button>
        </Modal>
      )}
      {missModal && (
        <MissStrategyModal
          tasks={missModal.tasks}
          onClose={() => setMissModal(null)}
          onSelect={handleApplyMissStrategy}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 하위 컴포넌트
// ---------------------------------------------------------------------------

function StatBox({ emoji, label, value, tone = 'rose' }) {
  const tones = {
    rose: 'text-rose-500',
    sky: 'text-sky-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    amber: 'text-amber-600',
  };
  return (
    <div className="rounded-2xl bg-amber-50 p-3 text-center">
      <p className="text-[11px] font-bold text-stone-400">{label}</p>
      <p className={`text-sm font-extrabold ${tones[tone]}`}>
        {emoji} {value}
      </p>
    </div>
  );
}

/**
 * 할 일 한 줄.
 * 아이가 하나 끝낼 때마다 바로 체크할 수 있도록, 카드 어디를 눌러도 완료/취소가 된다.
 * 숫자 입력 대신 −/+ 버튼으로 "한 만큼"을 조금씩 올린다. (키보드 없이 손가락만으로 조작)
 *
 * 주의: 바깥이 클릭 영역이라 안쪽 조작부는 button이 아닌 div(role="button")로 감싸고,
 * −/+와 삭제는 stopPropagation으로 카드 토글이 같이 일어나지 않게 막는다.
 */
function TaskRow({ task, assigned, justChecked, onToggle, onStep, onDuplicate, onRemove }) {
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

function GoalCard({ goal, todayKey, onRemove, onToggleHoliday, onToggleRestWeekday }) {
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
function hourLabel(h) {
  if (h === 24) return '밤 12시';
  if (h < 12) return `아침 ${h}시`;
  if (h === 12) return '낮 12시';
  return `오후 ${h - 12}시`;
}

function TimetableSetup({ slotMinutes, startHour, endHour, onConfirm }) {
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

function GoalFormModal({ onClose, onSubmit }) {
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

function TaskFormModal({ onClose, onSubmit }) {
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

function MissStrategyModal({ tasks, onClose, onSelect }) {
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-extrabold text-stone-500">{label}</span>
      {children}
    </label>
  );
}

// 시간표에 배정할 때 고를 수 있는 소요 시간(분).
// 시간표 칸 단위보다 짧은 항목은 화면에서 자동으로 걸러진다.
const DURATION_CHOICES = [10, 20, 30, 40, 50, 60, 90, 120, 150, 180];

function formatDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m}분`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

/** 기준 날짜보다 앞선 날 중, 할 일이 하나라도 있던 가장 최근 날짜. 없으면 null */
function findRecentPlannedDate(days = {}, beforeDate) {
  return (
    Object.keys(days)
      .filter((d) => d < beforeDate && (days[d]?.tasks?.length ?? 0) > 0)
      .sort()
      .pop() ?? null
  );
}

// 서버/캐시에서 온 값이 비어 있어도 컴포넌트가 안전하게 돌아가도록 형태를 맞춰 준다.
function normalizePlanner(raw) {
  return {
    goals: Array.isArray(raw?.goals) ? raw.goals : [],
    days: raw?.days && typeof raw.days === 'object' ? raw.days : {},
  };
}
