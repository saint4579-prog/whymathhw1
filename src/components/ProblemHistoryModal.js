'use client';

import { useEffect, useState } from 'react';
import { toViewableImageUrl } from '@/lib/api';

function formatDateTime(value) {
  if (!value) return '-';
  const raw = String(value);
  // "2026-07-23 15:04:22" 형태는 ISO로 변환해서 파싱하고,
  // Apps Script의 Date().toString() 형태("Thu Jul 23 2026 16:57:03 GMT+0900 ...")는 그대로 파싱한다.
  const isIsoLike = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw);
  const date = new Date(isIsoLike ? raw.replace(' ', 'T') : raw);
  if (Number.isNaN(date.getTime())) return raw;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatSolveTime(seconds) {
  const sec = Math.max(0, Math.round(Number(seconds) || 0));
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

// 2단계 모달: 특정 풀이 시점에 제출된 손글씨 이미지를 원본 크기로 보여준다.
function SubmittedImageLightbox({ imageUrl, alt, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} 풀이 이미지`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border-4 border-white bg-white p-4 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-rose-500"
        >
          닫기 ✕
        </button>
        <div className="mt-10 flex max-h-[75vh] items-center justify-center overflow-auto rounded-2xl bg-amber-50/40">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={alt} className="max-h-[75vh] max-w-full object-contain" />
          ) : (
            <p className="py-20 text-center text-sm font-semibold text-amber-500">
              저장된 풀이 이미지가 없어요 😢
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// 1단계 모달: 문제 하나에 대한 날짜별 풀이 기록(historyLogs) 목록.
// 항목을 클릭하면 2단계(SubmittedImageLightbox)로 제출된 이미지를 보여준다.
export default function ProblemHistoryModal({ problem, onClose }) {
  const [selectedLog, setSelectedLog] = useState(null);
  const logs = Array.isArray(problem?.historyLogs) ? problem.historyLogs : [];
  const reviewCount = Number(problem?.reviewCount) || logs.length;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (selectedLog) setSelectedLog(null);
        else onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, selectedLog]);

  if (!problem) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="problem-history-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border-4 border-white bg-white p-4 shadow-2xl md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">🐾</span>
          <h2
            id="problem-history-title"
            className="min-w-0 flex-1 truncate text-lg font-extrabold text-stone-700"
          >
            {problem.code} 풀이 기록 (총 {reviewCount}회)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-rose-500"
          >
            닫기 ✕
          </button>
        </div>

        {logs.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 py-12 text-center text-sm font-semibold text-amber-600">
            아직 풀이 기록이 없어요. 🐶
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {logs.map((log, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => setSelectedLog(log)}
                  className="flex w-full flex-wrap items-center gap-3 rounded-2xl border-2 border-amber-50 bg-amber-50/40 p-3 text-left hover:bg-amber-100/60"
                >
                  <span className="text-sm font-bold text-stone-600">{formatDateTime(log.date)}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                      log.isCorrect === 'O' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-orange-700'
                    }`}
                  >
                    {log.isCorrect === 'O' ? '⭕ 정답' : '❌ 오답'}
                  </span>
                  <span className="text-xs font-semibold text-sky-600">
                    ⏱️ {formatSolveTime(log.solveTimeSec)}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-600">
                    🔍 제출한 풀이 보기
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedLog && (
        <SubmittedImageLightbox
          imageUrl={selectedLog.imageUrl ? toViewableImageUrl(selectedLog.imageUrl) : null}
          alt={`${problem.code} ${formatDateTime(selectedLog.date)} 풀이`}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
