'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 두 줄짜리 메뉴.
 *
 * 위쪽은 큰 메뉴, 아래쪽은 그 안의 탭이다. 탭 9개가 한 줄에 늘어서 있으면
 * 아이패드에서 두세 줄로 접히면서 뭐가 뭔지 알아보기 어려웠다.
 *
 * `tabs`의 key는 예전 탭 이름을 그대로 쓴다. 화면을 그리는 쪽 코드를 건드리지 않기 위해서다.
 * `home`은 큰 메뉴를 눌렀을 때 처음 열리는 탭이다.
 */
export const MENUS = [
  {
    key: 'study',
    label: '📊 전체 현황판',
    home: 'dashboard',
    tabs: [
      // 'dashboard'가 문제를 고르는 화면이고, 문제를 누르면 'solver'로 넘어간다.
      // 둘은 한 몸이라 같은 탭으로 묶어 두고, 풀이 중에도 이 탭이 켜진 것으로 본다.
      { key: 'dashboard', label: '✍️ 문제 풀기', also: ['solver'] },
      { key: 'wrongNotes', label: '❌ 오답노트' },
      { key: 'review', label: '🔄 망각곡선 복습' },
    ],
  },
  {
    key: 'plan',
    label: '📅 플래너',
    home: 'planner',
    tabs: [
      { key: 'planner', label: '🗓️ 월간' },
      { key: 'todo', label: '🏫 숙제' },
      { key: 'studyPlanner', label: '📝 일간' },
    ],
  },
  { key: 'store', label: '🎁 보상 상점', home: 'store', tabs: [{ key: 'store', label: '보상 상점' }] },
  {
    key: 'collection',
    label: '🏅 내 캐릭터',
    home: 'collection',
    tabs: [{ key: 'collection', label: '내 캐릭터' }],
  },
];

/** 지금 열려 있는 탭이 어느 큰 메뉴에 속하는지 찾는다. */
export function menuOfTab(tabKey) {
  return (
    MENUS.find((menu) =>
      menu.tabs.some((tab) => tab.key === tabKey || (tab.also ?? []).includes(tabKey))
    ) ?? MENUS[0]
  );
}

export default function Header({
  activeTab,
  setActiveTab,
  currentPoints = 0,
  level = 1,
  userName = '',
  onLogout,
}) {
  const headerRef = useRef(null);
  // 실수로 눌러서 로그아웃되지 않도록 한 번 더 묻는다.
  const [askLogout, setAskLogout] = useState(false);
  const currentMenu = menuOfTab(activeTab);

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
          <span className="rounded-full border-2 border-white bg-violet-300 px-3 py-2 text-sm font-black text-violet-900 shadow-md shadow-violet-200">
            🏅 Lv {level}
          </span>
          <span className="rounded-full border-2 border-white bg-yellow-300 px-4 py-2 text-sm font-black text-amber-900 shadow-md shadow-amber-200">
            💰 {Number(currentPoints).toLocaleString()} P
          </span>
          {userName &&
            (askLogout ? (
              <span className="flex items-center gap-1.5 rounded-full border-2 border-rose-200 bg-white px-3 py-1.5 shadow-sm">
                <span className="text-xs font-bold text-stone-500">나갈까요?</span>
                <button
                  type="button"
                  onClick={() => {
                    setAskLogout(false);
                    onLogout?.();
                  }}
                  className="rounded-full bg-rose-400 px-3 py-1 text-xs font-black text-white hover:bg-rose-500"
                >
                  네
                </button>
                <button
                  type="button"
                  onClick={() => setAskLogout(false)}
                  className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-200"
                >
                  아니요
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAskLogout(true)}
                title="다른 사람으로 바꾸기"
                className="rounded-full border-2 border-white bg-white px-3 py-2 text-sm font-bold text-amber-700 shadow-md shadow-amber-100 hover:bg-amber-100"
              >
                👤 {userName} <span className="text-xs font-normal text-stone-400">나가기</span>
              </button>
            ))}
          <nav className="flex flex-wrap gap-2">
            {MENUS.map((menu) => (
              <button
                key={menu.key}
                type="button"
                onClick={() => setActiveTab(menu.home)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  currentMenu.key === menu.key
                    ? 'bg-rose-400 text-white shadow-md shadow-rose-200'
                    : 'bg-white text-amber-700 hover:bg-amber-100'
                }`}
              >
                {menu.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 아래 줄: 지금 메뉴 안의 탭들. 탭이 하나뿐인 메뉴는 줄을 만들지 않는다. */}
      {currentMenu.tabs.length > 1 && (
        <div className="border-t-2 border-rose-100/70 bg-white/60">
          <nav className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 py-2">
            {currentMenu.tabs.map((tab) => {
              const on = activeTab === tab.key || (tab.also ?? []).includes(activeTab);
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                    on
                      ? 'bg-amber-200 text-amber-900 shadow-sm'
                      : 'bg-white/80 text-stone-500 hover:bg-amber-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
