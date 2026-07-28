// 망각곡선 기반 복습 주기 스케줄링 (Leitner 방식 간이 구현)
// 구글 시트에는 마지막 풀이 시각이 저장되지 않으므로, 이 기기(브라우저)의 localStorage에
// 문제별 마지막 채점 시각과 단계를 기록해 복습 주기를 계산한다.

const STORAGE_KEY = 'mathReview.schedule.v1';
const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30];

function loadSchedule() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSchedule(schedule) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
  } catch {
    // 저장 실패(용량 초과 등)는 복습 스케줄 기능에만 영향을 주므로 조용히 무시한다.
  }
}

// 채점 결과를 기록: 정답이면 다음 단계로, 오답이면 처음 단계로 되돌린다.
export function recordAttempt(rowNumber, isCorrect) {
  const schedule = loadSchedule();
  const prevStage = schedule[rowNumber]?.stage ?? -1;
  const nextStage = isCorrect === 'O' ? Math.min(prevStage + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0;
  schedule[rowNumber] = { lastAttemptAt: new Date().toISOString(), stage: nextStage };
  saveSchedule(schedule);
}

function isDue(entry) {
  if (!entry) return true; // 이 기기에 기록이 없는 기존 풀이 문제는 즉시 복습 대상으로 취급
  const stage = entry.stage ?? 0;
  const intervalDays = REVIEW_INTERVAL_DAYS[Math.min(stage, REVIEW_INTERVAL_DAYS.length - 1)];
  const nextDueAt = new Date(entry.lastAttemptAt).getTime() + intervalDays * 24 * 60 * 60 * 1000;
  return Date.now() >= nextDueAt;
}

// 이미 채점된(O/X) 문제 중 복습 주기가 도래한 문제만 골라낸다.
export function getDueRowNumbers(problems) {
  if (typeof window === 'undefined') return [];
  const schedule = loadSchedule();
  return problems
    .filter((p) => p.isCorrect === 'O' || p.isCorrect === 'X' || p.isCorrect === '△')
    .filter((p) => isDue(schedule[p.rowNumber]))
    .map((p) => p.rowNumber);
}
