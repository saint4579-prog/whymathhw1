'use client';

import { useCallback, useEffect, useState } from 'react';

// 한 번 누를 때 늘어나는 비율 (화면 한 칸의 50%)
const STEP = 0.5;
const MAX = 4; // 화면의 4배까지
const MIN = 1;

/**
 * 캔버스를 아래로 / 오른쪽으로 넓히는 기능.
 *
 * 문제 이미지가 캔버스를 꽉 채우면 풀이를 쓸 여백이 없다. 그럴 때 캔버스를 화면보다
 * 크게 늘리고, 늘어난 부분은 스크롤해서 쓴다. 문제 이미지는 원래 자리(왼쪽 위)에
 * 그대로 있고 빈 종이만 아래·오른쪽으로 붙는 셈이다.
 *
 * 배율은 문제마다 초기화하지 않고 유지한다. 아이가 매번 다시 누르지 않아도 되게.
 *
 * @returns {{ scale, controls, wrapperProps, innerStyle }}
 *   wrapperProps 를 스크롤될 바깥 div에, innerStyle 을 캔버스를 감싼 div에 넣는다.
 */
export function useCanvasExpander(canvasRef, storageKey = 'canvas-expand') {
  const [scale, setScale] = useState({ w: MIN, h: MIN });

  // 아이가 정해 둔 배율을 기억한다.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && Number(saved.w) >= MIN && Number(saved.h) >= MIN) {
        setScale({ w: Math.min(MAX, Number(saved.w)), h: Math.min(MAX, Number(saved.h)) });
      }
    } catch {
      // 저장소가 막혀 있으면 기본 크기로 시작한다.
    }
  }, [storageKey]);

  const apply = useCallback(
    (next) => {
      setScale(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // 저장 실패는 무시
      }
      // 컨테이너 크기가 바뀌었으니 캔버스도 다시 맞춘다.
      // 두 번 호출하는 건 레이아웃이 실제로 반영된 뒤에 한 번 더 맞춰야 정확해서다.
      window.requestAnimationFrame(() => {
        canvasRef.current?.resize();
        window.requestAnimationFrame(() => canvasRef.current?.resize());
      });
    },
    [canvasRef, storageKey]
  );

  const grow = (axis) =>
    apply({ ...scale, [axis]: Math.min(MAX, Number((scale[axis] + STEP).toFixed(1))) });
  const shrink = (axis) =>
    apply({ ...scale, [axis]: Math.max(MIN, Number((scale[axis] - STEP).toFixed(1))) });
  const reset = () => apply({ w: MIN, h: MIN });

  const expanded = scale.w > MIN || scale.h > MIN;

  const controls = (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border-2 border-amber-100 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur">
      <span className="px-1 text-[11px] font-extrabold text-stone-400">종이 넓히기</span>

      <button
        type="button"
        onClick={() => shrink('h')}
        disabled={scale.h <= MIN}
        aria-label="아래 여백 줄이기"
        className="h-8 w-8 rounded-xl bg-amber-50 text-sm font-black text-stone-500 transition hover:bg-amber-100 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => grow('h')}
        disabled={scale.h >= MAX}
        aria-label="아래로 넓히기"
        className="h-8 w-8 rounded-xl bg-amber-100 text-sm font-black text-amber-700 transition hover:bg-amber-200 disabled:opacity-30"
      >
        ↓
      </button>

      <span className="mx-0.5 h-5 w-px bg-amber-100" />

      <button
        type="button"
        onClick={() => shrink('w')}
        disabled={scale.w <= MIN}
        aria-label="오른쪽 여백 줄이기"
        className="h-8 w-8 rounded-xl bg-amber-50 text-sm font-black text-stone-500 transition hover:bg-amber-100 disabled:opacity-30"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => grow('w')}
        disabled={scale.w >= MAX}
        aria-label="오른쪽으로 넓히기"
        className="h-8 w-8 rounded-xl bg-amber-100 text-sm font-black text-amber-700 transition hover:bg-amber-200 disabled:opacity-30"
      >
        →
      </button>

      {expanded && (
        <>
          <span className="mx-0.5 h-5 w-px bg-amber-100" />
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-extrabold text-sky-700">
            {scale.w}×{scale.h}배
          </span>
          <button
            type="button"
            onClick={reset}
            aria-label="원래 크기로"
            className="h-8 rounded-xl bg-amber-50 px-2 text-[11px] font-extrabold text-stone-500 transition hover:bg-amber-100"
          >
            원래대로
          </button>
        </>
      )}
    </div>
  );

  return {
    scale,
    expanded,
    controls,
    // 스크롤을 담당하는 바깥 div에 준다.
    wrapperProps: {
      className: 'relative min-h-0 flex-1 overflow-auto rounded-2xl',
      // 캔버스 자체는 touch-action:none이라 펜이 취소되지 않는다.
      // 스크롤은 여백을 손가락으로 밀어서 한다.
      style: { WebkitOverflowScrolling: 'touch' },
    },
    // 캔버스를 감싼 div에 준다. 여기 크기가 곧 캔버스 크기가 된다.
    innerStyle: {
      width: `${scale.w * 100}%`,
      height: `${scale.h * 100}%`,
      minWidth: '100%',
      minHeight: '100%',
    },
  };
}

export default useCanvasExpander;
