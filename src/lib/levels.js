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
  { name: 'ac01', requiredPoints: 3150 },
  { name: 'ac02', requiredPoints: 3555 },
  { name: 'ac03', requiredPoints: 3965 },
  { name: 'ac04', requiredPoints: 4380 },
  { name: 'ac05', requiredPoints: 4800 },
  { name: 'ac06', requiredPoints: 5225 },
  { name: 'ac07', requiredPoints: 5655 },
  { name: 'ac08', requiredPoints: 6090 },
  { name: 'ac09', requiredPoints: 6530 },
  { name: 'ac10', requiredPoints: 6975 },
  { name: 'ac11', requiredPoints: 7425 },
  { name: 'ac12', requiredPoints: 7880 },
  { name: 'ac13', requiredPoints: 8340 },
  { name: 'ac14', requiredPoints: 8805 },
  { name: 'ac15', requiredPoints: 9275 },
  { name: 'ac16', requiredPoints: 9750 },
  { name: 'ac17', requiredPoints: 10230 },
  { name: 'ac18', requiredPoints: 10715 },
  { name: 'ac19', requiredPoints: 11205 },
  { name: 'ac20', requiredPoints: 11700 },
  { name: 'ac21', requiredPoints: 12200 },
  { name: 'ac22', requiredPoints: 12705 },
  { name: 'ac23', requiredPoints: 13215 },
  { name: 'ac24', requiredPoints: 13730 },
  { name: 'ac25', requiredPoints: 14250 },
  { name: 'ac26', requiredPoints: 14775 },
  { name: 'ac27', requiredPoints: 15305 },
  { name: 'ac28', requiredPoints: 15840 },
  { name: 'ac29', requiredPoints: 16380 },
  { name: 'ac30', requiredPoints: 16925 },
  { name: 'ac31', requiredPoints: 17475 },
  { name: 'ac32', requiredPoints: 18030 },
  { name: 'ac33', requiredPoints: 18590 },
  { name: 'ac34', requiredPoints: 19155 },
  { name: 'ac35', requiredPoints: 19725 },
  { name: 'ac36', requiredPoints: 20300 },
  { name: 'ac37', requiredPoints: 20880 },
  { name: 'ac38', requiredPoints: 21465 },
  { name: 'ac39', requiredPoints: 22055 },
  { name: 'ac40', requiredPoints: 22650 },
  { name: 'ac41', requiredPoints: 23250 },
  { name: 'ac42', requiredPoints: 23855 },
  { name: 'ac43', requiredPoints: 24465 },
  { name: 'ac44', requiredPoints: 25080 },
  { name: 'ac45', requiredPoints: 25700 },
  { name: 'ac46', requiredPoints: 26325 },
  { name: 'ac47', requiredPoints: 26955 },
  { name: 'ac48', requiredPoints: 27590 },
  { name: 'ac49', requiredPoints: 28230 },
  { name: 'ac50', requiredPoints: 28875 },
  { name: 'ac51', requiredPoints: 29525 },
  { name: 'ac52', requiredPoints: 30180 },
  { name: 'ac53', requiredPoints: 30840 },
  { name: 'ac54', requiredPoints: 31505 },
  { name: 'ac55', requiredPoints: 32175 },
  { name: 'ac56', requiredPoints: 32850 },
  { name: 'ac57', requiredPoints: 33530 },
  { name: 'ac58', requiredPoints: 34215 },
  { name: 'ac59', requiredPoints: 34905 },
  { name: 'ac60', requiredPoints: 35600 },
  { name: 'ac61', requiredPoints: 36300 },
  { name: 'ac62', requiredPoints: 37005 },
  { name: 'ac63', requiredPoints: 37715 },
  { name: 'ac64', requiredPoints: 38430 },
  { name: 'ac65', requiredPoints: 39150 },
  { name: 'ac66', requiredPoints: 39875 },
  { name: 'ac67', requiredPoints: 40605 },
  { name: 'ac68', requiredPoints: 41340 },
  { name: 'ac69', requiredPoints: 42080 },
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
