// 망각곡선 기반 복습 주기 (Leitner 방식 간이 구현)
//
// 예전에는 이 기기의 localStorage에 마지막 풀이 시각을 적어 두고 그걸로 복습 주기를 셌다.
// 주석에는 "구글 시트에는 마지막 풀이 시각이 저장되지 않으므로"라고 되어 있었지만,
// 사실 학습기록 시트의 A열이 풀이 일시이고 doGet이 그걸 historyLogs로 내려주고 있었다.
//
// 그래서 이제 시트의 historyLogs를 1순위로 쓴다. 덕분에
//   - 아이패드에서 푼 것이 노트북에서도 복습으로 뜬다 (기기 간 동기화)
//   - 체크리스트에서 체크한 날짜도 그대로 복습 기준이 된다
// localStorage는 시트 기록이 아직 없을 때만 쓰는 예비 수단으로 남겨 둔다.

// 이름 없이 한 칸에 저장하면 같은 브라우저를 쓰는 다른 아이의 복습 기록이 섞인다.
// 아이 이름을 붙여 나눠 담는다. (시트가 원본이고 이건 예비 수단이라 옮겨오지 않아도 된다)
const STORAGE_BASE = 'mathReview.schedule.v1';

function scheduleKey(userName) {
  return `${STORAGE_BASE}:${String(userName ?? '').trim() || 'guest'}`;
}

/** 이름 없이 저장하던 시절의 값. 남겨 두면 다른 아이에게도 보인다. */
export function clearLegacyScheduleKey() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_BASE);
  } catch {
    // 저장소를 못 쓰는 환경이면 넘어간다.
  }
}
const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

function loadSchedule(userName) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(scheduleKey(userName));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSchedule(schedule, userName) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(scheduleKey(userName), JSON.stringify(schedule));
  } catch {
    // 저장 실패(용량 초과 등)는 복습 기능에만 영향을 주므로 조용히 무시한다.
  }
}

// 채점 결과를 이 기기에도 기록해 둔다. (시트 저장이 실패한 경우의 예비 수단)
export function recordAttempt(rowNumber, isCorrect, userName) {
  const schedule = loadSchedule(userName);
  const prevStage = schedule[rowNumber]?.stage ?? -1;
  const nextStage = isCorrect === 'O' ? Math.min(prevStage + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0;
  schedule[rowNumber] = { lastAttemptAt: new Date().toISOString(), stage: nextStage };
  saveSchedule(schedule, userName);
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value);
  // '2026-07-30 12:00:00' 형태는 사파리가 못 읽으므로 공백을 T로 바꿔 준다.
  const normalized = /^\d{4}-\d{2}-\d{2} /.test(raw) ? raw.replace(' ', 'T') : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 한 문제의 복습 상태를 계산한다.
 *
 * stage(단계)는 '연속으로 맞힌 횟수'다. 한 번 틀리면 0으로 돌아간다.
 * 단계별 복습 간격은 1일 → 3일 → 7일 → 14일 → 30일.
 */
export function getReviewState(problem, now = Date.now()) {
  const logs = Array.isArray(problem?.historyLogs) ? problem.historyLogs.filter(Boolean) : [];

  if (logs.length === 0) {
    // 시트 기록이 없으면 이 기기의 예전 기록을 본다.
    const entry = loadSchedule(problem?.userName)[problem?.rowNumber];
    const graded = problem?.isCorrect === 'O' || problem?.isCorrect === 'X';
    if (!entry && !graded) {
      return {
        attempted: false,
        lastDate: null,
        stage: 0,
        intervalDays: 0,
        nextDueAt: null,
        isDue: false,
        daysLate: 0,
      };
    }
    const last = entry?.lastAttemptAt ? parseDate(entry.lastAttemptAt) : null;
    const stage = Math.max(0, entry?.stage ?? 0);
    const intervalDays = REVIEW_INTERVAL_DAYS[Math.min(stage, REVIEW_INTERVAL_DAYS.length - 1)];
    // 기록이 아예 없는 예전 풀이 문제는 지금 바로 복습 대상으로 본다.
    const nextDueAt = last ? last.getTime() + intervalDays * DAY_MS : now;
    return {
      attempted: true,
      lastDate: last,
      stage,
      intervalDays,
      nextDueAt,
      isDue: now >= nextDueAt,
      daysLate: Math.max(0, Math.floor((now - nextDueAt) / DAY_MS)),
    };
  }

  // 마지막에서 거꾸로 세어 '연속 정답' 횟수를 구한다.
  let stage = 0;
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (String(logs[i].isCorrect || '').toUpperCase() === 'O') stage += 1;
    else break;
  }
  stage = Math.min(stage, REVIEW_INTERVAL_DAYS.length - 1);

  const lastDate = parseDate(logs[logs.length - 1]?.date);
  const intervalDays = REVIEW_INTERVAL_DAYS[stage];
  const nextDueAt = lastDate ? lastDate.getTime() + intervalDays * DAY_MS : now;

  return {
    attempted: true,
    lastDate,
    stage,
    intervalDays,
    nextDueAt,
    isDue: now >= nextDueAt,
    daysLate: Math.max(0, Math.floor((now - nextDueAt) / DAY_MS)),
  };
}

