import { toViewableImageUrl } from './api';

export function buildHintPrompt(problems) {
  const list = problems
    .map((p) => `- ${p.code} (${toViewableImageUrl(p.imageUrl)})`)
    .join('\n');

  return `아래 수학 문제 이미지(또는 문제명)를 보고 아이가 스스로 풀 수 있도록 힌트를 제공해 줘.

[선택된 문제]
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

export async function copyHintPrompt(problems) {
  const prompt = buildHintPrompt(problems);
  await copyToClipboard(prompt);
}
