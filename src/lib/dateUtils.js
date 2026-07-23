// 구글 시트(dailyStats)의 날짜 키는 "Thu Jul 23"처럼 연도가 빠진 형태로 내려오므로,
// "YYYY-MM-DD"로 정규화할 때는 연도가 없으면 현재 연도를 붙여서 파싱한다.
// 이미 연도가 포함된 값(ISO 문자열 등)은 그대로 파싱한다.
export function toISODate(value) {
  if (!value) return null;
  const raw = String(value);
  const hasYear = /\d{4}/.test(raw);
  const date = new Date(hasYear ? raw : `${raw} ${new Date().getFullYear()}`);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
