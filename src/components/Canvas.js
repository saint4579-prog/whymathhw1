'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const PEN_WIDTH = 2.5;
const ERASER_WIDTH = 24;

const Canvas = forwardRef(function Canvas(
  { disabled = false, onDrawEnd, color = '#1e293b', tool = 'pen' },
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
    if (disabled || event.pointerType === 'touch') return;
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getPos(event);
    applyBrush();
  };

  const handlePointerMove = (event) => {
    if (disabled || event.pointerType === 'touch' || !isDrawingRef.current) return;
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
    if (event.pointerType === 'touch') return;
    const wasDrawing = isDrawingRef.current;
    isDrawingRef.current = false;
    if (wasDrawing) onDrawEnd?.(hasContentRef.current);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border-4 border-dashed border-rose-200 bg-white"
      style={{ touchAction: 'none' }}
    >
      <span className="pointer-events-none absolute left-2 top-2 select-none text-lg opacity-40">🐾</span>
      <span className="pointer-events-none absolute bottom-2 right-2 select-none text-lg opacity-40">🐾</span>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${disabled ? 'pointer-events-none' : ''}`}
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
