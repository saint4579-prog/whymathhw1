'use client';

import { useEffect } from 'react';

// 스터디 플래너에서 되풀이해 쓰는 작은 화면 조각들.
// 모양만 담당하고, 계획 내용이 무엇인지는 알지 못한다.

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-[2rem] border-4 border-white bg-white p-4 shadow-xl shadow-amber-100/70 md:p-5 ${className}`}
    >
      {children}
    </section>
  );
}


export function SectionTitle({ emoji, title, subtitle, right }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs font-bold text-rose-400">{subtitle}</p>
        <h3 className="text-lg font-extrabold text-stone-700">
          {emoji} {title}
        </h3>
      </div>
      {right}
    </div>
  );
}


export function PillButton({ active, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        active
          ? 'bg-rose-400 text-white shadow-md shadow-rose-200'
          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** 과목 비중 도넛 차트 (외부 라이브러리 없이 SVG로 직접 그린다) */

export function SubjectDonut({ shares, mode = 'planned', size = 148 }) {
  const key = mode === 'done' ? 'doneShare' : 'plannedShare';
  const visible = shares.filter((s) => s[key] > 0);
  const total = visible.reduce((sum, s) => sum + s[key], 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border-8 border-amber-100 text-center text-xs font-bold text-stone-400"
        style={{ width: size, height: size }}
      >
        아직 기록이
        <br />
        없어요 🐾
      </div>
    );
  }

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="과목 비중">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#FEF3C7" strokeWidth="18" />
      {visible.map((share) => {
        const ratio = share[key] / total;
        const dash = ratio * circumference;
        const el = (
          <circle
            key={share.subject}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={share.color}
            strokeWidth="18"
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        className="fill-stone-500"
        style={{ fontSize: 12, fontWeight: 700 }}
      >
        과목 비중
      </text>
      <text x="50%" y="66%" textAnchor="middle" style={{ fontSize: 20 }}>
        🐶
      </text>
    </svg>
  );
}

/** 달성률 원형 게이지 */

export function AchievementRing({ rate, size = 116 }) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.min(1, Math.max(0, rate)) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#FFE4E6" strokeWidth="14" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FB7185"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-rose-500">{Math.round(rate * 100)}%</span>
        <span className="text-[10px] font-bold text-stone-400">오늘 달성률</span>
      </div>
    </div>
  );
}


export function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${maxWidth} overflow-hidden rounded-[2rem] border-4 border-white bg-amber-50 shadow-2xl`}>
        <div className="flex items-center gap-3 bg-gradient-to-r from-rose-100 to-amber-100 p-5">
          <span className="text-3xl">🐶</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-rose-500">{subtitle}</p>
            <h2 className="text-xl font-extrabold text-stone-700">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-rose-500 shadow-sm hover:bg-rose-50"
          >
            닫기 ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

// 월간 플래너에서 저장한 시험 설정을 바탕으로 '추천 기간 목표'를 보여주는 폼.
// 추천 진도(하루 권장량)를 자동 계산하고, 사용자가 총량/마감일을 수정한 뒤 목표로 저장할 수 있다.

export function StatBox({ emoji, label, value, tone = 'rose' }) {
  const tones = {
    rose: 'text-rose-500',
    sky: 'text-sky-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    amber: 'text-amber-600',
  };
  return (
    <div className="rounded-2xl bg-amber-50 p-3 text-center">
      <p className="text-[11px] font-bold text-stone-400">{label}</p>
      <p className={`text-sm font-extrabold ${tones[tone]}`}>
        {emoji} {value}
      </p>
    </div>
  );
}

/**
 * 할 일 한 줄.
 * 아이가 하나 끝낼 때마다 바로 체크할 수 있도록, 카드 어디를 눌러도 완료/취소가 된다.
 * 숫자 입력 대신 −/+ 버튼으로 "한 만큼"을 조금씩 올린다. (키보드 없이 손가락만으로 조작)
 *
 * 주의: 바깥이 클릭 영역이라 안쪽 조작부는 button이 아닌 div(role="button")로 감싸고,
 * −/+와 삭제는 stopPropagation으로 카드 토글이 같이 일어나지 않게 막는다.
 */

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-extrabold text-stone-500">{label}</span>
      {children}
    </label>
  );
}

// 시간표에 배정할 때 고를 수 있는 소요 시간(분).
// 시간표 칸 단위보다 짧은 항목은 화면에서 자동으로 걸러진다.
