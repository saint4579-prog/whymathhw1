// [멍멍 마을] 지윤이와 동물 친구들의 호감도 · 3지 선다 대화.
//
// 동물마다 지윤이에 대한 호감도를 갖는다. 대화에서 어떤 답을 고르느냐에 따라
// 호감도가 오르내리고, 그에 따라 평소 반응까지 달라진다.
//
// 대화는 성격(MBTI)별 '묶음(pack)'으로 관리한다. 동물이 79마리라 하나하나
// 대사를 쓰면 관리가 안 되고, 성격이 같으면 말투도 비슷하기 때문이다.

import { mbtiOf } from './villagePersona';

const STORAGE_KEY = 'village-affinity';

// ── 호감도 ──────────────────────────────────────────────────────────────

export const AFFINITY_FRIENDLY = 10; // 이 이상이면 우호적
export const AFFINITY_HOSTILE = 0; // 이 아래면 적대적
// 너무 벌어지면 되돌리기 어려워 아이가 지친다. 위아래로 한계를 둔다.
export const AFFINITY_MIN = -15;
export const AFFINITY_MAX = 30;

export function clampAffinity(score) {
  const n = Math.round(Number(score) || 0);
  return Math.min(AFFINITY_MAX, Math.max(AFFINITY_MIN, n));
}

/** 'friendly' | 'neutral' | 'hostile' */
export function affinityTier(score) {
  const n = clampAffinity(score);
  if (n >= AFFINITY_FRIENDLY) return 'friendly';
  if (n < AFFINITY_HOSTILE) return 'hostile';
  return 'neutral';
}

export const TIER_INFO = {
  friendly: { label: '우호적', icon: '❤️', color: '#FBCFE8' },
  neutral: { label: '보통', icon: '🐾', color: '#FDE68A' },
  hostile: { label: '까칠함', icon: '💢', color: '#BFDBFE' },
};

function storageKey(userName) {
  return `${STORAGE_KEY}:${userName || 'guest'}`;
}

/** 저장된 호감도 전부 불러오기. { 이름: 점수 } */
export function loadAffinity(userName) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userName));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAffinity(userName, table) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userName), JSON.stringify(table));
  } catch {
    // 저장소가 막혀 있어도 이번 방문 동안의 호감도는 화면에 유지된다.
  }
}

// ── 성격별 대화 묶음 ────────────────────────────────────────────────────
//
// 각 묶음은 { events: [...], idle: { friendly, neutral, hostile } } 형태.
// event = { text, choices: [{ label, delta, reaction }] }  (choices는 항상 3개)

