// [멍멍 마을] 지형과 캐릭터 이동 규칙.
//
// 좌표는 전부 '맵 그림에 대한 비율(0~1)'이다. 그래야 확대하거나 화면 크기가 바뀌어도
// 캐릭터가 늘 같은 자리(연못은 연못, 잔디는 잔디)에 있게 된다.
//
// 지형은 세 덩어리로 나눈다.
//   섬(LAND_POLYGON) : 잔디 전체. 마름모꼴 섬이라 사각형으로는 표현이 안 되어 다각형으로 잡았다.
//   연못(POND)       : 물. 물에 사는 친구만 들어간다.
//   집터(HOUSE_BASE) : 위쪽 단에 놓인 집. 아무도 뚫고 지나가지 못한다.
//
// 그림과 조금 어긋나면 아래 숫자만 만지면 된다. 화면의 [영역 보기] 버튼을 켜면
// 실제로 어디가 잔디이고 어디가 물인지 눈으로 확인할 수 있다.

// ── 지형 ────────────────────────────────────────────────────────────────

// 잔디 섬의 테두리. 그림의 마름모를 따라 시계 방향으로 찍은 점들.
export const LAND_POLYGON = [
  [0.075, 0.545],
  [0.215, 0.435],
  [0.44, 0.335],
  [0.60, 0.30],
  [0.76, 0.40],
  [0.905, 0.53],
  [0.90, 0.60],
  [0.75, 0.72],
  [0.50, 0.85],
  [0.26, 0.72],
  [0.09, 0.60],
];

// 연못(타원). 물에 사는 친구들의 놀이터.
export const POND = { x: 0.615, y: 0.60, rx: 0.145, ry: 0.115 };

// 집이 놓이는 위쪽 단. 집 그림의 '바닥'이 여기에 닿는다.
export const HOUSE_ANCHOR = { x: 0.545, y: 0.415 };
// 집 그림의 가로 크기(맵 대비)
export const HOUSE_WIDTH = 0.30;
// 캐릭터가 못 지나가는 집터. 그림보다 조금 작게 잡아야 답답해 보이지 않는다.
export const HOUSE_BASE = { x: 0.545, y: 0.375, halfWidth: 0.115, halfHeight: 0.085 };

// 집 현관. 지윤이가 삐졌을 때 여기로 걸어가서 안으로 들어간다.
// 집터(충돌 영역) 바로 '아래' 잔디에 둬야 한다. 집터 안에 두면 갈 수 없는 자리라
// 문 앞까지 가지도 못하고 그 자리에 멈춰 버린다.
export const HOUSE_DOOR = {
  x: HOUSE_ANCHOR.x,
  y: HOUSE_BASE.y + HOUSE_BASE.halfHeight + 0.015,
};

// ── 나무 (전경 레이어) ─────────────────────────────────────────────────
//
// tree-only-transparent.png 를 실제로 재어 본 값 (1254×1254).
//   줄기 중심 x = 0.50 (캔버스 기준)
//   뿌리 밑동 y = 0.86
//   줄기 폭     = 캔버스의 13%
// 그림 안에서 '뿌리가 땅에 닿는 점'이 어디인지 알아야, 그 점을 지형 좌표에 맞춰
// 앉힐 수 있고 z-index도 정확히 계산된다.
export const TREE_IMAGE = { trunkX: 0.50, rootY: 0.86, trunkWidth: 0.13 };

// 지도에서 나무 뿌리가 닿는 자리와 그림 크기
export const TREE_ANCHOR = { x: 0.30, y: 0.455 };
export const TREE_WIDTH = 0.30;

// 줄기 충돌 영역. 잎(수관) 밑으로는 지나갈 수 있어야 자연스럽고,
// 줄기만 못 지나가게 작고 납작하게 잡는다.
export const TREE_BASE = { x: TREE_ANCHOR.x, y: TREE_ANCHOR.y - 0.012, halfWidth: 0.032, halfHeight: 0.018 };

