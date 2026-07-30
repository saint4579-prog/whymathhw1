'use client';

import { CHARACTERS } from '@/lib/characters';
import { getCollectionState } from '@/lib/levels';
import CharacterMascot from './CharacterMascot';

function formatPoints(value) {
  return Number(value || 0).toLocaleString();
}

// 컬렉션 격자의 한 칸. 해금되면 컬러 + 이름, 잠겨 있으면 검은 실루엣 + 필요 포인트.
function CollectionCell({ entry }) {
  const character = CHARACTERS[entry.name];
  if (!character) return null;

  if (entry.unlocked) {
    return (
      <div
        className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-white p-3 shadow-md ${character.ring} ${character.glow}`}
      >
        <span className="absolute right-1.5 top-1.5 rounded-full bg-rose-400 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
          GET
        </span>
        <CharacterMascot name={entry.name} height={56} animate="bob" />
        <p className="text-xs font-extrabold text-stone-600">{character.label}</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-1 rounded-2xl border-2 border-stone-200 bg-stone-100 p-3">
      {/* 잠긴 캐릭터: 투명 PNG에 brightness-0을 씌워 검은 실루엣으로만 보여준다. */}
      <div className="opacity-40">
        <CharacterMascot name={entry.name} height={56} animate="none" className="[&_img]:brightness-0" />
      </div>
      <span className="absolute inset-0 flex items-center justify-center text-2xl">🔒</span>
      <p className="text-xs font-extrabold text-stone-400">{formatPoints(entry.requiredPoints)}P</p>
    </div>
  );
}

// 포인트를 쌓아 레벨업하며 캐릭터를 모으는 화면.
// totalEarned = 그동안 모은(누적) 포인트. 현재 잔액이 아니라 누적값이라 캐릭터가 사라지지 않는다.
export default function CharacterCollection({ totalEarned = 0 }) {
  const state = getCollectionState(totalEarned);

  return (
    <div className="mx-auto max-w-5xl">
      {/* 레벨 & 진행도 헤더 */}
      <div className="mb-5 overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-r from-violet-100 via-rose-100 to-amber-100 p-6 shadow-xl shadow-rose-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 flex-col items-center justify-center rounded-3xl border-4 border-white bg-white/80 shadow-lg">
            <span className="text-[11px] font-extrabold text-rose-400">LEVEL</span>
            <span className="text-3xl font-black text-rose-500">{state.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-violet-500">🏅 나의 동물 친구 컬렉션</p>
            <h2 className="text-2xl font-extrabold text-stone-700">
              {state.unlockedNames.length} / {state.maxLevel}마리와 함께해요
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-stone-500">
              그동안 모은 포인트 💰 {formatPoints(state.totalEarned)}P
              <span className="text-stone-400"> · 선물을 써도 친구들은 사라지지 않아요</span>
            </p>
          </div>
          {!state.isMax && (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-white bg-white/70 px-3 py-2 shadow-sm">
              <div className="opacity-50">
                <CharacterMascot name={state.nextCharacter} height={40} animate="none" className="[&_img]:brightness-0" />
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-stone-400">다음 친구까지</p>
                <p className="text-sm font-black text-rose-500">{formatPoints(state.pointsToNext)}P</p>
              </div>
            </div>
          )}
        </div>

        {/* 다음 레벨까지의 진행 막대 */}
        {!state.isMax ? (
          <div className="mt-4">
            <div className="h-4 w-full overflow-hidden rounded-full border-2 border-white bg-white/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400 transition-all duration-500"
                style={{ width: `${state.progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs font-bold text-stone-500">
              다음 친구를 만나려면 {formatPoints(state.nextThreshold)}P! (앞으로 {formatPoints(state.pointsToNext)}P)
            </p>
          </div>
        ) : (
          <p className="mt-4 text-center text-sm font-extrabold text-rose-500">
            🎉 모든 친구를 다 모았어요! 최고예요!
          </p>
        )}
      </div>

      {/* 전체 캐릭터 격자 */}
      <div className="rounded-[2rem] border-4 border-white bg-white p-4 shadow-xl shadow-amber-100/70 md:p-6">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {state.characters.map((entry) => (
            <CollectionCell key={entry.name} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
