// 채점 결과로 지급되는 포인트의 단일 기준값.
// 실제 잔액은 항상 백엔드(apps-script/Code.gs)가 계산하며, 여기 값은
// 응답에 포인트 정보가 없을 때 화면을 즉시 갱신하기 위한 폴백으로만 쓴다.
// 값을 바꿀 때는 apps-script/Code.gs의 POINTS_PER_CORRECT / POINTS_PER_WRONG도 같이 수정해야 한다.
export const POINTS_PER_CORRECT = 20;
export const POINTS_PER_WRONG = 10;

export function getPointsForAnswer(isCorrect) {
  return isCorrect === 'O' ? POINTS_PER_CORRECT : POINTS_PER_WRONG;
}
