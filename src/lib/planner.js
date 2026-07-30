// 아이 주도형 일일 스터디 플래너의 순수 계산 로직 모음.
// UI(컴포넌트)와 통신(api.js)에서 완전히 분리해 두어야 테스트와 재사용이 쉽다.
// 여기 있는 함수는 전부 부수효과가 없고, 입력을 바꾸지 않고 새 객체를 돌려준다.

// ---------------------------------------------------------------------------
// 1. 상수 정의
// ---------------------------------------------------------------------------

// 할 일 카테고리. subject는 통계 차트에서 국어/영어/수학 비중을 낼 때 쓰인다.
export const CATEGORIES = [
  { key: 'HW_YI', label: '숙제-와이(수학)', subject: '수학', emoji: '🐶', color: '#F9A8D4' },
  { key: 'HW_HWANGSO', label: '숙제-황소(수학)', subject: '수학', emoji: '🐮', color: '#F472B6' },
  { key: 'HW_APRAB', label: '숙제-에이프랩(영어)', subject: '영어', emoji: '🐤', color: '#FCD34D' },
  { key: 'HW_GIPARANG', label: '숙제-기파랑(국어)', subject: '국어', emoji: '🐰', color: '#93C5FD' },
  { key: 'HW_ETC', label: '숙제-기타', subject: '기타', emoji: '🐹', color: '#C4B5FD' },
  { key: 'SELF', label: '내공부', subject: '기타', emoji: '🐻', color: '#86EFAC' },
];

export const SUBJECTS = ['국어', '영어', '수학', '기타'];

export const SUBJECT_COLORS = {
  국어: '#93C5FD',
  영어: '#FCD34D',
  수학: '#F472B6',
  기타: '#C4B5FD',
};

// 카테고리별 기본 문제집 후보. 아이가 드롭다운에서 고르고, 없으면 직접 입력할 수 있다.
export const DEFAULT_WORKBOOKS = {
  HW_YI: ['와이수학 문제집 1권', '와이수학 문제집 2권', '와이수학 문제집 3권', '와이수학 문제집 4권'],
  HW_HWANGSO: ['황소 수학 A', '황소 수학 B', '황소 수학 심화'],
  HW_APRAB: ['에이프랩 영어 리딩', '에이프랩 영어 문법', '에이프랩 영어 단어장'],
  HW_GIPARANG: ['기파랑 국어 독해', '기파랑 국어 어휘'],
  HW_ETC: ['기타 숙제'],
  SELF: ['내가 정한 공부', '독서', '오답노트 정리'],
};

// 단위: 페이지 / 문제
export const UNITS = [
  { key: 'page', label: '페이지', short: 'p', emoji: '📖' },
  { key: 'problem', label: '문제', short: '문제', emoji: '✏️' },
];

// 시간표 설정값
export const SLOT_MINUTE_OPTIONS = [10, 30, 60];
export const DEFAULT_SLOT_MINUTES = 30;
export const TIMETABLE_START_HOUR = 7; // 아침 7시
export const TIMETABLE_MAX_HOUR = 24; // 밤 12시(자정)
export const DEFAULT_END_HOUR = 22;

// 할 일 1개당 기본 소요 시간(분). "할 일 1개 = 30분 분량"이라는 규칙의 근거값.
export const DEFAULT_TASK_MINUTES = 30;

// 하루 목표를 100% 달성했을 때 받는 최대 포인트.
// 실제 지급액 = 달성률 × MAX_DAILY_PLANNER_POINTS (반올림).
export const MAX_DAILY_PLANNER_POINTS = 100;

export const MISS_STRATEGY = {
  PUSH: 'push', // 못 한 만큼 그대로 내일로 미루기
  REDISTRIBUTE: 'redistribute', // 남은 기간에 맞춰 n분의 1로 다시 나누기
};

