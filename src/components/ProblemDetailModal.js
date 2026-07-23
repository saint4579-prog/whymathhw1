'use client';

import { useEffect } from 'react';
import { toViewableImageUrl } from '@/lib/api';

function getSubmittedImageUrl(submitted) {
  if (typeof submitted !== 'string') return null;
  const value = submitted.trim();
  if (!value || ['true', 'false'].includes(value.toLowerCase())) return null;
  if (!/^https?:\/\//i.test(value) && !value.startsWith('data:image/')) return null;
  return toViewableImageUrl(value);
}

function ImageCard({ title, imageUrl, alt, accent = 'amber' }) {
  const colorClasses =
    accent === 'rose'
      ? 'border-rose-200 bg-rose-50/50 text-rose-600'
      : 'border-amber-200 bg-amber-50/50 text-amber-700';

  return (
    <section className={`flex min-h-0 flex-col rounded-3xl border-4 border-dashed p-3 ${colorClasses}`}>
      <h3 className="mb-2 text-center text-sm font-extrabold">{title}</h3>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-white">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={alt} className="mx-auto h-auto max-h-[70vh] max-w-full object-contain" />
        ) : (
          <p className="py-16 text-center text-sm opacity-70">저장된 이미지가 없어요.</p>
        )}
      </div>
    </section>
  );
}

export default function ProblemDetailModal({ problem, onClose }) {
  const submittedImageUrl = getSubmittedImageUrl(problem?.submitted);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!problem) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="problem-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border-4 border-white bg-white p-4 shadow-2xl md:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">🐶</span>
          <h2 id="problem-detail-title" className="min-w-0 flex-1 truncate text-lg font-extrabold text-stone-700">
            {problem.code}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-rose-400 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-rose-500"
          >
            닫기 ✕
          </button>
        </div>
        <div className={`grid min-h-0 flex-1 gap-4 overflow-y-auto ${submittedImageUrl ? 'lg:grid-cols-2' : ''}`}>
          <ImageCard
            title="📖 문제"
            imageUrl={toViewableImageUrl(problem.imageUrl)}
            alt={`${problem.code} 문제`}
          />
          {submittedImageUrl && (
            <ImageCard
              title="🐾 아이가 제출한 풀이 과정"
              imageUrl={submittedImageUrl}
              alt={`${problem.code} 아이가 제출한 풀이 과정`}
              accent="rose"
            />
          )}
        </div>
      </div>
    </div>
  );
}
