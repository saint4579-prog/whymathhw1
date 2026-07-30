'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS } from '@/lib/characters';
import {
  backgroundFor,
  SKY_BACKGROUND,
  MEADOW_GROUND,
  TREE_LAYER,
  houseFor,
  houseName,
  upgradeCost,
  remainingCostToMax,
  clampLevel,
  MAX_HOUSE_LEVEL,
  THEME_SWITCH_LEVEL,
} from '@/lib/villageAssets';
import {
  HOUSE_ANCHOR,
  HOUSE_WIDTH,
  HOUSE_Z_INDEX,
  LAND_POLYGON,
  POND,
  TREE_ANCHOR,
  TREE_WIDTH,
  TREE_BASE,
  TREE_IMAGE,
  TREE_Z_INDEX,
  spawnCharacter,
  stepCharacter,
  commandMove,
  zIndexFor,
  findNearbyPair,
  pickCast,
  isAquatic,
  sendHome,
  comeOutside,
  HOUSE_DOOR,
} from '@/lib/villageMotion';
import { mbtiOf, MBTI_TYPES, pickLine, pickGreeting } from '@/lib/villagePersona';
import { activeNpcs, frameStyle, walkFrame, npcBoxStyle, npcAnchorTransform } from '@/lib/villageSprites';
import DialogueBox, { AffinityBurst } from './DialogueBox';
import {
  loadAffinity,
  saveAffinity,
  affinityTier,
  TIER_INFO,
  pickEvent,
  idleLineFor,
  pickQuestTargets,
  DIALOGUE_COOLDOWN_MS,
  loadNextDialogueAt,
  saveNextDialogueAt,
  formatCooldown,
  affinityRatio,
  loadHomeUntil,
  saveHomeUntil,
} from '@/lib/villageDialogue';

const BUBBLE_MS = 4000;
// 0.5배까지 줄일 수 있다. 줄이면 섬이 작아지고 둘레에 하늘·산 배경이 넓게 보인다.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
// 화살표 한 번에 움직이는 양(화면의 몇 %)
const PAN_STEP = 0.12;
// 1배일 때는 움직일 여백이 아예 없다. 그래서 화살표를 누르면 이만큼 자동으로 확대해 준다.
const AUTO_ZOOM = 1.8;

function SpeechBubble({ text }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 w-max max-w-[190px] -translate-x-1/2">
      <div className="rounded-2xl border-2 border-rose-100 bg-white/95 px-3 py-2 text-center text-[11px] font-bold leading-snug text-stone-600 shadow-lg">
        {text}
        <span className="absolute left-1/2 top-full -ml-1.5 h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-white/95" />
      </div>
    </div>
  );
}

/**
 * [멍멍 마을]
 *
 * - 집은 그림 위쪽 단에 놓인다. (바닥선을 기준으로 앉히므로 단계가 바뀌어도 자연스럽다)
 * - 확대/축소와 상하좌우 이동이 된다.
 * - 땅에 사는 친구는 잔디만, 물에 사는 친구는 연못만 돌아다닌다.
 * - 친구를 누르면 말을 걸고, 한 번 더 누르면 '따라가기'가 켜져서 원하는 자리를 찍어 보낼 수 있다.
 */
