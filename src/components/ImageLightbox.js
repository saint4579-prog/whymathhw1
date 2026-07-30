'use client';

import { useEffect, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// 문제/정답/해설 이미지를 전체 화면으로 크게 띄우고 확대·축소·이동할 수 있는 라이트박스.
// 두 손가락(핀치)으로 확대/축소, 한 손가락(드래그)으로 이동하며 상단 버튼으로도 ＋확대/－축소가 가능하다.
export default function ImageLightbox({ imageUrl, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const changeScale = (delta) => {
    setScale((current) => clamp(current + delta, 0.5, 5));
  };

  const startGesture = () => {
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      const [first, second] = points;
      gestureRef.current = {
        type: 'pinch',
        distance: Math.hypot(second.x - first.x, second.y - first.y) || 1,
        midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        scale,
        offset,
      };
    } else if (points.length === 1) {
      gestureRef.current = { type: 'drag', point: points[0], offset };
    }
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const gesture = gestureRef.current;

    if (points.length >= 2 && gesture?.type === 'pinch') {
      const [first, second] = points;
      const distance = Math.hypot(second.x - first.x, second.y - first.y) || 1;
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      setScale(clamp(gesture.scale * (distance / gesture.distance), 0.5, 5));
      setOffset({
        x: gesture.offset.x + midpoint.x - gesture.midpoint.x,
        y: gesture.offset.y + midpoint.y - gesture.midpoint.y,
      });
    } else if (points.length === 1 && gesture?.type === 'drag') {
      setOffset({
        x: gesture.offset.x + points[0].x - gesture.point.x,
        y: gesture.offset.y + points[0].y - gesture.point.y,
      });
    }
  };

  const handlePointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    startGesture();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-stone-900/90 p-3 backdrop-blur-sm md:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} 크게 보기`}
    >
      <div className="z-10 mb-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => changeScale(0.25)}
          className="rounded-full border-2 border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-500 shadow-lg hover:bg-rose-50"
        >
          ＋ 확대
        </button>
        <button
          type="button"
          onClick={() => changeScale(-0.25)}
          className="rounded-full border-2 border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-600 shadow-lg hover:bg-amber-50"
        >
          － 축소
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="rounded-full border-2 border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-600 shadow-lg hover:bg-sky-50"
        >
          🐾 원본 크기
        </button>
        <span className="rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-stone-500">
          {Math.round(scale * 100)}%
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-rose-500 md:right-5 md:top-5"
      >
        닫기 ✕
      </button>
      <div
        className="relative flex min-h-0 flex-1 cursor-grab touch-none select-none items-center justify-center overflow-hidden rounded-3xl border-4 border-dashed border-amber-200/70 bg-amber-50/10 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          draggable={false}
          className="pointer-events-none max-h-[82vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transformOrigin: 'center',
          }}
        />
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-white/70">
        두 손가락으로 확대·축소하고, 끌어서 원하는 곳을 살펴보세요.
      </p>
    </div>
  );
}
