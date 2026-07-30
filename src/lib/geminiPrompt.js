import { toViewableImageUrl } from './api';

// 윈도우/맥에서 파일명으로 쓸 수 없는 문자를 걸러내고, 확장자가 없으면 .png를 붙인다.
// 문제의 code는 구글 드라이브 파일명(예: "4-1-15.png")이라 대개 확장자가 이미 포함되어 있다.
function toSafeFileName(code, index) {
  const base = String(code ?? '').trim().replace(/[\\/:*?"<>|]/g, '_') || `문제${index + 1}`;
  return /\.(png|jpe?g|gif|webp)$/i.test(base) ? base : `${base}.png`;
}

export function buildHintPrompt(problems) {
  const list = problems
    .map((p, index) => `- ${toSafeFileName(p.code, index)}`)
    .join('\n');

  return `첨부한 수학 문제 이미지를 보고 아이가 스스로 풀 수 있도록 힌트를 제공해 줘.

[첨부한 문제]
${list}

[🚨 지켜야 할 엄격한 규칙]
1. 절대로 최종 정답이나 수식 계산 결과를 바로 알려주지 마.
2. 풀이 과정을 처음부터 끝까지 다 보여주지 마.
3. 아이가 스스로 다음 단계를 생각할 수 있도록 '첫 번째 접근 개념' 또는 '유용한 힌트 질문' 1~2개만 제시해 줘.`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // navigator.clipboard를 쓸 수 없는 환경(비보안 컨텍스트 등)을 위한 폴백
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// 문제 이미지를 blob으로 받아 사용자의 다운로드 폴더에 저장한다.
// toViewableImageUrl이 만들어 주는 lh3.googleusercontent.com 주소는 CORS를 허용하므로
// 다른 도메인(Vercel 배포 주소 등)에서도 fetch로 내려받아 파일로 저장할 수 있다.
async function downloadImage(url, fileName) {
  const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error(`이미지를 내려받지 못했습니다. (${res.status})`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 다운로드가 시작될 시간을 준 뒤 메모리를 해제한다.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

/**
 * 제미나이에 물어볼 준비를 한다.
 * 1) 힌트 프롬프트를 클립보드에 복사하고 (사용자 제스처가 살아 있는 동안 먼저 처리)
 * 2) 문제 이미지를 파일로 저장해 제미나이에 그대로 첨부할 수 있게 한다.
 *
 * @returns {Promise<{saved: string[], failed: string[]}>} 저장에 성공/실패한 파일명 목록
 */
export async function prepareGeminiHint(problems) {
  await copyToClipboard(buildHintPrompt(problems));

  const saved = [];
  const failed = [];

  // 브라우저가 동시 다운로드를 막는 경우가 있어 순차적으로 저장한다.
  for (let index = 0; index < problems.length; index += 1) {
    const problem = problems[index];
    const fileName = toSafeFileName(problem.code, index);
    const imageUrl = toViewableImageUrl(problem.imageUrl);
    if (!imageUrl) {
      failed.push(fileName);
      continue;
    }
    try {
      await downloadImage(imageUrl, fileName);
      saved.push(fileName);
    } catch {
      failed.push(fileName);
    }
  }

  return { saved, failed };
}

// prepareGeminiHint 결과를 아이가 읽을 수 있는 안내 문구로 바꾼다.
export function buildHintResultMessage({ saved, failed }) {
  if (saved.length === 0) {
    return [
      '🐾 힌트 프롬프트는 복사했어요!',
      '하지만 문제 이미지를 저장하지 못했어요. 😢',
      '화면의 문제 이미지를 길게 눌러 직접 저장한 뒤 제미나이에 첨부해 주세요.',
    ].join('\n');
  }

  const lines = [
    `🐾 힌트 프롬프트를 복사하고 문제 이미지 ${saved.length}개를 저장했어요! 🦴`,
    '제미나이에 붙여넣고, 저장된 이미지를 함께 첨부해 주세요.',
  ];
  if (failed.length > 0) {
    lines.push('', `⚠️ 아래 ${failed.length}개는 저장하지 못했어요: ${failed.join(', ')}`);
  }
  return lines.join('\n');
}