/** 나무 줄기 자리인가 */
export function isInsideTree(x, y) {
  const dx = (x - TREE_BASE.x) / TREE_BASE.halfWidth;
  const dy = (y - TREE_BASE.y) / TREE_BASE.halfHeight;
  return dx * dx + dy * dy <= 1;
}

// 물에 사는 친구들. 이 친구들만 연못에서 논다.
export const AQUATIC_NAMES = new Set(['개구리', '갈색 펭귄', '검정 펭귄', '해탈한', '고래', '물개']);

export function isAquatic(name) {
  return AQUATIC_NAMES.has(name);
}

// 한 번에 움직이는 거리(비율/초)와 쉬는 시간
const SPEED = 0.045;
const REST_MIN_MS = 900;
const REST_MAX_MS = 3800;

// ── 지형 판정 ───────────────────────────────────────────────────────────

/** 다각형 안에 있는가 (광선 교차 방식) */
export function pointInPolygon(x, y, polygon = LAND_POLYGON) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** 연못 안인가 */
export function isInPond(x, y, margin = 0) {
  const dx = (x - POND.x) / (POND.rx + margin);
  const dy = (y - POND.y) / (POND.ry + margin);
  return dx * dx + dy * dy <= 1;
}

/** 집터인가 */
export function isInsideHouse(x, y) {
  return (
    Math.abs(x - HOUSE_BASE.x) < HOUSE_BASE.halfWidth &&
    Math.abs(y - HOUSE_BASE.y) < HOUSE_BASE.halfHeight
  );
}

/**
 * 이 자리에 설 수 있는가.
 *  땅 친구 : 섬 안 + 연못 밖 + 집터 밖
 *  물 친구 : 연못 안
 */