/** 복습 주기가 도래한 문제만 골라낸다. */
export function getDueProblems(problems = [], now = Date.now()) {
  return problems.filter((p) => {
    const state = getReviewState(p, now);
    return state.attempted && state.isDue;
  });
}

/** 예전 호출부 호환용. rowNumber 목록만 돌려준다. */
export function getDueRowNumbers(problems) {
  if (typeof window === 'undefined') return [];
  return getDueProblems(problems).map((p) => p.rowNumber);
}

// ---------------------------------------------------------------------------
// 대분류 / 중분류 / 소분류
//
// 대분류 = 교재  (와이수학 / 영재원 모의고사 / 황소)
// 중분류 = 단원  (황소는 1·2·3단원, 와이수학은 차시, 모의고사는 없음)
// 소분류 = 개념  (황소는 C01… 개념탐구, 나머지는 없음)
// ---------------------------------------------------------------------------

export const WORKBOOK_LABELS = {
  yi: '와이수학-대수-공통수학1',
  mockExam: '영재원 대비_모의고사',
  hwangso: '황소 중2상 1차단평대비',
};

const WORKBOOK_ORDER = ['yi', 'mockExam', 'hwangso'];

/** 문제 객체의 생김새를 보고 어느 교재인지 알아낸다. */
export function detectWorkbook(problem) {
  if (!problem) return 'yi';
  // 황소는 CSV에서 만들어지므로 단원(unit)과 개념(conceptId)을 갖고 있다.
  if (problem.unit && problem.conceptId) return 'hwangso';
  // 모의고사는 문제 이미지가 따로 있고, 코드가 MOCK_으로 시작한다.
  if (problem.questionImageUrl || String(problem.code || '').startsWith('MOCK_')) return 'mockExam';
  return 'yi';
}

function middleKeyOf(problem, workbook) {
  if (workbook === 'hwangso') {
    return { key: problem.unit || 'U?', label: problem.unitLabel || problem.unit || '단원 미정' };
  }
  if (workbook === 'yi') {
    const session = String(problem.session ?? '').trim();
    return session ? { key: session, label: `${session}차시` } : { key: '_none', label: '차시 없음' };
  }
  return null; // 모의고사는 중분류가 없다
}

function smallKeyOf(problem, workbook) {
  if (workbook !== 'hwangso') return null;
  const code = problem.conceptId || 'C?';
  return { key: code, label: problem.conceptName ? `${code} ${problem.conceptName}` : code };
}

/**
 * 복습 화면의 드롭다운을 채우기 위한 분류 트리를 만든다.
 * 문제가 하나도 없는 갈래는 만들지 않아서, 아이가 빈 항목을 고르는 일이 없다.
 */
export function buildTaxonomy(problems = []) {
  const big = new Map();

  problems.forEach((problem) => {
    const workbook = detectWorkbook(problem);
    if (!big.has(workbook)) {
      big.set(workbook, {
        key: workbook,
        label: WORKBOOK_LABELS[workbook] ?? workbook,
        count: 0,
        middles: new Map(),
      });
    }
    const bigNode = big.get(workbook);
    bigNode.count += 1;

    const middle = middleKeyOf(problem, workbook);
    if (!middle) return;
    if (!bigNode.middles.has(middle.key)) {
      bigNode.middles.set(middle.key, { ...middle, count: 0, smalls: new Map() });
    }
    const middleNode = bigNode.middles.get(middle.key);
    middleNode.count += 1;

    const small = smallKeyOf(problem, workbook);
    if (!small) return;
    if (!middleNode.smalls.has(small.key)) {
      middleNode.smalls.set(small.key, { ...small, count: 0 });
    }
    middleNode.smalls.get(small.key).count += 1;
  });

  // Map을 배열로 펴서 화면에서 바로 쓰게 만든다.
  return [...big.values()]
    .map((b) => ({
      ...b,
      middles: [...b.middles.values()]
        .map((m) => ({
          ...m,
          smalls: [...m.smalls.values()].sort((x, y) => x.key.localeCompare(y.key)),
        }))
        .sort((x, y) => x.key.localeCompare(y.key, undefined, { numeric: true })),
    }))
    .sort((a, b) => WORKBOOK_ORDER.indexOf(a.key) - WORKBOOK_ORDER.indexOf(b.key));
}

/** 고른 대/중/소분류에 맞는 문제만 남긴다. 'all'이면 그 단계는 걸러내지 않는다. */
export function filterByTaxonomy(
  problems = [],
  { workbook = 'all', middle = 'all', small = 'all' } = {}
) {
  return problems.filter((problem) => {
    const wb = detectWorkbook(problem);
    if (workbook !== 'all' && wb !== workbook) return false;
    if (middle !== 'all') {
      const m = middleKeyOf(problem, wb);
      if (!m || m.key !== middle) return false;
    }
    if (small !== 'all') {
      const s = smallKeyOf(problem, wb);
      if (!s || s.key !== small) return false;
    }
    return true;
  });
}

/** 복습 단계를 아이가 알아볼 수 있게 표현한다. */
export function describeStage(stage) {
  const labels = ['처음', '1단계', '2단계', '3단계', '4단계'];
  return labels[Math.min(Math.max(0, stage), labels.length - 1)];
}
