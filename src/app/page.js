'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import WrongNotebook from '@/components/WrongNotebook';
import ReviewMode from '@/components/ReviewMode';
import ProblemSolver from '@/components/ProblemSolver';
import MockExamSolver from '@/components/MockExamSolver';
import HwangsoSolver from '@/components/HwangsoSolver';
import MonthlyPlanner from '@/components/MonthlyPlanner';
import StudyPlanner from '@/components/StudyPlanner';
import TodayTodo from '@/components/TodayTodo';
import RewardStore from '@/components/RewardStore';
import CharacterCollection from '@/components/CharacterCollection';
import LevelUpModal from '@/components/LevelUpModal';
import UserRegistration from '@/components/UserRegistration';
import CharacterMascot from '@/components/CharacterMascot';
import Village from '@/components/Village';
import { fetchProblems, redeemPoints, registerUser, submitGrade, fetchPlanner, patchPlanner } from '@/lib/api';
import { fetchHwangsoProblems, loadHwangsoRecords, appendHwangsoRecord } from '@/lib/hwangso';
import { loadExams, saveExams, normalizeExams, pickPrimaryExam, examToConfig } from '@/lib/smartSchedule';
import { toISODate } from '@/lib/dateUtils';
import { getPointsForAnswer } from '@/lib/points';
import { getCollectionState } from '@/lib/levels';
import { CHARACTERS } from '@/lib/characters';
import {
  VILLAGE_ICON,
  clampLevel,
  MAX_HOUSE_LEVEL,
  houseLevelFromPointLogs,
} from '@/lib/villageAssets';
import { sortProblemsByPage, isSolved, solvedToday } from '@/lib/problemUtils';
import { recordAttempt, clearLegacyScheduleKey } from '@/lib/reviewSchedule';

const POINT_HISTORY_KEY = 'dog-math-point-history';
const USER_INFO_KEY = 'userInfo';

// 아이마다 따로 담아 두어야 하는 값들.
//
// 예전에는 이름 없이 한 칸에만 저장했다. 그래서 같은 브라우저에서 다른 아이디로
// 들어가면 앞사람의 집 단계·포인트가 그대로 보였다. (시트를 비워도 남아 있었다)
// 이제 키 뒤에 이름을 붙여 서로 섞이지 않게 한다.
const CURRENT_POINTS_BASE = 'dog-math-current-points';
// 마지막으로 축하 모달을 보여준 레벨. 여기에 저장된 값보다 레벨이 오르면 레벨업 모달을 띄운다.
const LEVEL_SEEN_BASE = 'dog-math-level-seen';
const HOUSE_LEVEL_BASE = 'village-house-level';

/** 'dog-math-current-points' + '오지윤' → 'dog-math-current-points:오지윤' */
function userKey(base, userName) {
  return `${base}:${String(userName ?? '').trim() || 'guest'}`;
}

