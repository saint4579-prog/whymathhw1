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

// 나무를 빼낸 섬 바닥. 나무는 따로 전경 레이어로 얹는다.
// 이렇게 나눠야 캐릭터가 나무 뒤로 가려지거나 앞으로 나오는 게 자연스러워진다.
// 원본에는 투명 체크무늬가 픽셀로 구워져 있어서, 가장자리부터 훑어 지운 판을 쓴다.
export const MEADOW_GROUND = '/images/meadow-background-clean.png';
// 전경으로 얹는 나무 (투명 PNG)
export const TREE_LAYER = '/images/tree-only-transparent.png';

// 맨 아래에 까는 하늘·산 배경. 섬 그림이 그 위에 얹힌다.
export const SKY_BACKGROUND = driveImage('1Y8jEDuwezD1EGap5vM8EeD65ZEf6wTb-', 1600);

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

/**
 * 포인트 기록에서 집 단계를 되짚어 낸다.
 *
 * 집을 올릴 때마다 '멍멍 마을 집 4단계' 같은 내역이 포인트기록 시트에 남는다.
 * 이게 아이가 실제로 포인트를 낸 증거이므로, 집 단계의 진짜 근거로 삼는다.
 *
 * 브라우저에 남은 값이나 플래너에 적힌 값은 어긋날 수 있다.
 * (기기를 바꾸거나, 예전에 이름 없이 저장하던 값이 남아 있거나, 시험 삼아 바꿨거나)
 * 하지만 포인트를 낸 기록은 지우지 않는 한 그대로다.
 *
 * 산 적이 없으면 1단계. (1단계는 처음부터 주어지므로 기록이 없다)
 */
export function houseLevelFromPointLogs(pointLogs = []) {
  let level = MIN_HOUSE_LEVEL;
  (Array.isArray(pointLogs) ? pointLogs : []).forEach((log) => {
    const matched = String(log?.item ?? '').match(/멍멍\s*마을\s*집\s*(\d+)\s*단계/);
    if (!matched) return;
    // 포인트가 빠져나간 기록만 인정한다. 환불이나 잘못 적힌 줄까지 세면 실제보다 높아진다.
    if (Number(log?.amount) > 0) return;
    const n = clampLevel(matched[1]);
    if (n > level) level = n;
  });
  return level;
}
