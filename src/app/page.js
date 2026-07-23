'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import WrongNotebook from '@/components/WrongNotebook';
import ReviewMode from '@/components/ReviewMode';
import ProblemSolver from '@/components/ProblemSolver';
import MonthlyPlanner from '@/components/MonthlyPlanner';
import RewardStore from '@/components/RewardStore';
import UserRegistration from '@/components/UserRegistration';
import { fetchProblems, redeemPoints, registerUser, submitGrade } from '@/lib/api';
import { toISODate } from '@/lib/dateUtils';
import { sortProblemsByPage } from '@/lib/problemUtils';
import { recordAttempt } from '@/lib/reviewSchedule';

const POINT_HISTORY_KEY = 'dog-math-point-history';
const CURRENT_POINTS_KEY = 'dog-math-current-points';
const USER_INFO_KEY = 'userInfo';

function readLocalArray(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeLocalValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장소가 막힌 환경에서도 현재 화면의 상태는 계속 유지한다.
  }
}

function entryKey(entry) {
  return (
    entry.id ??
    entry.recordId ??
    [
      entry.studyDate ?? entry.date ?? entry.studiedAt ?? entry.createdAt ?? entry.timestamp,
      entry.rowNumber,
      entry.code ?? entry.contentCode ?? entry.item,
      entry.isCorrect,
      entry.solveTimeSec,
      entry.amount ?? entry.points,
    ].join('|')
  );
}

function mergeEntries(...lists) {
  const merged = new Map();
  lists.flat().forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    merged.set(entryKey(entry), entry);
  });
  return [...merged.values()].sort((a, b) => {
    const aDate = new Date(a.studiedAt ?? a.createdAt ?? a.date ?? a.timestamp ?? 0).getTime();
    const bDate = new Date(b.studiedAt ?? b.createdAt ?? b.date ?? b.timestamp ?? 0).getTime();
    return bDate - aDate;
  });
}

function getPayloadRoot(payload) {
  return payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
}

