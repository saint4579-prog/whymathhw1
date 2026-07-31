'use client';

import { useEffect, useState } from 'react';
import { fetchPointSummary } from '@/lib/api';

/**
 * 포인트가 어떻게 나온 숫자인지 항목별로 보여 준다.
 *
 * "문제를 많이 풀었는데 포인트가 어디 갔지?" 에 답하는 화면이다.
 * 잔액만 보여 주면 맞는지 틀린지 확인할 방법이 없어서, 번 것과 쓴 것을 갈라 놓는다.
 *
 * 숫자는 시트에서 계산해 내려준 것을 그대로 쓴다.
 * 화면에서 따로 더하면 시트와 다른 값이 나올 수 있어, 그때부터는 어느 쪽이 맞는지 알 수 없다.
 */
export default function PointSummaryPanel({ userName }) {
  const [summary, setSummary] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let alive = true;
    setState('loading');
    fetchPointSummary(userName).then((data) => {
      if (!alive) return;
      setSummary(data);
      setState(data ? 'ready' : 'failed');
    });
    return () => {
      alive = false;
    };
  }, [userName]);

  if (state === 'loading') {
    return (
      <section className="mb-5 rounded-[2rem] border-4 border-white bg-white p-5 shadow-xl shadow-amber-100/70">
        <p className="text-sm font-bold text-stone-400">🧮 포인트를 정산하는 중이에요…</p>
      </section>
    );
  }
  if (state === 'failed' || !summary) return null;

  const solve = summary.solve ?? {};
  const check = summary.checklist ?? {};
  const planner = summary.planner ?? {};
  const spent = summary.spent ?? {};

  const rows = [
    {
      icon: '✍️',
      label: '문제 풀이',
      detail: `맞음 ${solve.correct ?? 0}개 · 틀림 ${solve.wrong ?? 0}개`,
      value: solve.points ?? 0,
    },
    {
      icon: '📄',
      label: '체크리스트',
      detail: `맞음 ${check.correct ?? 0}개 · 틀림 ${check.wrong ?? 0}개${
        check.capped > 0 ? ` (하루 상한으로 ${check.capped}P 못 받음)` : ''
      }`,
      value: check.points ?? 0,
    },
    {
      icon: '📝',
      label: '플래너 달성 등',
      detail: `${planner.count ?? 0}번`,
      value: planner.points ?? 0,
    },
  ];

  return (
    <section className="mb-5 rounded-[2rem] border-4 border-white bg-white p-5 shadow-xl shadow-amber-100/70">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-extrabold text-stone-700">🧮 포인트는 이렇게 모였어요</h3>
        <p className="text-xs font-bold text-stone-400">지금 남은 포인트</p>
      </div>

      <div className="mb-3 flex items-baseline justify-end gap-2">
        <span
          className={`text-3xl font-black ${
            (summary.balance ?? 0) < 0 ? 'text-rose-500' : 'text-amber-600'
          }`}
        >
          {Number(summary.balance ?? 0).toLocaleString()} P
        </span>
      </div>

      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex flex-wrap items-baseline gap-x-2 rounded-2xl bg-amber-50/70 px-4 py-2"
          >
            <span className="font-extrabold text-stone-600">
              {row.icon} {row.label}
            </span>
            <span className="min-w-0 flex-1 text-xs font-bold text-stone-400">{row.detail}</span>
            <span className="font-extrabold text-emerald-600">
              +{Number(row.value).toLocaleString()}P
            </span>
          </li>
        ))}

        <li className="flex flex-wrap items-baseline gap-x-2 rounded-2xl bg-emerald-50 px-4 py-2">
          <span className="min-w-0 flex-1 font-extrabold text-stone-600">번 포인트 합계</span>
          <span className="font-extrabold text-emerald-600">
            +{Number(summary.earned ?? 0).toLocaleString()}P
          </span>
        </li>

        <li className="flex flex-wrap items-baseline gap-x-2 rounded-2xl bg-rose-50 px-4 py-2">
          <span className="font-extrabold text-stone-600">🎁 쓴 포인트</span>
          <span className="min-w-0 flex-1 text-xs font-bold text-stone-400">
            {spent.count ?? 0}번 (집 올리기·보상 교환)
          </span>
          <span className="font-extrabold text-rose-500">
            {Number(spent.points ?? 0).toLocaleString()}P
          </span>
        </li>
      </ul>

      {(summary.repeatsRewarded > 0 || summary.sameDaySkipped > 0) && (
        <p className="mt-3 rounded-2xl bg-stone-50 px-4 py-2 text-xs font-bold text-stone-400">
          {summary.repeatsRewarded > 0 && (
            <>🔁 다른 날 다시 푼 {summary.repeatsRewarded}건도 포인트를 받았어요. </>
          )}
          {summary.sameDaySkipped > 0 && (
            <>같은 날 다시 푼 {summary.sameDaySkipped}건은 빼고 셌어요 — 한 문제는 하루에 한 번이에요.</>
          )}
        </p>
      )}

      {(summary.balance ?? 0) < 0 && (
        <p className="mt-2 rounded-2xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-500">
          쓴 포인트가 번 포인트보다 많아요. 어른에게 확인해 달라고 하세요 🐾
        </p>
      )}
    </section>
  );
}
