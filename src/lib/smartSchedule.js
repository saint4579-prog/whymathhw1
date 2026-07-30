// '스마트 추천 시간표' 순수 계산 로직 + 시험 설정(D-day/범위) 저장.
//
// 진짜 AI API를 부르지 않고, 남은 문제 수와 D-day를 바탕으로 '똑똑해 보이는' 알고리즘으로
// 오늘 할당량과 시간 블록을 만들어 낸다. (강아지 튜터 = Fake AI)

import { toDateKey, fromDateKey } from './planner';

const DAY_MS = 24 * 60 * 60 * 1000;

// 오후 시간대에 기본으로 배치할 공부 블록 시각(자정 기준 분). 각 60분짜리 3개.
const BLOCK_TIME_SLOTS = [
  { start: 16 * 60, end: 17 * 60 }, // 오후 4시 ~ 5시
  { start: 17 * 60 + 30, end: 18 * 60 + 30 }, // 오후 5시 30분 ~ 6시 30분
  { start: 19 * 60, end: 20 * 60 }, // 오후 7시 ~ 8시
];

// 분(minutes) -> "오후 5시 30분" 형태의 한국어 표기
export function formatClock(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hour24 = Math.floor(m / 60) % 24;
  const minute = m % 60;
  const period = hour24 < 12 ? '오전' : '오후';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute === 0 ? `${period} ${hour12}시` : `${period} ${hour12}시 ${minute}분`;
}

function isWeekend(dateKey) {
  const day = fromDateKey(dateKey).getDay();
  return day === 0 || day === 6; // 일(0), 토(6)
}

// 오늘부터 시험일까지 남은 일수(D-day 숫자). 오늘이 시험일이면 0, 지났으면 음수.
export function daysUntil(examDate, today = toDateKey()) {
  if (!examDate) return null;
  const diff = fromDateKey(examDate).getTime() - fromDateKey(today).getTime();
  return Math.round(diff / DAY_MS);
}

// D-day 라벨: D-3 / D-DAY / D+2
export function formatDday(examDate, today = toDateKey()) {
  const d = daysUntil(examDate, today);
  if (d == null) return '';
  if (d > 0) return `D-${d}`;
  if (d === 0) return 'D-DAY';
  return `D+${-d}`;
}

// total을 count개로 앞에서부터 고르게 쪼갠다. 예) splitEven(11, 2) -> [6, 5]
function splitEven(total, count) {
  const amount = Math.max(0, Math.round(Number(total) || 0));
  const n = Math.max(1, Math.round(Number(count) || 1));
  const base = Math.floor(amount / n);
  const remainder = amount % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * 오늘의 추천 시간표를 만든다.
 *
 * 계산 순서
 * 1) 남은 문제 수 = 전체 - 이미 푼 수
 * 2) D-day 남은 일수만큼 오늘부터 날짜를 훑으며 요일 가중치를 매긴다. (주말 1.5배)
 * 3) 오늘 할당량 = ceil( 가중치 1당 분량 × 오늘 가중치 ). 소수는 반드시 올림해 정수로.
 * 4) 오늘 할당량을 2~3개의 시간 블록으로 쪼갠다.
 *
 * @returns {{
 *   hasExam, examDate, dday, ddayLabel, remaining, total, completed,
 *   remainingDays, dailyAverage, todayQuota, isWeekendToday, scopeLabel,
 *   blocks: Array<{ id, startLabel, endLabel, timeLabel, count, unit, text }>
 * }}
 */
export function generateSmartSchedule({
  totalProblems,
  completedProblems = 0,
  examDate,
  today = toDateKey(),
  scopeLabel = '시험 범위',
  unit = '문제',
} = {}) {
  const total = Math.max(0, Math.round(Number(totalProblems) || 0));
  const completed = Math.max(0, Math.round(Number(completedProblems) || 0));
  const remaining = Math.max(0, total - completed);
  const dday = daysUntil(examDate, today);

  const base = {
    hasExam: Boolean(examDate) && total > 0,
    examDate: examDate ?? null,
    dday,
    ddayLabel: formatDday(examDate, today),
    total,
    completed,
    remaining,
    scopeLabel,
    unit,
    isWeekendToday: examDate ? isWeekend(today) : false,
    remainingDays: 0,
    dailyAverage: 0,
    todayQuota: 0,
    blocks: [],
  };

  if (!base.hasExam || remaining <= 0) return base;

  // 시험이 오늘이거나 지났으면 최소 하루(오늘)는 벼락치기로 잡는다.
  const remainingDays = Math.max(1, dday);

  // 오늘부터 remainingDays일 동안의 요일 가중치 합
  let weightedSum = 0;
  let cursor = today;
  for (let i = 0; i < remainingDays; i += 1) {
    weightedSum += isWeekend(cursor) ? 1.5 : 1;
    cursor = toDateKey(new Date(fromDateKey(cursor).getTime() + DAY_MS));
  }

  const perWeight = weightedSum > 0 ? remaining / weightedSum : remaining;
  const todayWeight = isWeekend(today) ? 1.5 : 1;
  // 소수점이 나오면 Math.ceil로 올림 → 남은 기간 안에 부족함 없이 끝낼 수 있다.
  const todayQuota = Math.min(remaining, Math.max(1, Math.ceil(perWeight * todayWeight)));
  const dailyAverage = Math.ceil(remaining / remainingDays);

  // 할당량을 2~3개 블록으로 쪼갠다. (1문제면 1블록, 15문제 이상이면 3블록)
  const blockCount = todayQuota <= 1 ? 1 : todayQuota >= 15 ? 3 : 2;
  const counts = splitEven(todayQuota, blockCount).filter((c) => c > 0);

  const blocks = counts.map((count, i) => {
    const slot = BLOCK_TIME_SLOTS[i] ?? BLOCK_TIME_SLOTS[BLOCK_TIME_SLOTS.length - 1];
    const startLabel = formatClock(slot.start);
    const endLabel = formatClock(slot.end);
    const timeLabel = `${startLabel}~${endLabel}`;
    return {
      id: `block-${i}`,
      startLabel,
      endLabel,
      timeLabel,
      count,
      unit,
      text: `${timeLabel}: ${scopeLabel} ${count}${unit} 풀기`,
    };
  });

  return { ...base, remainingDays, dailyAverage, todayQuota, blocks };
}

