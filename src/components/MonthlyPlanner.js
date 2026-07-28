'use client';

import { useEffect, useMemo, useState } from 'react';
import { toISODate } from '@/lib/dateUtils';
import { formatDday, daysUntil, makeExam } from '@/lib/smartSchedule';
import CharacterMascot from './CharacterMascot';

// 시험 뱃지 색상 팔레트 (등록 순서대로 순환)
const EXAM_COLORS = [
  { dot: 'bg-rose-400', chip: 'bg-rose-100 text-rose-600' },
  { dot: 'bg-violet-400', chip: 'bg-violet-100 text-violet-700' },
  { dot: 'bg-sky-400', chip: 'bg-sky-100 text-sky-700' },
  { dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-700' },
  { dot: 'bg-emerald-400', chip: 'bg-emerald-100 text-emerald-700' },
  { dot: 'bg-pink-400', chip: 'bg-pink-100 text-pink-600' },
];

function examColor(index) {
  return EXAM_COLORS[index % EXAM_COLORS.length];
}

// 시험 추가/수정 폼 (인라인). 여러 개의 시험을 등록/수정할 때 쓴다.
function ExamForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [examDate, setExamDate] = useState(initial?.examDate || '');
  const [totalProblems, setTotalProblems] = useState(initial?.totalProblems || 0);

  return (
    <div className="rounded-2xl border-2 border-rose-200 bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold text-stone-500">시험 이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 황소 단원평가"
            className="w-full rounded-2xl border-2 border-amber-100 bg-white px-3 py-2 font-bold text-stone-700 outline-none focus:border-rose-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold text-stone-500">시험 날짜</span>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full rounded-2xl border-2 border-amber-100 bg-white px-3 py-2 font-bold text-stone-700 outline-none focus:border-rose-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold text-stone-500">시험 범위 (문제 수)</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={totalProblems}
            onChange={(e) => setTotalProblems(e.target.value)}
            className="w-full rounded-2xl border-2 border-amber-100 bg-white px-3 py-2 text-right font-extrabold text-stone-700 outline-none focus:border-rose-300"
          />
        </label>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-stone-100 px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-200"
        >
          취소
        </button>
        <button
          type="button"
          disabled={!name.trim() || !examDate}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              examDate,
              totalProblems: Math.max(0, Math.round(Number(totalProblems) || 0)),
            })
          }
          className="rounded-full bg-rose-400 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-rose-500 disabled:bg-stone-200 disabled:text-stone-400"
        >
          저장
        </button>
      </div>
    </div>
  );
}

