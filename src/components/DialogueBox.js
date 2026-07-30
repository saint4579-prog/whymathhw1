'use client';

import { useEffect, useState } from 'react';
import { CHARACTERS } from '@/lib/characters';
import { TIER_INFO, affinityTier, applyChoice, packNameFor } from '@/lib/villageDialogue';

// 리액션 대사를 보여 주는 시간
const REACTION_MS = 2600;

/**
 * 지윤이와 동물 친구의 3지 선다 대화창.
 *
 * 흐름: 동물의 질문 → 지윤이가 3개 중 하나 고르기 → 리액션 대사 → 닫힘
 *
 * 호감도 변화 값(+3 / 0 / -3)은 버튼에 숨겨 둔다. 숫자가 보이면 아이가
 * 대사를 읽지 않고 +3만 누르게 되어, 고민하는 재미가 사라진다.
 */
export default function DialogueBox({ animalName, event, affinity = 0, onDone, onClose }) {
  const [result, setResult] = useState(null);
  const sprite = Object.values(CHARACTERS).find((c) => c.label === animalName) ?? null;
  const tier = TIER_INFO[affinityTier(affinity)];

  // 답을 고르면 리액션을 보여 준 뒤 저절로 닫힌다.
  useEffect(() => {
    if (!result) return undefined;
    const timer = setTimeout(() => onClose?.(), REACTION_MS);
    return () => clearTimeout(timer);
  }, [result, onClose]);

  const choose = (choice) => {
    if (result) return;
    const applied = applyChoice(affinity, choice);
    setResult(applied);
    onDone?.(applied);
  };

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3">
      <div className="w-full max-w-2xl rounded-[2rem] border-4 border-violet-200 bg-white/92 p-4 shadow-2xl backdrop-blur">
        {/* 말하는 친구 */}
        <div className="mb-3 flex items-center gap-3">
          {sprite && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={sprite.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-12 w-auto select-none object-contain drop-shadow-sm"
              style={{ filter: 'url(#village-solid)' }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-extrabold text-stone-700">{animalName}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-extrabold text-stone-700"
                style={{ backgroundColor: tier.color }}
              >
                {tier.icon} {tier.label}
              </span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-400">
                {packNameFor(animalName)}
              </span>
            </p>
          </div>
          {!result && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-400 hover:bg-rose-100 hover:text-rose-500"
            >
              나중에
            </button>
          )}
        </div>

        {/* 동물의 말 */}
        <p className="mb-3 rounded-2xl bg-violet-50 px-4 py-3 text-[15px] font-bold leading-relaxed text-stone-700">
          {result ? result.reaction : event?.text}
        </p>

        {result ? (
          <div className="text-center">
            <p
              className={`inline-block rounded-full px-4 py-2 text-sm font-extrabold ${
                result.delta > 0
                  ? 'bg-rose-100 text-rose-500'
                  : result.delta < 0
                    ? 'bg-sky-100 text-sky-600'
                    : 'bg-stone-100 text-stone-500'
              }`}
            >
              {result.delta > 0 && `❤️ ${animalName}가 기뻐해요! (호감도 +${result.delta})`}
              {result.delta === 0 && `🐾 ${animalName}는 그냥 그런 표정이에요`}
              {result.delta < 0 && `💧 ${animalName}가 서운해해요 (호감도 ${result.delta})`}
            </p>
            {result.tierChanged && (
              <p className="mt-2 text-xs font-extrabold text-violet-500">
                ✨ {animalName}와의 사이가 &lsquo;{TIER_INFO[affinityTier(result.after)].label}&rsquo;(으)로 바뀌었어요!
              </p>
            )}
          </div>
        ) : (
          // 3지 선다. 세로로 세워서 아이가 천천히 읽고 고를 수 있게.
          <div className="space-y-2">
            {(event?.choices ?? []).map((choice, index) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => choose(choice)}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-violet-100 bg-white px-4 py-3 text-left transition hover:border-rose-300 hover:bg-rose-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-600">
                  {index + 1}
                </span>
                <span className="text-sm font-bold leading-snug text-stone-700">{choice.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 선택 직후 캐릭터 머리 위에 터지는 효과.
 * +면 하트, -면 먹구름과 번개.
 */
export function AffinityBurst({ delta }) {
  if (!delta) return null;
  const positive = delta > 0;
  const items = positive ? ['❤️', '💕', '❤️'] : ['🌧️', '⚡', '💧'];
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-[55] -translate-x-1/2">
      {items.map((icon, index) => (
        <span
          key={`${icon}-${index}`}
          className="absolute text-lg"
          style={{
            left: `${(index - 1) * 16}px`,
            animation: `affinity-burst 1200ms ease-out ${index * 120}ms forwards`,
          }}
        >
          {icon}
        </span>
      ))}
    </span>
  );
}
