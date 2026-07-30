// [멍멍 마을] 캐릭터가 돌아다니는 규칙.
//
// 좌표는 전부 '맵 크기에 대한 비율(0~1)'로 다룬다. 그래야 화면 크기가 바뀌어도
// 캐릭터가 맵 밖으로 튀어나가지 않고, 아이패드와 노트북에서 같은 모습이 된다.

// 집이 놓이는 자리 (맵 중앙, 비율)
export const HOUSE_AREA = { x: 0.5, y: 0.46, halfWidth: 0.19, halfHeight: 0.2 };

// 캐릭터가 걸어 다닐 수 있는 범위. 맵 가장자리는 조금 비워 둔다.
export const WALK_AREA = { minX: 0.06, maxX: 0.94, minY: 0.42, maxY: 0.92 };

// 한 번에 움직이는 거리(비율/초)와 쉬는 시간
const SPEED = 0.045;
const REST_MIN_MS = 900;
const REST_MAX_MS = 3800;

/** 집이 차지하는 자리인가 (캐릭터가 집을 뚫고 지나가지 않도록) */
export function isInsideHouse(x, y) {
  return (
    Math.abs(x - HOUSE_AREA.x) < HOUSE_AREA.halfWidth &&
    Math.abs(y - HOUSE_AREA.y) < HOUSE_AREA.halfHeight
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** 걸어 다닐 수 있는 자리로 목적지를 하나 고른다. 집 자리는 피한다. */
export function randomWalkablePoint(random = Math.random) {
  for (let tries = 0; tries < 30; tries += 1) {
    const x = WALK_AREA.minX + random() * (WALK_AREA.maxX - WALK_AREA.minX);
    const y = WALK_AREA.minY + random() * (WALK_AREA.maxY - WALK_AREA.minY);
    if (!isInsideHouse(x, y)) return { x, y };
  }
  // 30번을 뽑아도 집 안이면(있을 수 없지만) 안전하게 아래쪽 마당으로 보낸다.
  return { x: 0.5, y: WALK_AREA.maxY };
}

/** 캐릭터 한 마리의 처음 상태 */
export function spawnCharacter(name, index, total, random = Math.random) {
  // 처음부터 겹쳐 있으면 지저분하니, 집 아래 마당에 고르게 흩어 놓는다.
  const spread = total > 1 ? index / (total - 1) : 0.5;
  const x = clamp(WALK_AREA.minX + spread * (WALK_AREA.maxX - WALK_AREA.minX), WALK_AREA.minX, WALK_AREA.maxX);
  const y = WALK_AREA.minY + random() * (WALK_AREA.maxY - WALK_AREA.minY);
  const start = isInsideHouse(x, y) ? { x, y: WALK_AREA.maxY } : { x, y };
  return {
    name,
    x: start.x,
    y: start.y,
    target: randomWalkablePoint(random),
    // 처음에는 조금씩 다른 시간에 움직이기 시작한다. 다 같이 움직이면 부자연스럽다.
    restUntil: Date.now() + random() * 2000,
    facing: 1, // 1=오른쪽, -1=왼쪽
    line: null,
    lineUntil: 0,
  };
}

/**
 * 한 프레임만큼 움직인다.
 * 목적지에 닿으면 잠깐 쉬었다가 새 목적지를 고른다.
 *
 * @param actor 캐릭터 상태
 * @param dtSec 지난 시간(초)
 * @returns 새 상태 (원본은 건드리지 않는다)
 */
export function stepCharacter(actor, dtSec, now = Date.now(), random = Math.random) {
  const next = { ...actor };

  // 말풍선 시간이 지났으면 지운다.
  if (next.line && now >= next.lineUntil) next.line = null;

  // 쉬는 중
  if (now < next.restUntil) return next;

  const dx = next.target.x - next.x;
  const dy = next.target.y - next.y;
  const distance = Math.hypot(dx, dy);
  const stride = SPEED * dtSec;

  if (distance <= stride || distance < 0.005) {
    // 도착. 잠깐 쉬고 다음 목적지를 고른다.
    next.x = next.target.x;
    next.y = next.target.y;
    next.target = randomWalkablePoint(random);
    next.restUntil = now + REST_MIN_MS + random() * (REST_MAX_MS - REST_MIN_MS);
    return next;
  }

  const stepX = (dx / distance) * stride;
  const stepY = (dy / distance) * stride;
  let nx = next.x + stepX;
  let ny = next.y + stepY;

  // 집을 가로지르게 되면 이번 발걸음은 취소하고 다른 목적지를 고른다.
  if (isInsideHouse(nx, ny)) {
    next.target = randomWalkablePoint(random);
    return next;
  }

  nx = clamp(nx, WALK_AREA.minX, WALK_AREA.maxX);
  ny = clamp(ny, WALK_AREA.minY, WALK_AREA.maxY);

  next.x = nx;
  next.y = ny;
  if (Math.abs(stepX) > 0.0001) next.facing = stepX > 0 ? 1 : -1;
  return next;
}

/**
 * 캐릭터가 집보다 앞에 있는지 뒤에 있는지 정한다.
 * 아래쪽(y가 큼)에 있을수록 앞으로 온다. 2D 게임에서 흔히 쓰는 방식이다.
 */
export function zIndexFor(y) {
  return 10 + Math.round(y * 1000);
}

// 집의 z-index. 집보다 위(y가 작음)에 있는 캐릭터는 집 뒤로 가려진다.
export const HOUSE_Z_INDEX = zIndexFor(HOUSE_AREA.y + HOUSE_AREA.halfHeight);

/** 서로 가까워진 캐릭터 짝을 찾는다. (합동 대사용) */
export function findNearbyPair(actors, threshold = 0.07, now = Date.now()) {
  for (let i = 0; i < actors.length; i += 1) {
    for (let j = i + 1; j < actors.length; j += 1) {
      const a = actors[i];
      const b = actors[j];
      // 이미 말하고 있는 캐릭터는 건너뛴다. 말풍선이 겹치면 읽기 어렵다.
      if ((a.line && now < a.lineUntil) || (b.line && now < b.lineUntil)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= threshold) return [i, j];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 오늘 마을에 나와 있는 친구 고르기
//
// 집이 클수록 더 많은 친구가 놀러 온다. (1단계 1마리 … 10단계 10마리)
// 해금한 친구가 그보다 많으면 그중 일부만 나오는데, 마을에 들어올 때마다
// 순서를 새로 섞어서 "오늘은 누가 나와 있을까?" 하는 재미를 준다.
// ---------------------------------------------------------------------------

/** 배열을 무작위로 섞는다. 원본은 그대로 두고 새 배열을 돌려준다. (피셔-예이츠) */
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 마을에 내보낼 친구를 고른다.
 *
 * 섞은 '전체 순서'를 만들어 두고 앞에서부터 자르는 방식이라,
 * 집을 한 단계 올리면 이미 나와 있던 친구는 그대로 있고 새 친구가 한 마리 더 나온다.
 * (매번 새로 섞으면 업그레이드할 때마다 마당이 통째로 바뀌어 어수선하다)
 *
 * @param names 해금한 캐릭터 이름들
 * @param houseLevel 집 단계 = 나올 수 있는 최대 마릿수
 * @returns { roster, cast } roster=섞인 전체 순서, cast=오늘 나올 친구들
 */
export function pickCast(names = [], houseLevel = 1, random = Math.random) {
  const unique = [...new Set(names.filter(Boolean))];
  const limit = Math.max(0, Math.round(Number(houseLevel) || 0));
  const roster = shuffle(unique, random);
  // 해금한 수가 집 단계보다 적거나 같으면 전부 나온다.
  return { roster, cast: roster.slice(0, Math.min(limit, roster.length)) };
}