const PACKS = {
  // 장난꾸러기 · 활발  (여우 / 병아리 / 핑키 …)
  // 통하는 법: 같이 신나 주기. 걱정·정리는 김을 뺀다.
  playful: {
    label: '장난꾸러기',
    hint: '신나는 걸 같이 신나 해주면 좋아해요',
    events: [
      {
        text: '지윤아! 나 방금 뒷산에서 엄청 큰 웅덩이 찾았어! 같이 갈래?!',
        choices: [
          { label: '얼마나 큰데? 빨리 보여줘!', delta: 3, reaction: '히히, 바로 그거야! 지윤이는 말이 통해!' },
          { label: '재밌겠다. 근데 옷 젖으면 감기 걸리니까 수건 챙겨 갈까?', delta: 0, reaction: '어... 응. 챙겨야지. (김이 조금 샜다)' },
          { label: '좋은 생각이야! 다녀와서 같이 정리하자.', delta: -3, reaction: '정리...? 아직 놀지도 않았는데 그 얘기부터야?' },
        ],
      },
      {
        text: '나 오늘 달리기에서 넘어졌는데, 그래도 끝까지 뛰었다!',
        choices: [
          { label: '끝까지 뛴 게 진짜 멋있다! 어떻게 뛴 거야?', delta: 3, reaction: '그치?! 내가 봐도 멋있었어! 다시 보여줄까?' },
          { label: '고생했어. 무릎은 괜찮아?', delta: 0, reaction: '어, 괜찮아. 근데 그거 말고 멋있었잖아...' },
          { label: '다치지 않게 다음엔 천천히 하는 게 좋겠어.', delta: -3, reaction: '천천히...? 그럼 재미가 없잖아. 흥.' },
        ],
      },
    ],
    idle: {
      friendly: ['지윤아! 아까 네 생각나서 예쁜 조약돌 주워왔어. 가질래?', '지윤이랑 있으면 하루가 짧아! 오늘도 재밌게 놀자!'],
      neutral: ['오늘 날씨 좋다! 뭐 하고 놀까?', '심심해... 지윤아 나랑 놀자!'],
      hostile: ['앗, 지윤이다. 또 잔소리하기 전에 도망가야지! 메롱!', '흥, 나 지금 바빠. 저리 가.'],
    },
  },

  // 도도함 · 개인주의  (검정 펭귄 / 부엉 / 나무늘보 …)
  // 통하는 법: 거리를 지켜 주기. 다정해도 들이대면 부담스러워한다.
  aloof: {
    label: '도도함',
    hint: '혼자 있고 싶어 해요. 거리를 지켜 주면 마음을 엽니다',
    events: [
      {
        text: '(혼자 앉아 하늘을 보고 있다) ...아, 왔구나.',
        choices: [
          { label: '(옆에 조용히 앉는다)', delta: 3, reaction: '...너는 조용해서 좋아. 있고 싶은 만큼 있다 가.' },
          { label: '무슨 생각 해? 얘기해 봐, 내가 들어줄게.', delta: 0, reaction: '...딱히. 말할 만한 건 아니야.' },
          { label: '혼자 있으면 심심하잖아! 내가 같이 있어 줄게!', delta: -3, reaction: '...심심한 게 아니라 혼자 있고 싶었던 건데.' },
        ],
      },
      {
        text: '이 책, 세 번째 읽는 중이야. ...아무것도 아니야.',
        choices: [
          { label: '세 번이나 읽을 만한 책이구나. 나중에 알려줘.', delta: 3, reaction: '...알아봐 주네. 다 읽으면 빌려줄게.' },
          { label: '나도 읽어볼래! 지금 같이 보자!', delta: 0, reaction: '...지금은 내 차례야. 나중에.' },
          { label: '책만 보면 눈 나빠져. 나가서 좀 놀자!', delta: -3, reaction: '내가 뭘 하든 내 선택이야. 참견은 사양할게.' },
        ],
      },
    ],
    idle: {
      friendly: ['...왔어? 여기 네 자리 비워뒀어. 앉든가.', '...오늘은 조금 덜 시끄럽네. 나쁘지 않아.'],
      neutral: ['하아... 내 털에 흙 묻히지 말아 줄래?', '햇살이 좋네. 방해하지 말고 저기 가서 놀아.'],
      hostile: ['가까이 오지 마. 털에 먼지 묻어.', '아, 시끄러운 애 또 왔네.'],
    },
  },

  // 소심함 · 다정함  (고슴도치 / 고옥이 / 늘봉 …)
  // 통하는 법: 해결책보다 마음을 먼저. 옳은 말도 위로가 앞서야 한다.
  shy: {
    label: '소심함',
    hint: '해결책보다 마음을 먼저 알아주면 좋아해요',
    events: [
      {
        text: '지윤아... 내가 키운 당근이... 벌레 먹었어... 훌쩍...',
        choices: [
          { label: '그동안 정성껏 돌봤는데... 속상하겠다.', delta: 3, reaction: '응... 알아줘서 고마워. 조금 괜찮아졌어.' },
          { label: '내가 벌레 다 쫓아내 줄게! 걱정 마!', delta: 0, reaction: '고, 고마워... 근데 아직 마음이 좀...' },
          { label: '괜찮아! 다시 심으면 되지. 씨앗 사러 가자!', delta: -3, reaction: '...응. 그렇긴 한데. (아직 슬픈데 벌써 다음 얘기라니)' },
        ],
      },
      {
        text: '저... 지윤아. 이 꽃, 너 주려고 아침부터 골랐는데... 받아줄래...?',
        choices: [
          { label: '아침부터 골라준 거야? 그 마음이 제일 예뻐.', delta: 3, reaction: '헤헤... 알아봐 줘서 정말 기뻐. 또 골라올게!' },
          { label: '와, 예쁘다! 고마워!', delta: 0, reaction: '으응, 다행이다... 마음에 들었구나.' },
          { label: '고마워! 시들기 전에 얼른 물에 꽂아둬야겠다.', delta: -3, reaction: '아... 응. (시드는 얘기부터 나올 줄은 몰랐어...)' },
        ],
      },
    ],
    idle: {
      friendly: ['지윤아, 네가 오면 마을에 꽃이 피는 것 같아. 항상 응원할게!', '오늘도 공부 열심히 했지? 나는 다 알고 있어. 대단해!'],
      neutral: ['앗, 깜짝이야! 지윤이였구나...', '꽃들이 참 예쁘게 피었네... 마음이 편안해져.'],
      hostile: ['히익...! 지, 지윤아 안녕... 나 바빠서 이만...!', '아, 아무것도 아니야... 저기, 나 갈게...'],
    },
  },

  // 개구쟁이 · 자신감  (개구리 / 2호 / 라쿤 …)
  // 통하는 법: 정면으로 받아 주기. 칭찬만 하거나 피하면 시시해한다.
  bold: {
    label: '자신감',
    hint: '피하지 말고 정면으로 받아 주면 좋아해요',
    events: [
      {
        text: '지윤아! 나랑 퀴즈 대결하자! 내가 이기면 네 간식 내 거야!',
        choices: [
          { label: '좋아. 내가 이기면 네가 내 방 청소야. 콜?', delta: 3, reaction: '크하하! 배짱 좋은데? 절대 안 봐준다!' },
          { label: '와, 자신 있나 보네! 너 진짜 대단하다.', delta: 0, reaction: '어... 그래. (칭찬은 좋은데 왜 안 받아주지?)' },
          { label: '네가 이길 것 같은데? 그냥 간식 줄게.', delta: -3, reaction: '뭐야, 그럼 무슨 재미야. 시시해!' },
        ],
      },
      {
        text: '내가 이 마을에서 제일 빠르다고! 못 믿겠으면 달려볼래?',
        choices: [
          { label: '진짜? 그럼 확인해 보자. 연못까지 어때?', delta: 3, reaction: '오오, 좋아! 준비됐지? 출발!' },
          { label: '응, 네가 제일 빠른 거 다들 알아.', delta: 0, reaction: '...그치? (근데 왜 안 달리는 거야)' },
          { label: '무리하다 다칠라. 살살 해.', delta: -3, reaction: '내가 애냐고! 걱정 말고 그냥 붙어보자니까!' },
        ],
      },
    ],
    idle: {
      friendly: ['지윤 대장! 오늘도 멋진 하루 보내자고! 충성!', '지윤아, 힘들면 나한테 말해! 내가 다 해결해 줄게!'],
      neutral: ['오늘 뭐 재밌는 일 없나?', '비가 오려나? 비 오면 뛰기 딱 좋은데!'],
      hostile: ['야 지윤! 너 나한테 불만 있냐?! 한판 붙을래?!', '흥, 오늘은 너랑 말 안 해.'],
    },
  },

  // 다정함 · 챙겨주기  (코끼리 / 여울 / 메링 …)
  // 통하는 법: 챙김을 기쁘게 받아 주기. 사양하면 서운해한다.
  caring: {
    label: '다정함',
    hint: '챙겨주는 걸 기쁘게 받아 주면 좋아해요',
    events: [
      {
        text: '지윤아, 오늘 공부 많이 했지? 간식 만들어 놨는데 먹고 갈래?',
        choices: [
          { label: '기다렸어! 잘 먹을게. 무슨 맛이야?', delta: 3, reaction: '헤헤, 많이 먹어! 힘내라고 만든 거야.' },
          { label: '고마워. 이따 챙겨 먹을게.', delta: 0, reaction: '응, 남겨둘게. 꼭 먹으러 와야 해!' },
          { label: '나 신경 안 써도 괜찮은데. 힘들잖아.', delta: -3, reaction: '아... 부담됐구나. 미안해, 다음엔 안 할게.' },
        ],
      },
    ],
    idle: {
      friendly: ['지윤아, 오늘도 수고했어. 정말 잘하고 있어!', '무리하지 마. 네가 건강한 게 제일 중요해.'],
      neutral: ['오늘도 평화로운 하루네요. 차 한 잔 하실래요?', '뭐 필요한 거 없어? 내가 도와줄게.'],
      hostile: ['...오늘은 좀 서운했어. 그래도 잘 지내.', '음... 지금은 혼자 있고 싶어.'],
    },
  },

  // 원칙주의 · 진지함  (고북 / 사하라 / 너굴 …)
  // 통하는 법: 구체적으로 답하기. 두루뭉술하면 못 미더워한다.
  serious: {
    label: '진지함',
    hint: '두루뭉술한 말보다 구체적인 답을 좋아해요',
    events: [
      {
        text: '지윤아, 오늘 공부 계획은 세워 두었나?',
        choices: [
          { label: '응, 수학 20문제랑 영어 단어 30개. 반은 끝냈어.', delta: 3, reaction: '허허, 훌륭하군. 그 습관이 자네를 멀리 데려갈 걸세.' },
          { label: '응, 세웠어! 열심히 할게.', delta: 0, reaction: '음. 무엇을 얼마나 할 건지도 정해 두면 더 좋을 텐데.' },
          { label: '계획은 없지만 하다 보면 잘 될 거야!', delta: -3, reaction: '허어... 마음가짐은 좋네만, 그것만으론 부족하다네.' },
        ],
      },
    ],
    idle: {
      friendly: ['자네를 보면 마음이 든든하네. 잘 자라고 있어.', '오늘도 성실했군. 그거면 충분하네.'],
      neutral: ['허허, 젊은이. 너무 서두르지 말게.', '원칙대로 하는 게 제일 빠른 길입니다.'],
      hostile: ['...오늘은 할 말이 없네.', '자네와는 생각이 좀 다른 것 같군.'],
    },
  },
};

