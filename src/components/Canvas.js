'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const PEN_WIDTH = 2.5;
const ERASER_WIDTH = 24;

// 그리기를 허용할 포인터 종류. 아이패드에서는 애플펜슬이 'pen'으로 들어온다.
// 손가락은 'touch'라서 여기서 걸러지고(그리기 무시) → 화면 스크롤/확대에 쓰인다.
// 데스크톱 마우스('mouse')는 개발/검수용으로 함께 허용한다. (아이패드에는 mouse 포인터가 없어 사실상 펜 전용)
const isDrawingPointer = (event) => event.pointerType === 'pen' || event.pointerType === 'mouse';

const Canvas = forwardRef(function Canvas(
  { disabled = false, onDrawEnd, color = '#1e293b', tool = 'pen', bgImage = null, bgOpacity = 0.55 },
  ref
) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasContentRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const restoreSequenceRef = useRef(0);
  // 현재 펜 색상/도구를 ref로 들고 있어야 포인터 핸들러(클로저)가 항상 최신 값을 읽는다.
  const colorRef = useRef(color);
  const toolRef = useRef(tool);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  const getContext = () => canvasRef.current?.getContext('2d');

  const setupContext = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = PEN_WIDTH;
  }, []);

  // 그리기 직전에 현재 도구(펜/지우개)와 색상에 맞춰 컨텍스트를 설정한다.
  // 지우개는 destination-out 합성 모드로 실제 픽셀을 투명하게 지운다.
  const applyBrush = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    if (toolRef.current === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = ERASER_WIDTH;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = PEN_WIDTH;
    }
  }, []);

  // 캔버스의 실제 픽셀 크기가 바뀌면 브라우저가 내용을 지우므로,
  // 기존 비트맵을 잠시 복사해 두었다가 새 크기에 맞춰 다시 그린다.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(width * ratio));
    const nextHeight = Math.max(1, Math.round(height * ratio));

    if (canvas.width === nextWidth && canvas.height === nextHeight) return;

    const snapshot = document.createElement('canvas');
    if (hasContentRef.current && canvas.width && canvas.height) {
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
    }

    canvas.width = nextWidth;
    canvas.height = nextHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = getContext();
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (snapshot.width && snapshot.height) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, nextWidth, nextHeight);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    setupContext();
  }, [setupContext]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;
    restoreSequenceRef.current += 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasContentRef.current = false;
  }, []);

  const restoreCanvas = useCallback(
    (dataURL) => {
      clearCanvas();
      if (!dataURL) return Promise.resolve();

      const sequence = restoreSequenceRef.current;
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          if (sequence !== restoreSequenceRef.current) {
            resolve();
            return;
          }
          const canvas = canvasRef.current;
          const ctx = getContext();
          if (canvas && ctx) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            hasContentRef.current = true;
            setupContext();
          }
          resolve();
        };
        image.onerror = () => resolve();
        image.src = dataURL;
      });
    },
    [clearCanvas, setupContext]
  );

  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useImperativeHandle(
    ref,
    () => ({
      clear: clearCanvas,
      getDataURL: () => {
        if (!hasContentRef.current) return null;
        return canvasRef.current?.toDataURL('image/png') ?? null;
      },
      hasContent: () => hasContentRef.current,
      restore: restoreCanvas,
      resize: resizeCanvas,
    }),
    [clearCanvas, resizeCanvas, restoreCanvas]
  );

  const getPos = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event) => {
    // 펜(애플펜슬)/마우스만 그린다. 손가락 터치는 무시해 스크롤/확대가 가능하게 둔다.
    if (disabled || !isDrawingPointer(event)) return;
    event.preventDefault();
    // 포인터 캡처는 그리는 중 손가락이 캔버스 밖으로 나가도 계속 추적하게 해준다.
    // 일부 환경에서 예외가 날 수 있으므로 방어적으로 감싼다.
    try {
      canvasRef.current.setPointerCapture(event.pointerId);
    } catch {
      // 캡처 실패는 무시하고 그리기는 계속 진행한다.
    }
    isDrawingRef.current = true;
    lastPointRef.current = getPos(event);
    applyBrush();
  };

  const handlePointerMove = (event) => {
    if (disabled || !isDrawingPointer(event) || !isDrawingRef.current) return;
    event.preventDefault();
    const ctx = getContext();
    if (!ctx) return;
    applyBrush();
    const pos = getPos(event);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasContentRef.current = true;
    lastPointRef.current = pos;
  };

  const stopDrawing = (event) => {
    if (!isDrawingPointer(event)) return;
    const wasDrawing = isDrawingRef.current;
    isDrawingRef.current = false;
    if (wasDrawing) onDrawEnd?.(hasContentRef.current);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border-4 border-dashed border-rose-200 bg-white"
      // 손가락 터치로는 화면 스크롤/확대(핀치 줌)가 되도록 터치 제스처를 브라우저에 넘긴다.
      // 펜/마우스로 그릴 때는 핸들러에서 preventDefault 하므로 그리는 중 스크롤되지 않는다.
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
    >
      {/* 문제 이미지를 캔버스 바탕에 반투명하게 깔아, 그 위에 바로 풀이를 쓸 수 있게 한다. */}
      {bgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgImage}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          style={{ opacity: bgOpacity }}
        />
      )}
      <span className="pointer-events-none absolute left-2 top-2 select-none text-lg opacity-40">🐾</span>
      <span className="pointer-events-none absolute bottom-2 right-2 select-none text-lg opacity-40">🐾</span>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${disabled ? 'pointer-events-none' : ''}`}
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
      />
    </div>
  );
});

export default Canvas;