export default function Village({
  unlockedNames = [],
  currentPoints = 0,
  houseLevel = 1,
  userName,
  onUpgrade,
  onClose,
}) {
  const level = clampLevel(houseLevel);
  const cost = upgradeCost(level);
  const isMax = level >= MAX_HOUSE_LEVEL;
  const canUpgrade = !isMax && cost != null && currentPoints >= cost;
  // 1~5단계 배경만 '나무 없는 바닥 + 전경 나무'로 나뉘어 있다.
  // 6단계부터 쓰는 두 번째 배경은 나무가 그림에 포함돼 있어 전경 레이어를 쓰지 않는다.
  const hasTreeLayer = level < THEME_SWITCH_LEVEL;

  const [actors, setActors] = useState([]);
  const [upgrading, setUpgrading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState(null); // 이동 지시를 기다리는 친구 이름
  const [showAreas, setShowAreas] = useState(false);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }); // x,y = 화면 비율 기준 이동량

  // 동물별 지윤이에 대한 호감도. { 이름: 점수 } — 앱을 다시 켜도 유지된다.
  const [affinity, setAffinity] = useState({});
  // 지금 열려 있는 대화. { name, event }
  const [dialogue, setDialogue] = useState(null);
  // 호감도 변화 효과를 띄울 대상. { name, delta }
  const [burst, setBurst] = useState(null);
  // 이번 방문에 '!'를 달고 있는 친구들 (1~2마리)
  const [questTargets, setQuestTargets] = useState([]);
  // 다음 대화가 열리는 시각. 친구별이 아니라 마을 전체로 하나다. (5분에 한 번)
  const [nextDialogueAt, setNextDialogueAt] = useState(0);
  // 화면에 남은 시간을 보여 주기 위한 지금 시각 (1초마다 갱신)
  const [now, setNow] = useState(() => Date.now());

  const actorsRef = useRef([]);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  const available = useMemo(
    () => unlockedNames.filter((name) => Object.values(CHARACTERS).some((c) => c.label === name)),
    [unlockedNames]
  );

  const [roster, setRoster] = useState(() => pickCast(available, available.length).roster);
  useEffect(() => {
    setRoster((prev) => {
      const same = prev.length === available.length && available.every((n) => prev.includes(n));
      return same ? prev : pickCast(available, available.length).roster;
    });
  }, [available]);

  const cast = useMemo(() => roster.slice(0, Math.min(level, roster.length)), [roster, level]);
  const restingCount = Math.max(0, available.length - cast.length);
  const spriteOf = useCallback((name) => Object.values(CHARACTERS).find((c) => c.label === name) ?? null, []);

  // 저장된 호감도와 쿨타임 불러오기
  useEffect(() => {
    setAffinity(loadAffinity(userName));
    setNextDialogueAt(loadNextDialogueAt(userName));
  }, [userName]);

  // 남은 시간 표시를 위해 1초마다 현재 시각을 갱신한다.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dialogueReady = now >= nextDialogueAt;

  // 스프라이트 시트가 준비된 NPC. 동물 친구들과 함께 마을을 돌아다닌다.
  const npcs = useMemo(() => activeNpcs(), []);

  useEffect(() => {
    const animals = cast.map((name, index) => spawnCharacter(name, index, cast.length));
    // 아직 삐져 있는 중이면 집 안에서 시작한다.
    // (state가 아니라 저장값을 직접 읽는다. 이 effect가 쿨타임마다 다시 돌면
    //  동물들이 전부 제자리로 순간이동해 버린다.)
    const sulkingUntil = loadHomeUntil(userName);
    const stillSulking = Date.now() < sulkingUntil;
    const people = npcs.map((npc, index) => {
      const actor = spawnCharacter(npc.name, index, npcs.length, Math.random, npc);
      return stillSulking ? { ...actor, hidden: true, x: HOUSE_DOOR.x, y: HOUSE_DOOR.y } : actor;
    });
    const next = [...animals, ...people];
    actorsRef.current = next;
    setActors(next);
    setSelected(null);
    // 오늘 말을 걸어올 친구 1~2마리를 고른다. (전부 말을 걸면 공부에 방해가 된다)
    setQuestTargets(pickQuestTargets(cast));
  }, [cast, npcs, userName]);

  useEffect(() => {
    if (actorsRef.current.length === 0) return undefined;
    const tick = (time) => {
      const previous = lastTimeRef.current || time;
      const dt = Math.min(0.1, (time - previous) / 1000);
      lastTimeRef.current = time;
      const now = Date.now();

      let next = actorsRef.current.map((actor) => stepCharacter(actor, dt, now));

      if (Math.random() < 0.004) {
        const pair = findNearbyPair(next, 0.07, now);
        if (pair) {
          const [i, j] = pair;
          const greeting = pickGreeting(next[i].name, next[j].name);
          next = next.map((actor, index) => {
            if (index === i) return { ...actor, line: greeting.a, lineUntil: now + BUBBLE_MS };
            if (index === j) return { ...actor, line: greeting.b, lineUntil: now + BUBBLE_MS + 600 };
            return actor;
          });
        }
      }

      actorsRef.current = next;
      setActors(next);
      frameRef.current = window.requestAnimationFrame(tick);
    };
    frameRef.current = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameRef.current);
      lastTimeRef.current = 0;
    };
  }, [cast, npcs]);

  // 쿨타임이 끝나면 지윤이가 집에서 나오고, 말 걸 친구도 새로 정해진다.
  useEffect(() => {
    if (!dialogueReady) return;
    const someoneInside = actorsRef.current.some((a) => a.npc && a.hidden);
    if (someoneInside) {
      actorsRef.current = actorsRef.current.map((a) => (a.npc && a.hidden ? comeOutside(a) : a));
      setActors(actorsRef.current);
      saveHomeUntil(userName, 0);
      setNotice('지윤이가 다시 나왔어요! 🐾');
    }
    setQuestTargets((prev) => (prev.length > 0 ? prev : pickQuestTargets(cast)));
  }, [dialogueReady, cast, userName]);

  // ── 확대 / 이동 ────────────────────────────────────────────────────
  // 확대한 만큼만 움직일 수 있게 막아, 지도가 화면 밖으로 빠져나가지 않게 한다.
  const clampView = useCallback((next) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next.zoom));
    // 1배보다 작으면 지도가 화면보다 작아서 밀 여백이 없다. 이때는 가운데 고정.
    const limit = Math.max(0, (zoom - 1) / (2 * zoom));
    return {
      zoom,
      x: Math.min(limit, Math.max(-limit, next.x)),
      y: Math.min(limit, Math.max(-limit, next.y)),
    };
  }, []);

  const zoomBy = (delta) => setView((v) => clampView({ ...v, zoom: v.zoom + delta }));
  const resetView = () => setView({ zoom: 1, x: 0, y: 0 });

  // 화살표로 이동. 아직 1배라 움직일 여백이 없으면 먼저 확대부터 해 준다.
  // (그러지 않으면 아이가 화살표를 눌러도 아무 일도 안 일어나는 것처럼 보인다)
  const panBy = (dx, dy) =>
    setView((v) => {
      const zoom = v.zoom <= 1 ? AUTO_ZOOM : v.zoom;
      return clampView({ zoom, x: v.x + dx, y: v.y + dy });
    });

  // 손가락/마우스로 끌어서 이동
  const onStageDown = (event) => {
    if (view.zoom <= 1) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onStageMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (event.clientX - drag.x) / rect.width / view.zoom;
    const dy = (event.clientY - drag.y) / rect.height / view.zoom;
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) drag.moved = true;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    panBy(dx, dy);
  };
  const onStageUp = () => {
    dragRef.current = null;
  };

  /** 화면에서 누른 지점을 맵 비율 좌표로 바꾼다. (확대·이동을 되돌려 계산) */
  const toMapPoint = (event) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const sx = (event.clientX - rect.left) / rect.width;
    const sy = (event.clientY - rect.top) / rect.height;
    return {
      x: (sx - 0.5) / view.zoom - view.x + 0.5,
      y: (sy - 0.5) / view.zoom - view.y + 0.5,
    };
  };

  // 지도를 누르면, 고른 친구가 그 자리로 간다.
  const handleStageClick = (event) => {
    if (dragRef.current?.moved) return;
    if (!selected) return;
    const point = toMapPoint(event);
    if (!point) return;
    const next = actorsRef.current.map((actor) =>
      actor.name === selected ? commandMove(actor, point.x, point.y) : actor
    );
    actorsRef.current = next;
    setActors(next);
  };

  const handleCharacterTap = (event, index) => {
    event.stopPropagation();
    const actor = actorsRef.current[index];
    if (!actor) return;
    const now = Date.now();

    if (selected === actor.name) {
      setSelected(null); // 한 번 더 누르면 따라가기 끄기
      return;
    }

    // '!'가 떠 있고 마을 전체 쿨타임도 지났으면 3지 선다 대화를 시작한다.
    const ready = questTargets.includes(actor.name) && Date.now() >= nextDialogueAt;
    if (ready && !actor.npc) {
      setDialogue({ name: actor.name, event: pickEvent(actor.name) });
      setSelected(null);
      return;
    }

    // 그 외에는 평소 대사. 호감도 단계에 따라 말투가 달라진다.
    const line = actor.npc?.lines?.length
      ? actor.npc.lines[Math.floor(Math.random() * actor.npc.lines.length)]
      : idleLineFor(actor.name, affinity[actor.name] ?? 0);
    const next = actorsRef.current.map((a, i) =>
      i === index ? { ...a, line, lineUntil: Date.now() + BUBBLE_MS } : a
    );
    actorsRef.current = next;
    setActors(next);
    setSelected(actor.name);
  };

  // 대화에서 답을 고르면 호감도를 저장하고 효과를 띄운다.
  const handleDialogueDone = (applied) => {
    if (!dialogue) return;
    const name = dialogue.name;
    setAffinity((prev) => {
      const next = { ...prev, [name]: applied.after };
      saveAffinity(userName, next);
      return next;
    });
    // 다음 대화까지 마을 전체가 5분 쉰다.
    const until = Date.now() + DIALOGUE_COOLDOWN_MS;
    setNextDialogueAt(until);
    saveNextDialogueAt(userName, until);
    setQuestTargets([]);

    if (applied.delta !== 0) {
      setBurst({ name, delta: applied.delta });
      setTimeout(() => setBurst(null), 1400);
    }

    // 호감도를 잃었으면 지윤이가 속상해서 집으로 들어간다.
    // 다음 대화가 열릴 때까지 안 나온다.
    if (applied.delta < 0) {
      actorsRef.current = actorsRef.current.map((a) => (a.npc ? sendHome(a) : a));
      setActors(actorsRef.current);
      saveHomeUntil(userName, until);
      setNotice(`${name}가 서운해했어요. 지윤이가 집으로 들어갔어요 🏠`);
    }
  };

  const handleUpgrade = async () => {
    if (!canUpgrade || upgrading) return;
    setUpgrading(true);
    try {
      await onUpgrade?.(level + 1, cost);
      setNotice(`🎉 집이 ${houseName(level + 1)}(으)로 커졌어요!`);
    } catch (error) {
      setNotice(error?.message || '업그레이드에 실패했어요. 잠시 뒤 다시 해볼까요? 🐾');
    } finally {
      setUpgrading(false);
    }
  };

  const landPath = LAND_POLYGON.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-900/70 backdrop-blur-sm">
      {/*
        캐릭터 PNG에 반투명한 픽셀이 섞여 있어 잔디가 비쳐 보인다.
        알파값에 배수를 곱해 끌어올리면(투명한 부분은 0이라 그대로 투명)
        모양은 그대로인 채 몸통만 또렷해진다.
      */}
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <filter id="village-solid" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncA type="linear" slope="3" />
          </feComponentTransfer>
        </filter>
      </svg>

      {/* 상단 UI */}
      <div className="flex flex-wrap items-center gap-2 border-b-4 border-white/40 bg-amber-50/95 px-4 py-2.5">
        <h2 className="text-lg font-extrabold text-rose-500">🏡 멍멍 마을</h2>
        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-amber-700 shadow-sm">
          {level}단계 · {houseName(level)}
        </span>
        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-extrabold text-emerald-700 shadow-sm">
          🐾 친구 {cast.length} / {available.length}
        </span>
        <span
          className="rounded-full bg-yellow-300 px-4 py-1.5 text-sm font-black text-amber-900 shadow-sm"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          💰 {Number(currentPoints).toLocaleString()} P
        </span>

        {isMax ? (
          <span className="rounded-full bg-violet-300 px-4 py-1.5 text-sm font-extrabold text-violet-900 shadow-sm">
            👑 최고 단계 달성!
          </span>
        ) : (
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={!canUpgrade || upgrading}
            className="rounded-full bg-rose-400 px-5 py-2 text-sm font-extrabold text-white shadow-md transition hover:bg-rose-500 disabled:bg-stone-200 disabled:text-stone-400"
          >
            {upgrading ? '🐾 짓는 중...' : `🔨 집 키우기 (${cost.toLocaleString()}P)`}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-500 shadow-sm hover:bg-rose-50"
        >
          닫기 ✕
        </button>
      </div>

      {!isMax && (
        <div className="bg-amber-50/95 px-4 pb-1.5 text-xs font-bold text-stone-500">
          {canUpgrade
            ? '지금 집을 키울 수 있어요! 🎉'
            : `다음 단계까지 ${(cost - currentPoints).toLocaleString()}P 더 모으면 돼요`}
          <span className="ml-2 text-stone-400">
            · 10단계까지 앞으로 {remainingCostToMax(level).toLocaleString()}P
          </span>
          {level + 1 === THEME_SWITCH_LEVEL && (
            <span className="ml-2 text-rose-500">· 다음 단계에서 마을 풍경이 바뀌어요!</span>
          )}
        </div>
      )}

      {notice && (
        <p className="bg-rose-50 px-4 py-2 text-center text-sm font-extrabold text-rose-500">{notice}</p>
      )}

      {/* 맵 */}
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: 'none', cursor: selected ? 'crosshair' : view.zoom > 1 ? 'grab' : 'default' }}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
        onClick={handleStageClick}
        onDoubleClick={() => setView((v) => clampView({ ...v, zoom: v.zoom >= MAX_ZOOM ? 1 : v.zoom + 0.8 }))}
        onContextMenu={(event) => {
          // 길게 누르기(우클릭)로 축소. 아이패드에서 두 손가락 없이도 줄일 수 있게.
          event.preventDefault();
          zoomBy(-0.4);
        }}
        onWheel={(event) => {
          event.preventDefault();
          zoomBy(event.deltaY < 0 ? 0.25 : -0.25);
        }}
      >
        {/* 맨 아래: 하늘·산 배경. 확대/이동에 따라가지 않고 고정돼 있어야
            섬만 커지면서 뒤 풍경은 그대로인 자연스러운 그림이 된다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SKY_BACKGROUND}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />

        {/* 확대·이동은 이 겹에 한 번만 걸어 준다. 안쪽 좌표 계산이 단순해진다. */}
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${view.zoom}) translate(${view.x * 100}%, ${view.y * 100}%)`,
            transformOrigin: 'center center',
            transition: dragRef.current ? 'none' : 'transform 160ms ease-out',
          }}
        >
          {/*
            레이어 순서 (아래 → 위)
              1) 하늘·산                (무대 바깥, 확대/이동 안 따라감)
              2) 나무 없는 섬 바닥       ← 여기
              3) 집
              4) 캐릭터 (y좌표로 앞뒤 정렬)
              5) 나무 (전경)            ← 캐릭터가 뒤로 가려질 수 있게 맨 위
            나무를 바닥 그림에서 빼내야 캐릭터가 나무 뒤/앞으로 자연스럽게 지나간다.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hasTreeLayer ? MEADOW_GROUND : backgroundFor(level)}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-contain"
          />

          {/* 영역 확인용 겹. 그림과 안 맞을 때 눈으로 보고 숫자를 고치라고 둔 것. */}
          {showAreas && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ zIndex: 5 }}
            >
              <polygon points={landPath} fill="#ef4444" opacity="0.35" />
              <ellipse
                cx={POND.x * 100}
                cy={POND.y * 100}
                rx={POND.rx * 100}
                ry={POND.ry * 100}
                fill="#3b82f6"
                opacity="0.55"
              />
              {/* 나무 줄기 충돌 영역 */}
              {hasTreeLayer && (
                <ellipse
                  cx={TREE_BASE.x * 100}
                  cy={TREE_BASE.y * 100}
                  rx={TREE_BASE.halfWidth * 100}
                  ry={TREE_BASE.halfHeight * 100}
                  fill="#78350f"
                  opacity="0.8"
                />
              )}
            </svg>
          )}

          {/* 집: 위쪽 단에, 바닥선을 기준으로 앉힌다.
              transform의 -100%가 '그림 아래쪽이 바닥선에 닿게' 만들어, 단계가 바뀌어
              그림 높이가 달라져도 공중에 뜨거나 파묻히지 않는다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={houseFor(level)}
            alt={`${level}단계 ${houseName(level)}`}
            draggable={false}
            className="pointer-events-none absolute select-none object-contain"
            style={{
              left: `${HOUSE_ANCHOR.x * 100}%`,
              top: `${HOUSE_ANCHOR.y * 100}%`,
              width: `${HOUSE_WIDTH * 100}%`,
              transform: 'translate(-50%, -100%)',
              zIndex: HOUSE_Z_INDEX,
            }}
          />

          {/* 캐릭터 */}
          {actors.map((actor, index) => {
            const sprite = spriteOf(actor.name);
            // NPC는 낱장 그림이 없고 스프라이트 시트를 쓰므로 sprite가 없어도 그린다.
            if (!sprite && !actor.npc) return null;
            // 집 안에 들어가 있으면 화면에서 사라진다.
            if (actor.hidden) return null;
            const type = mbtiOf(actor.name);
            const isSelected = selected === actor.name;
            const score = affinity[actor.name] ?? 0;
            const tier = affinityTier(score);
            return (
              <button
                key={actor.name}
                type="button"
                onClick={(event) => handleCharacterTap(event, index)}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label={`${actor.name}와 이야기하기`}
                className="absolute cursor-pointer border-0 bg-transparent p-0"
                style={{
                  left: `${actor.x * 100}%`,
                  top: `${actor.y * 100}%`,
                  // NPC는 프레임 아래에 발밑 여백(28px)이 있어서 그만큼 더 내려 앉혀야
                  // 발이 정확히 이 지점에 닿는다. 동물 친구는 그림 아래가 곧 발이라 -100%.
                  transform: actor.npc ? npcAnchorTransform() : 'translate(-50%, -100%)',
                  zIndex: zIndexFor(actor.y),
                }}
              >
                <span className="relative block">
                  {actor.line && <SpeechBubble text={actor.line} />}
                  {/* 오늘 말을 걸어올 친구에게만 느낌표를 띄운다. */}
                  {!actor.npc && questTargets.includes(actor.name) && !dialogue && dialogueReady && (
                    <span className="animate-quest-bob pointer-events-none absolute -top-6 left-1/2 z-[52] -translate-x-1/2 text-xl drop-shadow">
                      💬
                    </span>
                  )}
                  {/* 호감도 단계 아이콘. 보통일 때는 굳이 띄우지 않는다. */}
                  {!actor.npc && tier !== 'neutral' && (
                    <span className="pointer-events-none absolute -top-2 -right-1 z-[52] text-sm drop-shadow">
                      {TIER_INFO[tier].icon}
                    </span>
                  )}
                  {burst?.name === actor.name && <AffinityBurst delta={burst.delta} />}
                  {actor.npc ? (
                    // 걷는 NPC: 스프라이트 시트에서 지금 프레임만 잘라 보여준다.
                    // 멈춰 있으면 0번(서 있는) 프레임으로 고정한다.
                    // 크기는 작은 화면/큰 화면 두 가지를 CSS 변수로 두고 Tailwind가 고르게 한다.
                    <span
                      aria-label={actor.name}
                      className="pointer-events-none block h-[var(--npc-size)] w-[var(--npc-size)] sm:h-[var(--npc-size-sm)] sm:w-[var(--npc-size-sm)]"
                      style={{
                        '--npc-size': npcBoxStyle(actor.npc).height,
                        '--npc-size-sm': npcBoxStyle(actor.npc, true).height,
                        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
                        ...frameStyle(
                          actor.npc.sheet,
                          actor.direction ?? 'downRight',
                          // 걷는 중이면 시간에 따라 0→1→2→3, 멈춰 있으면 0번(서 있는 자세)
                          actor.walkingSince ? walkFrame(Date.now() - actor.walkingSince) : 0
                        ),
                      }}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={sprite.src}
                      alt={actor.name}
                      draggable={false}
                      className={`pointer-events-none block h-12 w-auto select-none object-contain sm:h-14 ${
                        isSelected ? 'animate-mascot-bob' : ''
                      }`}
                      style={{
                        transform: `scaleX(${actor.facing})`,
                        // 반투명 픽셀을 불투명하게 만들고, 그림자는 필터 안에서 함께 처리한다.
                        filter: 'url(#village-solid) drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
                      }}
                    />
                  )}
                  <span
                    className={`mt-0.5 block rounded-full px-1.5 text-[9px] font-extrabold text-stone-700 ${
                      isSelected ? 'ring-2 ring-rose-400' : ''
                    }`}
                    style={{ backgroundColor: actor.npc ? '#FBCFE8' : MBTI_TYPES[type]?.color ?? '#FDE68A' }}
                  >
                    {actor.npc ? '🙋 ' : isAquatic(actor.name) ? '🌊 ' : ''}
                    {actor.name}
                  </span>
                  {/* 이름 아래 호감도 게이지.
                      숫자를 쓰면 아이가 대사보다 숫자를 먼저 보게 되고, 화면도 지저분해진다.
                      2px짜리 얇은 막대로 '얼마나 친한지'만 색과 길이로 보여 준다.
                      지윤이는 호감도를 받는 쪽이 아니라 주는 쪽이라 게이지가 없다. */}
                  {!actor.npc && (
                    <span
                      aria-label={`${actor.name} 호감도 ${TIER_INFO[tier].label}`}
                      className="mx-auto mt-[2px] block h-[2px] w-8 overflow-hidden rounded-full bg-black/15"
                    >
                      <span
                        className="block h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(6, affinityRatio(score) * 100)}%`,
                          backgroundColor:
                            tier === 'friendly' ? '#FB7185' : tier === 'hostile' ? '#94A3B8' : '#FBBF24',
                        }}
                      />
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {/* 전경 나무. 뿌리가 닿는 지점을 기준으로 앉히고, 그 y값으로 z를 정한다.
              → 뿌리보다 아래에 있는 캐릭터는 나무 앞, 위에 있는 캐릭터는 나무 뒤. */}
          {hasTreeLayer && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={TREE_LAYER}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="pointer-events-none absolute select-none object-contain"
              style={{
                left: `${TREE_ANCHOR.x * 100}%`,
                top: `${TREE_ANCHOR.y * 100}%`,
                width: `${TREE_WIDTH * 100}%`,
                // 그림 안의 (줄기 중심, 뿌리 밑동)이 위 좌표에 오도록 끌어올린다.
                transform: `translate(-${TREE_IMAGE.trunkX * 100}%, -${TREE_IMAGE.rootY * 100}%)`,
                zIndex: TREE_Z_INDEX,
              }}
            />
          )}
        </div>

        {/* 확대 / 이동 조작부 (지도 위에 고정) */}
        <div className="absolute bottom-3 right-3 z-40 flex flex-col items-center gap-1 rounded-3xl border-2 border-white bg-white/90 p-2 shadow-xl backdrop-blur">
          <button type="button" onClick={() => panBy(0, PAN_STEP)} aria-label="위로" className="h-8 w-8 rounded-xl bg-amber-50 font-black text-stone-500 hover:bg-amber-100">↑</button>
          <div className="flex gap-1">
            <button type="button" onClick={() => panBy(PAN_STEP, 0)} aria-label="왼쪽으로" className="h-8 w-8 rounded-xl bg-amber-50 font-black text-stone-500 hover:bg-amber-100">←</button>
            <button type="button" onClick={resetView} aria-label="처음 크기로" className="h-8 w-8 rounded-xl bg-rose-100 text-xs font-black text-rose-500 hover:bg-rose-200">◎</button>
            <button type="button" onClick={() => panBy(-PAN_STEP, 0)} aria-label="오른쪽으로" className="h-8 w-8 rounded-xl bg-amber-50 font-black text-stone-500 hover:bg-amber-100">→</button>
          </div>
          <button type="button" onClick={() => panBy(0, -PAN_STEP)} aria-label="아래로" className="h-8 w-8 rounded-xl bg-amber-50 font-black text-stone-500 hover:bg-amber-100">↓</button>
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => zoomBy(-0.4)}
              disabled={view.zoom <= MIN_ZOOM + 0.001}
              aria-label="축소"
              className="h-8 w-8 rounded-xl bg-sky-50 text-lg font-black text-sky-600 hover:bg-sky-100 disabled:opacity-30"
            >
              −
            </button>
            <span className="w-9 text-center text-[11px] font-extrabold text-stone-500">
              {view.zoom.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={() => zoomBy(0.4)}
              disabled={view.zoom >= MAX_ZOOM - 0.001}
              aria-label="확대"
              className="h-8 w-8 rounded-xl bg-sky-50 text-lg font-black text-sky-600 hover:bg-sky-100 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        {selected && (
          <p className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full bg-rose-400 px-4 py-2 text-sm font-extrabold text-white shadow-lg">
            🐾 {selected} 선택됨 · 가고 싶은 곳을 눌러 주세요
          </p>
        )}

        {dialogue && (
          <DialogueBox
            animalName={dialogue.name}
            event={dialogue.event}
            affinity={affinity[dialogue.name] ?? 0}
            onDone={handleDialogueDone}
            onClose={() => setDialogue(null)}
          />
        )}

        {cast.length === 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <p className="rounded-3xl bg-white/90 px-6 py-4 text-center text-sm font-bold text-stone-500 shadow-lg">
              {available.length === 0
                ? '아직 마을에 놀러 온 친구가 없어요. 문제를 풀어 캐릭터를 모으면 여기서 만날 수 있어요! 🐾'
                : '오늘은 친구들이 모두 집에서 쉬고 있어요. 집을 키우면 더 많이 나와요! 🐾'}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-50/95 px-4 py-2 text-xs font-bold text-stone-400">
        <span>🐾 친구를 누르면 말을 걸고, 그다음 원하는 자리를 누르면 그곳으로 가요</span>
        {dialogueReady && questTargets.length > 0 && (
          <span className="font-extrabold text-rose-500">
            · 💬 표시가 뜬 친구가 할 말이 있어요! ({questTargets.join(', ')})
          </span>
        )}
        {!dialogueReady && (
          <span className="font-bold text-stone-400">
            · 다음 대화까지 {formatCooldown(nextDialogueAt - now)}
          </span>
        )}
        {cast.length > 0 && <span>· 오늘 나온 친구 {cast.length}마리</span>}
        {restingCount > 0 && <span>· {restingCount}마리는 집에서 쉬는 중</span>}
        <button
          type="button"
          onClick={() => setShowAreas((v) => !v)}
          className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-stone-400 shadow-sm hover:text-rose-500"
        >
          {showAreas ? '영역 숨기기' : '영역 보기'}
        </button>
      </div>
    </div>
  );
}