function getNumericValue(source, keys) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function getPointDelta(entry) {
  const amount = Number(entry?.amount ?? entry?.points ?? entry?.point ?? 0) || 0;
  const type = String(entry?.type ?? entry?.action ?? '').toUpperCase();
  return type.includes('REDEEM') || type.includes('USE') || type.includes('SPEND')
    ? -Math.abs(amount)
    : amount;
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export default function Home() {
  // undefined: 아직 localStorage 확인 전, null: 미등록(등록 화면 노출), object: 등록 완료
  const [userInfo, setUserInfo] = useState(undefined);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pointHistory, setPointHistory] = useState([]);
  const [currentPoints, setCurrentPoints] = useState(0);
  // 보상 상점 화면용 원본 데이터: 백엔드가 실제로 내려주는 필드는
  // dailyStats(날짜별 학습 통계)와 pointLogs(엄마가 차감한 내역)이다.
  const [dailyStats, setDailyStats] = useState({});
  const [pointLogs, setPointLogs] = useState([]);

  // 현재 풀이 세션(문제풀기 탭)에서 순회할 문제 목록과 인덱스.
  // 어느 탭에서 [풀기]를 눌렀는지에 따라 전체 목록/오답노트/망각곡선 복습/오늘의 학습 목표 중 하나가 들어간다.
  const [solverQueue, setSolverQueue] = useState([]);
  const [solverIndex, setSolverIndex] = useState(0);
  const [solverLabel, setSolverLabel] = useState('');

  // 전체 현황판의 "오늘의 학습 목표" 체크박스 선택 상태 (rowNumber 집합)
  const [selectedRows, setSelectedRows] = useState(new Set());

  const loadProblems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchProblems();
      const root = getPayloadRoot(payload);
      const problemList = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : root?.problems ?? root?.items ?? [];
      const remotePointHistory =
        root?.pointHistory ?? root?.pointRecords ?? root?.rewardHistory ?? [];
      const localPointHistory = readLocalArray(POINT_HISTORY_KEY);
      const mergedPointHistory = mergeEntries(remotePointHistory, localPointHistory);
      const savedPointValue = window.localStorage.getItem(CURRENT_POINTS_KEY);
      const historyBalance = Math.max(
        0,
        mergedPointHistory.reduce((sum, entry) => sum + getPointDelta(entry), 0)
      );
      const savedPoints =
        savedPointValue == null ? historyBalance : Number(savedPointValue) || 0;
      const loadedPoints =
        getNumericValue(root, ['currentPoints', 'pointBalance', 'currentBalance', 'balance']) ??
        savedPoints;

      setProblems(sortProblemsByPage(Array.isArray(problemList) ? problemList : []));
      setPointHistory(mergedPointHistory);
      setCurrentPoints(loadedPoints);
      setDailyStats(
        root?.dailyStats && typeof root.dailyStats === 'object' && !Array.isArray(root.dailyStats)
          ? root.dailyStats
          : {}
      );
      setPointLogs(Array.isArray(root?.pointLogs) ? root.pointLogs : []);
      writeLocalValue(POINT_HISTORY_KEY, mergedPointHistory);
      window.localStorage.setItem(CURRENT_POINTS_KEY, String(loadedPoints));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 접속 시 1회만 사용자 등록을 받는다: localStorage에 userInfo가 있으면 바로 메인 화면으로 진입한다.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_INFO_KEY);
      setUserInfo(raw ? JSON.parse(raw) : null);
    } catch {
      setUserInfo(null);
    }
  }, []);

  useEffect(() => {
    if (userInfo) loadProblems();
  }, [loadProblems, userInfo]);

  const handleRegisterUser = async ({ grade, name, gender }) => {
    const response = await registerUser(grade, name, gender);
    const responseRoot = getPayloadRoot(response);
    const data = {
      grade,
      name,
      gender,
      registeredAt: new Date().toISOString(),
      ...(responseRoot && typeof responseRoot === 'object' && !Array.isArray(responseRoot)
        ? responseRoot
        : {}),
    };
    window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(data));
    setUserInfo(data);
  };

  const startSolving = (list, rowNumber, label) => {
    const startIndex = rowNumber == null ? 0 : Math.max(list.findIndex((p) => p.rowNumber === rowNumber), 0);
    setSolverQueue(list);
    setSolverIndex(startIndex);
    setSolverLabel(label);
    setActiveTab('solver');
  };

  const handleSolveFromDashboard = (rowNumber) => startSolving(problems, rowNumber, '전체 문제');

  const handleSolveFromWrongNotes = (rowNumber) => {
    const wrongList = problems.filter((p) => p.isCorrect === 'X');
    startSolving(wrongList, rowNumber, '오답노트');
  };

  const handleSolveFromReview = (rowNumber, dueProblems) => startSolving(dueProblems, rowNumber, '망각곡선 복습');

  const handleStartReview = (dueProblems) => startSolving(dueProblems, null, '망각곡선 복습');

  const handleSetDailyGoal = () => {
    const goalList = problems.filter((p) => selectedRows.has(p.rowNumber));
    startSolving(goalList, null, '오늘의 학습 목표');
  };

  const toggleRow = (rowNumber) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const toggleAllRows = () => {
    setSelectedRows((prev) => {
      const allSelected = problems.length > 0 && problems.every((p) => prev.has(p.rowNumber));
      return allSelected ? new Set() : new Set(problems.map((p) => p.rowNumber));
    });
  };

  // 쪽수 범위 선택: 전달받은 rowNumber 목록을 기존 선택에 더하거나(select) 뺀다(deselect)
  const selectRowNumbers = (rowNumbers) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      rowNumbers.forEach((rn) => next.add(rn));
      return next;
    });
  };

  const deselectRowNumbers = (rowNumbers) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      rowNumbers.forEach((rn) => next.delete(rn));
      return next;
    });
  };

  // ProblemSolver에서 O/X 채점 시 호출: 구글 시트로 결과 전송 + 로컬 복습 스케줄 갱신 + 상태 갱신
  const handleGrade = async (problem, isCorrect, canvasImage, solveTimeSec) => {
    // code는 학습기록 B열 콘텐츠 코드에 필요하므로 현재 문제에서 직접 전달한다.
    // userName은 학생별로 학습 기록/포인트를 분리해서 저장하기 위해 함께 전달한다.
    const response = await submitGrade(
      problem.rowNumber,
      isCorrect,
      problem.code,
      canvasImage,
      solveTimeSec,
      userInfo?.name
    );
    const responseRoot = getPayloadRoot(response);
    const submittedUrl =
      responseRoot?.submittedUrl ||
      responseRoot?.canvasImageUrl ||
      responseRoot?.imageUrl ||
      responseRoot?.url ||
      (typeof responseRoot?.submitted === 'string' ? responseRoot.submitted : null);
    const responseBalance = getNumericValue(responseRoot, [
      'currentPoints',
      'pointBalance',
      'currentBalance',
      'balance',
    ]);
    const explicitEarnedPoints =
      getNumericValue(responseRoot, ['pointsEarned', 'earnedPoints', 'rewardPoints']) ??
      getNumericValue(responseRoot?.pointRecord, ['amount', 'points']);
    const pointsEarned =
      explicitEarnedPoints ??
      (responseBalance == null
        ? isCorrect === 'O'
          ? 20
          : 10
        : Math.max(0, responseBalance - currentPoints));
    const studiedAt =
      responseRoot?.studiedAt ?? responseRoot?.createdAt ?? new Date().toISOString();
    const historyLog = {
      date: studiedAt,
      isCorrect,
      imageUrl: submittedUrl || '',
      solveTimeSec,
    };

    recordAttempt(problem.rowNumber, isCorrect);
    setProblems((prev) =>
      prev.map((p) =>
        p.rowNumber === problem.rowNumber
          ? {
              ...p,
              submitted: submittedUrl || p.submitted || true,
              isCorrect,
              reviewCount: (Number(p.reviewCount) || 0) + 1,
              historyLogs: [...(Array.isArray(p.historyLogs) ? p.historyLogs : []), historyLog],
            }
          : p
      )
    );
    setDailyStats((prev) => {
      const todayKey = getLocalDateKey();
      const existingKey =
        Object.keys(prev).find((key) => toISODate(key) === todayKey) ?? todayKey;
      const previousStat = prev[existingKey] ?? {};
      return {
        ...prev,
        [existingKey]: {
          ...previousStat,
          solvedCount: (Number(previousStat.solvedCount) || 0) + 1,
          totalTimeSec: (Number(previousStat.totalTimeSec) || 0) + solveTimeSec,
          pointsEarned: (Number(previousStat.pointsEarned) || 0) + pointsEarned,
        },
      };
    });

    if (pointsEarned > 0) {
      const pointEntry = {
        id: responseRoot?.pointRecord?.id ?? `earn-${problem.rowNumber}-${Date.now()}`,
        type: 'EARN_POINT',
        item: problem.code,
        amount: pointsEarned,
        date: studiedAt,
        ...(responseRoot?.pointRecord ?? {}),
      };
      setPointHistory((prev) => {
        const next = mergeEntries(pointEntry, prev);
        writeLocalValue(POINT_HISTORY_KEY, next);
        return next;
      });
    }

    if (responseBalance != null) {
      setCurrentPoints(responseBalance);
      window.localStorage.setItem(CURRENT_POINTS_KEY, String(responseBalance));
    } else if (pointsEarned > 0) {
      setCurrentPoints((prev) => {
        const next = prev + pointsEarned;
        window.localStorage.setItem(CURRENT_POINTS_KEY, String(next));
        return next;
      });
    }
    return response;
  };

  const handleRedeemPoints = async (item, amount) => {
    const response = await redeemPoints(item, amount, userInfo?.name);
    const responseRoot = getPayloadRoot(response);
    const nextBalance =
      getNumericValue(responseRoot, [
        'currentPoints',
        'pointBalance',
        'currentBalance',
        'balance',
      ]) ?? Math.max(0, currentPoints - amount);
    const redeemedAt = responseRoot?.createdAt ?? responseRoot?.redeemedAt ?? new Date().toISOString();
    const pointEntry = {
      id: responseRoot?.pointRecord?.id ?? `redeem-${Date.now()}`,
      type: 'REDEEM_POINT',
      item,
      amount: -Math.abs(amount),
      date: redeemedAt,
      ...(responseRoot?.pointRecord ?? {}),
    };

    setCurrentPoints(nextBalance);
    window.localStorage.setItem(CURRENT_POINTS_KEY, String(nextBalance));
    setPointHistory((prev) => {
      const next = mergeEntries(pointEntry, prev);
      writeLocalValue(POINT_HISTORY_KEY, next);
      return next;
    });
    setPointLogs((prev) => [pointEntry, ...prev]);
    return response;
  };

  // 등록 여부 확인 전에는 아무것도 그리지 않아 깜빡임을 막는다.
  if (userInfo === undefined) return null;

  // userInfo가 없으면(미등록) 메인 앱을 숨기고 등록 화면만 전체 화면으로 보여준다.
  if (userInfo === null) {
    return <UserRegistration onSubmit={handleRegisterUser} />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50/40 to-amber-50 pb-10">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentPoints={currentPoints}
      />
      <div className="p-4 md:p-6">
        {loading && <p className="py-20 text-center text-lg text-amber-700">🐾 강아지가 문제를 물어오는 중... 🐶</p>}
        {!loading && error && (
          <div className="py-20 text-center">
            <p className="mb-3 text-rose-500">🐶 앗, 문제를 가져오지 못했어요. {error}</p>
            <button
              type="button"
              onClick={loadProblems}
              className="rounded-full bg-rose-400 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-100/60 hover:bg-rose-500"
            >
              다시 시도 🐾
            </button>
          </div>
        )}
        {!loading && !error && activeTab === 'dashboard' && (
          <Dashboard
            problems={problems}
            onSolve={handleSolveFromDashboard}
            selectedRows={selectedRows}
            onToggleRow={toggleRow}
            onToggleAll={toggleAllRows}
            onSetDailyGoal={handleSetDailyGoal}
            onSelectRange={selectRowNumbers}
            onDeselectRange={deselectRowNumbers}
          />
        )}
        {!loading && !error && activeTab === 'wrongNotes' && (
          <WrongNotebook problems={problems} onSolve={handleSolveFromWrongNotes} />
        )}
        {!loading && !error && activeTab === 'review' && (
          <ReviewMode
            problems={problems}
            onSolve={handleSolveFromReview}
            onStartReview={handleStartReview}
          />
        )}
        {!loading && !error && activeTab === 'solver' && (
          <ProblemSolver
            queue={solverQueue}
            setQueue={setSolverQueue}
            index={solverIndex}
            setIndex={setSolverIndex}
            onGrade={handleGrade}
            queueLabel={solverLabel}
            onFinish={() => setActiveTab('dashboard')}
          />
        )}
        {!loading && !error && activeTab === 'planner' && (
          <MonthlyPlanner dailyStats={dailyStats} />
        )}
        {!loading && !error && activeTab === 'store' && (
          <RewardStore
            currentPoints={currentPoints}
            dailyStats={dailyStats}
            pointLogs={pointLogs}
            onRedeem={handleRedeemPoints}
          />
        )}
      </div>
    </main>
  );
}
