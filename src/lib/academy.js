// 고정 주간 학원 스케줄 + '다음 등원일(D-day)' 계산 유틸.
//
// 아이는 매주 정해진 요일에 학원을 다닌다. 어떤 요일에 학원을 다녀와 '학원 숙제'를
// 입력하면, 그 과목의 "다음 등원 요일"이 곧 숙제 제출 마감일(D-day)이 된다.
// 예) 월요일에 '와이-대수' 숙제를 입력 → 다음 와이-대수 수업일인 수요일이 D-day.

import { addDays, fromDateKey, toDateKey } from './planner';

// 요일 번호: 0=일 ... 6=토 (JavaScript Date.getDay 기준)
export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// 고정 주간 학원 스케줄. 요일 번호 → 그날 다니는 과목(수업) 목록.
export const ACADEMY_SCHEDULE = {
  1: ['와이-대수', '와이-기하'], // 월
  2: ['에이프랩(영어)'], // 화
  3: ['와이-대수', '황소-대수'], // 수
  4: ['에이프랩(영어)'], // 목
  5: ['와이-대수', '와이-기하'], // 금
  6: ['하늘고래(국어)', '황소-기하'], // 토
  0: ['미래(과학)', '기파랑(국어)'], // 일
};

// 과목별 배지 색상 (UI에서 사용)
export const SUBJECT_COLOR = {
  '와이-대수': 'bg-rose-100 text-rose-600',
  '와이-기하': 'bg-pink-100 text-pink-600',
  '에이프랩(영어)': 'bg-amber-100 text-amber-700',
  '황소-대수': 'bg-sky-100 text-sky-700',
  '황소-기하': 'bg-cyan-100 text-cyan-700',
  '하늘고래(국어)': 'bg-blue-100 text-blue-700',
  '미래(과학)': 'bg-emerald-100 text-emerald-700',
  '기파랑(국어)': 'bg-violet-100 text-violet-700',
};

// 특정 날짜(YYYY-MM-DD)에 다니는 학원 과목 목록.
export function subjectsOn(dateKey) {
  const weekday = fromDateKey(dateKey).getDay();
  return ACADEMY_SCHEDULE[weekday] || [];
}

// 전체 과목 목록(중복 제거, 스케줄 등장 순서 유지).
export function allAcademySubjects() {
  const seen = new Set();
  const result = [];
  // 월~일 순서로 훑어 자연스러운 순서를 만든다.
  [1, 2, 3, 4, 5, 6, 0].forEach((weekday) => {
    (ACADEMY_SCHEDULE[weekday] || []).forEach((subject) => {
      if (!seen.has(subject)) {
        seen.add(subject);
        result.push(subject);
      }
    });
  });
  return result;
}

/**
 * 주어진 과목의 '다음 등원일'을 찾아 D-day(제출 마감일)로 돌려준다.
 * from 다음 날부터 최대 14일(2주)까지 앞으로 훑으며, 그 과목 수업이 있는 첫 날을 반환한다.
 *
 * @param {string} subject   과목명 (ACADEMY_SCHEDULE의 값과 일치해야 함)
 * @param {string} from      기준일 'YYYY-MM-DD' (보통 숙제를 입력한 날 = 오늘)
 * @returns {string|null}    다음 등원일 'YYYY-MM-DD' (2주 내 수업이 없으면 null)
 */
export function getNextAcademyDate(subject, from = toDateKey()) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const dateKey = addDays(from, offset);
    const weekday = fromDateKey(dateKey).getDay();
    if ((ACADEMY_SCHEDULE[weekday] || []).includes(subject)) {
      return dateKey;
    }
  }
  return null;
}
