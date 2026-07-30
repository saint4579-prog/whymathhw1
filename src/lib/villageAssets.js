// [멍멍 마을] 배경·집 이미지와 집 단계 규칙.
//
// 이미지는 구글 드라이브에 올린 것을 CORS가 허용되는 lh3 썸네일로 불러온다.
// (문제 이미지와 같은 방식. drive.google.com/uc 링크는 다른 도메인에서 차단된다)

// 공유 링크에서 파일 ID만 뽑아 쓴다.
// 'https://drive.google.com/file/d/<ID>/view?usp=drivesdk' → '<ID>'
export function driveIdFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/\/d\/([\w-]+)/) || String(url).match(/[?&]id=([\w-]+)/);
  return match ? match[1] : null;
}

/** 드라이브 파일 ID → 화면에 바로 쓸 수 있는 이미지 URL */
export function driveImage(id, size = 1600) {
  return id ? `https://lh3.googleusercontent.com/d/${id}=s${size}` : null;
}

/**
 * 공유 링크 표(붙여넣은 그대로)를 { 파일명: URL } 로 바꿔 준다.
 * 탭이든 여러 칸 공백이든 상관없이 읽는다.
 */
export function parseDriveTable(text) {
  const out = {};
  String(text || '')
    .split('\n')
    .forEach((line) => {
      const [name, url] = line.split(/\t|\s{2,}/).map((s) => (s || '').trim());
      if (!name || !url || !url.startsWith('http')) return;
      const id = driveIdFromUrl(url);
      if (id) out[name] = driveImage(id);
    });
  return out;
}

// 배경 2종. 집이 5단계 이하면 첫 번째, 6단계부터 두 번째로 바뀐다.
const BACKGROUND_IDS = ['1aenMIU8f0HmhkyC7T4GP77fNAbIis8mu', '1smMhBV8Xu0JSBZwFVjKq_-ovMSObeFD1'];

// 집 1~10단계
const HOUSE_IDS = [
  '1c3t_0eBwaWm-4umD3ExHkGztLGKivRxu',
  '18Ru8WojCfrfXZAIY7pU8gEdkQLn_DEsR',
  '1IXwi-SIapD-XeBanv2Lqk-8596iUEKj_',
  '18054tsdsPSlbi2FNSEB68-SUrOj6u8at',
  '1s0w6nyvAc1F9kcvMNnh2ewtGsaeY2KvW',
  '1zSgnSS3Y8mEOA2DqHFR45DZJ_dpYKh91',
  '1KhmmLR9nP41EY6PsxJ-syKrI363-oo24',
  '1MdNAj-B20GL8vtsP5aZ1TM4BOSowQS7d',
  '17g2qTYwurn81r5S1xbhx5MgLFys8imsd',
  '1bRPNsYuawiYtPLOQskT82R0gYWYRTRta',
];

export const MIN_HOUSE_LEVEL = 1;
export const MAX_HOUSE_LEVEL = HOUSE_IDS.length;
// 6단계부터 배경이 바뀐다.
export const THEME_SWITCH_LEVEL = 6;

// 앱 화면에 띄우는 '멍멍 마을' 입구 아이콘
export const VILLAGE_ICON = driveImage('14vn12nYgNDpLflVH5bqez6TkYIsqjJA2', 400);

export const BACKGROUNDS = BACKGROUND_IDS.map((id) => driveImage(id));
export const HOUSES = HOUSE_IDS.map((id) => driveImage(id));

export function clampLevel(level) {
  const n = Math.round(Number(level) || MIN_HOUSE_LEVEL);
  return Math.min(MAX_HOUSE_LEVEL, Math.max(MIN_HOUSE_LEVEL, n));
}

export function backgroundFor(level) {
  return clampLevel(level) < THEME_SWITCH_LEVEL ? BACKGROUNDS[0] : BACKGROUNDS[1];
}

export function houseFor(level) {
  return HOUSES[clampLevel(level) - 1];
}

// 단계별 업그레이드 비용. 1→2가 300P, 뒤로 갈수록 비싸진다.
// 채점 20P / 플래너 100P 규모를 생각하면, 10단계까지는 꾸준히 오래 모아야 닿는다.
const UPGRADE_COSTS = [300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];

/** 다음 단계로 올리는 데 드는 포인트. 최고 단계면 null */
export function upgradeCost(level) {
  const current = clampLevel(level);
  if (current >= MAX_HOUSE_LEVEL) return null;
  return UPGRADE_COSTS[current - 1];
}

/** 10단계까지 남은 총 포인트 (목표 안내용) */
export function remainingCostToMax(level) {
  const current = clampLevel(level);
  return UPGRADE_COSTS.slice(current - 1).reduce((sum, c) => sum + c, 0);
}

// 단계마다 붙는 집 이름. 아이가 성장을 실감하도록.
export const HOUSE_NAMES = [
  '작은 텐트',
  '아늑한 오두막',
  '나무 집',
  '벽돌 집',
  '이층 집',
  '정원 딸린 집',
  '넓은 저택',
  '탑이 있는 저택',
  '멋진 대저택',
  '멍멍 마을 성',
];

export function houseName(level) {
  return HOUSE_NAMES[clampLevel(level) - 1];
}
