const API_URL =
  process.env.NEXT_PUBLIC_SHEET_API_URL ||
  'https://script.google.com/macros/s/AKfycbz9qdyqPLpDUHthPDpnynv0uSivgayGtMbOSfFdFLQNlqtpS_swx7eWug6i0orQsvtw/exec';

// 전체 문제 목록(392개)을 구글 시트에서 조회
export async function fetchProblems() {
  const res = await fetch(API_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('문제 목록을 불러오지 못했습니다.');
  }
  return res.json();
}

// 특정 문제의 채점 결과와 아이가 캔버스에 작성한 풀이 이미지를 업데이트
// Content-Type을 text/plain으로 보내야 Apps Script Web App에서 CORS preflight 없이 처리된다.
export async function submitGrade(rowNumber, isCorrect, code, canvasImage, solveTimeSec) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      rowNumber,
      isCorrect,
      // 학습기록 B열에 반드시 기록되어야 하는 현재 문제 파일명
      code,
      canvasImage: canvasImage || null,
      solveTimeSec: Math.max(0, Math.round(Number(solveTimeSec) || 0)),
    }),
  });
  if (!res.ok) {
    throw new Error('채점 결과 전송에 실패했습니다.');
  }
  return res.json().catch(() => ({}));
}

// 엄마가 인증 후 보상을 선물하면 구글 시트의 포인트 잔액을 차감한다.
export async function redeemPoints(item, amount) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      type: 'REDEEM_POINT',
      item,
      amount: Math.round(Number(amount)),
    }),
  });
  if (!res.ok) {
    throw new Error('포인트 차감에 실패했습니다.');
  }
  const data = await res.json().catch(() => ({}));
  if (data?.success === false) {
    throw new Error(data.message || '포인트 차감에 실패했습니다.');
  }
  return data;
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
