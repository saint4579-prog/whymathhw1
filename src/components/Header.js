'use client';

import { useEffect, useRef } from 'react';

const TABS = [
  { key: 'dashboard', label: '📊 전체 현황판' },
  { key: 'wrongNotes', label: '❌ 오답노트' },
  { key: 'review', label: '🔄 망각곡선 복습' },
  { key: 'solver', label: '✍️ 문제 풀기' },
  { key: 'planner', label: '📅 월간 플래너' },
  { key: 'store', label: '🎁 보상 상점' },
];

export default function Header({ activeTab, setActiveTab, currentPoints = 0 }) {
  const headerRef = useRef(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;

    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty('--app-header-height', `${header.offsetHeight}px`);
    };

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 border-b-4 border-rose-100 bg-amber-50/95 shadow-lg shadow-amber-100/60 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-lg font-extrabold text-rose-500 sm:text-xl">
          🐶 멍멍! 나의 강아지 수학 복습 다이어리 🐾
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border-2 border-white bg-yellow-300 px-4 py-2 text-sm font-black text-amber-900 shadow-md shadow-amber-200">
            💰 {Number(currentPoints).toLocaleString()} P
          </span>
          <nav className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab.key
                    ? 'bg-rose-400 text-white shadow-md shadow-rose-200'
                    : 'bg-white text-amber-700 hover:bg-amber-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