// ---------------------------------------------------------------------------
// 시험 설정(D-day / 범위) 저장 — 월간/스터디/오늘 할 일 탭이 공유한다.
// ---------------------------------------------------------------------------

const EXAM_KEY_PREFIX = 'smart-exam-config';

function examKey(userName) {
  return `${EXAM_KEY_PREFIX}:${userName || 'guest'}`;
}

export function defaultExamConfig() {
  return { examDate: '', totalProblems: 0, scopeLabel: '황소 중2상 1단원' };
}

export function loadExamConfig(userName) {
  if (typeof window === 'undefined') return defaultExamConfig();
  try {
    const raw = window.localStorage.getItem(examKey(userName));
    if (!raw) return defaultExamConfig();
    const parsed = JSON.parse(raw);
    return { ...defaultExamConfig(), ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return defaultExamConfig();
  }
}

export function saveExamConfig(userName, config) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(examKey(userName), JSON.stringify(config));
  } catch {
    // 저장소가 막힌 환경에서도 화면 상태는 유지된다.
  }
}

// ---------------------------------------------------------------------------
// 다중 시험 등록 (여러 개의 시험을 배열로 관리)
// 시험 하나 = { id, name, examDate, totalProblems }
// 저장은 플래너 블롭(exams)에 하고, localStorage(smart-exams)는 빠른 표시용 캐시.
// 기존 소비자(스터디 플래너/오늘 할 일)에는 pickPrimaryExam→examToConfig로 "가장 임박한 시험 1개"만 넘긴다.
// ---------------------------------------------------------------------------

const EXAMS_KEY_PREFIX = 'smart-exams';

function examsKey(userName) {
  return `${EXAMS_KEY_PREFIX}:${userName || 'guest'}`;
}

export function makeExam(partial = {}) {
  return {
    id: partial.id ?? `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: partial.name ?? '',
    examDate: partial.examDate ?? '',
    totalProblems: Math.max(0, Math.round(Number(partial.totalProblems) || 0)),
  };
}

// 서버/캐시에서 온 값이 배열이 아니거나, 구버전 단일 examConfig여도 안전하게 배열로 정규화한다.
export function normalizeExams(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(makeExam);
  if (raw && typeof raw === 'object' && raw.examDate) {
    return [makeExam({ name: raw.scopeLabel || '시험', examDate: raw.examDate, totalProblems: raw.totalProblems })];
  }
  return [];
}

export function loadExams(userName) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(examsKey(userName));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(makeExam);
    }
  } catch {
    // 무시하고 마이그레이션 시도
  }
  // 구버전 단일 시험 설정 → 배열로 마이그레이션
  const legacy = loadExamConfig(userName);
  if (legacy && legacy.examDate && Number(legacy.totalProblems) > 0) {
    return [makeExam({ name: legacy.scopeLabel || '시험', examDate: legacy.examDate, totalProblems: legacy.totalProblems })];
  }
  return [];
}

export function saveExams(userName, exams) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(examsKey(userName), JSON.stringify(Array.isArray(exams) ? exams : []));
  } catch {
    // 저장 실패는 무시 (블롭/GAS 저장이 별도로 이뤄짐)
  }
}

// 여러 시험 중 "가장 임박한(오늘 이후 가장 가까운)" 시험을 고른다. 다 지났으면 가장 최근 것.
export function pickPrimaryExam(exams, today = toDateKey()) {
  const list = (exams || []).filter((e) => e && e.examDate);
  if (list.length === 0) return null;
  const upcoming = list.filter((e) => e.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate));
  if (upcoming.length > 0) return upcoming[0];
  return [...list].sort((a, b) => b.examDate.localeCompare(a.examDate))[0];
}

// 시험 1개 → 기존 로직이 쓰는 examConfig 형태({ examDate, totalProblems, scopeLabel })로 변환.
export function examToConfig(exam) {
  if (!exam) return defaultExamConfig();
  return {
    examDate: exam.examDate || '',
    totalProblems: exam.totalProblems || 0,
    scopeLabel: exam.name || '시험 범위',
  };
}
