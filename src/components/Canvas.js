'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const PEN_WIDTH = 2.5;
const ERASER_WIDTH = 24;

// 지우개 크기 선택값. 화면에서 [얇게/보통/굵게]로 고른다.
export const ERASER_SIZES = { small: 12, medium: 24, large: 48 };

// 지우개 방식
//   pixel  : 문지른 자리만 지운다 (기존 방식)
//   stroke : 닿은 획 하나를 통째로 지운다
//   area   : 드래그로 감싼 영역 안의 획을 모두 지운다
export const ERASER_MODES = ['pixel', 'stroke', 'area'];

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
    eraserSize = ERASER_SIZES.medium,
    eraserMode = 'pixel',
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
  const eraserSizeRef = useRef(eraserSize);
  const eraserModeRef = useRef(eraserMode);
  // 지금까지 그린 획들. [획 지우개]/[영역 지우개]가 되려면 픽셀만으론 부족하고
  // '어디부터 어디까지가 한 획인지'를 알고 있어야 한다.
  // { tool, color, width, points: [{x,y}] } 형태로 그린 순서대로 쌓는다.
  const strokesRef = useRef([]);
  // 복원된 그림(예전에 저장한 PNG). 획을 지우고 다시 그릴 때 바탕으로 깐다.
  const baseImageRef = useRef(null);
  // 영역 지우개로 드래그 중인 사각형
  const areaRectRef = useRef(null);
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
    eraserSizeRef.current = eraserSize;
  }, [eraserSize]);
  useEffect(() => {
    eraserModeRef.current = eraserMode;
  }, [eraserMode]);
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
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = eraserSizeRef.current || ERASER_WIDTH;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = colorRef.current;
      ctx.fillStyle = colorRef.current;
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
      // 캔버스가 커질 때는 원래 크기 그대로 왼쪽 위에 붙여 넣는다.
      // 늘어난 크기에 맞춰 잡아당기면 아이가 쓴 글씨가 세로로 늘어나 버린다.
      // (캔버스 넓히기 기능을 쓸 때 특히 티가 난다)
      const growing = nextWidth >= snapshot.width && nextHeight >= snapshot.height;
      if (growing) {
        ctx.drawImage(snapshot, 0, 0);
      } else {
        ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, nextWidth, nextHeight);
      }
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
    strokesRef.current = [];
    areaRectRef.current = null;
  }, []);

  const restoreCanvas = useCallback(
    (dataURL) => {
      clearCanvas();
      strokesRef.current = [];
      baseImageRef.current = null;
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
            baseImageRef.current = image;
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

  // 기록해 둔 획으로 화면을 처음부터 다시 그린다.
  // [획 지우개]/[영역 지우개]는 픽셀을 문지르는 게 아니라 획을 목록에서 빼고 다시 그리는 방식이다.
  const redrawFromStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 예전에 저장해 둔 그림이 있으면 먼저 깔아 준다.
    if (baseImageRef.current) {
      ctx.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    setupContext();
    strokesRef.current.forEach((stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      stroke.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      // 점 하나짜리 획도 자국이 남게
      if (stroke.points.length === 1) {
        const p0 = stroke.points[0];
        ctx.lineTo(p0.x + 0.1, p0.y + 0.1);
      }
      ctx.stroke();
    });
    ctx.globalCompositeOperation = 'source-over';
    hasContentRef.current = Boolean(baseImageRef.current) || strokesRef.current.length > 0;
  }, [setupContext]);

  // 점 (x,y)에서 가장 가까운 획을 찾는다. 없으면 -1.
  const findStrokeAt = useCallback((x, y) => {
    const strokes = strokesRef.current;
    // 나중에 그린 획이 위에 있으니 뒤에서부터 찾는다.
    for (let i = strokes.length - 1; i >= 0; i -= 1) {
      const stroke = strokes[i];
      if (stroke.tool === 'eraser') continue;
      const threshold = Math.max(10, stroke.width * 3);
      const pts = stroke.points || [];
      for (let j = 0; j < pts.length; j += 1) {
        const dx = pts[j].x - x;
        const dy = pts[j].y - y;
        if (dx * dx + dy * dy <= threshold * threshold) return i;
      }
    }
    return -1;
  }, []);

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
      // 획 개수. 지울 게 있는지 화면에서 판단할 때 쓴다.
      strokeCount: () => strokesRef.current.length,
      undo: () => {
        // 마지막 획 하나 되돌리기. 지우개 획도 하나로 취급한다.
        if (strokesRef.current.length === 0) return false;
        strokesRef.current = strokesRef.current.slice(0, -1);
        redrawFromStrokes();
        return true;
      },
    }),
    [clearCanvas, resizeCanvas, restoreCanvas, redrawFromStrokes]
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
      // 지금 그리는 획에 좌표를 이어 붙인다. (획 지우개가 이 목록을 본다)
      const current = strokesRef.current[strokesRef.current.length - 1];
      if (current) current.points.push({ x, y });
    };

    const onDown = (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      activeIdRef.current = event.pointerId;
      isDrawingRef.current = true;
      drewSomethingRef.current = false;
      lastPointRef.current = posOf(event);

      const erasing = toolRef.current === 'eraser';
      const mode = eraserModeRef.current;

      // [획 지우개] 닿은 획 하나를 통째로 지운다.
      if (erasing && mode === 'stroke') {
        const at = findStrokeAt(lastPointRef.current.x, lastPointRef.current.y);
        if (at >= 0) {
          strokesRef.current = strokesRef.current.filter((_, i) => i !== at);
          redrawFromStrokes();
          drewSomethingRef.current = true;
        }
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // 캡처 실패는 무시
        }
        return;
      }

      // [영역 지우개] 드래그로 사각형을 그리기 시작한다.
      if (erasing && mode === 'area') {
        areaRectRef.current = {
          x0: lastPointRef.current.x,
          y0: lastPointRef.current.y,
          x1: lastPointRef.current.x,
          y1: lastPointRef.current.y,
        };
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // 캡처 실패는 무시
        }
        return;
      }

      // 여기부터는 펜 또는 [문지르는 지우개]. 새 획을 시작한다.
      strokesRef.current = [
        ...strokesRef.current,
        {
          tool: erasing ? 'eraser' : 'pen',
          color: colorRef.current,
          width: erasing ? eraserSizeRef.current || ERASER_WIDTH : PEN_WIDTH,
          points: [{ ...lastPointRef.current }],
        },
      ];
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

      const erasing = toolRef.current === 'eraser';
      const mode = eraserModeRef.current;

      // [획 지우개] 문지르는 동안 지나간 획들도 계속 지운다.
      if (erasing && mode === 'stroke') {
        const { x, y } = posOf(event);
        const at = findStrokeAt(x, y);
        if (at >= 0) {
          strokesRef.current = strokesRef.current.filter((_, i) => i !== at);
          redrawFromStrokes();
          drewSomethingRef.current = true;
        }
        return;
      }

      // [영역 지우개] 사각형을 늘리며 점선으로 미리 보여 준다.
      if (erasing && mode === 'area' && areaRectRef.current) {
        const { x, y } = posOf(event);
        areaRectRef.current = { ...areaRectRef.current, x1: x, y1: y };
        redrawFromStrokes();
        const ctx = getContext();
        if (ctx) {
          const r = areaRectRef.current;
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#fb7185';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(
            Math.min(r.x0, r.x1),
            Math.min(r.y0, r.y1),
            Math.abs(r.x1 - r.x0),
            Math.abs(r.y1 - r.y0)
          );
          ctx.restore();
        }
        return;
      }

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

      // [영역 지우개] 감싼 사각형 안에 점이 하나라도 있는 획을 모두 지운다.
      if (areaRectRef.current) {
        const r = areaRectRef.current;
        areaRectRef.current = null;
        const left = Math.min(r.x0, r.x1);
        const right = Math.max(r.x0, r.x1);
        const top = Math.min(r.y0, r.y1);
        const bottom = Math.max(r.y0, r.y1);
        // 손이 살짝 떨린 정도(탭)는 무시한다.
        if (right - left > 6 || bottom - top > 6) {
          strokesRef.current = strokesRef.current.filter((stroke) => {
            if (stroke.tool === 'eraser') return true;
            return !(stroke.points || []).some(
              (pt) => pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom
            );
          });
          drewSomethingRef.current = true;
        }
        redrawFromStrokes();
      }
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
  }, [applyBrush, findStrokeAt, redrawFromStrokes]);

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
