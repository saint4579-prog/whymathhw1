const API_URL =
  process.env.NEXT_PUBLIC_SHEET_API_URL ||
  'https://script.google.com/macros/s/AKfycbz9qdyqPLpDUHthPDpnynv0uSivgayGtMbOSfFdFLQNlqtpS_swx7eWug6i0orQsvtw/exec';

// localStorage에 저장된 userInfo에서 이름만 꺼낸다. (등록 전이거나 저장소 접근이 막힌 환경은 null)
function getStoredUserName() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('userInfo');
    if (!raw) return null;
    return JSON.parse(raw)?.name ?? null;
  } catch {
    return null;
  }
}

async function parseApiResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === 'error' || data?.success === false) {
    throw new Error(data?.message || fallbackMessage);
  }
  return data;
}

// 전체 문제 목록(392개)을 구글 시트에서 조회. 학생별 학습 기록/포인트가 분리되어 있으므로
// localStorage의 userInfo.name을 userName 쿼리 파라미터로 함께 전달한다.
export async function fetchProblems() {
  const userName = getStoredUserName();
  const url = userName ? `${API_URL}?userName=${encodeURIComponent(userName)}` : API_URL;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('문제 목록을 불러오지 못했습니다.');
  }
  return res.json();
}

// 특정 문제의 채점 결과와 아이가 캔버스에 작성한 풀이 이미지를 업데이트
// Content-Type을 text/plain으로 보내야 Apps Script Web App에서 CORS preflight 없이 처리된다.
export async function submitGrade(
  rowNumber,
  isCorrect,
  code,
  canvasImage,
  solveTimeSec,
  userName,
  workbook,
  typedAnswer
) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      rowNumber,
      isCorrect,
      // 학습기록 B열에 반드시 기록되어야 하는 현재 문제 파일명
      code,
      canvasImage: canvasImage || null,
      solveTimeSec: Math.max(0, Math.round(Number(solveTimeSec) || 0)),
      // 학생별로 학습 기록/포인트를 분리하기 위한 사용자 식별자
      userName: userName ?? getStoredUserName(),
      // 'mockExam'이면 모의고사문제목록 시트를 갱신한다 (기본값: 문제목록).
      workbook: workbook || undefined,
      // 펜 대신 키보드로 답을 냈을 때 아이가 입력한 텍스트.
      // 학습기록 G열에 남겨서, 나중에 "무슨 답을 썼다가 틀렸나"를 되짚어 볼 수 있게 한다.
      typedAnswer: typedAnswer ? String(typedAnswer).slice(0, 200) : '',
    }),
  });
  if (!res.ok) {
    throw new Error('채점 결과 전송에 실패했습니다.');
  }
  return parseApiResponse(res, '채점 결과 전송에 실패했습니다.');
}

// 엄마가 인증 후 보상을 선물하면 구글 시트의 포인트 잔액을 차감한다.
export async function redeemPoints(item, amount, userName) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      type: 'REDEEM_POINT',
      item,
      amount: Math.round(Number(amount)),
      // 학생별로 포인트를 분리하기 위한 사용자 식별자
      userName: userName ?? getStoredUserName(),
    }),
  });
  return parseApiResponse(res, '포인트 차감에 실패했습니다.');
}

// 최초 접속 시 학년/이름/성별을 구글 시트에 등록한다.
export async function registerUser(grade, name, gender) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      type: 'REGISTER_USER',
      grade: Math.round(Number(grade)),
      name,
      gender,
    }),
  });
  return parseApiResponse(res, '사용자 등록에 실패했습니다.');
}

// ---------------------------------------------------------------------------
// 스터디 플래너 API
// 구글 시트의 '플래너' 시트에 사용자별 계획을 통째로 JSON으로 저장한다.
// 네트워크가 끊겨도 아이가 계획을 잃지 않도록, 항상 localStorage에 먼저 캐시한다.
// ---------------------------------------------------------------------------

const PLANNER_CACHE_KEY = 'dog-math-planner-cache';

function plannerCacheKey(userName) {
  return `${PLANNER_CACHE_KEY}:${userName || 'guest'}`;
}

