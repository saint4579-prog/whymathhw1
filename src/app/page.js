'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import WrongNotebook from '@/components/WrongNotebook';
import ReviewMode from '@/components/ReviewMode';
import ProblemSolver from '@/components/ProblemSolver';
import { fetchProblems, submitGrade } from '@/lib/api';
import { sortProblemsByPage } from '@/lib/problemUtils';
import { recordAttempt } from '@/lib/reviewSchedule';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const data = await fetchProblems();
      setProblems(sortProblemsByPage(Array.isArray(data) ? data : []));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

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
  const handleGrade = async (problem, isCorrect, canvasImage) => {
    const response = await submitGrade(problem.rowNumber, isCorrect, problem.code, canvasImage);
    const submittedUrl =
      response?.submittedUrl ||
      response?.canvasImageUrl ||
      response?.imageUrl ||
      response?.url ||
      (typeof response?.submitted === 'string' ? response.submitted : null);
    recordAttempt(problem.rowNumber, isCorrect);
    setProblems((prev) =>
      prev.map((p) =>
        p.rowNumber === problem.rowNumber
          ? {
              ...p,
              submitted: submittedUrl || p.submitted || true,
              isCorrect,
            }
          : p
      )
    );
    return response;
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50/40 to-amber-50 pb-10">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
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
            index={solverIndex}
            setIndex={setSolverIndex}
            onGrade={handleGrade}
            queueLabel={solverLabel}
          />
        )}
      </div>
    </main>
  );
}