// 여러 개의 시험 대비 설정을 등록/수정/삭제하는 카드.
// 저장하면 가장 임박한 시험이 [스터디 플래너] 추천 목표와 [오늘 할 일] 추천 시간표에 자동 반영된다.
function ExamManager({ exams, onExamsChange, loading = false }) {
  const [editingId, setEditingId] = useState(null); // 'new' | exam.id | null
  const list = Array.isArray(exams) ? exams : [];

  const addExam = (draft) => {
    onExamsChange?.([...list, makeExam(draft)]);
    setEditingId(null);
  };
  const updateExam = (id, draft) => {
    onExamsChange?.(list.map((e) => (e.id === id ? { ...e, ...draft } : e)));
    setEditingId(null);
  };
  const removeExam = (id) => {
    if (!window.confirm('이 시험을 삭제할까요?')) return;
    onExamsChange?.(list.filter((e) => e.id !== id));
  };

  return (
    <div className="mb-4 rounded-[2rem] border-4 border-white bg-gradient-to-br from-rose-50 to-amber-50 p-4 shadow-xl shadow-amber-100/70 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-rose-400">🐾 시험을 정하면 강아지 튜터가 진도를 짜 줘요</p>
          <h3 className="text-lg font-extrabold text-stone-700">📌 시험 대비 설정 (여러 개 등록 가능)</h3>
        </div>
        {loading ? (
          <span className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-700">🐾 불러오는 중...</span>
        ) : (
          editingId !== 'new' && (
            <button
              type="button"
              onClick={() => setEditingId('new')}
              className="rounded-full bg-rose-400 px-4 py-1.5 text-sm font-extrabold text-white shadow-md hover:bg-rose-500"
            >
              + 시험 추가
            </button>
          )
        )}
      </div>

      {editingId === 'new' && (
        <div className="mb-3">
          <ExamForm onSubmit={addExam} onCancel={() => setEditingId(null)} />
        </div>
      )}

      {list.length === 0 && editingId !== 'new' ? (
        <p className="rounded-2xl bg-white/70 p-5 text-center text-sm font-bold text-stone-400">
          아직 등록한 시험이 없어요. [+ 시험 추가]로 시험 일정을 넣어 볼까요? 🦴
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((exam, index) => {
            const color = examColor(index);
            const dday = daysUntil(exam.examDate);
            if (editingId === exam.id) {
              return (
                <li key={exam.id}>
                  <ExamForm
                    initial={exam}
                    onSubmit={(draft) => updateExam(exam.id, draft)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              );
            }
            return (
              <li
                key={exam.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-white bg-white px-4 py-2.5 shadow-sm"
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${color.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold text-stone-700">{exam.name || '이름 없는 시험'}</span>
                  <span className="block truncate text-xs font-bold text-stone-400">
                    📅 {exam.examDate || '날짜 미정'} · 📚 {exam.totalProblems}문제
                  </span>
                </span>
                {exam.examDate && (
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${color.chip}`}>
                    {formatDday(exam.examDate)}
                    {dday != null && dday >= 0 ? ` · ${dday}일` : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingId(exam.id)}
                  className="shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-200"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => removeExam(exam.id)}
                  className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-400 hover:bg-rose-100 hover:text-rose-500"
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-center text-xs font-bold text-stone-400">
        가장 임박한 시험이 [스터디 플래너] 추천 목표와 [오늘 할 일] 추천 시간표에 자동 반영돼요.
      </p>
    </div>
  );
}

function toCalendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function formatStudyTime(seconds) {
  const sec = Math.max(0, Math.round(Number(seconds) || 0));
  if (sec < 60) return `${sec}초`;
  const minutes = Math.floor(sec / 60);
  const restSeconds = sec % 60;
  return restSeconds ? `${minutes}분 ${restSeconds}초` : `${minutes}분`;
}

// 날짜 클릭 시 그날의 학습 집계(dailyStats)만 보여주는 요약 모달.
// dailyStats는 날짜별 합계만 제공하므로 문제별 상세 목록은 보여주지 않는다.
function DayDetailModal({ dateKey, stat, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const solvedCount = Number(stat?.solvedCount) || 0;
  const seconds = Math.max(0, Number(stat?.totalTimeSec) || 0);
  const points = Math.max(0, Number(stat?.pointsEarned) || 0);

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
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border-4 border-white bg-amber-50 shadow-2xl">
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
        {solvedCount === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-stone-400">
            이날은 아직 공부 기록이 없어요. 🐾
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-5">
            <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-bold text-stone-400">푼 문제</p>
              <p className="font-extrabold text-rose-500">✏️ {solvedCount}문제</p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-bold text-stone-400">공부 시간</p>
              <p className="font-extrabold text-sky-500">⏱️ {formatStudyTime(seconds)}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
              <p className="text-xs font-bold text-stone-400">획득 포인트</p>
              <p className="font-extrabold text-amber-600">💰 +{points}P</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MonthlyPlanner({ dailyStats = {}, exams = [], onExamsChange, examConfigLoading = false }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateKey, setSelectedDateKey] = useState(null);

  // dailyStats의 "Thu Jul 23" 같은 키를 "YYYY-MM-DD"로 정규화한 맵으로 만든다.
  // 구글 시트가 진짜로 내려주는 값이라, 새로고침마다 시트 상태를 그대로 반영한다.
  const statsByDate = useMemo(() => {
    const map = new Map();
    Object.entries(dailyStats).forEach(([key, stat]) => {
      const iso = toISODate(key);
      if (iso) map.set(iso, stat);
    });
    return map;
  }, [dailyStats]);

  // 날짜별 시험 목록 맵: 달력 칸에 시험 뱃지로 표시하기 위함. (등록 순서 색상 유지)
  const examsByDate = useMemo(() => {
    const map = new Map();
    (Array.isArray(exams) ? exams : []).forEach((exam, index) => {
      if (!exam?.examDate) return;
      if (!map.has(exam.examDate)) map.set(exam.examDate, []);
      map.get(exam.examDate).push({ ...exam, color: examColor(index) });
    });
    return map;
  }, [exams]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const calendarStart = new Date(year, month, 1 - firstWeekday);
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
  const todayKey = toCalendarDateKey(today);

  const moveMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div className="mx-auto max-w-7xl">
      <ExamManager exams={exams} onExamsChange={onExamsChange} loading={examConfigLoading} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-rose-100 bg-white p-4 shadow-lg shadow-amber-100/60">
        <div className="flex items-center gap-3">
          <CharacterMascot name="elephant" height={54} />
          <div>
            <p className="text-xs font-bold text-rose-400">🐾 하루하루 쌓이는 나의 공부 발자국</p>
            <h2 className="text-2xl font-extrabold text-stone-700">📅 월간 스터디 플래너</h2>
          </div>
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
              const key = toCalendarDateKey(date);
              const stat = statsByDate.get(key);
              const inCurrentMonth = date.getMonth() === month;
              const solvedCount = Number(stat?.solvedCount) || 0;
              const seconds = Math.max(0, Number(stat?.totalTimeSec) || 0);
              const points = Math.max(0, Number(stat?.pointsEarned) || 0);
              const dayExams = examsByDate.get(key) || [];

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDateKey(key)}
                  className={`relative min-h-36 rounded-3xl border-2 p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                    key === todayKey
                      ? 'border-rose-300 bg-rose-50'
                      : dayExams.length > 0
                        ? 'border-rose-200 bg-rose-50/50'
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
                  {/* 시험 뱃지: 이 날짜에 등록된 시험을 색상 칩으로 표시 */}
                  {dayExams.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {dayExams.map((exam) => (
                        <span
                          key={exam.id}
                          title={exam.name}
                          className={`block truncate rounded-full px-2 py-0.5 text-[10px] font-extrabold ${exam.color.chip}`}
                        >
                          📝 {exam.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {solvedCount > 0 && (
                    <>
                      <span className="absolute right-2 top-1 rotate-6 text-3xl drop-shadow-sm">🐶</span>
                      <div className="mt-2 space-y-1 rounded-2xl bg-white/90 p-2 text-xs font-bold shadow-sm">
                        <p className="text-rose-500">✏️ {solvedCount}문제</p>
                        <p className="text-sky-500">⏱️ {formatStudyTime(seconds)}</p>
                        <p className="text-amber-600">💰 +{points}P</p>
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
          stat={statsByDate.get(selectedDateKey)}
          onClose={() => setSelectedDateKey(null)}
        />
      )}
    </div>
  );
}
