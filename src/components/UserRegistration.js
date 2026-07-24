'use client';

import { useState } from 'react';
import CharacterMascot from './CharacterMascot';

const GENDER_OPTIONS = [
  { value: '', label: '선택' },
  { value: '남', label: '남' },
  { value: '여', label: '여' },
];

// 등록된 이름은 로그인하고, 처음 온 이름만 새 사용자로 저장한다.
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
          <div className="flex items-end justify-center gap-1.5">
            <CharacterMascot name="penguin" height={50} delay={0} />
            <CharacterMascot name="frog" height={54} delay={160} />
            <CharacterMascot name="chick" height={58} delay={320} />
            <CharacterMascot name="fox" height={54} delay={480} />
            <CharacterMascot name="dog" height={50} delay={640} />
          </div>
          <h1 className="mt-3 text-xl font-extrabold text-stone-700">
            이름을 입력하고 시작해요!
          </h1>
          <p className="mt-1 text-sm font-semibold text-amber-500">
            등록된 이름이면 바로 로그인하고, 처음 온 친구만 새로 등록해요.
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
            {submitting ? '🐾 멍멍이가 확인하는 중이에요...' : '로그인 / 처음 시작하기 🐶'}
          </button>
        </form>
      </div>
    </div>
  );
}