// 저장 실패/오프라인 대비 로컬 캐시. 서버 응답이 오면 이 값을 덮어쓴다.
export function readPlannerCache(userName) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(plannerCacheKey(userName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writePlannerCache(userName, state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(plannerCacheKey(userName), JSON.stringify(state));
  } catch {
    // 저장소가 막힌 환경에서도 화면 상태는 계속 유지된다.
  }
}

// 플래너 전체 상태(목표 목록 + 날짜별 하루 계획)를 시트에서 불러온다.
// 실패하면 예외를 던지지 않고 로컬 캐시로 폴백해서, 아이 화면이 절대 비어 보이지 않게 한다.
export async function fetchPlanner(userName) {
  const name = userName ?? getStoredUserName();
  const cached = readPlannerCache(name);
  try {
    const url = `${API_URL}?type=GET_PLANNER&userName=${encodeURIComponent(name || '')}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await parseApiResponse(res, '플래너를 불러오지 못했습니다.');
    const planner = data?.planner ?? data?.data?.planner ?? null;
    if (planner) {
      writePlannerCache(name, planner);
      return { planner, source: 'remote' };
    }
    return { planner: cached, source: cached ? 'cache' : 'empty' };
  } catch (error) {
    return { planner: cached, source: cached ? 'cache' : 'empty', error: String(error.message || error) };
  }
}

// 플래너 블롭의 일부 필드만 안전하게 바꿔 저장한다. (시험 대비 설정/학원 숙제 등)
// 현재 블롭을 읽어(캐시 우선, 없으면 서버) patch를 얕은 병합한 뒤 통째로 저장하므로,
// goals/days 같은 다른 필드를 덮어쓰지 않는다. GAS 저장이 실패해도 localStorage에는 남는다.
export async function patchPlanner(userName, patch) {
  const name = userName ?? getStoredUserName();
  let base = readPlannerCache(name);
  if (!base) {
    try {
      const { planner } = await fetchPlanner(name);
      base = planner;
    } catch {
      base = null;
    }
  }
  const next = { goals: [], days: {}, ...(base || {}), ...(patch || {}) };
  writePlannerCache(name, next); // 낙관적 저장: 네트워크보다 먼저 로컬에 남긴다.
  try {
    await savePlanner(next, name);
  } catch {
    // 서버 저장 실패는 무시 (로컬 캐시로 유지). GAS 재배포 후 다음 저장부터 서버 반영됨.
  }
  return next;
}

// 목표/하루 계획 변경분을 시트에 통째로 저장한다. (마지막 저장이 이김 - 아이 1명이 쓰는 앱이라 충분)
export async function savePlanner(planner, userName) {
  const name = userName ?? getStoredUserName();
  writePlannerCache(name, planner); // 낙관적 저장: 네트워크보다 먼저 로컬에 남긴다.
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      type: 'SAVE_PLANNER',
      userName: name,
      planner,
    }),
  });
  return parseApiResponse(res, '플래너 저장에 실패했습니다.');
}

// 하루를 마감하며 달성률만큼 포인트를 지급한다.
// 중복 지급을 막기 위해 date를 키로 쓰고, 서버는 같은 날짜의 이전 지급액과의 차액만 기록한다.
export async function awardPlannerPoints(date, amount, achievementRate, userName) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      type: 'PLANNER_POINT',
      date,
      amount: Math.max(0, Math.round(Number(amount) || 0)),
      achievementRate: Number(achievementRate) || 0,
      userName: userName ?? getStoredUserName(),
    }),
  });
  return parseApiResponse(res, '플래너 포인트 지급에 실패했습니다.');
}

// 구글 시트가 반환하는 "drive.google.com/uc?export=view&id=..." 형태의 링크는
// 최종 리소스에 Cross-Origin-Resource-Policy: same-site 헤더가 붙어 있어
// 다른 도메인(Vercel 배포 주소 등)의 <img> 태그에서는 브라우저가 차단한다.
// CORP 제한이 없는 lh3.googleusercontent.com 썸네일 CDN 형식으로 변환해 사용한다.
export function toViewableImageUrl(url) {
  if (!url) return url;
  const match = url.match(/[?&]id=([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
  if (!match) return url;
  return `https://lh3.googleusercontent.com/d/${match[1]}=s1600`;
}

// ---------------------------------------------------------------------------
// 학습 체크리스트
// 아이가 종이로 풀고 체크만 하는 화면. 체크는 '체크리스트' 시트에 저장되고,
// 채점 결과(O/X)는 학습기록에도 남아 포인트와 망각곡선 복습에 반영된다.
// ---------------------------------------------------------------------------

// 저장된 체크 상태와 오늘 이미 받은 체크리스트 포인트를 가져온다.
export async function fetchChecklist(userName) {
  const name = userName ?? getStoredUserName();
  const url = `${API_URL}?type=GET_CHECKLIST&userName=${encodeURIComponent(name || '')}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await parseApiResponse(res, '체크리스트를 불러오지 못했습니다.');
  const root = data?.data && !Array.isArray(data.data) ? data.data : data;
  return {
    checks: root?.checks && typeof root.checks === 'object' ? root.checks : {},
    earnedToday: Number(root?.earnedToday) || 0,
  };
}

// 체크 변경분을 저장한다. 배열로 받아 두어, 나중에 "이 개념 전부 체크" 같은
// 묶음 처리를 추가해도 요청 횟수가 늘지 않는다.
export async function saveChecklistMarks(userName, entries = []) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      type: 'SAVE_CHECKLIST',
      userName: userName ?? getStoredUserName(),
      entries: entries.map((e) => ({
        code: e.code,
        checks: e.checks,
        // 'O' | 'X' | null. null이면 아직 채점 단계가 아니라 포인트도 없다.
        mark: e.mark ?? null,
      })),
    }),
  });
  const data = await parseApiResponse(res, '체크 저장에 실패했습니다.');
  const root = data?.data && !Array.isArray(data.data) ? data.data : data;
  return {
    granted: Number(root?.granted) || 0,
    capped: Boolean(root?.capped),
    earnedToday: Number(root?.earnedToday) || 0,
  };
}
