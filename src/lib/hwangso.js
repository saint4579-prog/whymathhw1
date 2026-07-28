// [황소 중2상 1차단평대비] 문제집 데이터 로더.
//
// 문제 메타데이터/정답은 구글 시트가 아니라 프로젝트에 포함된 CSV
// (public/data/문항목록.csv)에서 프론트엔드가 직접 읽어온다.
// 문제 이미지는 public/images/hwangso/<학기>/<파일명> 에 들어 있다.

import { HWANGSO_DATA, hwangsoImageUrl } from './hwangsoData';

const CSV_PATH = '/data/문항목록.csv';
const IMAGE_BASE = '/images/hwangso';

// CSV -> 단원 라벨. 파일에는 U1만 있지만, 앞으로 U2/U3가 추가돼도 그대로 동작한다.
const UNIT_LABELS = {
  U1: '1단원',
  U2: '2단원',
  U3: '3단원',
};

// 화면에서 쓸 서브 필터(단원) 목록. 데이터가 아직 없어도 버튼은 항상 노출한다.
export const HWANGSO_UNITS = [
  { id: 'U1', label: '1단원' },
  { id: 'U2', label: '2단원' },
  { id: 'U3', label: '3단원' },
];

// 문항 유형 코드 -> 사람이 읽는 라벨.
const PROB_TYPE_LABELS = {
  Q: '개념 확인',
  E: '예제',
  M: '기본 문제',
  W: '실전 문제',
};

// 문항 제목에 들어갈 짧은 유형 라벨. (Q=개탐, E=예제, M=미션, W=확학)
const TITLE_TYPE_LABELS = {
  Q: '개탐',
  E: '예제',
  M: '미션',
  W: '확학',
};

// 개념탐구(concept_id) -> 실제 개념명. 단원(unit)별로 관리해 U2/U3가 추가돼도 확장 가능하다.
// 1단원(유리수와 순환소수)
const CONCEPT_NAMES = {
  U1: {
    C01: '유한소수와 무한소수',
    C02: '순환소수',
    C03: '순환소수의 분수 표현',
    C04: '순환소수의 사칙연산',
  },
};

export function unitLabel(unit) {
  return UNIT_LABELS[unit] || unit || '';
}

export function probTypeLabel(type) {
  return PROB_TYPE_LABELS[type] || type || '';
}

