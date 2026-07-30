// 아이가 타이핑한 답을 정답과 비교하는 로직.
//
// 왜 단순 문자열 비교로는 안 되는가:
//   시트의 정답은 사람이 손으로 적은 값이라 형태가 제각각이다.
//     '12개'          → 아이는 보통 '12'이라고 쓴다
//     '4, 5'          → '4,5'  '5, 4'  '5,4'  모두 같은 답이다
//     'a=9, b=40'     → 'a=9,b=40'  'b=40, a=9'
//     '19/4'          → '4.75'도 같은 값이다
//   그대로 비교하면 맞은 답을 틀렸다고 하고, 아이는 앱을 믿지 않게 된다.
//
// 반대로 너무 관대하면 틀린 답을 맞다고 해버린다. 그래서 애매한 정답은
// 아예 자동채점을 포기하고 아이가 직접 O/X 하도록 넘긴다(judgeMode 'manual').

// 정답 끝에 붙는 단위. 숫자만 비교하기 위해 떼어 낸다.
const UNIT_SUFFIXES = [
  '가지', '자리', '제곱', '개월', '개', '명', '번', '쪽', '원', '초', '분', '시간',
  '일', '주', '년', '살', '권', '장', 'cm', 'mm', 'm', 'km', 'g', 'kg', 'l', 'ml',
];

// 이런 표시가 들어간 정답은 기계가 비교하면 위험하다.
//   '①104/333 ②2918/12375 (2) 14'  → 여러 소문항이 한 칸에 뭉쳐 있음
//   '소수 0.000819 (순환마디 000819), 분수 1/12210' → 설명이 섞여 있음
const MANUAL_PATTERNS = [
  /[①-⑳]/, // 동그라미 숫자
  /\(\s*\d\s*\)/, // (1) (2)
  /순환마디/,
  /[가-힣]{3,}/, // 세 글자 이상 한글 = 서술형 설명
];

/**
 * 이 정답을 자동채점해도 되는지 판단한다.
 * @returns 'auto' | 'manual' | 'none'
 */
export function getJudgeMode(rawAnswer) {
  const answer = String(rawAnswer ?? '').trim();
  if (!answer) return 'none';

  // 단위만 붙은 한글('12개', '23가지')은 서술형이 아니므로 자동채점 대상이다.
  const withoutUnits = stripUnits(answer);
  if (MANUAL_PATTERNS.some((re) => re.test(withoutUnits))) return 'manual';

  // 쉼표로 나눈 조각이 5개를 넘으면 아이가 순서·개수를 정확히 맞추기 어렵다.
  if (splitTokens(answer).length > 5) return 'manual';

  return 'auto';
}

/** 문자열 끝에 붙은 단위를 떼어 낸다. '12개' → '12' */
function stripUnits(value) {
  let out = String(value);
  for (const unit of UNIT_SUFFIXES) {
    out = out.replace(new RegExp(`(\\d)\\s*${unit}\\b`, 'gi'), '$1');
    out = out.replace(new RegExp(`(\\d)\\s*${unit}$`, 'gi'), '$1');
  }
  return out;
}

/**
 * 비교하기 좋은 형태로 다듬는다.
 * - 전각 문자를 반각으로 (아이가 한글 키보드로 치면 ％ ， 같은 게 섞인다)
 * - 공백 제거, 소문자화
 * - 단위 제거, 끝의 마침표 제거
 * - 곱셈기호·유니코드 마이너스 통일
 */
export function normalizeAnswer(value) {
  return stripUnits(String(value ?? ''))
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[−–—]/g, '-')
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/\s+/g, '')
    .replace(/[.,]$/, '')
    .toLowerCase();
}

