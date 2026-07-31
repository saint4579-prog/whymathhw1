// 마을 동물이 내는 국어 어휘 퀴즈.
//
// 시트 [필수 국어 어휘]의 300개 단어를 받아 3지 선다를 만든다.
// 문제는 두 방향을 번갈아 낸다.
//   meaning : 뜻을 주고 단어를 맞히기   (예1)
//   word    : 단어를 주고 뜻을 맞히기   (예2)
//
// 같은 단어를 한쪽으로만 물으면 아이가 '이 뜻 = 이 단어' 짝만 외운다.
// 양쪽으로 물어봐야 실제로 아는 것이 된다.

import { packKeyFor } from './villageDialogue';

/** 시트 한 줄 → 쓰기 좋은 모양. 비어 있는 줄은 버린다. */
export function normalizeVocab(rows = []) {
  return rows
    .map((row) => ({
      rowNumber: Number(row.rowNumber) || 0,
      no: Number(row.no) || 0,
      word: String(row.word ?? '').trim(),
      meaning: String(row.meaning ?? '').trim(),
      field: String(row.field ?? '').trim(),
      correctCount: Number(row.correctCount) || 0,
    }))
    .filter((v) => v.word && v.meaning);
}

/** '귀착(歸着)' → '귀착' (글자 수를 셀 때 한자를 빼야 한다) */
export function hangulOnly(word) {
  return String(word ?? '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

const COUNT_LABEL = ['', '한', '두', '세', '네', '다섯', '여섯'];

/** '두 글자 단어' 처럼 자연스럽게 읽히는 힌트. 너무 길면 생략한다. */
function lengthHint(word) {
  const n = hangulOnly(word).length;
  if (n < 1 || n >= COUNT_LABEL.length) return '';
  return `${COUNT_LABEL[n]} 글자 `;
}

/**
 * 오답 선택지를 고른다.
 *
 * 같은 분야(인문·철학 등)에서 먼저 고른다. 아무 단어나 섞으면
 * '과학 단어 하나만 딱 튀어서' 뜻을 몰라도 답이 보인다.
 * 같은 분야에 후보가 모자라면 그때만 다른 분야에서 채운다.
 */
export function pickDistractors(vocab, answer, count = 2, random = Math.random) {
  const sameField = vocab.filter(
    (v) => v.rowNumber !== answer.rowNumber && v.field && v.field === answer.field
  );
  const others = vocab.filter(
    (v) => v.rowNumber !== answer.rowNumber && (!v.field || v.field !== answer.field)
  );

  const picked = [];
  const takeFrom = (pool) => {
    const bag = [...pool];
    while (picked.length < count && bag.length > 0) {
      const item = bag.splice(Math.floor(random() * bag.length), 1)[0];
      // 뜻이나 단어가 똑같으면 답이 두 개가 되어 버린다.
      const clashes = picked.some((p) => p.word === item.word || p.meaning === item.meaning);
      if (!clashes && item.word !== answer.word && item.meaning !== answer.meaning) picked.push(item);
    }
  };
  takeFrom(sameField);
  takeFrom(others);
  return picked;
}

// 성향별 말투. 같은 문제라도 누가 묻느냐에 따라 다르게 들리게 한다.
const ASK = {
  playful: {
    meaning: (m, hint) => `있잖아 있잖아! '${m}' 이런 뜻인 ${hint}단어! 뭔지 알아?`,
    word: (w) => `퀴즈퀴즈! '${w}' 이거 무슨 뜻이게? 맞혀 봐!`,
    right: ['우와 맞았어! 너 진짜 똑똑하다!', '헐 바로 맞히네? 대단해!'],
    wrong: ['아쉽다! 그거 아니야~ 다음엔 맞힐 수 있어!', '땡! 히히, 어려웠지?'],
  },
  aloof: {
    meaning: (m, hint) => `'${m}'. 이런 뜻의 ${hint}단어. ...알아?`,
    word: (w) => `'${w}'. 무슨 뜻인지 알고 있어?`,
    right: ['...맞아. 제법이네.', '...알고 있었구나.'],
    wrong: ['...아니야. 뭐, 모를 수도 있지.', '...틀렸어.'],
  },
  shy: {
    meaning: (m, hint) => `저... '${m}' 이런 뜻인 ${hint}단어, 혹시 알아?`,
    word: (w) => `음... '${w}'라는 말, 무슨 뜻인지 알아?`,
    right: ['우와... 맞았어! 대단해...', '맞아! 나도 기뻐...'],
    wrong: ['아... 아니야. 그치만 괜찮아!', '음... 아쉬워. 다음엔 알 거야.'],
  },
  bold: {
    meaning: (m, hint) => `자, 문제! '${m}' — 이 뜻을 가진 ${hint}단어는?`,
    word: (w) => `'${w}'! 이 단어 뜻, 바로 말해 봐!`,
    right: ['좋아! 정확해!', '역시! 제대로 아는구나!'],
    wrong: ['틀렸어! 다시 붙자!', '아깝다! 한 번 더 도전해!'],
  },
  caring: {
    meaning: (m, hint) => `'${m}'이라는 뜻을 가진 ${hint}단어, 뭘까? 천천히 생각해도 돼.`,
    word: (w) => `'${w}'는 무슨 뜻일까? 급하지 않아, 천천히 골라 봐.`,
    right: ['잘했어! 정말 열심히 했구나.', '맞았어! 기특하네.'],
    wrong: ['괜찮아, 이건 좀 어려운 말이야. 같이 외워 두자.', '아쉽지만 괜찮아. 이제 알았으니 됐어.'],
  },
  serious: {
    meaning: (m, hint) => `'${m}'. 이 뜻에 해당하는 ${hint}단어를 고르시오.`,
    word: (w) => `'${w}'의 뜻으로 알맞은 것을 고르시오.`,
    right: ['정답. 정확히 알고 있군.', '맞았다. 좋은 자세야.'],
    wrong: ['오답. 정확히 외워 두도록.', '틀렸다. 한 번 더 확인해.'],
  },
};

function pick(list, random) {
  return list[Math.floor(random() * list.length) % list.length];
}

function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 동물 한 마리가 낼 어휘 퀴즈 하나를 만든다.
 *
 * 돌려주는 모양은 기존 대화 이벤트와 똑같다. { text, choices:[{label, delta, reaction}] }
 * 그래야 대화창을 그대로 쓸 수 있다. 정답 여부는 choices[].correct 로 함께 실어 보낸다.
 *
 * @param animalName 문제를 내는 동물 (말투를 정한다)
 * @param vocab      normalizeVocab을 거친 단어 목록
 * @param reward     맞혔을 때 오를 호감도 / 틀렸을 때 내릴 호감도
 */
export function buildVocabQuiz(animalName, vocab, { random = Math.random, reward = 3, mode } = {}) {
  const list = Array.isArray(vocab) ? vocab : [];
  if (list.length < 3) return null;

  const answer = list[Math.floor(random() * list.length) % list.length];
  const distractors = pickDistractors(list, answer, 2, random);
  if (distractors.length < 2) return null;

  const kind = mode ?? (random() < 0.5 ? 'meaning' : 'word');
  const tone = ASK[packKeyFor(animalName)] ?? ASK.playful;

  const text =
    kind === 'meaning'
      ? tone.meaning(answer.meaning, lengthHint(answer.word))
      : tone.word(answer.word);

  const rightLine = pick(tone.right, random);
  const wrongLine = pick(tone.wrong, random);

  const toChoice = (item, correct) => ({
    label: kind === 'meaning' ? item.word : item.meaning,
    correct,
    delta: correct ? reward : -reward,
    // 틀렸을 때는 정답을 함께 알려 준다. 모르고 지나가면 퀴즈를 낸 보람이 없다.
    reaction: correct
      ? rightLine
      : `${wrongLine} 정답은 '${kind === 'meaning' ? answer.word : answer.meaning}'였어.`,
  });

  return {
    quiz: true,
    kind,
    word: answer.word,
    rowNumber: answer.rowNumber,
    text,
    choices: shuffle(
      [toChoice(answer, true), ...distractors.map((d) => toChoice(d, false))],
      random
    ),
  };
}

/**
 * 명언을 그 동물이 말하는 것처럼 살짝 다듬는다.
 *
 * 명언을 그대로 읽으면 누가 말해도 똑같아서 캐릭터가 사라진다.
 * 앞뒤에 짧은 추임새만 붙이고 명언 자체는 건드리지 않는다.
 */
const QUOTE_STYLE = {
  playful: (q) => `${q} — 이 말 멋있지 않아?!`,
  aloof: (q) => `...${q}`,
  shy: (q) => `음... ${q} ...라고 하더라.`,
  bold: (q) => `${q} 바로 이거야!`,
  caring: (q) => `${q} 우리 같이 기억하자.`,
  serious: (q) => `${q} 새겨 둘 만한 말이지.`,
};

export function quoteLineFor(animalName, quote) {
  const text = String(quote ?? '').trim();
  if (!text) return null;
  const style = QUOTE_STYLE[packKeyFor(animalName)] ?? QUOTE_STYLE.playful;
  return style(text);
}