// 성격 → 대화 묶음
const MBTI_PACK = {
  ESFP: 'playful', ESTP: 'playful', ENFP: 'playful',
  INTJ: 'aloof', INTP: 'aloof', ISFP: 'aloof',
  INFP: 'shy', ISFJ: 'shy',
  ENTP: 'bold',
  ESFJ: 'caring',
  ESTJ: 'serious', ISTJ: 'serious',
};

export function packFor(name) {
  const key = MBTI_PACK[mbtiOf(name)] ?? 'playful';
  return PACKS[key];
}

export function packNameFor(name) {
  return packFor(name).label;
}

/**
 * 이 친구와 잘 지내는 요령.
 * 세 선택지가 전부 착한 말이라 무엇이 통할지는 성격을 알아야 한다.
 * 사이가 좋아진 뒤(우호적)에만 보여 줘서, 처음에는 스스로 눈치채게 한다.
 */
export function packHintFor(name) {
  return packFor(name).hint ?? '';
}

/** 이 동물에게 걸 대화 이벤트 하나 (선택지 3개 포함) */
export function pickEvent(name, random = Math.random) {
  const pack = packFor(name);
  const events = pack.events;
  return events[Math.floor(random() * events.length) % events.length];
}

/** 호감도 단계에 맞는 평소 대사 */
export function idleLineFor(name, score, random = Math.random) {
  const pack = packFor(name);
  const tier = affinityTier(score);
  const pool = pack.idle[tier] ?? pack.idle.neutral;
  return pool[Math.floor(random() * pool.length) % pool.length];
}

