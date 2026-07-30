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
  playful: {
    label: '장난꾸러기',
    events: [
      {
        text: '지윤아! 나 방금 엄청 웃긴 생각 났어! 뒷산에 가서 진흙구덩이에서 파티할래?!',
        choices: [
          { label: '완전 재밌겠다! 당장 가자!', delta: 3, reaction: '역시 지윤이가 최고야! 내가 제일 좋은 자리 맡아둘게!' },
          { label: '음... 오늘은 옷 더러워지는 거 싫은데.', delta: 0, reaction: '에이, 까다롭기는. 알았어, 나 혼자 갈게.' },
          { label: '너 또 씻기 싫어서 핑계 대는 거지? 목욕부터 해!', delta: -3, reaction: '흥! 지윤이 완전 잔소리꾼! 너랑 안 놀아!' },
        ],
      },
      {
        text: '지윤아, 나랑 술래잡기 하자! 내가 술래 할게. 열까지 셀 동안 숨어!',
        choices: [
          { label: '좋아! 절대 못 찾을 데 숨을 거야!', delta: 3, reaction: '히히, 기대되는데? 하나... 둘... 셋...!' },
          { label: '조금만 쉬었다가 하자.', delta: 0, reaction: '알았어, 기다려 줄게. 근데 빨리 와!' },
          { label: '너 저번에 열까지 안 세고 찾았잖아.', delta: -3, reaction: '아, 그건... 그건 실수였다고! 삐졌어!' },
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
  aloof: {
    label: '도도함',
    events: [
      {
        text: '(햇살 아래서 꾸벅꾸벅 졸고 있다) ...방해하지 마라...',
        choices: [
          { label: '(옆에 조용히 앉아서 같이 쉰다)', delta: 3, reaction: '...너 옆은 꽤 따뜻하네. 조금만 더 잘게.' },
          { label: '감기 걸려. 집에 가서 자.', delta: 0, reaction: '알아서 할게. 신경 꺼줄래?' },
          { label: '일어나!! 놀자아아악!!', delta: -3, reaction: '하아... 진짜 최악이야. 내 평화로운 오후를 망쳤어.' },
        ],
      },
      {
        text: '이 책 읽고 있는데... 아, 아무것도 아니야. 신경 쓰지 마.',
        choices: [
          { label: '무슨 책이야? 나도 궁금해.', delta: 3, reaction: '...흥. 궁금하면 옆에서 같이 봐도 돼. 조용히만 있어.' },
          { label: '그래, 방해 안 할게.', delta: 0, reaction: '...고마워. 그게 제일 도움이 돼.' },
          { label: '책은 됐고 나랑 놀자!', delta: -3, reaction: '...내 시간을 뭐라고 생각하는 거야. 저리 가.' },
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
  shy: {
    label: '소심함',
    events: [
      {
        text: '지윤아... 내가 정성껏 키운 당근이... 벌레 먹었어... 훌쩍...',
        choices: [
          { label: '울지 마. 내가 그 나쁜 벌레 다 쫓아내 줄게!', delta: 3, reaction: '정말? 지윤이는 정말 용감하고 다정해... 고마워!' },
          { label: '어쩔 수 없지. 농사란 원래 그런 거래.', delta: 0, reaction: '으응... 그렇긴 한데... 너무 슬퍼...' },
          { label: '잘됐네! 난 당근 싫어하니까 안 먹어도 되겠다!', delta: -3, reaction: '너무해...! 내 정성을 무시하다니! 우아앙!' },
        ],
      },
      {
        text: '저... 지윤아. 이 꽃... 너한테 주려고 골랐는데... 받아줄래...?',
        choices: [
          { label: '와, 정말 예뻐! 소중히 간직할게.', delta: 3, reaction: '헤헤... 좋아해 줘서 다행이야. 또 골라올게!' },
          { label: '고마워. 여기 두고 갈게.', delta: 0, reaction: '으응... 그래도 받아줘서 기뻐...' },
          { label: '꽃은 좀... 시들면 버려야 하잖아.', delta: -3, reaction: '아... 미, 미안해. 괜한 걸 했나 봐... 훌쩍.' },
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
  bold: {
    label: '자신감',
    events: [
      {
        text: '지윤아! 나랑 퀴즈 대결하자! 내가 이기면 네 간식 내 거야!',
        choices: [
          { label: '좋아! 내가 이기면 네가 내 방 청소하기다!', delta: 3, reaction: '크하하! 배짱 좋은데? 절대 안 봐준다!' },
          { label: '나 지금 수학 공부해야 해서 바빠.', delta: 0, reaction: '에이, 공부 벌레. 이따가 꼭 해줘야 해!' },
          { label: '너 저번에도 졌잖아. 넌 나한테 안 돼~', delta: -3, reaction: '뭐라고?! 욱! 두고 봐! 다음엔 꼭 이길 테니까! 흥!' },
        ],
      },
      {
        text: '내가 이 마을에서 제일 빠르다고! 못 믿겠으면 달리기 해볼래?',
        choices: [
          { label: '오, 인정! 진짜 빠르긴 해.', delta: 3, reaction: '역시 지윤이는 볼 줄 아는구나! 크하하!' },
          { label: '난 달리기보다 걷는 게 좋아.', delta: 0, reaction: '뭐야, 재미없어. 그럼 다음에 하자.' },
          { label: '나무늘보보다 조금 빠른 정도지.', delta: -3, reaction: '뭐?! 지금 나 무시한 거야?! 화났어!' },
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
  caring: {
    label: '다정함',
    events: [
      {
        text: '지윤아, 오늘 공부 많이 했지? 내가 간식 만들어 놨는데 먹고 갈래?',
        choices: [
          { label: '와, 고마워! 잘 먹겠습니다!', delta: 3, reaction: '많이 먹어! 힘내라고 만든 거야. 헤헤.' },
          { label: '배불러서 나중에 먹을게.', delta: 0, reaction: '그래, 남겨둘게. 꼭 먹으러 와!' },
          { label: '또 만들었어? 매번 안 그래도 되는데.', delta: -3, reaction: '아... 귀찮았구나. 미안해, 다음엔 안 할게.' },
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
  serious: {
    label: '진지함',
    events: [
      {
        text: '지윤아, 오늘 할 일 목록은 다 확인했나? 계획 없이 움직이면 안 된다네.',
        choices: [
          { label: '응, 다 적어뒀어! 하나씩 해나갈게.', delta: 3, reaction: '허허, 훌륭하군. 그 습관이 자네를 멀리 데려갈 거야.' },
          { label: '아직인데... 지금 확인할게.', delta: 0, reaction: '음. 지금이라도 늦지 않았네. 서두르게.' },
          { label: '계획 같은 거 없어도 잘 되던데?', delta: -3, reaction: '허어... 그런 태도는 곤란하네. 나중에 후회할 걸세.' },
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

// 같은 친구와 다시 대화할 수 있게 되기까지의 시간
export const DIALOGUE_COOLDOWN_MS = 3 * 60 * 1000;
