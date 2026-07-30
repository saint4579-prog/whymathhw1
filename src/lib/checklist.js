// [황소] 학습 체크리스트 로직.
//
// 종이 체크리스트(풀기 / 맞음 / 틀림 / 다시 / 완료 + 날짜 + 메모)를 앱으로 옮긴 것.
// 아이는 종이로 풀고 앱에서 체크만 한다. 문제 이미지나 캔버스는 쓰지 않는다.
//
// 단원별로 데이터 출처가 다르다.
//   중2-상 1단원  → public/data/문항목록.csv (이미 앱에 문제로 들어와 있는 109문항)
//                   체크리스트와 문제 목록이 1:1로 맞아서, 체크하면 앱에서도 푼 것으로 보인다.
//   중2-상 2단원  → 체크리스트 PDF 데이터 (177문항). 아직 문제 이미지가 없어 체크만.
//   중1-상 1단원  → 체크리스트 PDF 데이터 (298문항). 선수학습.
//
// 2·3단원도 나중에 CSV와 이미지가 들어오면 1단원처럼 자동으로 승격된다.
// 그래서 문제 코드를 CSV 파일명 규칙과 똑같이 만들어 둔다. (아래 buildCode 참고)

import { CHECKLIST_UNITS } from './hwangsoChecklist';

// 체크리스트 열. 종이의 순서를 그대로 따랐다.
export const CHECK_KEYS = ['solved', 'correct', 'wrong', 'retry', 'done'];

export const CHECK_COLUMNS = [
  { key: 'solved', label: '풀기', emoji: '✏️', hint: '문제를 풀었어요' },
  { key: 'correct', label: '맞음', emoji: '⭕', hint: '채점했더니 맞았어요' },
  { key: 'wrong', label: '틀림', emoji: '❌', hint: '채점했더니 틀렸어요' },
  { key: 'retry', label: '다시', emoji: '🔁', hint: '틀린 문제를 다시 풀었어요' },
  { key: 'done', label: '완료', emoji: '✅', hint: '다시 풀어서 이제 맞아요' },
];

// 체크리스트 유형 → CSV 파일명의 유형 코드.
const TYPE_TO_CODE = { 개념: 'Q', 예제: 'E', 미션: 'M', 확인: 'W' };

// 체크리스트 단원 id → CSV의 (학기, 단원) 짝.
const UNIT_CODE = {
  M2A1: { term: '2-1', unit: 'U1' },
  M2A2: { term: '2-1', unit: 'U2' },
  M1A1: { term: '1-1', unit: 'U1' },
};

// 체크리스트 항목에 이미 앱 문제가 있는 단원. 여기만 앱↔체크리스트가 양방향으로 붙는다.
export const LINKED_UNIT_IDS = ['M2A1'];

/**
 * 체크리스트 한 항목의 문제 코드를 만든다.
 * CSV 파일명 규칙(`2-1_U1_C01_W_01.png`)을 그대로 재현하므로,
 * 나중에 2·3단원 CSV가 들어와도 코드가 저절로 맞는다.
 */
export function buildCode(unitId, concept, type, item) {
  const meta = UNIT_CODE[unitId];
  if (!meta) return `${unitId}_${concept}_${type}_${item}`;
  const typeCode = TYPE_TO_CODE[type] ?? type;
  return `${meta.term}_${meta.unit}_${concept}_${typeCode}_${item}.png`;
}

/** 단원 목록. 화면의 단원 선택 버튼에 그대로 쓴다. */
export function listUnits() {
  return CHECKLIST_UNITS.map((u) => ({
    id: u.id,
    label: u.label,
    subject: u.subject,
    total: u.total,
    tag: u.tag ?? '',
    linked: LINKED_UNIT_IDS.includes(u.id),
    conceptCount: u.concepts.length,
  }));
}

/**
 * 한 단원의 문항을 개념(C01…)별로 묶어서 돌려준다.
 *
 * @param unitId  'M2A1' | 'M2A2' | 'M1A1'
 * @param problems 앱이 이미 들고 있는 황소 문제 목록 (연동 단원에서만 사용)
 */
export function buildUnitGroups(unitId, problems = []) {
  const unit = CHECKLIST_UNITS.find((u) => u.id === unitId);
  if (!unit) return [];

  const linked = LINKED_UNIT_IDS.includes(unitId);
  // 연동 단원은 앱 문제를 코드로 찾아 붙인다.
  const byCode = new Map(problems.map((p) => [p.code, p]));

  let no = 0;
  const rows = unit.items.map((raw) => {
    const [concept, type, item] = String(raw).split('|');
    no += 1;
    const code = buildCode(unitId, concept, type, item);
    const problem = linked ? byCode.get(code) ?? null : null;
    return {
      no,
      code,
      concept,
      type,
      item,
      label: `${type} ${item}`,
      // 연동 단원이면 앱 문제의 채점 이력을 그대로 쓴다.
      problem,
      historyLogs: problem?.historyLogs ?? [],
    };
  });

  return unit.concepts.map((c) => ({
    ...c,
    items: rows.filter((r) => r.concept === c.code),
  }));
}

