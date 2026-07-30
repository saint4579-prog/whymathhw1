import { CHARACTERS } from '@/lib/characters';

// 동물 캐릭터 마스코트: 구글 드라이브 CDN의 투명 PNG(@/lib/characters)를 장식용으로 배치한다.
// - height로 크기를 정하고 가로세로 비율은 원본 그대로 유지한다.
// - animate: 'bob'(위아래로 둥실) | 'wiggle'(좌우로 살랑) | 'none'
// - delay: 여러 마리를 나란히 둘 때 애니메이션 시작을 어긋나게 해 자연스럽게 보이게 한다.
// - flip: 좌우 반전 (애니메이션 transform과 충돌하지 않도록 바깥 span에 적용)
export default function CharacterMascot({
  name,
  height = 72,
  animate = 'bob',
  delay = 0,
  flip = false,
  className = '',
  style = {},
}) {
  const character = CHARACTERS[name];
  if (!character) return null;

  const animationClass =
    animate === 'bob'
      ? 'animate-mascot-bob'
      : animate === 'wiggle'
        ? 'animate-mascot-wiggle'
        : '';

  // 원본 비율(naturalWidth/naturalHeight)로 렌더 너비를 미리 계산해 <img>에 width/height를
  // 명시한다. 원격 이미지가 도착하기 전에도 브라우저가 정확한 자리를 잡아 레이아웃이 밀리지 않는다.
  const width = Math.round((height * character.naturalWidth) / character.naturalHeight);

  return (
    <span
      className={`inline-block leading-none ${flip ? 'scale-x-[-1]' : ''} ${className}`}
      style={style}
      aria-hidden={character.alt ? undefined : true}
    >
      {/* next/image 대신 순수 img: 장식용이라 최적화보다 단순함이 우선이고, 구글 드라이브 원격 링크를 그대로 쓴다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={character.src}
        alt={character.alt}
        width={width}
        height={height}
        draggable={false}
        style={{ height, width, animationDelay: delay ? `${delay}ms` : undefined }}
        className={`pointer-events-none max-w-none select-none object-contain drop-shadow-sm ${animationClass}`}
      />
    </span>
  );
}
