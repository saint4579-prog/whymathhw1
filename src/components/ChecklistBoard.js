'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CharacterMascot from './CharacterMascot';
import { saveChecklistMarks, fetchChecklist } from '@/lib/api';
import {
  CHECK_COLUMNS,
  listUnits,
  buildUnitGroups,
  deriveChecks,
  emptyChecks,
  toggleCheck,
  toMark,
  summarizeUnit,
  pointsForCheck,
  CHECKLIST_DAILY_CAP,
} from '@/lib/checklist';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function StatCard({ label, value, tone = 'rose' }) {
  const tones = {
    rose: 'text-rose-500',
    sky: 'text-sky-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-600',
  };
  return (
    <div className="rounded-2xl bg-amber-50 p-3 text-center">
      <p className="text-[11px] font-bold text-stone-400">{label}</p>
      <p className={`text-lg font-extrabold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

/**
 * 종이 학습 체크리스트를 그대로 옮긴 화면.
 *
 * 아이는 종이(또는 문제집)로 풀고 여기서 체크만 한다. 문제 이미지·캔버스·정답은 없다.
 * 체크는 학습기록 시트에 남고, 그 덕분에
 *   - 포인트가 들어온다 (정답 5P / 오답 3P, 하루 최대 200P)
 *   - 체크한 날짜가 망각곡선 복습의 기준이 된다
 *   - 중2-상 1단원은 앱의 문제와 코드가 같아서, 앱에서 푼 것도 여기에 체크로 나타난다
 *     (그래서 같은 문제로 포인트를 두 번 받는 일이 없다)
 */
export default function ChecklistBoard({ hwangsoProblems = [], userName, onPointsAwarded }) {
  const units = useMemo(() => listUnits(), []);
  const [unitId, setUnitId] = useState(units[0]?.id ?? 'M2A1');
  const [openConcepts, setOpenConcepts] = useState(() => new Set());
  // 문제코드 → 체크 상태. 시트에서 불러온 값과 아이가 방금 누른 값이 함께 들어 있다.
  const [checkMap, setCheckMap] = useState({});
  const [savingCode, setSavingCode] = useState(null);
  const [notice, setNotice] = useState(null);
  const [earnedToday, setEarnedToday] = useState(0);

  // 시트에 저장된 체크 상태를 불러온다. 실패해도 화면은 앱 채점 이력으로 채워진다.
  useEffect(() => {
    let alive = true;
    fetchChecklist(userName)
      .then(({ checks, earnedToday: earned }) => {
        if (!alive) return;
        setCheckMap(checks ?? {});
        setEarnedToday(Number(earned) || 0);
      })
      .catch(() => {
        if (alive) setNotice('저장된 체크를 불러오지 못했어요. 체크는 계속 할 수 있어요 🐾');
      });
    return () => {
      alive = false;
    };
  }, [userName]);

  const groups = useMemo(() => buildUnitGroups(unitId, hwangsoProblems), [unitId, hwangsoProblems]);

  // 각 문항의 최종 체크 상태 = 시트에 저장된 값이 있으면 그것, 없으면 앱 채점 이력에서 유추.
  const groupsWithChecks = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        items: g.items.map((it) => ({
          ...it,
          checks: checkMap[it.code] ?? deriveChecks(it.historyLogs),
        })),
      })),
    [groups, checkMap]
  );

  const summary = useMemo(() => summarizeUnit(groupsWithChecks), [groupsWithChecks]);
  const activeUnit = units.find((u) => u.id === unitId);

  const handleToggle = useCallback(
    async (item, key) => {
      const before = checkMap[item.code] ?? deriveChecks(item.historyLogs);
      const after = toggleCheck(before, key, todayKey());

      // 화면은 즉시 바꾼다. 아이가 기다리지 않게.
      setCheckMap((prev) => ({ ...prev, [item.code]: after }));
      setSavingCode(item.code);

      const beforeMark = toMark(before);
      const afterMark = toMark(after);

      try {
        const result = await saveChecklistMarks(userName, [
          { code: item.code, checks: after, mark: afterMark },
        ]);
        const granted = Number(result?.granted) || 0;
        if (granted > 0) {
          setEarnedToday((prev) => prev + granted);
          onPointsAwarded?.(granted);
          setNotice(`체크 완료! 💰 ${granted}P 받았어요 🐾`);
        } else if (afterMark && afterMark !== beforeMark && result?.capped) {
          setNotice(`오늘 체크리스트 포인트는 ${CHECKLIST_DAILY_CAP}P까지예요. 체크는 저장했어요 🐶`);
        } else {
          setNotice(null);
        }
      } catch {
        setNotice('저장이 안 됐어요. 잠시 뒤 다시 눌러 주세요 🐾');
      } finally {
        setSavingCode(null);
      }
    },
    [checkMap, userName, onPointsAwarded]
  );

  const toggleConcept = (code) => {
    setOpenConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* 단원 선택 */}
      <div className="flex flex-wrap gap-2">
        {units.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => {
              setUnitId(u.id);
              setOpenConcepts(new Set());
            }}
            className={`rounded-full px-4 py-2 text-sm font-extrabold shadow-sm transition ${
              unitId === u.id
                ? 'bg-rose-400 text-white shadow-rose-200'
                : 'bg-white text-amber-600 hover:bg-amber-50'
            }`}
          >
            {u.label} · {u.total}문제
            {u.tag && (
              <span className="ml-1 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">{u.tag}</span>
            )}
          </button>
        ))}
      </div>

      {/* 진도 요약 */}
      <section className="rounded-[2rem] border-4 border-white bg-white p-4 shadow-xl shadow-amber-100/70">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CharacterMascot name="fox" height={48} />
            <div>
              <p className="text-xs font-bold text-rose-400">
                🐾 종이로 풀고, 여기에 체크만 하면 돼요
              </p>
              <h3 className="text-lg font-extrabold text-stone-700">
                {activeUnit?.subject ?? ''} 체크리스트
              </h3>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-stone-400">오늘 체크로 받은 포인트</p>
            <p className="text-lg font-extrabold text-amber-600">
              💰 {earnedToday} / {CHECKLIST_DAILY_CAP}P
            </p>
          </div>
        </div>

        <div className="mb-3 h-3 overflow-hidden rounded-full bg-amber-50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-300 to-amber-300 transition-all"
            style={{ width: `${Math.round(summary.progressRate * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="푼 문항" value={`${summary.solved} / ${summary.total}`} tone="rose" />
          <StatCard label="맞음" value={`${summary.correct}개`} tone="emerald" />
          <StatCard label="틀림" value={`${summary.wrong}개`} tone="amber" />
          <StatCard label="다시 풀 것" value={`${summary.todo}개`} tone="sky" />
          <StatCard
            label="정답률"
            value={summary.correct + summary.wrong > 0 ? `${Math.round(summary.accuracy * 100)}%` : '-'}
            tone="emerald"
          />
        </div>

        {activeUnit?.linked ? (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
            ✅ 이 단원은 앱의 문제와 연결돼 있어요. 앱에서 푼 문제는 여기에도 체크가 들어옵니다.
          </p>
        ) : (
          <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700">
            📄 이 단원은 아직 문제 이미지가 없어서 체크만 해요. 종이로 풀고 표시해 주세요.
          </p>
        )}

        {notice && (
          <p className="mt-2 rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-500">{notice}</p>
        )}
      </section>

      {/* 개념별 체크리스트 */}
      <div className="space-y-3">
        {groupsWithChecks.map((group) => {
          const open = openConcepts.has(group.code);
          const gs = summarizeUnit([group]);
          return (
            <section
              key={group.code}
              className="overflow-hidden rounded-3xl border-2 border-amber-100 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleConcept(group.code)}
                className="flex w-full items-center gap-3 bg-amber-50/60 p-4 text-left hover:bg-amber-100/60"
              >
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-amber-700">
                  {group.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold text-stone-700">{group.title}</span>
                  <span className="block text-xs font-bold text-stone-400">
                    {gs.solved} / {gs.total}문항 완료
                    {gs.todo > 0 && <span className="ml-2 text-rose-500">· 다시 풀 것 {gs.todo}개</span>}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-extrabold text-stone-400">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className="overflow-x-auto p-2">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-xs font-extrabold text-stone-400">
                        <th className="p-2 text-left">문항</th>
                        {CHECK_COLUMNS.map((c) => (
                          <th key={c.key} className="p-2 text-center" title={c.hint}>
                            {c.emoji}
                            <span className="ml-0.5 hidden sm:inline">{c.label}</span>
                          </th>
                        ))}
                        <th className="p-2 text-center">날짜</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        const checks = item.checks ?? emptyChecks();
                        const busy = savingCode === item.code;
                        return (
                          <tr
                            key={item.code}
                            className={`border-t border-amber-50 ${
                              checks.done
                                ? 'bg-emerald-50/50'
                                : checks.wrong
                                  ? 'bg-rose-50/40'
                                  : checks.correct
                                    ? 'bg-white'
                                    : 'bg-white'
                            } ${busy ? 'opacity-60' : ''}`}
                          >
                            <td className="p-2">
                              <span className="text-xs font-bold text-stone-400">{item.no}</span>
                              <span className="ml-2 font-extrabold text-stone-600">{item.label}</span>
                            </td>
                            {CHECK_COLUMNS.map((col) => (
                              <td key={col.key} className="p-1 text-center">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleToggle(item, col.key)}
                                  aria-label={`${item.label} ${col.label}`}
                                  aria-pressed={Boolean(checks[col.key])}
                                  className={`h-9 w-9 rounded-xl text-base font-black transition ${
                                    checks[col.key]
                                      ? col.key === 'wrong'
                                        ? 'bg-rose-400 text-white'
                                        : col.key === 'done'
                                          ? 'bg-emerald-400 text-white'
                                          : 'bg-amber-300 text-amber-900'
                                      : 'bg-amber-50 text-stone-300 hover:bg-amber-100'
                                  }`}
                                >
                                  {checks[col.key] ? '✓' : ''}
                                </button>
                              </td>
                            ))}
                            <td className="p-2 text-center text-[11px] font-bold text-stone-400">
                              {checks.date ? checks.date.slice(5) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="p-2 text-center text-[11px] font-bold text-stone-400">
                    맞음 {pointsForCheck('O')}P · 틀림 {pointsForCheck('X')}P · 하루 최대{' '}
                    {CHECKLIST_DAILY_CAP}P
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
