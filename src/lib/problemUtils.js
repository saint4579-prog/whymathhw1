// 문제 파일명(code) 앞부분의 "N쪽" 표기에서 쪽수를 추출한다. 예: "57쪽_기본문제_2_(2).png" -> 57
export function extractPageNumber(code) {
  if (!code) return Number.POSITIVE_INFINITY;
  const match = code.match(/(\d+)쪽/);
  if (!match) return Number.POSITIVE_INFINITY;
  return parseInt(match[1], 10);
}

// 쪽수 오름차순으로 정렬. 같은 쪽수인 경우 파일명 가나다순으로 정렬해 순서를 안정적으로 유지한다.
export function sortProblemsByPage(problems) {
  return [...problems].sort((a, b) => {
    const pageDiff = extractPageNumber(a.code) - extractPageNumber(b.code);
    if (pageDiff !== 0) return pageDiff;
    return (a.code ?? '').localeCompare(b.code ?? '', 'ko');
  });
}

export function isSolved(problem) {
  return (
    (problem.submitted != null &&
      problem.submitted !== false &&
      problem.submitted !== 'FALSE' &&
      problem.submitted !== 'false' &&
      problem.submitted !== '') ||
    problem.isCorrect === 'O' ||
    problem.isCorrect === 'X'
  );
}

export function isWrong(problem) {
  return problem.isCorrect === 'X';
}

// ---------------------------------------------------------------------------
// 한 문제는 하루에 한 번
// ---------------------------------------------------------------------------

// 이 날짜부터 '하루에 한 번' 규칙이 돈다. Code.gs의 DAILY_ONCE_START_DATE와 같아야 한다.
// 둘이 어긋나면 화면에서는 잠겼는데 포인트는 들어오거나, 그 반대가 된다.
export const DAILY_ONCE_START_DATE = '2026-08-01';

/** Date/문자열 → 'YYYY-MM-DD' (그 지역 날짜 기준) */
export function toDayKey(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 오늘 날짜 키 */
export function todayKey(now = new Date()) {
  return toDayKey(now);
}

/**
 * 이 문제를 오늘 이미 풀었는지.
 *
 * 오늘 푼 문제는 내일이 되어야 다시 풀 수 있다.
 * 같은 문제를 연달아 눌러 포인트를 불리는 걸 막고, 복습 주기(하루 뒤)와도 맞춘다.
 */
export function solvedToday(problem, now = new Date()) {
  const today = todayKey(now);
  // 규칙 시행 전이면 잠그지 않는다.
  if (today < DAILY_ONCE_START_DATE) return false;
  const logs = Array.isArray(problem?.historyLogs) ? problem.historyLogs : [];
  return logs.some((log) => {
    const mark = log?.isCorrect;
    if (mark !== 'O' && mark !== 'X' && mark !== true && mark !== false) return false;
    return toDayKey(log?.date) === today;
  });
}
