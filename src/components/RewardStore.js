'use client';

import { useMemo, useState } from 'react';
import { toISODate } from '@/lib/dateUtils';
import CharacterMascot from './CharacterMascot';

const DEFAULT_PARENT_PIN = '1234';

function formatDate(value) {
  const iso = toISODate(value);
  return iso ?? (value ? String(value).slice(0, 16) : '-');
}

function ParentRewardModal({ currentPoints, onClose, onRedeem }) {
  const [step, setStep] = useState('pin');
  const [pin, setPin] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const verifyPin = (event) => {
    event.preventDefault();
    if (pin !== DEFAULT_PARENT_PIN) {
      setError('비밀번호가 맞지 않아요.');
      return;
    }
    setError('');
    setStep('reward');
  };

  const handleRedeem = async (event) => {
    event.preventDefault();
    const numericAmount = Math.round(Number(amount));
    if (!item.trim()) {
      setError('선물할 보상 이름을 적어주세요.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('차감할 포인트를 1P 이상 입력해주세요.');
      return;
    }
    if (numericAmount > currentPoints) {
      setError('현재 보유한 포인트보다 큰 금액이에요.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onRedeem(item.trim(), numericAmount);
      alert(`🎁 "${item.trim()}" 선물을 등록하고 ${numericAmount.toLocaleString()}P를 사용했어요!`);
      onClose();
    } catch (redeemError) {
      setError(redeemError.message || '포인트 차감에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="엄마 보상 선물하기"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-[2rem] border-4 border-white bg-gradient-to-b from-amber-50 to-rose-50 p-6 shadow-2xl">
        <div className="mb-5 flex items-start gap-3">
          <span className="text-4xl">{step === 'pin' ? '🔐' : '🎁'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-rose-400">엄마 전용 메뉴</p>
            <h2 className="text-xl font-extrabold text-stone-700">
              {step === 'pin' ? '비밀번호 확인' : '보상 선물해주기'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-stone-400 shadow-sm disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {step === 'pin' ? (
          <form onSubmit={verifyPin}>
            <label className="block text-sm font-bold text-stone-600">
              엄마 비밀번호
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="PIN 4자리"
                className="mt-2 w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-rose-300"
              />
            </label>
            <p className="mt-2 text-center text-xs font-semibold text-stone-400">
              기본 PIN은 1234예요.
            </p>
            {error && <p className="mt-3 text-center text-sm font-bold text-rose-500">{error}</p>}
            <button
              type="submit"
              className="mt-5 w-full rounded-2xl bg-rose-400 py-3 font-extrabold text-white shadow-lg shadow-rose-200 hover:bg-rose-500"
            >
              엄마 확인하기 🐾
            </button>
          </form>
        ) : (
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="rounded-2xl bg-white p-3 text-center text-sm font-bold text-amber-700 shadow-sm">
              현재 사용 가능한 포인트: 💰 {currentPoints.toLocaleString()}P
            </div>
            <label className="block text-sm font-bold text-stone-600">
              보상 항목명
              <input
                type="text"
                autoFocus
                value={item}
                onChange={(event) => setItem(event.target.value)}
                placeholder="예: 1000원 아이스크림"
                className="mt-2 w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 outline-none focus:border-rose-300"
              />
            </label>
            <label className="block text-sm font-bold text-stone-600">
              차감할 포인트
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max={currentPoints}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="예: 1000"
                className="mt-2 w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 outline-none focus:border-rose-300"
              />
            </label>
            {error && <p className="text-center text-sm font-bold text-rose-500">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-amber-400 py-3 font-extrabold text-white shadow-lg shadow-amber-200 hover:bg-amber-500 disabled:cursor-wait disabled:opacity-50"
            >
              {submitting ? '🐶 구글 시트에 선물을 기록 중이에요...' : '🎁 포인트 차감하기'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function RewardStore({ currentPoints = 0, dailyStats = {}, pointLogs = [], onRedeem }) {
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);

  // 그동안 모은 포인트: dailyStats(날짜별 학습 통계)의 pointsEarned를 모두 합산한다.
  const totalEarned = useMemo(
    () =>
      Object.values(dailyStats).reduce((sum, stat) => sum + (Number(stat?.pointsEarned) || 0), 0),
    [dailyStats]
  );

  // 선물에 사용한 포인트: pointLogs(엄마가 차감한 내역)의 절대값 합.
  const totalUsed = useMemo(
    () =>
      pointLogs.reduce(
        (sum, entry) => sum + Math.abs(Number(entry.amount ?? entry.points ?? 0) || 0),
        0
      ),
    [pointLogs]
  );

  // 포인트 발자국: dailyStats(학습으로 얻은 포인트)와 pointLogs(보상으로 차감된 포인트)를
  // 하나의 배열로 합친 뒤 날짜 기준 최신순으로 정렬한다.
  const footprintEntries = useMemo(() => {
    const earnedEntries = Object.entries(dailyStats)
      .filter(([, stat]) => (Number(stat?.pointsEarned) || 0) !== 0)
      .map(([dateKey, stat]) => ({
        key: `daily-${dateKey}`,
        date: toISODate(dateKey) ?? dateKey,
        label: '📚 문제 풀이 완료',
        amount: Number(stat?.pointsEarned) || 0,
      }));

    const redeemedEntries = pointLogs.map((entry, index) => {
      const rawDate = entry.date ?? entry.createdAt ?? entry.timestamp ?? entry.redeemedAt;
      return {
        key: entry.id ?? `redeem-${index}-${rawDate ?? index}`,
        date: toISODate(rawDate) ?? String(rawDate ?? '').slice(0, 10),
        label: `🎁 ${entry.item ?? entry.description ?? '보상 사용'}`,
        amount: -Math.abs(Number(entry.amount ?? entry.points ?? 0) || 0),
      };
    });

    return [...earnedEntries, ...redeemedEntries].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );
  }, [dailyStats, pointLogs]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-r from-amber-200 via-yellow-100 to-rose-100 p-6 shadow-xl shadow-amber-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <CharacterMascot name="raccoon" height={60} animate="wiggle" />
            <span className="text-4xl">🎁</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-rose-500">공부해서 모은 나의 보물</p>
            <h2 className="text-2xl font-extrabold text-stone-700">포인트 보상 상점</h2>
          </div>
          <div className="rounded-3xl border-4 border-white bg-yellow-300 px-6 py-4 text-center shadow-lg">
            <p className="text-xs font-extrabold text-amber-800">내 현재 포인트</p>
            <p className="text-3xl font-black text-amber-900">
              💰 {Number(currentPoints).toLocaleString()} P
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border-2 border-rose-100 bg-white p-5 text-center shadow-lg shadow-amber-100/60">
          <p className="text-xs font-bold text-stone-400">그동안 모은 포인트</p>
          <p className="mt-1 text-2xl font-extrabold text-sky-600">
            +{totalEarned.toLocaleString()}P
          </p>
        </div>
        <div className="rounded-3xl border-2 border-amber-100 bg-white p-5 text-center shadow-lg shadow-amber-100/60">
          <p className="text-xs font-bold text-stone-400">선물에 사용한 포인트</p>
          <p className="mt-1 text-2xl font-extrabold text-orange-500">
            -{totalUsed.toLocaleString()}P
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsParentModalOpen(true)}
          className="rounded-3xl bg-gradient-to-r from-rose-400 to-orange-400 p-5 text-lg font-extrabold text-white shadow-lg shadow-rose-200 hover:from-rose-500 hover:to-orange-500"
        >
          🎁 엄마 보상 선물해주기
          <span className="mt-1 block text-xs font-bold text-white/80">(포인트 차감)</span>
        </button>
      </div>

      <section className="rounded-[2rem] border-2 border-rose-100 bg-white p-4 shadow-lg shadow-amber-100/60 md:p-6">
        <h3 className="mb-4 text-lg font-extrabold text-stone-700">🐾 포인트 발자국</h3>
        {footprintEntries.length === 0 ? (
          <p className="rounded-2xl bg-amber-50 py-12 text-center text-sm font-semibold text-amber-600">
            아직 포인트 기록이 없어요. 문제를 풀고 첫 포인트를 모아볼까요? 🐶
          </p>
        ) : (
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {footprintEntries.map((entry) => (
              <li
                key={entry.key}
                className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-amber-50 bg-amber-50/40 p-3"
              >
                <span className="text-2xl">{entry.amount >= 0 ? '⭐' : '🎁'}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-stone-600">{entry.label}</p>
                  <p className="text-xs font-semibold text-stone-400">{formatDate(entry.date)}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-extrabold ${
                    entry.amount >= 0 ? 'bg-sky-100 text-sky-600' : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  {entry.amount >= 0 ? '+' : '-'}
                  {Math.abs(entry.amount).toLocaleString()}P
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isParentModalOpen && (
        <ParentRewardModal
          currentPoints={Number(currentPoints) || 0}
          onClose={() => setIsParentModalOpen(false)}
          onRedeem={onRedeem}
        />
      )}
    </div>
  );
}
