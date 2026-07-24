// 포인트를 쌓아 레벨이 오르면 새 동물 캐릭터를 한 마리씩 모으는 시스템.
//
// 기준은 "그동안 모은 포인트(누적 획득 포인트)"다. 현재 잔액이 아니라 누적값이라,
// 엄마가 선물로 포인트를 차감해도 이미 모은 캐릭터와 레벨은 절대 사라지지 않는다.
//
// COLLECTION 순서 = 해금 순서. 각 캐릭터의 requiredPoints(누적 포인트)를 넘으면 해금된다.
// 첫 캐릭터(개구리)는 0P라 시작하자마자 함께한다.
export const COLLECTION = [
  { name: 'frog', requiredPoints: 0 },
  { name: 'chick', requiredPoints: 100 },
  { name: 'fox', requiredPoints: 250 },
  { name: 'penguin', requiredPoints: 450 },
  { name: 'hedgehog', requiredPoints: 700 },
  { name: 'raccoon', requiredPoints: 1000 },
  { name: 'cat', requiredPoints: 1350 },
  { name: 'elephant', requiredPoints: 1750 },
  { name: 'blackpenguin', requiredPoints: 2200 },
  { name: 'sloth', requiredPoints: 2750 },
];

export const MAX_LEVEL = COLLECTION.length;

// 누적 포인트로 현재 레벨/보유 캐릭터/다음 해금까지의 진행도를 계산한다.
// level: 해금한 캐릭터 수(1 이상). 항상 첫 캐릭터는 보유하므로 최소 1이다.
export function getCollectionState(totalEarnedPoints) {
  const points = Math.max(0, Number(totalEarnedPoints) || 0);

  // 요구 포인트를 넘긴 캐릭터 수 = 레벨 (최소 1: 0P 캐릭터는 항상 보유)
  let unlockedCount = 0;
  for (const entry of COLLECTION) {
    if (points >= entry.requiredPoints) unlockedCount += 1;
    else break;
  }
  const level = Math.max(1, unlockedCount);

  const characters = COLLECTION.map((entry, index) => ({
    ...entry,
    unlocked: index < level,
  }));

  const isMax = level >= MAX_LEVEL;
  const nextEntry = isMax ? null : COLLECTION[level];
  const currentThreshold = COLLECTION[level - 1]?.requiredPoints ?? 0;
  const nextThreshold = nextEntry ? nextEntry.requiredPoints : currentThreshold;
  const pointsToNext = nextEntry ? Math.max(0, nextThreshold - points) : 0;

  // 이번 레벨 구간에서의 진행도(0~100). 최고 레벨이면 100.
  const span = nextThreshold - currentThreshold;
  const progressPct = isMax
    ? 100
    : span > 0
      ? Math.min(100, Math.round(((points - currentThreshold) / span) * 100))
      : 0;

  return {
    level,
    maxLevel: MAX_LEVEL,
    isMax,
    totalEarned: points,
    characters,
    unlockedNames: characters.filter((c) => c.unlocked).map((c) => c.name),
    nextCharacter: nextEntry ? nextEntry.name : null,
    pointsToNext,
    nextThreshold,
    progressPct,
  };
}
