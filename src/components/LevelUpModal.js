'use client';

import { useEffect } from 'react';
import { CHARACTERS } from '@/lib/characters';
import CharacterMascot from './CharacterMascot';

// 목적격 조사(을/를)를 단어의 받침 유무로 골라준다. 예) 개구리 → "를", 라쿤 → "을".
function objectParticle(word) {
  const text = String(word || '').trim();
  const last = text[text.length - 1];
  if (!last) return '을(를)';
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    // (음절코드 - 가) % 28 !== 0 이면 받침이 있다.
    return (code - 0xac00) % 28 !== 0 ? '을' : '를';
  }
  return '을(를)';
}

// 레벨업으로 새 친구를 얻었을 때 뜨는 축하 모달.
// names: 이번에 새로 해금된 캐릭터 이름 배열 (보통 1마리, 한 번에 여러 레벨을 넘으면 여러 마리).
export default function LevelUpModal({ level, names = [], onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (names.length === 0) return null;

  const labels = names.map((name) => CHARACTERS[name]?.label).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="레벨 업"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-[2rem] border-4 border-white bg-gradient-to-b from-violet-50 via-rose-50 to-amber-50 p-6 text-center shadow-2xl">
        <p className="text-sm font-black tracking-widest text-violet-400">✨ LEVEL UP ✨</p>
        <h2 className="mt-1 text-2xl font-black text-rose-500">레벨 {level} 달성!</h2>

        <div className="mt-4 flex flex-wrap items-end justify-center gap-2">
          {names.map((name, index) => (
            <CharacterMascot key={name} name={name} height={92} delay={index * 160} />
          ))}
        </div>

        <p className="mt-4 text-lg font-extrabold text-stone-700">
          새 친구 <span className="text-rose-500">{labels.join(', ')}</span>
          {objectParticle(labels[labels.length - 1])} 만났어요! 🎉
        </p>
        <p className="mt-1 text-xs font-semibold text-stone-500">
          🏅 내 캐릭터 탭에서 모은 친구들을 볼 수 있어요.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-rose-400 py-3 font-extrabold text-white shadow-lg shadow-rose-200 hover:bg-rose-500"
        >
          야호! 🐾
        </button>
      </div>
    </div>
  );
}
