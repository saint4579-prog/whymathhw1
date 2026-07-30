'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS } from '@/lib/characters';
import {
  backgroundFor,
  houseFor,
  houseName,
  upgradeCost,
  remainingCostToMax,
  clampLevel,
  MAX_HOUSE_LEVEL,
  THEME_SWITCH_LEVEL,
} from '@/lib/villageAssets';
import {
  HOUSE_AREA,
  HOUSE_Z_INDEX,
  spawnCharacter,
  stepCharacter,
  zIndexFor,
  findNearbyPair,
  pickCast,
} from '@/lib/villageMotion';
import { mbtiOf, MBTI_TYPES, pickLine, pickGreeting } from '@/lib/villagePersona';

// 말풍선이 떠 있는 시간
const BUBBLE_MS = 4000;

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
 * 아이가 모은 포인트로 집을 10단계까지 키우고, 해금한 캐릭터들이 마당을 돌아다니는 화면.
 *
 * 좌표는 전부 비율(0~1)이라 화면 크기가 달라져도 그대로 동작한다.
 * 캐릭터가 집보다 아래(y가 큼)에 있으면 집 앞에, 위에 있으면 집 뒤에 그려진다.
 */
export default function Village({
  unlockedNames = [],
  currentPoints = 0,
  houseLevel = 1,
  onUpgrade,
  onClose,
}) {
  const level = clampLevel(houseLevel);
  const cost = upgradeCost(level);
  const isMax = level >= MAX_HOUSE_LEVEL;
  const canUpgrade = !isMax && cost != null && currentPoints >= cost;

  const [actors, setActors] = useState([]);
  const [upgrading, setUpgrading] = useState(false);
  const [notice, setNotice] = useState(null);
  const actorsRef = useRef([]);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);

  // 앱에 실제로 그림이 있는 캐릭터만 추린다.
  const available = useMemo(
    () => unlockedNames.filter((name) => Object.values(CHARACTERS).some((c) => c.label === name)),
    [unlockedNames]
  );

  // 마을에 들어올 때 한 번만 순서를 섞는다.
  // 이 순서를 계속 들고 있다가 집 단계만큼 앞에서 잘라 쓰기 때문에,
  // 집을 키우면 나와 있던 친구는 그대로 있고 새 친구가 한 마리 더 나온다.
  const [roster, setRoster] = useState(() => pickCast(available, available.length).roster);

  // 해금한 친구가 늘면(마을을 열어 둔 채 문제를 풀 일은 드물지만) 순서를 다시 만든다.
  useEffect(() => {
    setRoster((prev) => {
      const sameSet =
        prev.length === available.length && available.every((name) => prev.includes(name));
      return sameSet ? prev : pickCast(available, available.length).roster;
    });
  }, [available]);

  // 오늘 마당에 나와 있는 친구 = 집 단계만큼
  const cast = useMemo(() => roster.slice(0, Math.min(level, roster.length)), [roster, level]);
  const restingCount = Math.max(0, available.length - cast.length);

  const spriteOf = useCallback(
    (name) => Object.values(CHARACTERS).find((c) => c.label === name) ?? null,
    []
  );

  // 캐릭터 목록이 바뀌면 새로 배치한다.
  useEffect(() => {
    const next = cast.map((name, index) => spawnCharacter(name, index, cast.length));
    actorsRef.current = next;
    setActors(next);
  }, [cast]);

  // 움직임 루프. 화면 갱신에 맞춰 조금씩 이동시킨다.
  useEffect(() => {
    if (actorsRef.current.length === 0) return undefined;

    const tick = (time) => {
      const previous = lastTimeRef.current || time;
      // 탭을 오래 비웠다 돌아오면 dt가 커져 캐릭터가 순간이동한다. 0.1초로 자른다.
      const dt = Math.min(0.1, (time - previous) / 1000);
      lastTimeRef.current = time;
      const now = Date.now();

      let next = actorsRef.current.map((actor) => stepCharacter(actor, dt, now));

      // 가끔 가까워진 둘이 인사를 나눈다. 매 프레임 확인하면 너무 자주 떠들어서 확률을 낮춘다.
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
  }, [cast]);

  const handleTalk = (index) => {
    const now = Date.now();
    const next = actorsRef.current.map((actor, i) =>
      i === index ? { ...actor, line: pickLine(actor.name), lineUntil: now + BUBBLE_MS } : actor
    );
    actorsRef.current = next;
    setActors(next);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-900/70 backdrop-blur-sm">
      {/* 상단 UI */}
      <div className="flex flex-wrap items-center gap-2 border-b-4 border-white/40 bg-amber-50/95 px-4 py-3">
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
            👑 마을 최고 단계 달성!
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
        <div className="bg-amber-50/95 px-4 pb-2 text-xs font-bold text-stone-500">
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
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundFor(level)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />

        {/* 집: 맵 중앙 고정 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={houseFor(level)}
          alt={`${level}단계 ${houseName(level)}`}
          draggable={false}
          className="pointer-events-none absolute select-none object-contain"
          style={{
            left: `${HOUSE_AREA.x * 100}%`,
            top: `${HOUSE_AREA.y * 100}%`,
            width: `${HOUSE_AREA.halfWidth * 2 * 100}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: HOUSE_Z_INDEX,
          }}
        />

        {/* 캐릭터 */}
        {actors.map((actor, index) => {
          const sprite = spriteOf(actor.name);
          if (!sprite) return null;
          const type = mbtiOf(actor.name);
          return (
            <button
              key={actor.name}
              type="button"
              onClick={() => handleTalk(index)}
              aria-label={`${actor.name}와 이야기하기`}
              className="absolute cursor-pointer border-0 bg-transparent p-0"
              style={{
                left: `${actor.x * 100}%`,
                top: `${actor.y * 100}%`,
                transform: 'translate(-50%, -100%)',
                // 아래에 있을수록 앞으로. 이 값이 집보다 크면 집 앞에 그려진다.
                zIndex: zIndexFor(actor.y),
              }}
            >
              <span className="relative block">
                {actor.line && <SpeechBubble text={actor.line} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sprite.src}
                  alt={actor.name}
                  draggable={false}
                  className="pointer-events-none block h-14 w-auto select-none object-contain drop-shadow-md sm:h-16"
                  style={{ transform: `scaleX(${actor.facing})` }}
                />
                <span
                  className="mt-0.5 block rounded-full px-1.5 text-[9px] font-extrabold text-stone-700"
                  style={{ backgroundColor: `${MBTI_TYPES[type]?.color ?? '#FDE68A'}cc` }}
                >
                  {actor.name}
                </span>
              </span>
            </button>
          );
        })}

        {cast.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-3xl bg-white/90 px-6 py-4 text-center text-sm font-bold text-stone-500 shadow-lg">
              {available.length === 0
                ? '아직 마을에 놀러 온 친구가 없어요. 문제를 풀어 캐릭터를 모으면 여기서 만날 수 있어요! 🐾'
                : '오늘은 친구들이 모두 집에서 쉬고 있어요. 집을 키우면 더 많이 나와요! 🐾'}
            </p>
          </div>
        )}
      </div>

      <p className="bg-amber-50/95 px-4 py-2 text-center text-xs font-bold text-stone-400">
        🐾 친구를 톡 누르면 말을 걸어요 · 가까워진 친구끼리는 저희끼리도 이야기해요
        {cast.length > 0 && ` · 오늘 나온 친구 ${cast.length}마리`}
        {restingCount > 0 && ` · ${restingCount}마리는 집에서 쉬는 중 (집을 키우면 더 나와요!)`}
      </p>
    </div>
  );
}
