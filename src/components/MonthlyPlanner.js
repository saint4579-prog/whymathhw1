'use client';

import { useEffect, useMemo, useState } from 'react';

function toDateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const directMatch = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (directMatch) {
      return `${directMatch[1]}-${String(directMatch[2]).padStart(2, '0')}-${String(
        directMatch[3]
      ).padStart(2, '0')}`;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function getRecordDate(record) {
  return toDateKey(
    record.studyDate ??
      record.date ??
      record.studiedAt ??
      record.submittedAt ??
      record.createdAt ??
      record.timestamp
  );
}

function getProblemCount(record) {
  const explicit = Number(record.problemCount ?? record.solvedCount ?? record.count);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;
  if (Array.isArray(record.problems)) return record.problems.length;
  return 1;
}

function getStudySeconds(record) {
  return Math.max(
    0,
    Number(
      record.totalStudyTimeSec ??
        record.studyTimeSec ??
        record.solveTimeSec ??
        record.durationSec ??
        0
    ) || 0
  );
}

function getEarnedPoints(record) {
  return Math.max(
    0,
    Number(record.pointsEarned ?? record.earnedPoints ?? record.rewardPoints ?? record.points ?? 0) ||
      0
  );
}

function formatStudyTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}초`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.round(seconds % 60);
  return restSeconds ? `${minutes}분 ${restSeconds}초` : `${minutes}분`;
}

function DayDetailModal({ dateKey, records, onClose }) {
  const totals = records.reduce(
    (result, record) => ({
      problems: result.problems + getProblemCount(record),
      seconds: result.seconds + getStudySeconds(record),
      points: result.points + getEarnedPoints(record),
    }),
    { problems: 0, seconds: 0, points: 0 }
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${dateKey} 공부 기록`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border-4 border-white bg-amber-50 shadow-2xl">
        <div className="flex items-center gap-3 bg-gradient-to-r from-rose-100 to-amber-100 p-5">
          <span className="text-3xl">🐶</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-rose-500">멍멍이 공부 일기</p>
            <h2 className="text-xl font-extrabold text-stone-700">{dateKey}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-rose-500 shadow-sm hover:bg-rose-50"
          >
            닫기 ✕
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4">
          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-xs font-bold text-stone-400">푼 문제</p>
            <p className="font-extrabold text-rose-500">✏️ {totals.problems}문제</p>
          </div>
          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-xs font-bold text-stone-400">공부 시간</p>
            <p className="font-extrabold text-sky-500">⏱️ {formatStudyTime(totals.seconds)}</p>
          </div>
          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-xs font-bold text-stone-400">획득 포인트</p>
            <p className="font-extrabold text-amber-600">💰 +{totals.points}P</p>
          </div>
        </div>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto px-4 pb-5">
          {records.length === 0 ? (
            <p className="rounded-2xl bg-white py-10 text-center text-sm font-semibold text-stone-400">
              이날은 아직 공부 기록이 없어요. 🐾
            </p>
          ) : (
            records.flatMap((record, recordIndex) => {
              const details =
                Array.isArray(record.problems) && record.problems.length > 0
                  ? record.problems
                  : [record];
              return details.map((detail, detailIndex) => (
                <div
                  key={`${record.id ?? recordIndex}-${detail.id ?? detailIndex}`}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-rose-100 bg-white p-3"
                >
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-700">
                    {detail.isCorrect === 'O' ? '⭕ 정답' : detail.isCorrect === 'X' ? '❌ 다시 도전' : '✏️ 학습'}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-stone-600">
                    {detail.code ?? detail.contentCode ?? detail.item ?? '수학 문제 학습'}
                  </p>
                  <span className="text-xs font-semibold text-sky-500">
                    ⏱️ {formatStudyTime(getStudySeconds(detail) || getStudySeconds(record))}
                  </span>
                  <span className="text-xs font-semibold text-amber-600">
                    💰 +{getEarnedPoints(detail) || getEarnedPoints(record)}P
                  </span>
                </div>
              ));
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function MonthlyPlanner({ studyRecords = [] }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateKey, setSelectedDateKey] = useState(null);

  const recordsByDate = useMemo(() => {
    const grouped = new Map();
    studyRecords.forEach((record) => {
      const key = getRecordDate(record);
      if (!key) return;
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    });
    return grouped;
  }, [studyRecords]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const calendarStart = new Date(year, month, 1 - firstWeekday);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const todayKey = toDateKey(today);

  const moveMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-lg shadow-amber-100/60">
        <div>
          <p className="text-xs font-bold text-rose-400">🐾 하루하루 쌓이는 나의 공부 발자국</p>
          <h2 className="text-2xl font-extrabold text-stone-700">📅 월간 스터디 플래너</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="rounded-full bg-amber-100 px-4 py-2 font-extrabold text-amber-700 hover:bg-amber-200"
            aria-label="이전 달"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="min-w-36 rounded-full bg-rose-400 px-5 py-2 text-sm font-extrabold text-white shadow-md"
          >
            {year}년 {month + 1}월
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="rounded-full bg-amber-100 px-4 py-2 font-extrabold text-amber-700 hover:bg-amber-200"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[2rem] border-4 border-white bg-white p-2 shadow-xl shadow-amber-100/70 md:p-4">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 gap-2 pb-2 text-center text-sm font-extrabold">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
              <div
                key={day}
                className={`rounded-full py-2 ${
                  index === 0
                    ? 'bg-rose-100 text-rose-500'
                    : index === 6
                      ? 'bg-sky-100 text-sky-500'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((date) => {
              const key = toDateKey(date);
              const records = recordsByDate.get(key) ?? [];
              const inCurrentMonth = date.getMonth() === month;
              const totals = records.reduce(
                (result, record) => ({
                  problems: result.problems + getProblemCount(record),
                  seconds: result.seconds + getStudySeconds(record),
                  points: result.points + getEarnedPoints(record),
                }),
                { problems: 0, seconds: 0, points: 0 }
              );

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDateKey(key)}
                  className={`relative min-h-36 rounded-3xl border-2 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                    key === todayKey
                      ? 'border-rose-300 bg-rose-50'
                      : inCurrentMonth
                        ? 'border-amber-100 bg-amber-50/40'
                        : 'border-stone-100 bg-stone-50 opacity-45'
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold ${
                      key === todayKey ? 'bg-rose-400 text-white' : 'bg-white text-stone-500'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {records.length > 0 && (
                    <>
                      <span className="absolute right-2 top-1 rotate-6 text-3xl drop-shadow-sm">🐶</span>
                      <div className="mt-2 space-y-1 rounded-2xl bg-white/90 p-2 text-xs font-bold shadow-sm">
                        <p className="text-rose-500">✏️ {totals.problems}문제</p>
                        <p className="text-sky-500">⏱️ {formatStudyTime(totals.seconds)}</p>
                        <p className="text-amber-600">💰 +{totals.points}P</p>
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDateKey && (
        <DayDetailModal
          dateKey={selectedDateKey}
          records={recordsByDate.get(selectedDateKey) ?? []}
          onClose={() => setSelectedDateKey(null)}
        />
      )}
    </div>
  );
}