/**
 * 앱의 채점 이력(historyLogs)에서 체크 상태를 유추한다.
 * 아이가 앱에서 문제를 풀었으면 체크리스트에도 저절로 체크가 들어와 있어야 한다.
 *
 * 규칙
 *   기록이 하나라도 있으면        → 풀기 ✓
 *   마지막 기록이 O이면           → 맞음 ✓
 *   마지막 기록이 X이면           → 틀림 ✓
 *   틀린 뒤 다시 풀어 O가 되었으면 → 다시 ✓, 완료 ✓
 */
export function deriveChecks(historyLogs = []) {
  const logs = Array.isArray(historyLogs) ? historyLogs.filter(Boolean) : [];
  if (logs.length === 0) return emptyChecks();

  const marks = logs.map((l) => String(l.isCorrect || '').toUpperCase());
  const last = marks[marks.length - 1];
  const hadWrong = marks.includes('X');
  const fixedAfterWrong = hadWrong && last === 'O';

  return {
    solved: true,
    correct: last === 'O',
    wrong: last === 'X',
    retry: hadWrong && marks.length > 1,
    done: fixedAfterWrong,
    date: lastDate(logs),
    memo: '',
  };
}

function lastDate(logs) {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const raw = logs[i]?.date;
    if (!raw) continue;
    const iso = String(raw).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
        parsed.getDate()
      ).padStart(2, '0')}`;
    }
  }
  return '';
}

export function emptyChecks() {
  return { solved: false, correct: false, wrong: false, retry: false, done: false, date: '', memo: '' };
}

/**
 * 체크박스 하나를 눌렀을 때의 다음 상태.
 * 종이에서 사람이 자연스럽게 하는 흐름을 코드로 옮긴 것이다.
 *
 *  - 맞음/틀림은 동시에 켤 수 없다. 하나를 켜면 다른 쪽이 꺼진다.
 *  - 맞음·틀림을 켜면 '풀기'도 자동으로 켜진다. (채점했다면 당연히 푼 것)
 *  - '완료'를 켜면 '다시'도 자동으로 켜진다. (다시 풀었으니 완료가 된 것)
 *  - '풀기'를 끄면 뒤 단계가 모두 꺼진다. (안 푼 문제에 채점 결과가 남아 있으면 이상하다)
 */
export function toggleCheck(checks, key, todayKey) {
  const next = { ...emptyChecks(), ...checks };
  const turningOn = !next[key];
  next[key] = turningOn;

  if (key === 'correct' && turningOn) {
    next.wrong = false;
    next.solved = true;
  }
  if (key === 'wrong' && turningOn) {
    next.correct = false;
    next.solved = true;
  }
  if (key === 'done' && turningOn) {
    next.retry = true;
    next.solved = true;
  }
  if (key === 'retry' && turningOn) {
    next.solved = true;
  }
  if (key === 'retry' && !turningOn) {
    next.done = false;
  }
  if (key === 'solved' && !turningOn) {
    next.correct = false;
    next.wrong = false;
    next.retry = false;
    next.done = false;
  }

  // 처음 체크한 날을 기록한다. 이 날짜가 복습 주기의 기준이 된다.
  const anyChecked = CHECK_KEYS.some((k) => next[k]);
  next.date = anyChecked ? next.date || todayKey : '';
  return next;
}

/**
 * 체크 상태 → 학습기록에 남길 O/X.
 * null이면 아직 채점 단계가 아니라서 기록할 게 없다는 뜻이다.
 */
export function toMark(checks) {
  if (!checks) return null;
  // '완료'는 다시 풀어서 맞힌 것이므로 O.
  if (checks.done || checks.correct) return 'O';
  if (checks.wrong) return 'X';
  return null;
}

// 체크리스트로 받는 포인트. 직접 풀어서 채점하는 것(정답 20P)보다 낮게 둔다.
// 종이로 풀고 체크만 하는 것이라 앱이 실제로 확인할 수 있는 게 없기 때문이다.
export const CHECKLIST_POINTS_CORRECT = 5;
export const CHECKLIST_POINTS_WRONG = 3;
// 하루에 체크리스트로 받을 수 있는 최대 포인트. 584개를 마구 체크해서
// 하루에 만 포인트를 버는 일을 막는다.
export const CHECKLIST_DAILY_CAP = 200;

export function pointsForCheck(mark) {
  if (mark === 'O') return CHECKLIST_POINTS_CORRECT;
  if (mark === 'X') return CHECKLIST_POINTS_WRONG;
  return 0;
}

/** 한 단원의 진도 요약. 상단 통계 카드에 쓴다. */
export function summarizeUnit(groups) {
  const items = groups.flatMap((g) => g.items);
  let solved = 0;
  let correct = 0;
  let wrong = 0;
  let done = 0;

  items.forEach((it) => {
    const checks = it.checks ?? deriveChecks(it.historyLogs);
    if (checks.solved) solved += 1;
    if (checks.correct) correct += 1;
    if (checks.wrong) wrong += 1;
    if (checks.done) done += 1;
  });

  return {
    total: items.length,
    solved,
    correct,
    wrong,
    done,
    // 아직 다시 풀지 않은 오답 = 지금 손봐야 할 것
    todo: Math.max(0, wrong - done),
    progressRate: items.length > 0 ? solved / items.length : 0,
    accuracy: correct + wrong > 0 ? correct / (correct + wrong) : 0,
  };
}
