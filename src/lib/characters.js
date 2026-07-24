// 앱 곳곳에 장식으로 배치하는 동물 캐릭터들.
//
// 이미지는 프로젝트에 저장하지 않고 구글 드라이브에서 직접 불러온다.
// (로컬 파일은 배포 위치에 따라 경로가 깨지는 문제가 있었다.)
// drive.google.com/uc?export=view 형식은 CORP(same-site) 헤더 때문에 다른 도메인의
// <img>에서 차단되므로, 제한이 없는 lh3.googleusercontent.com 썸네일 CDN을 쓴다.
// =s400: 가장 긴 변을 400px로 맞춘다. 장식용 작은 이미지라 이 정도면 선명하고 가볍다.
const DRIVE_IDS = {
  frog: '151typ-XjjrHhdAmOsc-60djfZUiTR6DZ',
  elephant: '1NIVCvzT6sRBZlPlQnvNWkw1uhGnPeVbk',
  fox: '1Z9MphY_VryMMXngXYRR3j90S6gg4921c',
  penguin: '1D6mIbiJCgZb5ava0Sk885iBcAczcvWTV',
  raccoon: '16-lxyQXeiernviS0eukSwHhk-YCYeMwy',
  chick: '1PhcyhoAKA6xnfQLXnQ1iH-O_ZEUS0rAN',
  dog: '1PV-5LQxKBBWhZA_C2BL5vIXBnuiPZI7s',
};

function driveImageUrl(id) {
  return `https://lh3.googleusercontent.com/d/${id}=s400`;
}

// naturalWidth/naturalHeight는 원본 PNG의 픽셀 비율이다.
// CharacterMascot가 이 비율로 <img>에 width/height를 지정해, 네트워크로 이미지를
// 불러오기 전에도 정확한 자리를 잡아 레이아웃 밀림(CLS)과 헤더 높이 튐을 막는다.
// ring/glow는 카드 장식(Dashboard 요약 카드)에 쓰는 캐릭터별 색 톤이다.
export const CHARACTERS = {
  frog: {
    src: driveImageUrl(DRIVE_IDS.frog),
    alt: '개구리 친구',
    naturalWidth: 290,
    naturalHeight: 251,
    ring: 'border-emerald-100',
    glow: 'shadow-emerald-100/60',
  },
  elephant: {
    src: driveImageUrl(DRIVE_IDS.elephant),
    alt: '코끼리 친구',
    naturalWidth: 419,
    naturalHeight: 248,
    ring: 'border-amber-100',
    glow: 'shadow-amber-100/60',
  },
  fox: {
    src: driveImageUrl(DRIVE_IDS.fox),
    alt: '여우 친구',
    naturalWidth: 339,
    naturalHeight: 290,
    ring: 'border-orange-100',
    glow: 'shadow-orange-100/60',
  },
  penguin: {
    src: driveImageUrl(DRIVE_IDS.penguin),
    alt: '갈색 펭귄 친구',
    naturalWidth: 290,
    naturalHeight: 268,
    ring: 'border-stone-200',
    glow: 'shadow-stone-100/60',
  },
  raccoon: {
    src: driveImageUrl(DRIVE_IDS.raccoon),
    alt: '라쿤 친구',
    naturalWidth: 296,
    naturalHeight: 258,
    ring: 'border-slate-200',
    glow: 'shadow-slate-100/60',
  },
  chick: {
    src: driveImageUrl(DRIVE_IDS.chick),
    alt: '병아리 친구',
    naturalWidth: 302,
    naturalHeight: 317,
    ring: 'border-yellow-100',
    glow: 'shadow-yellow-100/60',
  },
  dog: {
    src: driveImageUrl(DRIVE_IDS.dog),
    alt: '강아지 친구',
    naturalWidth: 377,
    naturalHeight: 253,
    ring: 'border-amber-200',
    glow: 'shadow-amber-100/60',
  },
};

export const CHARACTER_NAMES = Object.keys(CHARACTERS);