// 이름 없이 저장하던 시절의 값. 남아 있으면 새 아이디에게도 계속 보이므로 한 번 지운다.
// 지워도 손해가 없다 — 포인트·집 단계·레벨은 모두 시트에서 다시 받아 온다.
const LEGACY_KEYS = [CURRENT_POINTS_BASE, LEVEL_SEEN_BASE, HOUSE_LEVEL_BASE];
function clearLegacyKeys() {
  try {
    LEGACY_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // 저장소를 못 쓰는 환경이면 그냥 넘어간다.
  }
}

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
  // [황소 중2상 1차단평대비] 문제집. public/data/문항목록.csv 를 프론트에서 직접 파싱해 채운다.
  const [hwangsoProblems, setHwangsoProblems] = useState([]);
  // 구글 시트가 내려준, 시트에 없는 문제집(황소 등)의 채점 이력. { 문제코드: [{date,isCorrect,...}] }
  // CSV 로딩보다 시트 응답이 먼저 오기도 하고 나중에 오기도 해서, state가 아니라 ref로 들고
  // 양쪽 중 나중에 도착한 쪽이 목록을 다시 조립하게 한다.
  const hwangsoSheetLogsRef = useRef({});
  // 여러 개의 시험 대비 설정(배열). 월간 플래너에서 추가/수정/삭제하고, 달력에 표시된다.
  const [exams, setExams] = useState([]);
  // 시험 설정을 GAS(구글 시트)에서 불러오는 중인지 여부. (월간 플래너 로딩 표시용)
  const [examConfigLoading, setExamConfigLoading] = useState(true);
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

  // [멍멍 마을] 열림 여부와 집 단계.
  // 집 단계는 플래너 블롭에 함께 저장해 기기를 바꿔도 유지된다.
  const [villageOpen, setVillageOpen] = useState(false);
  const [houseLevel, setHouseLevel] = useState(1);

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

  // 마을에 내보낼 캐릭터: 지금까지 해금한 아이들의 '한글 이름'
  const villageCast = useMemo(
    () =>
      collection.characters
        .filter((entry) => entry.unlocked)
        .map((entry) => CHARACTERS[entry.name]?.label)
        .filter(Boolean),
    [collection]
  );

  // 망각곡선 복습 대상: 세 교재를 모두 합친다.
  // 복습 화면에서 대분류(교재)로 골라 볼 수 있으므로 섞여도 헷갈리지 않는다.
  const reviewProblems = useMemo(
    () => [...problems, ...mockExamProblems, ...hwangsoProblems],
    [problems, mockExamProblems, hwangsoProblems]
  );

  // 여러 시험 중 "가장 임박한 시험 1개"를 기존 examConfig 형태로 파생한다.
  // (스터디 플래너 추천 목표 / 오늘 할 일 스마트 시간표는 기존처럼 이 값 하나만 사용)
  const examConfig = useMemo(() => examToConfig(pickPrimaryExam(exams)), [exams]);

  // 누적 포인트가 늘어 레벨이 오르면 축하 모달을 띄운다.
  // 최초 로딩 시점 레벨은 기준선으로 저장만 하고(모달 없이), 이후 상승분에만 반응한다.
  useEffect(() => {
    if (!userInfo || loading) return;
    let seen = null;
    try {
      const raw = window.localStorage.getItem(userKey(LEVEL_SEEN_BASE, userInfo?.name));
      if (raw != null && raw !== '') seen = Number(raw);
    } catch {
      seen = null;
    }

    if (seen == null || Number.isNaN(seen)) {
      // 이 브라우저에서 처음 확인하는 순간: 지금 레벨을 기준선으로만 저장한다.
      try {
        window.localStorage.setItem(userKey(LEVEL_SEEN_BASE, userInfo?.name), String(collection.level));
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
        window.localStorage.setItem(userKey(LEVEL_SEEN_BASE, userInfo?.name), String(collection.level));
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
      const savedPointValue = window.localStorage.getItem(userKey(CURRENT_POINTS_BASE, userInfo?.name));
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
      // 황소처럼 시트에 문제 행이 없는 문제집의 채점 이력을 받아 둔다.
      hwangsoSheetLogsRef.current =
        root?.externalLogs && typeof root.externalLogs === 'object' ? root.externalLogs : {};
      // 이미 CSV 목록이 그려진 뒤에 시트 응답이 왔다면, 여기서 이력을 덧입힌다.
      setHwangsoProblems((prev) =>
        prev.length === 0
          ? prev
          : prev.map((p) => {
              const sheetLogs = Array.isArray(hwangsoSheetLogsRef.current[p.code])
                ? hwangsoSheetLogsRef.current[p.code]
                : [];
              if (sheetLogs.length <= (p.historyLogs?.length ?? 0)) return p;
              const last = sheetLogs[sheetLogs.length - 1];
              return {
                ...p,
                historyLogs: sheetLogs,
                reviewCount: sheetLogs.length,
                isCorrect: last ? last.isCorrect : p.isCorrect,
                submitted: true,
              };
            })
      );
      writeLocalValue(POINT_HISTORY_KEY, mergedPointHistory);
      window.localStorage.setItem(userKey(CURRENT_POINTS_BASE, userInfo?.name), String(loadedPoints));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 접속 시 1회만 사용자 등록을 받는다: localStorage에 userInfo가 있으면 바로 메인 화면으로 진입한다.
  useEffect(() => {
    try {
      clearLegacyKeys();
      clearLegacyScheduleKey();
      const raw = window.localStorage.getItem(USER_INFO_KEY);
      setUserInfo(raw ? JSON.parse(raw) : null);
    } catch {
      setUserInfo(null);
    }
  }, []);

  useEffect(() => {
    if (userInfo) loadProblems();
  }, [loadProblems, userInfo]);

  // [황소 중2상 1차단평대비] 문제 목록을 CSV에서 한 번 불러온다.
  // 실패해도 다른 문제집 사용에는 지장이 없으므로 조용히 빈 목록으로 둔다.
  useEffect(() => {
    if (!userInfo) return;
    let cancelled = false;
    fetchHwangsoProblems()
      .then((list) => {
        if (cancelled) return;
        // 과거 채점 기록을 두 곳에서 읽어 합친다.
        //  - localStorage: 이 기기에서 푼 기록. O/△/X 세 단계가 그대로 남아 있다.
        //  - 구글 시트(externalLogs): 어느 기기에서 풀었든 남는 기록. 단 △는 X로 저장된다.
        // 둘 중 기록이 더 많은 쪽을 그 문제의 진짜 이력으로 본다.
        // 그래서 다른 기기(아이패드 등)에서 푼 것도 이 기기에서 보이고,
        // 이 기기에서 방금 푼 △ 표시도 시트 때문에 X로 뭉개지지 않는다.
        const records = loadHwangsoRecords(userInfo?.name);
        setHwangsoProblems(
          list.map((p) => {
            const localMarks = Array.isArray(records[p.fileName]) ? records[p.fileName] : [];
            const sheetLogs = Array.isArray(hwangsoSheetLogsRef.current[p.code])
              ? hwangsoSheetLogsRef.current[p.code]
              : [];
            const useSheet = sheetLogs.length > localMarks.length;
            const historyLogs = useSheet
              ? sheetLogs
              : localMarks.map((mark) => ({ isCorrect: mark }));
            const last = historyLogs.length > 0 ? historyLogs[historyLogs.length - 1] : null;
            return {
              ...p,
              historyLogs,
              reviewCount: historyLogs.length,
              // 상태 뱃지는 가장 최근 채점 결과를 따른다.
              isCorrect: last ? last.isCorrect : null,
              submitted: historyLogs.length > 0,
            };
          })
        );
      })
      .catch(() => {
        if (!cancelled) setHwangsoProblems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userInfo]);

  // 저장해 둔 집 단계를 불러온다. (화면을 바로 채우기 위한 임시값)
  //
  // 진짜 근거는 아래 '포인트 기록으로 집 단계 맞추기'다.
  // 여기서 읽는 값은 시트 응답이 오기 전 잠깐 보여 주는 용도일 뿐이다.
  useEffect(() => {
    if (!userInfo) return undefined;
    let cancelled = false;
    try {
      const local = window.localStorage.getItem(userKey(HOUSE_LEVEL_BASE, userInfo?.name));
      if (local) setHouseLevel(clampLevel(local));
    } catch {
      // 저장소가 막혀 있으면 1단계로 시작한다.
    }
    fetchPlanner(userInfo?.name)
      .then(({ planner }) => {
        if (cancelled || !planner) return;
        if (planner.houseLevel != null) setHouseLevel(clampLevel(planner.houseLevel));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userInfo]);

  // 포인트 기록으로 집 단계를 맞춘다.
  //
  // 집을 올릴 때마다 '멍멍 마을 집 4단계' 내역이 포인트기록 시트에 남는다.
  // 그게 아이가 실제로 포인트를 낸 증거라서, 브라우저나 플래너에 적힌 값보다 믿을 만하다.
  // (기기를 바꾸거나 예전 저장값이 남아 있으면 엉뚱한 단계가 보일 수 있다)
  useEffect(() => {
    if (!userInfo || pointLogs.length === 0) return;
    const owned = houseLevelFromPointLogs(pointLogs);
    setHouseLevel((prev) => {
      if (prev === owned) return prev;
      // 어긋난 값을 이 기기에도 바로잡아 둔다.
      try {
        window.localStorage.setItem(userKey(HOUSE_LEVEL_BASE, userInfo?.name), String(owned));
      } catch {
        // 저장 실패는 화면에 영향이 없다.
      }
      patchPlanner(userInfo?.name, { houseLevel: owned }).catch(() => {});
      return owned;
    });
  }, [userInfo, pointLogs]);

  // 시험 목록(배열)을 불러온다.
  // 1) 즉시 localStorage 캐시로 화면을 채우고, 2) GAS(플래너 블롭)에서 최신값을 받아 덮어쓴다.
  //    구버전 단일 examConfig 블롭도 normalizeExams로 배열로 자동 마이그레이션한다.
  useEffect(() => {
    if (!userInfo) return undefined;
    let cancelled = false;
    setExamConfigLoading(true);
    setExams(loadExams(userInfo?.name)); // 빠른 표시: 로컬 캐시 먼저
    (async () => {
      try {
        const { planner } = await fetchPlanner(userInfo?.name);
        if (!cancelled && planner) {
          const remoteExams = normalizeExams(planner.exams ?? planner.examConfig);
          if (remoteExams.length > 0) {
            setExams(remoteExams);
            saveExams(userInfo?.name, remoteExams); // 로컬 캐시 동기화
          }
        }
      } catch {
        // GAS 미연동/실패 시 로컬 캐시값을 그대로 사용한다.
      } finally {
        if (!cancelled) setExamConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userInfo]);

  // 월간 플래너에서 시험을 추가/수정/삭제하면 즉시 화면/캐시에 반영하고 GAS에도 영구 저장한다.
  const handleExamsChange = useCallback(
    (nextExams) => {
      const list = Array.isArray(nextExams) ? nextExams : [];
      setExams(list);
      saveExams(userInfo?.name, list); // 로컬 캐시(즉시)
      patchPlanner(userInfo?.name, { exams: list }); // GAS 영구 저장(비동기, 실패 시 캐시 유지)
    },
    [userInfo]
  );

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
    // 오늘 이미 푼 문제는 줄에서 빼고 시작한다.
    // 목록의 배지만 잠그면, 여러 문제를 묶어 푸는 '오늘의 목표' 경로로 들어올 때
    // 오늘 푼 문제가 다시 나온다. 화면이 낡았을 때도 여기서 걸러진다.
    const playable = list.filter((p) => !solvedToday(p) || p.rowNumber === rowNumber);
    const queue = playable.length > 0 ? playable : list;
    const startIndex =
      rowNumber == null ? 0 : Math.max(queue.findIndex((p) => p.rowNumber === rowNumber), 0);
    setSolverQueue(queue);
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

  const handleSolveHwangso = (rowNumber) =>
    startSolving(hwangsoProblems, rowNumber, '황소 중2상 1차단평대비', 'hwangso');

  const handleSolveHwangsoGoal = (list) =>
    startSolving(list, null, '오늘의 황소 목표', 'hwangso');

  // 황소 채점: ①브라우저 O/△/X 기록 ②망각곡선 복습 스케줄 ③구글 시트 학습기록(정답여부/푼날짜)에 모두 남긴다.
  // 학습기록/복습은 O/X 기준이라 △는 X(다시 볼 것)로 매핑해 기록한다. (화면 뱃지는 △ 그대로 유지)
  const handleGradeHwangso = async (problem, isCorrect, canvasImage, solveTimeSec, typedAnswer = '') => {
    const gasMark = isCorrect === 'O' ? 'O' : 'X'; // 시트/복습용 O·X (△·X → X)

    // ① 브라우저 로컬 O/△/X 기록
    const marks = appendHwangsoRecord(userInfo?.name, problem.fileName, isCorrect);
    setHwangsoProblems((prev) =>
      prev.map((p) =>
        p.rowNumber === problem.rowNumber
          ? {
              ...p,
              submitted: true,
              isCorrect,
              reviewCount: marks.length,
              historyLogs: marks.map((mark) => ({ isCorrect: mark })),
            }
          : p
      )
    );

    // ② 망각곡선 복습 스케줄: 오늘 풀었으니 내일부터 복습 대상으로 뜬다.
    recordAttempt(problem.rowNumber, gasMark, userInfo?.name);

    // ③ 구글 시트 학습기록에 남긴다. (콘텐츠 코드=파일명, 정답여부, 푼 날짜, 학생 이름)
    //    실패해도 로컬 기록/복습은 유지되도록 조용히 무시한다.
    try {
      await submitGrade(
        problem.rowNumber,
        gasMark,
        problem.code,
        canvasImage ?? null,
        solveTimeSec ?? 1,
        userInfo?.name,
        // 반드시 'hwangso'를 넘겨야 한다.
        // 황소는 CSV 기반이라 시트에 대응하는 행이 없는데, 이 값을 빼먹으면 백엔드가
        // 문제목록 시트의 rowNumber번째 행이라고 착각해 엉뚱한 문제의 제출답/정답여부를
        // 덮어써 버린다. 이 값이 있으면 학습기록에만 남긴다.
        'hwangso',
        typedAnswer
      );
    } catch {
      // 시트 기록 실패는 무시 (다음 풀이 때 다시 시도)
    }
  };

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
  const handleGrade = async (problem, isCorrect, canvasImage, solveTimeSec, typedAnswer = '') => {
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
      isMockExam ? 'mockExam' : undefined,
      // 펜 대신 키보드로 낸 답. 학습기록 G열에 남는다.
      typedAnswer
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
    if (!isMockExam) recordAttempt(problem.rowNumber, isCorrect, userInfo?.name);
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
      window.localStorage.setItem(userKey(CURRENT_POINTS_BASE, userInfo?.name), String(responseBalance));
    } else if (pointsEarned > 0) {
      setCurrentPoints((prev) => {
        const next = prev + pointsEarned;
        window.localStorage.setItem(userKey(CURRENT_POINTS_BASE, userInfo?.name), String(next));
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
      window.localStorage.setItem(userKey(CURRENT_POINTS_BASE, userInfo?.name), String(next));
      return next;
    });
  };

  // 집 업그레이드: 포인트를 실제로 차감하고(시트 반영) 단계를 올린다.
  const handleUpgradeHouse = async (nextLevel, cost) => {
    const level = clampLevel(nextLevel);
    if (level > MAX_HOUSE_LEVEL) throw new Error('이미 최고 단계예요!');
    if (currentPoints < cost) throw new Error('포인트가 조금 모자라요 🐾');

    // 보상 상점과 같은 방식으로 차감한다. 포인트기록 시트에 내역이 남는다.
    await handleRedeemPoints(`멍멍 마을 집 ${level}단계`, cost);

    setHouseLevel(level);
    try {
      window.localStorage.setItem(userKey(HOUSE_LEVEL_BASE, userInfo?.name), String(level));
    } catch {
      // 저장 실패해도 이번 화면에서는 올라간 단계가 보인다.
    }
    // 기기를 바꿔도 유지되도록 플래너 블롭에도 남긴다.
    patchPlanner(userInfo?.name, { houseLevel: level }).catch(() => {});
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
    window.localStorage.setItem(userKey(CURRENT_POINTS_BASE, userInfo?.name), String(nextBalance));
    setPointHistory((prev) => {
      const next = mergeEntries(pointEntry, prev);
      writeLocalValue(POINT_HISTORY_KEY, next);
      return next;
    });
    setPointLogs((prev) => [pointEntry, ...prev]);
    return response;
  };

  // 로그아웃: 누가 쓰고 있는지만 지운다.
  //
  // 공부 기록·포인트·호감도는 이름별로 저장되고 시트에도 남아 있으므로,
  // 같은 이름으로 다시 들어오면 그대로 이어서 쓸 수 있다.
  // (여기서 기록까지 지우면 형제가 번갈아 쓸 때 서로의 기록이 날아간다)
  const handleLogout = useCallback(() => {
    try {
      window.localStorage.removeItem(USER_INFO_KEY);
    } catch {
      // 저장소를 못 쓰는 환경이어도 화면 전환은 되어야 한다.
    }
    setUserInfo(null);
  }, []);

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
        userName={userInfo?.name}
        onLogout={handleLogout}
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
            hwangsoProblems={hwangsoProblems}
            userName={userInfo?.name}
            onChecklistPoints={handlePlannerPointsAwarded}
            onSolveHwangso={handleSolveHwangso}
            onSolveHwangsoGoal={handleSolveHwangsoGoal}
          />
        )}
        {!loading && !error && activeTab === 'wrongNotes' && (
          <WrongNotebook problems={problems} onSolve={handleSolveFromWrongNotes} />
        )}
        {!loading && !error && activeTab === 'review' && (
          <ReviewMode
            problems={reviewProblems}
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
        {!loading && !error && activeTab === 'solver' && solverWorkbook === 'hwangso' && (
          <HwangsoSolver
            queue={solverQueue}
            setQueue={setSolverQueue}
            index={solverIndex}
            setIndex={setSolverIndex}
            onGrade={handleGradeHwangso}
            queueLabel={solverLabel}
            onFinish={() => setActiveTab('dashboard')}
          />
        )}
        {!loading && !error && activeTab === 'solver' && solverWorkbook === 'yi' && (
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
        {!loading && !error && activeTab === 'todo' && (
          <TodayTodo
            userName={userInfo?.name}
            examConfig={examConfig}
            completedProblems={hwangsoProblems.filter(isSolved).length}
          />
        )}
        {!loading && !error && activeTab === 'studyPlanner' && (
          <StudyPlanner
            userName={userInfo?.name}
            onPointsAwarded={handlePlannerPointsAwarded}
            examConfig={examConfig}
            completedProblems={hwangsoProblems.filter(isSolved).length}
          />
        )}
        {!loading && !error && activeTab === 'planner' && (
          <MonthlyPlanner
            dailyStats={dailyStats}
            exams={exams}
            onExamsChange={handleExamsChange}
            examConfigLoading={examConfigLoading}
          />
        )}
        {!loading && !error && activeTab === 'store' && (
          <RewardStore
            currentPoints={currentPoints}
            dailyStats={dailyStats}
            pointLogs={pointLogs}
            onRedeem={handleRedeemPoints}
            userName={userInfo?.name}
          />
        )}
        {!loading && !error && activeTab === 'collection' && (
          <CharacterCollection totalEarned={totalEarnedPoints} />
        )}
      </div>

      {/* 멍멍 마을 입구 아이콘. 어느 화면에서든 눌러서 들어갈 수 있다. */}
      {!villageOpen && activeTab !== 'solver' && (
        <button
          type="button"
          onClick={() => setVillageOpen(true)}
          aria-label="멍멍 마을 열기"
          className="fixed bottom-5 right-5 z-40 rounded-full border-4 border-white bg-amber-50 p-1 shadow-2xl transition hover:-translate-y-1 hover:bg-amber-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={VILLAGE_ICON}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="h-16 w-16 select-none object-contain sm:h-20 sm:w-20"
          />
          <span className="block pb-0.5 text-center text-[11px] font-extrabold text-rose-500">
            멍멍 마을
          </span>
        </button>
      )}

      {villageOpen && (
        <Village
          unlockedNames={villageCast}
          currentPoints={currentPoints}
          houseLevel={houseLevel}
          userName={userInfo?.name}
          onUpgrade={handleUpgradeHouse}
          onClose={() => setVillageOpen(false)}
        />
      )}

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
