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