// 'C01' -> 1 처럼 개념탐구 번호(정수)를 뽑아낸다.
export function conceptNumber(conceptId) {
  const n = parseInt(String(conceptId || '').replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

export function conceptName(unit, conceptId) {
  return CONCEPT_NAMES[unit]?.[conceptId] || '';
}

// 특정 단원의 개념탐구 목록을 순서대로 돌려준다. (요약 통계 패널에서 사용)
// 예: [{ id: 'C01', num: 1, name: '유한소수와 무한소수' }, ...]
export function hwangsoConceptList(unit = 'U1') {
  const map = CONCEPT_NAMES[unit] || {};
  return Object.keys(map)
    .sort()
    .map((id) => ({ id, num: conceptNumber(id), name: map[id] }));
}

// '01' -> '1' 처럼 앞의 0을 없앤다. (숫자가 아니면 원본 유지)
function stripLeadingZero(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? String(value || '') : String(n);
}

// 파일명 요소들을 조합해 학생이 이해하기 쉬운 제목 문자열을 만든다.
// 예) 개념탐구1 _ 개탐1 _유한소수와 무한소수
//     개념탐구1 _ 예제1-1 _유한소수와 무한소수
function buildTitle({ unit, conceptId, probType, mainNum, subNum }) {
  const conceptNum = conceptNumber(conceptId);
  const typeLabel = TITLE_TYPE_LABELS[probType] || probType || '';
  const numberPart = subNum
    ? `${stripLeadingZero(mainNum)}-${subNum}`
    : stripLeadingZero(mainNum);
  const name = conceptName(unit, conceptId);
  return `개념탐구${conceptNum ?? ''} _ ${typeLabel}${numberPart} _${name}`;
}

// 따옴표가 없는 단순 CSV 전용 파서. (문항목록.csv에는 필드 안에 콤마/따옴표가 없다.)
// papaparse 같은 외부 라이브러리 없이도 충분해서 가벼운 유틸로 직접 파싱한다.
function parseCsv(text) {
  // 엑셀이 붙이는 BOM(﻿) 제거 + 윈도우 줄바꿈 정규화
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = clean.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

// CSV 한 줄(row) -> 화면/풀이에서 쓰는 문제 객체.
function toProblem(row, order) {
  const fileName = row.file_name;
  const gradeTerm = row.grade_term || '2-1';
  const mainNum = row.main_num || '';
  const subNum = row.sub_num || '';
  const numberLabel = subNum ? `${mainNum}-${subNum}` : mainNum;

  return {
    // 목록/선택/풀이 큐에서 각 문항을 구분하는 고유 키. (시트가 없으므로 파일명을 그대로 쓴다.)
    rowNumber: fileName,
    code: fileName,
    fileName,
    order,
    gradeTerm,
    unit: row.unit || '',
    unitLabel: unitLabel(row.unit),
    conceptId: row.concept_id || '',
    conceptName: conceptName(row.unit, row.concept_id),
    probType: row.prob_type || '',
    probTypeLabel: probTypeLabel(row.prob_type),
    mainNum,
    subNum,
    numberLabel,
    // 학생이 어떤 개념을 배우는지 한눈에 보이는 제목. (파일명 대신 목록에 노출)
    title: buildTitle({
      unit: row.unit,
      conceptId: row.concept_id,
      probType: row.prob_type,
      mainNum,
      subNum,
    }),
    // 정답: 코드에 내장한 정답표(hwangsoData) 우선, 없으면 CSV 값.
    answer: (HWANGSO_DATA[fileName]?.a ?? '') || row.answer || '',
    // 이미지: 구글 드라이브(lh3, CORS 허용) 우선, 없으면 로컬 public 경로로 폴백.
    imageUrl: hwangsoImageUrl(fileName) || `${IMAGE_BASE}/${gradeTerm}/${fileName}`,
    // 로컬(브라우저) 상태로만 관리하는 채점/복습 정보.
    isCorrect: null,
    reviewCount: 0,
    historyLogs: [],
  };
}

// public/data/문항목록.csv 를 받아 파싱한 문제 목록을 돌려준다.
export async function fetchHwangsoProblems() {
  const res = await fetch(CSV_PATH, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('황소 문항목록.csv 를 불러오지 못했습니다.');
  }
  const text = await res.text();
  const rows = parseCsv(text);
  return rows
    .filter((row) => row.file_name)
    .map((row, index) => toProblem(row, index + 1));
}

// ---------------------------------------------------------------------------
// 채점 기록(O/X) 로컬 저장
// 황소 문제집은 구글 시트가 아니라 CSV 기반이라, 학생의 채점 기록을 브라우저
// localStorage에 학생별로 보관한다. (정답 텍스트가 아니라 O/X 시퀀스만 저장한다.)
// 저장 형태: { [fileName]: ['O','X','O', ...] }
// ---------------------------------------------------------------------------

const RECORDS_KEY_PREFIX = 'hwangso-records';

function recordsKey(userName) {
  return `${RECORDS_KEY_PREFIX}:${userName || 'guest'}`;
}

export function loadHwangsoRecords(userName) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(recordsKey(userName));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveHwangsoRecords(userName, records) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(recordsKey(userName), JSON.stringify(records));
  } catch {
    // 저장소가 막힌 환경에서도 화면 상태(메모리)는 계속 유지된다.
  }
}

// 특정 문제의 채점 결과(O/△/X)를 뒤에 이어 붙이고, 갱신된 그 문제의 기록 배열을 돌려준다.
export function appendHwangsoRecord(userName, fileName, isCorrect) {
  const mark = isCorrect === 'O' ? 'O' : isCorrect === '△' ? '△' : 'X';
  const records = loadHwangsoRecords(userName);
  const list = Array.isArray(records[fileName]) ? [...records[fileName], mark] : [mark];
  records[fileName] = list;
  saveHwangsoRecords(userName, records);
  return list;
}

// O/X 기록 배열 -> 화면 표시용 문자열. 기록이 없으면 '-'.
export function recordsToString(list) {
  return Array.isArray(list) && list.length > 0 ? list.join('') : '-';
}
