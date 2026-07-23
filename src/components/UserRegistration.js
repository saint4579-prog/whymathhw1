'use client';

import { useState } from 'react';

const GENDER_OPTIONS = [
  { value: '', label: '선택' },
  { value: '남', label: '남' },
  { value: '여', label: '여' },
];

// 최초 접속 시 1회만 노출되는 사용자 등록 화면. onSubmit이 실패하면 에러 메시지만 보여주고 화면에 남는다.
export default function UserRegistration({ onSubmit }) {
  const [grade, setGrade] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const numericGrade = Number(grade);

    if (!grade || !Number.isFinite(numericGrade) || numericGrade <= 0) {
      setError('학년을 숫자로 입력해주세요.');
      return;
    }
    if (!trimmedName) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!gender) {
      setError('성별을 선택해주세요.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ grade: numericGrade, name: trimmedName, gender });
    } catch (submitError) {
      setError(submitError.message || '등록에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 via-rose-50/40 to-amber-50 p-4">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-white bg-white p-6 shadow-2xl shadow-amber-100/70 sm:p-8">
        <div className="mb-6 text-center">
          <p className="text-4xl">🐶🐾</p>
          <h1 className="mt-3 text-xl font-extrabold text-stone-700">
            처음 오셨네요. 정보를 입력해 주세요.
          </h1>
          <p className="mt-1 text-sm font-semibold text-amber-500">
            멍멍이가 우리 친구를 기억할 수 있게 알려주세요!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-bold text-stone-600">
            학년
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              placeholder="예: 4"
              className="mt-2 w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 outline-none focus:border-rose-300"
            />
          </label>

          <label className="block text-sm font-bold text-stone-600">
            이름
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 김지윤"
              className="mt-2 w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 outline-none focus:border-rose-300"
            />
          </label>

          <label className="block text-sm font-bold text-stone-600">
            성별
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="mt-2 w-full rounded-2xl border-2 border-amber-200 bg-white px-4 py-3 outline-none focus:border-rose-300"
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-center text-sm font-bold text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-emerald-400 py-3 font-extrabold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? '🐾 등록하는 중이에요...' : '등록하고 시작하기 🐶'}
          </button>
        </form>
      </div>
    </div>
  );
}
