'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import WrongNotebook from '@/components/WrongNotebook';
import ReviewMode from '@/components/ReviewMode';
import ProblemSolver from '@/components/ProblemSolver';
import MockExamSolver from '@/components/MockExamSolver';
import MonthlyPlanner from '@/components/MonthlyPlanner';
import StudyPlanner from '@/components/StudyPlanner';
import RewardStore from '@/components/RewardStore';
import CharacterCollection from '@/components/CharacterCollection';
import LevelUpModal from '@/components/LevelUpModal';
import UserRegistration from '@/components/UserRegistration';
import CharacterMascot from '@/components/CharacterMascot';
import { fetchProblems, redeemPoints, registerUser, submitGrade } from '@/lib/api';
import { toISODate } from '@/lib/dateUtils';
import { getPointsForAnswer } from '@/lib/points';
import { getCollectionState } from '@/lib/levels';
import { sortProblemsByPage } from '@/lib/problemUtils';
import { recordAttempt } from '@/lib/reviewSchedule';

const POINT_HISTORY_KEY = 'dog-math-point-history';
const CURRENT_POINTS_KEY = 'dog-math-current-points';
const USER_INFO_KEY = 'userInfo';
// 마지막으로 축하 모달을 보여준 레벨. 여기에 저장된 값보다 레벨이 오르면 레벨업 모달을 띄운다.
const LEVEL_SEEN_KEY = 'dog-math-level-seen';

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
  // [영재원 대비_모의고사] 문제집. 전체 현황판에서 선택하는 문제집 탭에 따라 이 목록이 노출된다.
  const [mockExamProblems, setMockExamProblems] = useState([]);
  // 전체 현황판에서 어느 문제집 탭이 선택되어 있는지 ('yi' | 'mockExam')
  const [activeWorkbook, setActiveWorkbook] = useState('yi');
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
  // 지금 풀이 중인 문제집. handleGrade에서 어느 목록/시트를 갱신할지 결정하는 데 쓰인다.
  const [solverWorkbook, setSolverWorkbook] = useState('yi');

  // 전체 현황판의 "오늘의 학습 목표" 체크박스 선택 상태 (rowNumber 집합)
  const [selectedRows, setSelectedRows] = useState(new Set());

  // 레벨업 축하 모달로 보여줄, 이번에 새로 얻은 캐릭터 정보. null이면 표시 안 함.
  const [levelUp, setLevelUp] = useState(null);

  // 그동안 모은(누적) 포인트 = 날짜별 학습 통계(dailyStats)의 pointsEarned 총합.
  // 현재 잔액이 아니라 누적값이라, 선물로 포인트를 차감해도 레벨/캐릭터는 줄지 않는다.
  const totalEarnedPoints = useMemo(
    () =>
      Object.values(dailyStats).reduce(
        (sum, stat) => sum + (Number(stat?.pointsEarned) || 0),
        0
      ),
    [dailyStats]
  );
  const collection = useMemo(
    () => getCollectionState(totalEarnedPoints),
    [totalEarnedPoints]
  );

  // 누적 포인트가 늘어 레벨이 오르면 축하 모달을 띄운다.
  // 최초 로딩 시점 레벨은 기준선으로 저장만 하고(모달 없이), 이후 상승분에만 반응한다.
  useEffect(() => {
    if (!userInfo || loading) return;
    let seen = null;
    try {
      const raw = window.localStorage.getItem(LEVEL_SEEN_KEY);
      if (raw != null && raw !== '') seen = Number(raw);
    } catch {
      seen = null;
    }

    if (seen == null || Number.isNaN(seen)) {
      // 이 브라우저에서 처음 확인하는 순간: 지금 레벨을 기준선으로만 저장한다.
      try {
        window.localStorage.setItem(LEVEL_SEEN_KEY, String(collection.level));
      } catch {
        // 저장 실패는 무시 (다음 상승 때 다시 시도)
      }
      return;
    }

    if (collection.level > seen) {
      // seen 다음 칸부터 현재 레벨까지가 이번에 새로 해금된 캐릭터들이다.
      const newNames = collection.characters
        .slice(seen, collection.level)
        .map((entry) => entry.name);
      setLevelUp({ level: collection.level, names: newNames });
      try {
        window.localStorage.setItem(LEVEL_SEEN_KEY, String(collection.level));
      } catch {
        // 저장 실패는 무시
      }
    }
  }, [userInfo, loading, collection]);

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
      setMockExamProblems(Array.isArray(root?.mockExamProblems) ? root.mockExamProblems : []);
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

  const startSolving = (list, rowNumber, label, workbook = 'yi') => {
    const startIndex = rowNumber == null ? 0 : Math.max(list.findIndex((p) => p.rowNumber === rowNumber), 0);
    setSolverQueue(list);
    setSolverIndex(startIndex);
    setSolverLabel(label);
    setSolverWorkbook(workbook);
    setActiveTab('solver');
  };

  const handleSolveFromDashboard = (rowNumber) => startSolving(problems, rowNumber, '전체 문제');

  const handleSolveMockExam = (rowNumber) =>
    startSolving(mockExamProblems, rowNumber, '영재원 대비 모의고사', 'mockExam');

  // 모의고사 현황판에서 체크박스로 고른 문제들만 순서대로 푼다. (오늘의 학습 목표)
  const handleSolveMockGoal = (list) =>
    startSolving(list, null, '오늘의 모의고사 목표', 'mockExam');

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

  const toggleAllRows = (rowNumbers) => {
    const targetRows = Array.isArray(rowNumbers)
      ? rowNumbers
      : problems.map((problem) => problem.rowNumber);
    setSelectedRows((prev) => {
      const next = new Set(prev);
      const allSelected = targetRows.length > 0 && targetRows.every((rowNumber) => prev.has(rowNumber));
      targetRows.forEach((rowNumber) => {
        if (allSelected) next.delete(rowNumber);
        else next.add(rowNumber);
      });
      return next;
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
    // 현재 풀이 중인 문제집이 [영재원 대비_모의고사]면 모의고사문제목록 시트를 갱신하도록 알려준다.
    const isMockExam = solverWorkbook === 'mockExam';
    // code는 학습기록 B열 콘텐츠 코드에 필요하므로 현재 문제에서 직접 전달한다.
    // userName은 학생별로 학습 기록/포인트를 분리해서 저장하기 위해 함께 전달한다.
    const response = await submitGrade(
      problem.rowNumber,
      isCorrect,
      problem.code,
      canvasImage,
      solveTimeSec,
      userInfo?.name,
      isMockExam ? 'mockExam' : undefined
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
        ? getPointsForAnswer(isCorrect)
        : Math.max(0, responseBalance - currentPoints));
    const studiedAt =
      responseRoot?.studiedAt ?? responseRoot?.createdAt ?? new Date().toISOString();
    const historyLog = {
      date: studiedAt,
      isCorrect,
      imageUrl: submittedUrl || '',
      solveTimeSec,
    };

    // 망각곡선 복습 스케줄은 [와이수학-대수-공통수학1] 문제집 전용이다. 모의고사는 시트가 달라
    // rowNumber가 겹칠 수 있으므로 여기서는 스케줄에 기록하지 않는다.
    if (!isMockExam) recordAttempt(problem.rowNumber, isCorrect);
    const applyGradeUpdate = (p) =>
      p.rowNumber === problem.rowNumber
        ? {
            ...p,
            submitted: submittedUrl || p.submitted || true,
            isCorrect,
            reviewCount: (Number(p.reviewCount) || 0) + 1,
            historyLogs: [...(Array.isArray(p.historyLogs) ? p.historyLogs : []), historyLog],
          }
        : p;
    if (isMockExam) {
      setMockExamProblems((prev) => prev.map(applyGradeUpdate));
    } else {
      setProblems((prev) => prev.map(applyGradeUpdate));
    }
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

  // 스터디 플래너에서 하루를 마감하고 달성률만큼 포인트를 받았을 때 호출된다.
  // 서버 저장은 StudyPlanner 안에서 이미 끝났고, 여기서는 헤더 포인트/보상 상점/캐릭터
  // 레벨에 쓰이는 화면 상태만 즉시 갱신한다.
  const handlePlannerPointsAwarded = (amount, dateKey) => {
    const earned = Math.max(0, Math.round(Number(amount) || 0));
    if (earned <= 0) return;

    setDailyStats((prev) => {
      const key = dateKey ?? getLocalDateKey();
      const existingKey = Object.keys(prev).find((k) => toISODate(k) === key) ?? key;
      const previousStat = prev[existingKey] ?? {};
      return {
        ...prev,
        [existingKey]: {
          ...previousStat,
          pointsEarned: (Number(previousStat.pointsEarned) || 0) + earned,
        },
      };
    });

    const pointEntry = {
      id: `planner-${dateKey ?? getLocalDateKey()}-${Date.now()}`,
      type: 'EARN_POINT',
      item: '스터디 플래너 달성',
      amount: earned,
      date: new Date().toISOString(),
    };
    setPointHistory((prev) => {
      const next = mergeEntries(pointEntry, prev);
      writeLocalValue(POINT_HISTORY_KEY, next);
      return next;
    });
    setCurrentPoints((prev) => {
      const next = prev + earned;
      window.localStorage.setItem(CURRENT_POINTS_KEY, String(next));
      return next;
    });
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
        level={collection.level}
      />
      <div className="p-4 md:p-6">
        {loading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="flex items-end gap-3">
              <CharacterMascot name="hedgehog" height={56} delay={0} />
              <CharacterMascot name="chick" height={64} delay={200} />
              <CharacterMascot name="penguin" height={56} delay={400} />
            </div>
            <p className="text-lg text-amber-700">🐾 강아지가 문제를 물어오는 중... 🐶</p>
          </div>
        )}
        {!loading && error && (
          <div className="py-20 text-center">
            <div className="mb-3 flex justify-center">
              <CharacterMascot name="raccoon" height={72} animate="wiggle" />
            </div>
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
            activeWorkbook={activeWorkbook}
            onWorkbookChange={setActiveWorkbook}
            mockExamProblems={mockExamProblems}
            onSolveMockExam={handleSolveMockExam}
            onSolveMockGoal={handleSolveMockGoal}
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
        {!loading && !error && activeTab === 'solver' && solverWorkbook === 'mockExam' && (
          <MockExamSolver
            queue={solverQueue}
            setQueue={setSolverQueue}
            index={solverIndex}
            setIndex={setSolverIndex}
            onGrade={handleGrade}
            queueLabel={solverLabel}
            onFinish={() => setActiveTab('dashboard')}
          />
        )}
        {!loading && !error && activeTab === 'solver' && solverWorkbook !== 'mockExam' && (
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
        {!loading && !error && activeTab === 'studyPlanner' && (
          <StudyPlanner
            userName={userInfo?.name}
            onPointsAwarded={handlePlannerPointsAwarded}
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
        {!loading && !error && activeTab === 'collection' && (
          <CharacterCollection totalEarned={totalEarnedPoints} />
        )}
      </div>

      {/* 레벨업 축하 모달: 문제 풀이(채점) 중에는 방해되지 않도록 미루고, 그 외 화면에서 보여준다. */}
      {levelUp && activeTab !== 'solver' && (
        <LevelUpModal
          level={levelUp.level}
          names={levelUp.names}
          onClose={() => setLevelUp(null)}
        />
      )}
    </main>
  );
}
