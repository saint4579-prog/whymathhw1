'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const PEN_WIDTH = 2.5;
const ERASER_WIDTH = 24;

// 그리기를 허용할 포인터 종류. 아이패드에서는 애플펜슬이 'pen'으로 들어온다.
// 손가락은 'touch'라서 여기서 걸러지고(그리기 무시) → 화면 스크롤/확대에 쓰인다.
// 데스크톱 마우스('mouse')는 개발/검수용으로 함께 허용한다. (아이패드에는 mouse 포인터가 없어 사실상 펜 전용)
const isDrawingPointer = (event) => event.pointerType === 'pen' || event.pointerType === 'mouse';

const Canvas = forwardRef(function Canvas(
  {
    disabled = false,
    onDrawEnd,
    color = '#1e293b',
    tool = 'pen',
    bgImage = null,
    bgOpacity = 0.55,
    bgPosition = 'center', // 'center' | 'top' — 배경 문제 이미지 정렬
    // 펜이 끝내 말을 안 들을 때를 위한 비상구. 켜면 손가락으로도 쓸 수 있다.
    allowTouch = false,
  },
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
  // 지금 그리는 중인 포인터 id. null이면 안 그리는 중.
  const activeIdRef = useRef(null);
  const drewSomethingRef = useRef(false);
  // 네이티브 리스너(클로저)가 최신 props를 읽기 위한 거울들
  const disabledRef = useRef(disabled);
  const allowTouchRef = useRef(allowTouch);
  const onDrawEndRef = useRef(onDrawEnd);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);
  useEffect(() => {
    allowTouchRef.current = allowTouch;
  }, [allowTouch]);
  useEffect(() => {
    onDrawEndRef.current = onDrawEnd;
  }, [onDrawEnd]);

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

  // ---- 그리기 -------------------------------------------------------------
  //
  // 애플펜슬로 "글자가 안 써지고 점·짧은 선만 찍히던" 문제의 원인과 수정 내역.
  //
  // 원인: 캔버스에 touch-action: pan-x pan-y pinch-zoom 이 걸려 있었다.
  //   touch-action은 브라우저 합성기가 자바스크립트보다 먼저 판단한다. 그래서 펜이
  //   움직이기 시작하면 브라우저가 '이건 스크롤/확대 제스처일 수 있다'고 보고
  //   pointercancel을 쏜다. 핸들러에서 preventDefault를 불러도 이미 늦다.
  //   예전 코드는 pointercancel에서 바로 붓을 뗐기 때문에 한 획이 점 하나로 끝났다.
  //
  // 수정
  //   1) 캔버스 자체는 touch-action: none. 펜 입력이 절대 취소되지 않는다.
  //      (화면 스크롤은 캔버스 바깥 영역에서 하면 된다)
  //   2) pointercancel이 와도 그리기를 끝내지 않는다. 캡처만 정리하고 상태는 유지해서,
  //      같은 포인터가 다시 움직이면 획을 이어 그린다.
  //   3) pointerleave로 획을 끝내지 않는다. 종료는 pointerup / lostpointercapture만.
  //      (setPointerCapture를 걸어도 사파리는 leave를 함께 쏴서 획이 끊겼다)
  //   4) 이벤트를 React 합성 이벤트가 아니라 네이티브 리스너 + { passive: false }로 붙여
  //      preventDefault가 제때 먹게 한다. React 17+는 루트에 위임하므로 한 박자 늦는다.
  //   5) getCoalescedEvents()로 화면 갱신 사이에 뭉쳐 온 좌표까지 모두 이어 그린다.
  //      펜은 주사율보다 빠르게 좌표를 뿌리는데, 버리면 선이 각지고 끊겨 보인다.
  //   6) 톡 찍기만 해도 자국이 남게 pointerdown에서 점을 하나 찍는다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const posOf = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const accepts = (event) => {
      if (disabledRef.current) return false;
      if (event.pointerType === 'touch') return allowTouchRef.current;
      if (!isDrawingPointer(event)) return false;
      // 펜 뒤쪽 지우개 버튼이나 마우스 우클릭은 그리지 않는다.
      if (event.button > 0) return false;
      return true;
    };

    const strokeTo = (x, y) => {
      const ctx = getContext();
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastPointRef.current = { x, y };
      hasContentRef.current = true;
      drewSomethingRef.current = true;
    };

    const onDown = (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      activeIdRef.current = event.pointerId;
      isDrawingRef.current = true;
      drewSomethingRef.current = false;
      lastPointRef.current = posOf(event);
      applyBrush();

      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // 캡처 실패는 무시하고 그리기는 계속 진행한다.
      }

      // 점 하나만 톡 찍어도 자국이 남게 한다.
      const ctx = getContext();
      if (ctx) {
        const { x, y } = lastPointRef.current;
        const radius = (toolRef.current === 'eraser' ? ERASER_WIDTH : PEN_WIDTH) / 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        hasContentRef.current = true;
      }
    };

    const onMove = (event) => {
      if (activeIdRef.current === null || event.pointerId !== activeIdRef.current) return;
      if (!accepts(event)) return;
      event.preventDefault();
      applyBrush();

      const batch =
        typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
      if (batch.length > 0) {
        batch.forEach((sub) => {
          const { x, y } = posOf(sub);
          strokeTo(x, y);
        });
      } else {
        const { x, y } = posOf(event);
        strokeTo(x, y);
      }
    };

    const finish = (event) => {
      if (activeIdRef.current === null) return;
      if (event && event.pointerId !== undefined && event.pointerId !== activeIdRef.current) return;
      activeIdRef.current = null;
      const wasDrawing = isDrawingRef.current;
      isDrawingRef.current = false;
      if (wasDrawing) onDrawEndRef.current?.(hasContentRef.current);
      drewSomethingRef.current = false;
    };

    // pointercancel은 '획의 끝'으로 보지 않는다. 캡처만 정리한다.
    const onCancel = (event) => {
      if (event.pointerId !== activeIdRef.current) return;
      try {
        if (canvas.hasPointerCapture?.(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch {
        // 이미 풀려 있으면 무시
      }
    };

    // 그리는 중에는 사파리의 확대/스크롤 제스처가 끼어들지 못하게 막는다.
    const blockGesture = (event) => {
      if (activeIdRef.current !== null) event.preventDefault();
    };

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', onDown, opts);
    canvas.addEventListener('pointermove', onMove, opts);
    canvas.addEventListener('pointerup', finish, opts);
    canvas.addEventListener('lostpointercapture', finish, opts);
    canvas.addEventListener('pointercancel', onCancel, opts);
    canvas.addEventListener('gesturestart', blockGesture, opts);
    canvas.addEventListener('touchmove', blockGesture, opts);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', finish);
      canvas.removeEventListener('lostpointercapture', finish);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('gesturestart', blockGesture);
      canvas.removeEventListener('touchmove', blockGesture);
    };
  }, [applyBrush]);

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
          className={`pointer-events-none absolute inset-0 h-full w-full select-none object-contain ${
            bgPosition === 'top' ? 'object-top' : 'object-center'
          }`}
          style={{ opacity: bgOpacity }}
        />
      )}
      <span className="pointer-events-none absolute left-2 top-2 select-none text-lg opacity-40">🐾</span>
      <span className="pointer-events-none absolute bottom-2 right-2 select-none text-lg opacity-40">🐾</span>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${disabled ? 'pointer-events-none' : ''}`}
        // touchAction: 'none' 이 애플펜슬 수정의 핵심이다.
        // 여기에 pan/pinch를 허용해 두면 브라우저가 펜 움직임을 스크롤 제스처로 오판해
        // pointercancel을 쏘고, 획이 점 하나로 끊긴다.
        // 화면 스크롤은 캔버스 바깥(감싼 div 여백, 툴바 영역)에서 하면 된다.
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          // 사파리가 펜 입력을 텍스트 선택/스크리블로 해석하는 걸 줄인다.
          WebkitTouchCallout: 'none',
        }}
      />
    </div>
  );
});

export default Canvas;
