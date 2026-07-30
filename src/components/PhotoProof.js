'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 체크리스트 사진 인증.
 *
 * 아이가 푼 문제를 사진으로 찍으면, 그 사진을 화면에 띄워 둔 채로
 * 사진 속 문제들만 체크하게 한다.
 *
 * 사진은 저장하지 않는다. 브라우저 메모리에만 잠깐 두었다가 끝내면 지운다.
 * (부모가 나중에 볼 수는 없지만, '찍어서 눈앞에 두고 체크한다'는 절차 자체가
 *  안 푼 문제를 습관적으로 체크하는 걸 막아 준다)
 *
 * 사진을 다시 찍으면 앞의 사진은 즉시 버린다. 여러 장을 쌓아 두지 않는 이유는
 * 아이패드에서 고화질 사진 여러 장이 메모리에 남으면 화면이 버벅이기 때문이다.
 */
export default function PhotoProof({ active, onStart, onEnd, checkedCount = 0 }) {
  const inputRef = useRef(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  // 사진 주소는 다 쓰면 반드시 반납한다. 안 그러면 메모리에 계속 남는다.
  const releasePhoto = useCallback((url) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => () => releasePhoto(photoUrl), [photoUrl, releasePhoto]);

  const handlePick = (event) => {
    const file = event.target.files?.[0];
    // 파일 선택창을 열었다가 그냥 닫으면 file이 없다. 이때 기존 사진을 지우면 안 된다.
    if (!file) return;

    releasePhoto(photoUrl);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setZoomed(false);
    onStart?.();

    // 같은 사진을 연달아 다시 고를 수 있게 입력값을 비운다.
    event.target.value = '';
  };

  const handleEnd = () => {
    releasePhoto(photoUrl);
    setPhotoUrl(null);
    setZoomed(false);
    onEnd?.();
  };

  return (
    <section className="rounded-[2rem] border-4 border-white bg-white p-4 shadow-xl shadow-amber-100/70">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
      />

      {!active ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-stone-700">📷 푼 문제를 사진으로 보여 주세요</p>
            <p className="mt-0.5 text-xs font-bold text-stone-400">
              사진을 찍어야 체크할 수 있어요. 한 장에 여러 문제를 담아도 괜찮아요!
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-full bg-rose-400 px-5 py-3 text-sm font-black text-white shadow-md shadow-rose-200 hover:bg-rose-500"
          >
            사진 찍기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-emerald-600">
              ✅ 사진 확인! 이제 이 사진에 있는 문제만 체크해 주세요
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full bg-amber-100 px-4 py-2 text-xs font-extrabold text-amber-700 hover:bg-amber-200"
              >
                다시 찍기
              </button>
              <button
                type="button"
                onClick={handleEnd}
                className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-500"
              >
                체크 끝내기
              </button>
            </div>
          </div>

          {photoUrl && (
            <button
              type="button"
              onClick={() => setZoomed((v) => !v)}
              className="block w-full overflow-hidden rounded-2xl border-2 border-amber-100 bg-stone-50"
              title={zoomed ? '작게 보기' : '크게 보기'}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="방금 찍은 푼 문제 사진"
                className={`mx-auto w-full object-contain transition-all ${
                  zoomed ? 'max-h-[70vh]' : 'max-h-44'
                }`}
              />
            </button>
          )}

          <p className="text-center text-[11px] font-bold text-stone-400">
            사진을 누르면 {zoomed ? '작게' : '크게'} 볼 수 있어요 · 이번에 체크한 문제 {checkedCount}개
            <br />
            사진은 저장되지 않고, 체크를 끝내면 사라져요.
          </p>
        </div>
      )}
    </section>
  );
}