// ---------------------------------------------------------------------------
// 2. 날짜 유틸 (전부 'YYYY-MM-DD' 로컬 문자열 기준)
// ---------------------------------------------------------------------------

export function toDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function fromDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(key, days) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function compareDateKey(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function weekdayLabel(key) {
  return WEEKDAY_LABELS[fromDateKey(key).getDay()];
}

/**
 * start~end(양끝 포함) 사이에서 '공부하는 날'만 뽑아 준다.
 * holidays에 들어 있는 날짜와, 요일 단위 휴일(restWeekdays: [0,6] 등)은 제외한다.
 */
export function listStudyDates(startDate, endDate, holidays = [], restWeekdays = []) {
  if (!startDate || !endDate || compareDateKey(startDate, endDate) > 0) return [];
  const holidaySet = new Set(holidays);
  const restSet = new Set(restWeekdays.map(Number));
  const dates = [];
  let cursor = startDate;
  // 무한 루프 방지용 상한 (약 2년)
  for (let guard = 0; guard < 800 && compareDateKey(cursor, endDate) <= 0; guard += 1) {
    const isHoliday = holidaySet.has(cursor) || restSet.has(fromDateKey(cursor).getDay());
    if (!isHoliday) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// 3. 목표량 분배
// ---------------------------------------------------------------------------

/**
 * total을 slots개로 최대한 고르게 쪼갠다. 나머지는 앞쪽 날짜부터 1씩 더 얹는다.
 * 예) distributeAmount(10, 3) -> [4, 3, 3]
 * 결과 배열의 합은 항상 total과 같다. (아이가 "왜 총합이 안 맞지?" 하는 일이 없도록)
 */
export function distributeAmount(total, slots) {
  const amount = Math.max(0, Math.round(Number(total) || 0));
  const count = Math.max(0, Math.round(Number(slots) || 0));
  if (count === 0) return [];
  const base = Math.floor(amount / count);
  const remainder = amount % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * 목표(goal) 하나를 날짜별 권장량 맵으로 펼친다.
 *
 * goal = {
 *   id, category, workbook, title, unit,
 *   totalAmount,       // 전체 페이지 수 또는 문제 수
 *   startAmount,       // (선택) 시작 페이지 번호. 표시용
 *   startDate, endDate,
 *   holidays: ['2026-07-28'],   // 아이가 콕 집어 쉬기로 한 날
 *   restWeekdays: [0],          // 매주 쉬는 요일 (0=일)
 *   completedAmount,            // 지금까지 실제로 끝낸 양
 *   strategy,                   // 미달성 처리 방식
 *   carryOver,                  // PUSH 방식에서 다음 날로 넘어온 밀린 양
 * }
 *
 * @returns {{ [dateKey: string]: number }}
 */
export function buildGoalSchedule(goal, { fromDate = null } = {}) {
  if (!goal || !goal.startDate || !goal.endDate) return {};
  const total = Math.max(0, Math.round(Number(goal.totalAmount) || 0));
  const done = Math.max(0, Math.round(Number(goal.completedAmount) || 0));
  const carryOver = Math.max(0, Math.round(Number(goal.carryOver) || 0));
  const remainingTotal = Math.max(0, total - done);
  // 밀린 분량(carryOver)은 아직 안 끝낸 양이라 remainingTotal에 이미 포함돼 있다.
  // 첫날에 따로 얹을 것이므로 나머지 날에 나눌 때는 빼 둔다. (이중 계산 방지)
  const spreadTotal = Math.max(0, remainingTotal - carryOver);

  // 목표 전체 기간의 공부일. PUSH 방식에서 "원래 정한 하루치"의 기준이 된다.
  const allDates = listStudyDates(goal.startDate, goal.endDate, goal.holidays, goal.restWeekdays);
  // 오늘(또는 fromDate) 이후 남은 공부 가능일
  const anchor = fromDate && compareDateKey(fromDate, goal.startDate) > 0 ? fromDate : goal.startDate;
  const dates = allDates.filter((d) => compareDateKey(d, anchor) >= 0);
  if (dates.length === 0) return {};

  let amounts;
  if (goal.strategy === MISS_STRATEGY.PUSH) {
    // 미루기 방식: 처음 정한 하루치를 그대로 지킨다. 밀린 양만 첫날에 몰아서 얹는다.
    const baseline = distributeAmount(total, allDates.length);
    amounts = trimToTotal(baseline.slice(allDates.length - dates.length), spreadTotal);
  } else {
    // 재계산 방식: 남은 분량을 남은 날에 다시 n분의 1 한다.
    amounts = distributeAmount(spreadTotal, dates.length);
  }

  const schedule = {};
  dates.forEach((date, index) => {
    schedule[date] = amounts[index] ?? 0;
  });
  if (carryOver > 0) schedule[dates[0]] += carryOver;
  return schedule;
}

/** 배열의 합이 cap을 넘지 않도록 뒤쪽 날짜부터 깎는다. (계획을 앞당겨 끝냈을 때 대비) */
function trimToTotal(amounts, cap) {
  const next = [...amounts];
  let excess = next.reduce((sum, v) => sum + v, 0) - Math.max(0, cap);
  for (let i = next.length - 1; i >= 0 && excess > 0; i -= 1) {
    const cut = Math.min(next[i], excess);
    next[i] -= cut;
    excess -= cut;
  }
  return next;
}

/** 특정 날짜에 이 목표로 해야 할 권장량 */
export function getDailyQuota(goal, dateKey, options = {}) {
  const schedule = buildGoalSchedule(goal, options);
  return schedule[dateKey] ?? 0;
}

/**
 * 목표 진행 요약. 진행바/응원 문구에 쓴다.
 */
export function summarizeGoal(goal, todayKey = toDateKey()) {
  const total = Math.max(0, Math.round(Number(goal?.totalAmount) || 0));
  const done = Math.min(total, Math.max(0, Math.round(Number(goal?.completedAmount) || 0)));
  const remaining = total - done;
  const remainingDays = listStudyDates(
    compareDateKey(todayKey, goal?.startDate ?? todayKey) > 0 ? todayKey : goal?.startDate,
    goal?.endDate,
    goal?.holidays,
    goal?.restWeekdays
  ).length;
  return {
    total,
    done,
    remaining,
    remainingDays,
    progressRate: total > 0 ? done / total : 0,
    perDay: remainingDays > 0 ? Math.ceil(remaining / remainingDays) : remaining,
    isFinished: total > 0 && done >= total,
    isOverdue: remainingDays === 0 && remaining > 0,
  };
}

/**
 * 오늘 목표를 다 못 끝냈을 때의 재계산.
 *
 * - PUSH:         못 한 만큼(shortfall)을 통째로 다음 공부일에 얹는다. 나머지 날은 그대로.
 * - REDISTRIBUTE: 남은 전체 분량을 남은 공부일 수로 다시 n분의 1 한다. 하루가 조금씩 늘어난다.
 *
 * @returns {{ goal, schedule, shortfall, nextDate, beforePerDay, afterPerDay }}
 */
export function recalcAfterMiss(goal, todayKey, plannedAmount, doneAmount, strategy) {
  const planned = Math.max(0, Math.round(Number(plannedAmount) || 0));
  const finished = Math.max(0, Math.round(Number(doneAmount) || 0));
  const shortfall = Math.max(0, planned - finished);
  const nextDate = nextStudyDate(goal, todayKey);

  const beforeSchedule = buildGoalSchedule(goal, { fromDate: todayKey });
  const beforePerDay = nextDate ? beforeSchedule[nextDate] ?? 0 : 0;

  if (shortfall === 0 || !nextDate) {
    return {
      goal: { ...goal, carryOver: 0 },
      schedule: buildGoalSchedule({ ...goal, carryOver: 0 }, { fromDate: nextDate ?? todayKey }),
      shortfall,
      nextDate,
      beforePerDay,
      afterPerDay: beforePerDay,
    };
  }

  const nextGoal =
    strategy === MISS_STRATEGY.PUSH
      ? { ...goal, carryOver: Math.max(0, Number(goal.carryOver) || 0) + shortfall, strategy }
      : { ...goal, carryOver: 0, strategy };

  const schedule = buildGoalSchedule(nextGoal, { fromDate: nextDate });
  return {
    goal: nextGoal,
    schedule,
    shortfall,
    nextDate,
    beforePerDay,
    afterPerDay: schedule[nextDate] ?? 0,
  };
}

/** 오늘 다음으로 공부하는 날 (휴일 건너뜀). 기간이 끝났으면 null */
export function nextStudyDate(goal, todayKey) {
  const dates = listStudyDates(
    addDays(todayKey, 1),
    goal?.endDate,
    goal?.holidays,
    goal?.restWeekdays
  );
  return dates.length > 0 ? dates[0] : null;
}

/**
 * 목표 목록에서 특정 날짜의 할 일 후보를 만들어 준다.
 * 아이가 "오늘 할 일 자동으로 담기" 버튼을 눌렀을 때 쓰인다.
 */
export function buildTasksForDate(goals = [], dateKey) {
  return goals
    .map((goal) => {
      const amount = getDailyQuota(goal, dateKey, { fromDate: dateKey });
      if (amount <= 0) return null;
      const category = CATEGORIES.find((c) => c.key === goal.category);
      return {
        id: `${goal.id}-${dateKey}`,
        goalId: goal.id,
        category: goal.category,
        subject: category?.subject ?? '기타',
        workbook: goal.workbook,
        title: goal.title || goal.workbook,
        unit: goal.unit || 'page',
        amount,
        doneAmount: 0,
        done: false,
        minutes: DEFAULT_TASK_MINUTES,
      };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// 4. 시간표
// ---------------------------------------------------------------------------

/**
 * 아침 7시부터 아이가 정한 종료 시각까지, slotMinutes 단위의 빈칸을 만든다.
 * @returns [{ index, startMinutes, endMinutes, label }]
 */
export function buildTimeSlots(
  startHour = TIMETABLE_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  slotMinutes = DEFAULT_SLOT_MINUTES
) {
  const step = SLOT_MINUTE_OPTIONS.includes(Number(slotMinutes))
    ? Number(slotMinutes)
    : DEFAULT_SLOT_MINUTES;
  const rawStart = Number(startHour);
  const start = Number.isFinite(rawStart)
    ? Math.min(TIMETABLE_MAX_HOUR - 1, Math.max(0, rawStart))
    : TIMETABLE_START_HOUR;
  const end = Math.min(TIMETABLE_MAX_HOUR, Math.max(start + 1, Number(endHour) || DEFAULT_END_HOUR));
  const startMin = start * 60;
  const endMin = end * 60;
  const slots = [];
  for (let m = startMin, index = 0; m < endMin; m += step, index += 1) {
    slots.push({
      index,
      startMinutes: m,
      endMinutes: Math.min(m + step, endMin),
      label: formatMinutes(m),
      endLabel: formatMinutes(Math.min(m + step, endMin)),
    });
  }
  return slots;
}

export function formatMinutes(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hour = Math.floor(m / 60) % 24;
  const minute = m % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** 지금 시각이 몇 번째 슬롯인지. 시간표 진입 시 자동 스크롤 위치 계산에 쓴다. */
export function currentSlotIndex(slots = [], now = new Date()) {
  if (slots.length === 0) return 0;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes <= slots[0].startMinutes) return 0;
  const found = slots.findIndex((slot) => nowMinutes >= slot.startMinutes && nowMinutes < slot.endMinutes);
  return found >= 0 ? found : slots.length - 1;
}

/** 할 일 1개당 기본 30분 → 슬롯 몇 칸을 차지하는지 */
export function slotSpanForTask(task, slotMinutes = DEFAULT_SLOT_MINUTES) {
  const minutes = Math.max(slotMinutes, Number(task?.minutes) || DEFAULT_TASK_MINUTES);
  return Math.max(1, Math.round(minutes / slotMinutes));
}

// ---------------------------------------------------------------------------
// 5. 통계 & 포인트
// ---------------------------------------------------------------------------

/**
 * 오늘의 공부 통계. 과목 비중 차트와 "몇 페이지 / 몇 문제" 요약에 그대로 꽂아 쓴다.
 */
export function calcDayStats(tasks = []) {
  const bySubject = {};
  SUBJECTS.forEach((subject) => {
    bySubject[subject] = { planned: 0, done: 0, minutes: 0, count: 0 };
  });

  let plannedPages = 0;
  let donePages = 0;
  let plannedProblems = 0;
  let doneProblems = 0;
  let plannedTotal = 0;
  let doneTotal = 0;
  let doneCount = 0;

  tasks.forEach((task) => {
    const category = CATEGORIES.find((c) => c.key === task.category);
    const subject = task.subject ?? category?.subject ?? '기타';
    const planned = Math.max(0, Number(task.amount) || 0);
    const done = task.done
      ? Math.max(0, Number(task.doneAmount) || planned)
      : Math.max(0, Number(task.doneAmount) || 0);

    if (!bySubject[subject]) bySubject[subject] = { planned: 0, done: 0, minutes: 0, count: 0 };
    bySubject[subject].planned += planned;
    bySubject[subject].done += done;
    bySubject[subject].minutes += Number(task.minutes) || DEFAULT_TASK_MINUTES;
    bySubject[subject].count += 1;

    plannedTotal += planned;
    doneTotal += Math.min(done, planned);
    if (task.done) doneCount += 1;

    if (task.unit === 'problem') {
      plannedProblems += planned;
      doneProblems += done;
    } else {
      plannedPages += planned;
      donePages += done;
    }
  });

  const achievementRate = plannedTotal > 0 ? Math.min(1, doneTotal / plannedTotal) : 0;

  // 원형 차트용: 계획된 분량 기준 과목 비중(%)
  const subjectShares = SUBJECTS.map((subject) => {
    const entry = bySubject[subject] ?? { planned: 0, done: 0, minutes: 0, count: 0 };
    return {
      subject,
      color: SUBJECT_COLORS[subject],
      planned: entry.planned,
      done: entry.done,
      minutes: entry.minutes,
      count: entry.count,
      plannedShare: plannedTotal > 0 ? entry.planned / plannedTotal : 0,
      doneShare: doneTotal > 0 ? entry.done / doneTotal : 0,
    };
  }).filter((entry) => entry.count > 0);

  return {
    taskCount: tasks.length,
    doneCount,
    plannedTotal,
    doneTotal,
    achievementRate,
    plannedPages,
    donePages,
    plannedProblems,
    doneProblems,
    totalMinutes: tasks.reduce((sum, t) => sum + (Number(t.minutes) || DEFAULT_TASK_MINUTES), 0),
    bySubject,
    subjectShares,
  };
}

// 30분짜리 계획 1칸을 완료할 때마다 주는 포인트.
export const POINTS_PER_SLOT = 30;

// 할 일 하나가 몇 개의 30분 칸에 해당하는지. (예상 시간 기준, 최소 1칸)
export function taskSlotCount(task) {
  const minutes = Math.max(1, Number(task?.minutes) || DEFAULT_TASK_MINUTES);
  return Math.max(1, Math.round(minutes / 30));
}

/**
 * 30분 단위 포인트. "계획(할 일)을 완료할 때마다 30분당 30P".
 * 예) 30분짜리 할 일 완료 → 30P, 60분짜리 완료 → 60P.
 * 완료한(done) 할 일만 계산한다.
 */
export function calcPlannerPoints(tasks = []) {
  return tasks.reduce(
    (sum, t) => sum + (t.done ? taskSlotCount(t) * POINTS_PER_SLOT : 0),
    0
  );
}

/** 오늘 계획을 전부 완료했을 때 받을 수 있는 최대 포인트. (예상 포인트 표시용) */
export function calcPlannerMaxPoints(tasks = []) {
  return tasks.reduce((sum, t) => sum + taskSlotCount(t) * POINTS_PER_SLOT, 0);
}

/**
 * 이미 지급한 포인트를 빼고, 이번에 추가로 줄 포인트만 계산한다.
 * (아이가 체크했다 풀었다 반복해도 포인트가 중복 지급되지 않는다.)
 */
export function calcPointDelta(tasks = [], alreadyAwarded = 0) {
  const earned = calcPlannerPoints(tasks);
  return Math.max(0, earned - Math.max(0, Math.round(Number(alreadyAwarded) || 0)));
}

/** 달성률에 맞춘 강아지 응원 문구 */
export function cheerMessage(rate) {
  if (rate >= 1) return '오늘 계획 전부 완료! 최고의 하루였어요 🐶🎉';
  if (rate >= 0.7) return '거의 다 왔어요! 조금만 더 힘내요 🐾';
  if (rate >= 0.4) return '절반쯤 왔어요. 잘하고 있어요 🐕';
  if (rate > 0) return '시작이 반이에요! 하나씩 해봐요 🐶';
  return '오늘 할 일을 골라서 시간표에 담아 볼까요? 🦴';
}

// ---------------------------------------------------------------------------
// 6. 하루 계획 기본값
// ---------------------------------------------------------------------------

export function createEmptyDayPlan(dateKey = toDateKey()) {
  return {
    date: dateKey,
    slotMinutes: DEFAULT_SLOT_MINUTES,
    startHour: TIMETABLE_START_HOUR,
    endHour: DEFAULT_END_HOUR,
    setupDone: false, // 시작·종료시각을 아직 고르지 않은 상태
    tasks: [],
    assignments: {}, // { [slotIndex]: taskId }
    pointsAwarded: 0,
    closed: false, // 하루 마감(결과 체크) 완료 여부
  };
}

export function createTask(partial = {}) {
  const category = CATEGORIES.find((c) => c.key === partial.category) ?? CATEGORIES[0];
  return {
    id: partial.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    goalId: partial.goalId ?? null,
    category: category.key,
    subject: category.subject,
    workbook: partial.workbook ?? DEFAULT_WORKBOOKS[category.key]?.[0] ?? '',
    title: partial.title ?? '',
    unit: partial.unit ?? 'page',
    amount: Math.max(0, Math.round(Number(partial.amount) || 0)),
    doneAmount: 0,
    done: false,
    minutes: Number(partial.minutes) || DEFAULT_TASK_MINUTES,
  };
}

export function createGoal(partial = {}) {
  const today = toDateKey();
  const category = CATEGORIES.find((c) => c.key === partial.category) ?? CATEGORIES[0];
  return {
    id: partial.id ?? `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: category.key,
    workbook: partial.workbook ?? DEFAULT_WORKBOOKS[category.key]?.[0] ?? '',
    title: partial.title ?? '',
    unit: partial.unit ?? 'page',
    totalAmount: Math.max(0, Math.round(Number(partial.totalAmount) || 0)),
    completedAmount: 0,
    startDate: partial.startDate ?? today,
    endDate: partial.endDate ?? addDays(today, 13),
    holidays: partial.holidays ?? [],
    restWeekdays: partial.restWeekdays ?? [],
    strategy: partial.strategy ?? MISS_STRATEGY.REDISTRIBUTE,
    carryOver: 0,
  };
}
