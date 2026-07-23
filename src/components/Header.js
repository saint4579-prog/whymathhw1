'use client';

const TABS = [
  { key: 'dashboard', label: '📊 전체 현황판' },
  { key: 'wrongNotes', label: '❌ 오답노트' },
  { key: 'review', label: '🔄 망각곡선 복습' },
  { key: 'solver', label: '✍️ 문제 풀기' },
];

export default function Header({ activeTab, setActiveTab }) {
  return (
    <header className="sticky top-0 z-10 border-b-4 border-rose-100 bg-amber-50/90 shadow-lg shadow-amber-100/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-lg font-extrabold text-rose-500 sm:text-xl">
          🐶 멍멍! 나의 강아지 수학 복습 다이어리 🐾
        </h1>
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
    </header>
  );
}
