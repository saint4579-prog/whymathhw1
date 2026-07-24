// 앱 곳곳에 장식으로 배치하고, 레벨업으로 모으는 동물 캐릭터들.
//
// 이미지는 프로젝트에 저장하지 않고 구글 드라이브에서 직접 불러온다.
// (로컬 파일은 배포 위치에 따라 경로가 깨지는 문제가 있었다.)
// drive.google.com/uc?export=view 형식은 CORP(same-site) 헤더 때문에 다른 도메인의
// <img>에서 차단되므로, 제한이 없는 lh3.googleusercontent.com 썸네일 CDN을 쓴다.
// =s400: 가장 긴 변을 400px로 맞춘다. 장식용 작은 이미지라 이 정도면 선명하고 가볍다.
const DRIVE_IDS = {
  frog: '151typ-XjjrHhdAmOsc-60djfZUiTR6DZ',
  chick: '1PhcyhoAKA6xnfQLXnQ1iH-O_ZEUS0rAN',
  fox: '1Z9MphY_VryMMXngXYRR3j90S6gg4921c',
  penguin: '1D6mIbiJCgZb5ava0Sk885iBcAczcvWTV',
  hedgehog: '1eHe6lAmFb79Wxxgzgwkl8CGFY-J8Sdz8',
  raccoon: '16-lxyQXeiernviS0eukSwHhk-YCYeMwy',
  cat: '1xJ_yibwAyT16OMf8_x-FsLg1ZPvg7E63',
  elephant: '1NIVCvzT6sRBZlPlQnvNWkw1uhGnPeVbk',
  blackpenguin: '1iCj_CB6ZMfrXDp9DY1xhrI0EDldRg3Ah',
  sloth: '1eXwrS-9yzGfmzmb-gIHxFWYAzNE4v_sr',
};

function driveImageUrl(id) {
  return `https://lh3.googleusercontent.com/d/${id}=s400`;
}

// naturalWidth/naturalHeight는 원본 PNG의 픽셀 비율이다.
// CharacterMascot가 이 비율로 <img>에 width/height를 지정해, 네트워크로 이미지를
// 불러오기 전에도 정확한 자리를 잡아 레이아웃 밀림(CLS)과 헤더 높이 튐을 막는다.
// label: 아이에게 보여줄 이름. ring/glow: 카드 장식에 쓰는 캐릭터별 색 톤.
export const CHARACTERS = {
  frog: {
    src: driveImageUrl(DRIVE_IDS.frog),
    label: '개구리',
    alt: '개구리 친구',
    naturalWidth: 290,
    naturalHeight: 251,
    ring: 'border-emerald-100',
    glow: 'shadow-emerald-100/60',
  },
  chick: {
    src: driveImageUrl(DRIVE_IDS.chick),
    label: '병아리',
    alt: '병아리 친구',
    naturalWidth: 302,
    naturalHeight: 317,
    ring: 'border-yellow-100',
    glow: 'shadow-yellow-100/60',
  },
  fox: {
    src: driveImageUrl(DRIVE_IDS.fox),
    label: '여우',
    alt: '여우 친구',
    naturalWidth: 339,
    naturalHeight: 290,
    ring: 'border-orange-100',
    glow: 'shadow-orange-100/60',
  },
  penguin: {
    src: driveImageUrl(DRIVE_IDS.penguin),
    label: '갈색 펭귄',
    alt: '갈색 펭귄 친구',
    naturalWidth: 290,
    naturalHeight: 268,
    ring: 'border-stone-200',
    glow: 'shadow-stone-100/60',
  },
  hedgehog: {
    src: driveImageUrl(DRIVE_IDS.hedgehog),
    label: '고슴도치',
    alt: '고슴도치 친구',
    naturalWidth: 307,
    naturalHeight: 285,
    ring: 'border-orange-100',
    glow: 'shadow-orange-100/60',
  },
  raccoon: {
    src: driveImageUrl(DRIVE_IDS.raccoon),
    label: '라쿤',
    alt: '라쿤 친구',
    naturalWidth: 296,
    naturalHeight: 258,
    ring: 'border-slate-200',
    glow: 'shadow-slate-100/60',
  },
  cat: {
    src: driveImageUrl(DRIVE_IDS.cat),
    label: '줄무늬 고양이',
    alt: '줄무늬 고양이 친구',
    naturalWidth: 327,
    naturalHeight: 270,
    ring: 'border-slate-200',
    glow: 'shadow-slate-100/60',
  },
  elephant: {
    src: driveImageUrl(DRIVE_IDS.elephant),
    label: '코끼리',
    alt: '코끼리 친구',
    naturalWidth: 419,
    naturalHeight: 248,
    ring: 'border-amber-100',
    glow: 'shadow-amber-100/60',
  },
  blackpenguin: {
    src: driveImageUrl(DRIVE_IDS.blackpenguin),
    label: '검정 펭귄',
    alt: '검정 펭귄 친구',
    naturalWidth: 315,
    naturalHeight: 241,
    ring: 'border-slate-300',
    glow: 'shadow-slate-200/60',
  },
  sloth: {
    src: driveImageUrl(DRIVE_IDS.sloth),
    label: '나무늘보',
    alt: '나무늘보 친구',
    naturalWidth: 309,
    naturalHeight: 287,
    ring: 'border-amber-200',
    glow: 'shadow-amber-100/60',
  },
};

export const CHARACTER_NAMES = Object.keys(CHARACTERS);
