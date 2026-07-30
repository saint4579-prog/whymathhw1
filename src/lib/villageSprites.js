// [멍멍 마을] 걷는 NPC 스프라이트 시트.
//
// 한 장의 그림(4열 × 4행 = 16프레임)을 잘라 쓴다. 낱장 PNG 16개보다
// 요청이 한 번이라 로딩이 빠르고, 프레임이 어긋날 일도 없다.
//
// 행 = 바라보는 방향, 열 = 걷는 동작 4단계.
//   0행 downRight  (앞쪽 오른편을 보며 걷기)
//   1행 downLeft   (앞쪽 왼편)
//   2행 upRight    (뒤돌아 오른편)
//   3행 upLeft     (뒤돌아 왼편)

export const SPRITE_COLUMNS = 4;
export const SPRITE_ROWS = 4;

// jiyoon-walk.png 를 실제로 재어 본 값 (1280×1280 → 한 프레임 320×320).
//   캐릭터 키       264px  (16프레임 모두 동일, 편차 0)
//   발밑 아래 여백   28px  (16프레임 모두 동일, 편차 0)
// 이 두 값이 있어야 발이 정확히 땅에 닿고, 걸을 때 위아래로 튀지 않는다.
const FRAME_PX = 320;
const BODY_PX = 264;
const FOOT_PADDING_PX = 28;

// 프레임 안에서 발밑이 위에서 몇 %에 있는가. 캐릭터를 앉힐 기준점.
export const FOOT_OFFSET_PCT = ((FRAME_PX - FOOT_PADDING_PX) / FRAME_PX) * 100; // 91.25%
// 보이는 키를 원하는 크기로 맞추려면 프레임 박스는 이만큼 커야 한다.
export const FRAME_TO_BODY = FRAME_PX / BODY_PX; // 약 1.212

// 한 프레임이 바뀌는 간격(ms). 140~180이 걷는 느낌이 가장 자연스럽다.
export const FRAME_MS = 160;

export const DIRECTION_ROW = {
  downRight: 0,
  downLeft: 1,
  upRight: 2,
  upLeft: 3,
};

/**
 * 이동 방향(dx, dy)으로 바라볼 방향을 정한다.
 * 화면 좌표라서 dy가 양수면 '아래로(앞으로)' 가는 것이다.
 */
export function directionFor(dx, dy) {
  if (dx >= 0 && dy >= 0) return 'downRight';
  if (dx < 0 && dy >= 0) return 'downLeft';
  if (dx >= 0 && dy < 0) return 'upRight';
  return 'upLeft';
}

/**
 * 걷기 프레임 번호(0~3). 흐른 시간으로 계산하므로
 * 화면 주사율이 달라도 걷는 속도가 늘 같다.
 */
export function walkFrame(elapsedMs, frameMs = FRAME_MS) {
  return Math.floor(Math.max(0, elapsedMs) / frameMs) % SPRITE_COLUMNS;
}

/**
 * CSS background로 한 프레임만 보여주기 위한 값.
 *
 * 시트를 (열 수 × 100)% 크기로 늘려 놓고 위치를 옮기는 방식이라,
 * 원본 그림이 몇 픽셀이든 상관없이 똑같이 동작한다.
 * (프레임 크기를 픽셀로 계산하면 이미지가 로드되기 전에는 알 수 없어 깜빡인다)
 */
export function frameStyle(sheetUrl, direction, frame) {
  const row = DIRECTION_ROW[direction] ?? 0;
  const col = Math.max(0, Math.min(SPRITE_COLUMNS - 1, frame));
  return {
    backgroundImage: `url(${sheetUrl})`,
    backgroundSize: `${SPRITE_COLUMNS * 100}% ${SPRITE_ROWS * 100}%`,
    // 칸이 4개면 0% / 33.33% / 66.67% / 100% 로 옮겨 간다.
    backgroundPosition: `${(col * 100) / (SPRITE_COLUMNS - 1)}% ${(row * 100) / (SPRITE_ROWS - 1)}%`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'auto',
  };
}

// ---------------------------------------------------------------------------
// 마을에 세울 NPC 목록
//
// sheet 에는 스프라이트 시트 이미지 주소를 넣는다.
// 구글 드라이브 공유 링크를 받으면 villageAssets 의 driveImage()로 만든 주소를 쓰면 된다.
// ---------------------------------------------------------------------------

export const NPCS = [
  {
    id: 'jiyoon',
    name: '지윤',
    sheet: '/images/jiyoon-walk.png',
    // 화면에 보일 '캐릭터 키'(px). 동물 친구(48~56px)보다 조금 크게 잡아 사람처럼 보이게.
    bodyHeight: 64,
    bodyHeightSm: 76,
    // 걷는 빠르기(비율/초)
    speed: 0.05,
    lines: [
      '안녕! 오늘도 공부하러 왔구나?',
      '한 걸음씩 가다 보면 어느새 멀리 와 있을 거야.',
      '쉬는 것도 공부의 하나야. 너무 무리하지 마.',
      '이 마을은 네가 노력한 만큼 자라나.',
      '연못 쪽에 개구리가 자주 나와. 봤어?',
      '집이 커지면 친구들이 더 놀러 온다더라!',
    ],
  },
];

/**
 * NPC를 화면에 그릴 때 쓸 크기와 위치 보정값.
 * 프레임 박스가 캐릭터보다 크고 발밑에 여백이 있어서, 그 여백만큼 아래로 내려 앉혀야
 * 발이 정확히 (x, y) 지점에 닿는다.
 */
export function npcBoxStyle(npc, small = false) {
  const body = (small ? npc.bodyHeightSm : npc.bodyHeight) ?? 64;
  const boxHeight = body * FRAME_TO_BODY;
  return {
    width: `${boxHeight}px`, // 프레임이 정사각형이라 가로=세로
    height: `${boxHeight}px`,
  };
}

/** 발밑을 (x, y)에 맞추는 CSS transform */
export function npcAnchorTransform() {
  return `translate(-50%, -${FOOT_OFFSET_PCT}%)`;
}

/** 시트 주소가 실제로 채워진 NPC만 화면에 올린다. */
export function activeNpcs() {
  return NPCS.filter((npc) => Boolean(npc.sheet));
}