export function isWalkable(x, y, kind = 'land') {
  if (kind === 'water') return isInPond(x, y, -0.012); // 물가에 걸치지 않게 살짝 안쪽
  return (
    pointInPolygon(x, y) && !isInPond(x, y, 0.01) && !isInsideHouse(x, y) && !isInsideTree(x, y)
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** 갈 수 있는 자리를 하나 고른다. */
export function randomWalkablePoint(kind = 'land', random = Math.random) {
  if (kind === 'water') {
    // 타원 안에서 고르게 뽑는다.
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.82;
    return { x: POND.x + Math.cos(angle) * POND.rx * radius, y: POND.y + Math.sin(angle) * POND.ry * radius };
  }
  for (let tries = 0; tries < 60; tries += 1) {
    const x = 0.08 + random() * 0.82;
    const y = 0.32 + random() * 0.52;
    if (isWalkable(x, y, 'land')) return { x, y };
  }
  // 여기까지 오는 일은 없지만, 안전하게 섬 아래쪽 잔디로 보낸다.
  return { x: 0.5, y: 0.78 };
}

/**
 * 캐릭터 한 마리의 처음 상태.
 * npc를 넘기면 걷는 스프라이트를 쓰는 NPC가 된다.
 */
export function spawnCharacter(name, index, total, random = Math.random, npc = null) {
  const kind = npc ? 'land' : isAquatic(name) ? 'water' : 'land';
  const start = randomWalkablePoint(kind, random);
  return {
    name,
    kind,
    // NPC면 스프라이트 정보를 함께 들고 다닌다. (없으면 기존 낱장 그림 캐릭터)
    npc,
    // 걷기 애니메이션용: 바라보는 방향과 걷기 시작 시각
    direction: 'downRight',
    walkingSince: 0,
    x: start.x,
    y: start.y,
    target: randomWalkablePoint(kind, random),
    // 다 같이 움직이면 부자연스러우니 시작 시간을 조금씩 어긋나게 한다.
    restUntil: Date.now() + random() * 2000,
    facing: 1, // 1=오른쪽, -1=왼쪽
    line: null,
    lineUntil: 0,
    // 아이가 "저기로 가"라고 찍어 준 자리. 이때는 쉬지 않고 곧장 간다.
    commanded: false,
    // 집으로 돌아가는 중인가 / 집 안에 들어가 있는가
    goingHome: false,
    hidden: false,
  };
}

/**
 * 집으로 돌려보낸다. 문 앞까지 걸어간 뒤 안으로 들어간다.
 * (바로 사라지면 아이가 무슨 일인지 모른다. 걸어가는 모습을 보여 줘야
 *  "삐져서 들어갔구나"를 알 수 있다.)
 */
export function sendHome(actor) {
  const moved = commandMove(actor, HOUSE_DOOR.x, HOUSE_DOOR.y);
  return { ...moved, goingHome: true, line: null, lineUntil: 0 };
}

/** 집에서 다시 나온다. 문 앞에서 시작해 마당으로 걸어간다. */
export function comeOutside(actor, random = Math.random) {
  return {
    ...actor,
    hidden: false,
    goingHome: false,
    commanded: false,
    x: HOUSE_DOOR.x,
    y: HOUSE_DOOR.y,
    target: randomWalkablePoint(actor.kind ?? 'land', random),
    restUntil: 0,
    walkingSince: 0,
  };
}

/** 한 프레임만큼 움직인다. (원본은 건드리지 않는다) */
export function stepCharacter(actor, dtSec, now = Date.now(), random = Math.random) {
  const next = { ...actor };
  const kind = next.kind ?? 'land';

  // 집 안에 있으면 아무것도 하지 않는다.
  if (next.hidden) return next;

  if (next.line && now >= next.lineUntil) next.line = null;
  if (now < next.restUntil) return next;

  const dx = next.target.x - next.x;
  const dy = next.target.y - next.y;
  const distance = Math.hypot(dx, dy);
  // 아이가 시킨 이동은 조금 더 빠르게. 기다리는 재미가 없으면 안 되니까.
  const baseSpeed = next.npc?.speed ?? SPEED;
  const stride = baseSpeed * (next.commanded ? 1.8 : 1) * dtSec;

  if (distance <= stride || distance < 0.004) {
    next.x = next.target.x;
    next.y = next.target.y;
    // 집으로 가던 길이었다면 문 앞에 닿았으니 안으로 들어간다.
    if (next.goingHome) {
      next.hidden = true;
      next.goingHome = false;
      next.commanded = false;
      next.walkingSince = 0;
      return next;
    }
    next.target = randomWalkablePoint(kind, random);
    next.restUntil = now + REST_MIN_MS + random() * (REST_MAX_MS - REST_MIN_MS);
    next.commanded = false;
    next.walkingSince = 0; // 멈췄으니 걷기 동작도 멈춘다
    return next;
  }

  const stepX = (dx / distance) * stride;
  const stepY = (dy / distance) * stride;
  const nx = next.x + stepX;
  const ny = next.y + stepY;

  // 걷는 스프라이트는 좌우 반전 대신 방향별 그림이 따로 있다.
  // 그래서 여기서 바라볼 방향을 정해 둔다. (화면 좌표라 dy>0이 '앞으로')
  if (next.npc) {
    next.direction =
      stepX >= 0 ? (stepY >= 0 ? 'downRight' : 'upRight') : stepY >= 0 ? 'downLeft' : 'upLeft';
    if (!next.walkingSince) next.walkingSince = now;
  }

  // 집에 가는 길은 지형에 걸리든 말든 곧장 간다.
  // 옆으로 미끄러지게 두면 연못가나 집 모서리에서 몇십 프레임씩 맴돌아,
  // 아이 눈에는 '가다 말고 멈춘' 것처럼 보인다.
  if (next.goingHome) {
    next.x = clamp(nx, 0.02, 0.98);
    next.y = clamp(ny, 0.02, 0.98);
    if (Math.abs(stepX) > 0.0001) next.facing = stepX > 0 ? 1 : -1;
    return next;
  }

  if (!isWalkable(nx, ny, kind)) {
    // 못 가는 곳이면 옆으로 살짝 돌아가 본다. (연못이나 집을 끼고 도는 효과)
    const slideX = next.x + stepX;
    const slideY = next.y + stepY;
    if (isWalkable(slideX, next.y, kind)) {
      next.x = slideX;
    } else if (isWalkable(next.x, slideY, kind)) {
      next.y = slideY;
    } else {
      // 완전히 막혔으면 다른 곳으로 목적지를 바꾼다.
      next.target = randomWalkablePoint(kind, random);
      next.commanded = false;
      return next;
    }
    if (Math.abs(stepX) > 0.0001) next.facing = stepX > 0 ? 1 : -1;
    return next;
  }

  next.x = clamp(nx, 0.02, 0.98);
  next.y = clamp(ny, 0.02, 0.98);
  if (Math.abs(stepX) > 0.0001) next.facing = stepX > 0 ? 1 : -1;
  return next;
}

/** 아이가 찍어 준 자리로 보낸다. 갈 수 없는 곳이면 가장 가까운 갈 수 있는 자리로. */
export function commandMove(actor, x, y) {
  const kind = actor.kind ?? 'land';
  if (isWalkable(x, y, kind)) {
    return { ...actor, target: { x, y }, restUntil: 0, commanded: true };
  }
  // 찍은 자리를 향해 조금씩 당겨 보며 갈 수 있는 가장 가까운 점을 찾는다.
  for (let t = 0.9; t > 0; t -= 0.05) {
    const nx = actor.x + (x - actor.x) * t;
    const ny = actor.y + (y - actor.y) * t;
    if (isWalkable(nx, ny, kind)) {
      return { ...actor, target: { x: nx, y: ny }, restUntil: 0, commanded: true };
    }
  }
  return actor;
}

/**
 * 집보다 앞에 있는지 뒤에 있는지. 아래쪽(y가 큼)일수록 앞으로 온다.
 */
export function zIndexFor(y) {
  return 10 + Math.round(y * 1000);
}

// 집의 z-index. 집 바닥선보다 위에 있는 캐릭터는 집 뒤로 가려진다.
export const HOUSE_Z_INDEX = zIndexFor(HOUSE_ANCHOR.y);
// 나무의 z-index. 뿌리보다 아래(y가 큼)에 있는 캐릭터는 나무 앞에,
// 위에 있는 캐릭터는 나무 뒤로 가려진다.
export const TREE_Z_INDEX = zIndexFor(TREE_ANCHOR.y);

/** 서로 가까워진 캐릭터 짝을 찾는다. (합동 대사용) */
export function findNearbyPair(actors, threshold = 0.07, now = Date.now()) {
  for (let i = 0; i < actors.length; i += 1) {
    for (let j = i + 1; j < actors.length; j += 1) {
      const a = actors[i];
      const b = actors[j];
      if ((a.line && now < a.lineUntil) || (b.line && now < b.lineUntil)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= threshold) return [i, j];
    }
  }
  return null;
}

// ── 오늘 마을에 나와 있는 친구 고르기 ──────────────────────────────────

/** 배열을 무작위로 섞는다. (피셔-예이츠) */
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 마을에 내보낼 친구를 고른다. 집 단계 = 나올 수 있는 최대 마릿수.
 * 섞은 전체 순서를 만들어 두고 앞에서부터 자르므로, 집을 키우면
 * 나와 있던 친구는 그대로 있고 새 친구가 한 마리 더 나온다.
 */
export function pickCast(names = [], houseLevel = 1, random = Math.random) {
  const unique = [...new Set(names.filter(Boolean))];
  const limit = Math.max(0, Math.round(Number(houseLevel) || 0));
  const roster = shuffle(unique, random);
  return { roster, cast: roster.slice(0, Math.min(limit, roster.length)) };
}
