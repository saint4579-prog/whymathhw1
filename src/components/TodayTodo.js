'use client';

import { useEffect, useMemo, useState } from 'react';
import CharacterMascot from './CharacterMascot';
import { toDateKey } from '@/lib/planner';
import { generateSmartSchedule } from '@/lib/smartSchedule';

const TODO_KEY_PREFIX = 'smart-todos';

function todoKey(userName, dateKey) {
  return `${TODO_KEY_PREFIX}:${userName || 'guest'}:${dateKey}`;
}

function loadTodos(userName, dateKey) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(todoKey(userName, dateKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos(userName, dateKey, todos) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(todoKey(userName, dateKey), JSON.stringify(todos));
  } catch {
    // 저장 실패는 무시 (화면 상태는 유지)
  }
}

// [오늘 할 일] 탭.
// 상단에 강아지 튜터의 '오늘의 추천 시간표' 카드를 띄우고, 각 시간 블록을 실제 To-do로 담을 수 있다.
// 아래에는 오늘 하루의 실제 할 일 목록(체크/추가/삭제)을 관리한다.
export default function TodayTodo({ userName, examConfig, completedProblems = 0 }) {
  const todayKey = toDateKey();
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [addedBlockIds, setAddedBlockIds] = useState(() => new Set());

  // 오늘 날짜의 할 일 불러오기
  useEffect(() => {
    setTodos(loadTodos(userName, todayKey));
  }, [userName, todayKey]);

  const persist = (next) => {
    setTodos(next);
    saveTodos(userName, todayKey, next);
  };

  const schedule = useMemo(
    () =>
      generateSmartSchedule({
        totalProblems: examConfig?.totalProblems,
        completedProblems,
        examDate: examConfig?.examDate,
        today: todayKey,
        scopeLabel: examConfig?.scopeLabel || '시험 범위',
        unit: '문제',
      }),
    [examConfig, completedProblems, todayKey]
  );

  const addTodo = (text) => {
    const value = String(text || '').trim();
    if (!value) return null;
    const todo = { id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: value, done: false };
    persist([...todos, todo]);
    return todo.id;
  };

  const handleAddBlock = (block) => {
    addTodo(block.text);
    setAddedBlockIds((prev) => new Set(prev).add(block.id));
  };

  const handleAddInput = () => {
    if (addTodo(input)) setInput('');
  };

  const toggleTodo = (id) => {
    persist(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTodo = (id) => {
    persist(todos.filter((t) => t.id !== id));
  };

  const doneCount = todos.filter((t) => t.done).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 강아지 튜터 추천 카드 */}
      {!dismissed && (
        <div className="relative overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-br from-rose-50 to-amber-50 p-5 shadow-xl shadow-amber-100/70">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="추천 닫기"
            className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-sm font-bold text-stone-400 shadow-sm hover:bg-rose-50 hover:text-rose-500"
          >
            ✕
          </button>

          <div className="flex items-center gap-3">
            <CharacterMascot name="chick" height={54} />
            <div>
              <p className="text-xs font-bold text-rose-400">🐾 강아지 튜터의 스마트 추천</p>
              <h2 className="text-xl font-extrabold text-stone-700">🐶 멍멍! 오늘의 추천 일정이에요!</h2>
            </div>
          </div>

          {schedule.hasExam ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-full bg-rose-400 px-3 py-1 text-white shadow-sm">
                  {schedule.ddayLabel}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-stone-600 shadow-sm">
                  📅 시험 {schedule.examDate}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-stone-600 shadow-sm">
                  📚 남은 {schedule.remaining}문제
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 shadow-sm">
                  🎯 오늘 목표 {schedule.todayQuota}문제
                  {schedule.isWeekendToday ? ' (주말 +50%)' : ''}
                </span>
              </div>

              {schedule.blocks.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {schedule.blocks.map((block) => {
                    const added = addedBlockIds.has(block.id);
                    return (
                      <li
                        key={block.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amber-100 bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-stone-700">⏰ {block.timeLabel}</p>
                          <p className="text-xs font-bold text-stone-500">
                            {block.scopeLabel ?? examConfig?.scopeLabel ?? ''} {block.count}
                            {block.unit} 풀기
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddBlock(block)}
                          disabled={added}
                          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold shadow-sm transition ${
                            added
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-rose-400 text-white hover:bg-rose-500'
                          }`}
                        >
                          {added ? '추가됨 ✓' : '＋ 내 일정에 추가'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl bg-white px-4 py-6 text-center text-sm font-bold text-emerald-500">
                  🎉 시험 범위를 다 풀었어요! 오늘은 가볍게 복습해볼까요?
                </p>
              )}

              <p className="mt-3 text-center text-xs font-bold text-stone-400">
                🐕 하루 평균 {schedule.dailyAverage}문제씩 풀면 시험 전에 딱 끝나요!
              </p>
            </>
          ) : (
            <p className="mt-4 rounded-2xl bg-white px-4 py-6 text-center text-sm font-bold text-stone-500">
              📅 아직 시험 정보가 없어요. <span className="text-rose-500">[월간 플래너]</span> 탭에서
              시험 날짜와 시험 범위를 먼저 입력해 주세요! 🐾
            </p>
          )}
        </div>
      )}

      {dismissed && (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="w-full rounded-2xl border-2 border-dashed border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-50"
        >
          🐶 오늘의 추천 일정 다시 보기
        </button>
      )}

      {/* 실제 오늘 할 일 목록 */}
      <div className="rounded-[2rem] border-4 border-white bg-white p-5 shadow-xl shadow-amber-100/70">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-stone-700">✅ 오늘 할 일</h3>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">
            {doneCount} / {todos.length} 완료
          </span>
        </div>

        <div className="mb-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddInput();
            }}
            placeholder="직접 할 일을 적어 보세요 (예: 오답 정리하기)"
            className="flex-1 rounded-full border-2 border-amber-100 px-4 py-2 text-sm font-bold text-stone-700 outline-none focus:border-rose-300"
          />
          <button
            type="button"
            onClick={handleAddInput}
            className="shrink-0 rounded-full bg-rose-400 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500"
          >
            추가
          </button>
        </div>

        {todos.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 p-6 text-center text-sm font-bold text-stone-400">
            아직 할 일이 없어요. 위 추천 일정을 담거나 직접 적어 보세요 🐾
          </p>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition ${
                  todo.done ? 'border-emerald-200 bg-emerald-50' : 'border-amber-100 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleTodo(todo.id)}
                  aria-pressed={todo.done}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black transition ${
                    todo.done ? 'bg-emerald-400 text-white' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {todo.done ? '✓' : ''}
                </button>
                <span
                  className={`min-w-0 flex-1 text-sm font-bold ${
                    todo.done ? 'text-emerald-600 line-through' : 'text-stone-700'
                  }`}
                >
                  {todo.text}
                </span>
                <button
                  type="button"
                  onClick={() => removeTodo(todo.id)}
                  className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-400 hover:bg-rose-100 hover:text-rose-500"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