/** 쉼표·세미콜론·'와/과'로 나눈 조각들 */
function splitTokens(value) {
  return String(value ?? '')
    .split(/[,;]|\s+또는\s+|\s+and\s+/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** '19/4' '4.75' '-3' 같은 값을 수로 바꾼다. 수가 아니면 null */
function toNumber(token) {
  const t = normalizeAnswer(token);
  if (!t) return null;
  // 분수 a/b
  const frac = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(t);
  if (frac) {
    const denominator = Number(frac[2]);
    if (!denominator) return null;
    return Number(frac[1]) / denominator;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return null;
}

/** 두 조각이 같은 값인가 (수면 수로, 아니면 글자로 비교) */
function tokenEquals(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) {
    // 분수↔소수를 허용하되, 반올림 오차만 눈감아 준다.
    return Math.abs(na - nb) < 1e-9;
  }
  return normalizeAnswer(a) === normalizeAnswer(b);
}

/**
 * 아이가 타이핑한 답을 채점한다.
 *
 * @param {string} typed 아이가 입력한 답
 * @param {string} correct 시트 G열의 정답
 * @returns {{ verdict: 'correct'|'wrong'|'unknown', mode: 'auto'|'manual'|'none', reason: string }}
 *   verdict 'unknown' = 자동채점할 수 없으니 아이가 직접 O/X 해야 한다.
 */
export function checkAnswer(typed, correct) {
  const mode = getJudgeMode(correct);
  const input = String(typed ?? '').trim();

  if (mode === 'none') {
    return { verdict: 'unknown', mode, reason: '이 문제는 정답이 아직 등록되지 않았어요.' };
  }
  if (mode === 'manual') {
    return { verdict: 'unknown', mode, reason: '정답이 여러 갈래라서 스스로 채점해요.' };
  }
  if (!input) {
    return { verdict: 'wrong', mode, reason: '답을 입력해 주세요.' };
  }

  const typedTokens = splitTokens(input);
  const correctTokens = splitTokens(correct);

  // 조각이 하나면 그대로 비교
  if (correctTokens.length <= 1) {
    return tokenEquals(input, correct)
      ? { verdict: 'correct', mode, reason: '정답이에요!' }
      : { verdict: 'wrong', mode, reason: '아쉬워요, 다시 볼까요?' };
  }

  // 여러 값을 답하는 문제는 순서를 따지지 않는다. ('4, 5'와 '5, 4'는 같은 답)
  if (typedTokens.length !== correctTokens.length) {
    return {
      verdict: 'wrong',
      mode,
      reason: `답이 ${correctTokens.length}개 필요해요. (지금 ${typedTokens.length}개)`,
    };
  }

  const remaining = [...correctTokens];
  for (const token of typedTokens) {
    const at = remaining.findIndex((r) => tokenEquals(token, r));
    if (at < 0) return { verdict: 'wrong', mode, reason: '아쉬워요, 다시 볼까요?' };
    remaining.splice(at, 1);
  }
  return { verdict: 'correct', mode, reason: '정답이에요!' };
}

/**
 * 객관식 보기를 만든다.
 * 같은 개념의 다른 문제 정답을 오답 후보로 빌려 오고, 부족하면 숫자를 살짝 흔들어 채운다.
 *
 * 주의: 수학에서 기계가 만든 오답은 가끔 '사실은 맞는 답'이 되거나 티가 나게 어색하다.
 * 그래서 이 함수는 숫자 하나로 답하는 문제에만 쓰고, 그 외에는 빈 배열을 돌려준다.
 * (빈 배열이면 화면은 객관식 대신 타이핑만 보여 준다.)
 *
 * @param {string} correct 정답
 * @param {string[]} peerAnswers 같은 개념에 속한 다른 문제들의 정답
 * @param {number} count 보기 개수
 */
export function buildChoices(correct, peerAnswers = [], count = 4) {
  if (getJudgeMode(correct) !== 'auto') return [];
  const answerNumber = toNumber(correct);
  if (answerNumber === null || !Number.isInteger(answerNumber)) return [];

  // 보기는 전부 '단위 없는 숫자'로 통일한다.
  // '12개'와 '13'이 한 화면에 섞이면 어색하고, 단위가 붙은 보기가 정답처럼 튀어 보인다.
  // checkAnswer가 단위를 무시하므로 숫자만 골라도 채점은 정확하다.
  const seen = new Set([answerNumber]);
  const numbers = [answerNumber];

  // 1순위: 같은 개념의 다른 정답 (이 단원에 실제로 나오는 수라서 그럴듯하다)
  for (const peer of peerAnswers) {
    if (numbers.length >= count) break;
    const n = toNumber(peer);
    if (n === null || !Number.isInteger(n) || seen.has(n)) continue;
    seen.add(n);
    numbers.push(n);
  }

  // 2순위: 정답을 조금 흔든 값
  for (const d of [1, -1, 2, -2, 3, -3, 10, -10]) {
    if (numbers.length >= count) break;
    const candidate = answerNumber + d;
    if (candidate < 0 || seen.has(candidate)) continue;
    seen.add(candidate);
    numbers.push(candidate);
  }

  if (numbers.length < count) return [];
  return shuffleStable(numbers.map(String), correct);
}

// 정답 위치가 매번 같으면 아이가 자리를 외운다. 정답 문자열을 씨앗으로 섞어
// 같은 문제에서는 항상 같은 순서가 나오게(=새로고침해도 안 바뀌게) 한다.
function shuffleStable(list, seedText) {
  let seed = 0;
  for (const ch of String(seedText)) seed = (seed * 31 + ch.charCodeAt(0)) % 233280;
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