/** 답을 고른 뒤 새 호감도와 리액션 */
export function applyChoice(score, choice) {
  const before = clampAffinity(score);
  const after = clampAffinity(before + (choice?.delta ?? 0));
  return {
    before,
    after,
    delta: after - before,
    reaction: choice?.reaction ?? '...',
    // 단계가 바뀌었으면 화면에서 알려 준다.
    tierChanged: affinityTier(before) !== affinityTier(after),
  };
}

// ── 오늘 말을 걸 친구 고르기 ────────────────────────────────────────────

/**
 * 마을에 들어올 때 1~2마리만 '!' 표시를 달아 준다.
 * 모두가 말을 걸면 공부에 방해가 되고, 아이도 지친다.
 */
export function pickQuestTargets(names = [], random = Math.random) {
  const pool = [...new Set(names.filter(Boolean))];
  if (pool.length === 0) return [];
  const count = Math.min(pool.length, random() < 0.5 ? 1 : 2);
  const picked = [];
  const rest = [...pool];
  for (let i = 0; i < count; i += 1) {
    const at = Math.floor(random() * rest.length);
    picked.push(rest.splice(at, 1)[0]);
  }
  return picked;
}

// 다음 대화가 열리기까지의 시간.
// 친구별이 아니라 '마을 전체'로 한 번이다. 5분에 한 번만 말을 걸 수 있으니
// 아이가 대화를 몰아서 하느라 공부를 놓치는 일이 없다.
export const DIALOGUE_COOLDOWN_MS = 5 * 60 * 1000;

const COOLDOWN_KEY = 'village-next-dialogue';

/** 다음 대화가 가능해지는 시각(ms). 마을을 나갔다 들어와도 유지된다. */
export function loadNextDialogueAt(userName) {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(`${COOLDOWN_KEY}:${userName || 'guest'}`);
    const at = Number(raw);
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

export function saveNextDialogueAt(userName, at) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${COOLDOWN_KEY}:${userName || 'guest'}`, String(at));
  } catch {
    // 저장 실패해도 이번 방문 동안의 쿨타임은 화면에서 지켜진다.
  }
}

/** 남은 시간을 '3분 20초'처럼 읽기 좋게 */
export function formatCooldown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min <= 0) return `${sec}초`;
  return sec > 0 ? `${min}분 ${sec}초` : `${min}분`;
}

// 지윤이가 삐져서 집에 들어가 있는 시각.
// 마을 화면을 나갔다 들어오면 캐릭터가 새로 배치되기 때문에,
// 이 값을 저장해 두지 않으면 '나갔다 오기'로 벌을 피할 수 있다.
const HOME_KEY = 'village-jiyoon-home';

export function loadHomeUntil(userName) {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(`${HOME_KEY}-${userName}`);
  return Number(raw) || 0;
}

export function saveHomeUntil(userName, at) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${HOME_KEY}-${userName}`, String(at));
}
