var PROBLEM_SHEET_NAME = '문제목록';
var MOCK_EXAM_SHEET_NAME = '모의고사문제목록';
var STUDY_LOG_SHEET_NAME = '학습기록';
var POINT_LOG_SHEET_NAME = '포인트기록';
var USER_SHEET_NAME = '사용자정보';
// 스터디 플래너/시험 대비 설정/학원 숙제를 사용자별 JSON 한 덩어리로 저장하는 시트.
var PLANNER_SHEET_NAME = '플래너';
// 날짜별 하루 계획. 한 행 = 사용자 1명의 하루.
var PLANNER_DAY_SHEET_NAME = '플래너일자';
// 종이 학습 체크리스트. 한 행 = 사용자 1명의 문항 1개.
var CHECKLIST_SHEET_NAME = '체크리스트';
// 포인트가 어떻게 계산됐는지 사람이 눈으로 검사하는 탭
var POINT_SUMMARY_SHEET_NAME = '포인트정산';
// 마을 동물이 내는 국어 어휘 퀴즈와, 돌아다니며 말하는 공부 명언
var VOCAB_SHEET_NAME = '필수 국어 어휘';
var QUOTE_SHEET_NAME = '공부명대사';

// 체크리스트로 받는 포인트. 직접 풀고 채점하는 것(정답 20P)보다 낮게 둔다.
// 종이로 풀고 체크만 하는 것이라 앱이 실제 풀이를 확인할 수 없기 때문이다.
// 값을 바꿀 때는 프론트엔드의 src/lib/checklist.js도 같이 수정해야 한다.
var CHECKLIST_POINTS_CORRECT = 5;
var CHECKLIST_POINTS_WRONG = 3;
// 하루에 체크리스트로 받을 수 있는 상한.
// 584문항을 마구 체크해서 하루에 만 포인트를 버는 일을 막는다.
var CHECKLIST_DAILY_CAP = 200;
// 학습기록 H열(출처)에 남기는 표식. 이 값이 있는 행은 체크리스트에서 온 것이다.
var CHECKLIST_SOURCE = '체크리스트';
var PROBLEM_IMAGE_FOLDER_ID = '1QPpZq4iDvnVVaswFQd6YLgY2d4IEGbqG';
var ANSWER_IMAGE_FOLDER_ID = '1YOtQiOrjbxDh3DNwgdwkA65C9bkbdhDr';
var TIME_ZONE = 'Asia/Seoul';

// 채점 결과로 지급되는 포인트의 단일 기준값.
// 값을 바꿀 때는 프론트엔드 폴백인 src/lib/points.js도 같이 수정해야 한다.
var POINTS_PER_CORRECT = 20;
var POINTS_PER_WRONG = 10;

function pointsForAnswer(isCorrect) {
  return isCorrect === 'O' ? POINTS_PER_CORRECT : POINTS_PER_WRONG;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDateTime(date) {
  return Utilities.formatDate(date, TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
}

function formatDateKey(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TIME_ZONE, 'yyyy-MM-dd');
  }

  var raw = String(value);
  var directMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (directMatch) {
    return directMatch[1] + '-' +
      ('0' + directMatch[2]).slice(-2) + '-' +
      ('0' + directMatch[3]).slice(-2);
  }

  var parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? '' : Utilities.formatDate(parsed, TIME_ZONE, 'yyyy-MM-dd');
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

// ---------------------------------------------------------------------------
// 스터디 플래너 저장/조회 (사용자별 JSON 블롭)
// planner 블롭 = { goals, days, examConfig, academyHomework, ... } 형태의 자유 JSON.
// ---------------------------------------------------------------------------

// 하루치 계획은 '플래너일자' 시트에 한 행씩 따로 저장한다.
//
// 왜 나눴나: 예전에는 { goals, days:{ '2026-07-27': {...}, ... } } 전체를 '플래너' 시트의
// 셀 하나에 넣었다. 하루에 1.4KB씩 쌓이는데 시트 셀 한도가 5만 자여서, 한 달쯤 쓰면
// 저장이 갑자기 멈춘다. 체크 한 번 할 때마다 지금까지의 전 기간을 왕복으로 주고받는
// 문제도 있었다.
//
// 이제 '플래너'에는 목표(goals)·시험·학원숙제처럼 날짜와 무관한 것만 남고,
// 날짜별 계획은 '플래너일자'에 하루=한 행으로 들어간다. 하루치는 절대 한도에 닿지 않고,
// 저장할 때 오늘 행 하나만 쓰므로 요청도 훨씬 작아진다.
function getPlannerDaySheet(ss) {
  return getOrCreateSheet(ss, PLANNER_DAY_SHEET_NAME, ['사용자', '날짜', '계획JSON', '수정일시']);
}

/**
 * 날짜별 계획을 '플래너일자'에 반영한다.
 * 이미 있는 날짜는 그 행만 덮어쓰고, 없는 날짜는 새 행으로 붙인다.
 * (넘어오지 않은 날짜는 건드리지 않는다. 그래서 오늘 것만 보내도 지난 기록이 지워지지 않는다.)
 */
function writePlannerDays(ss, userName, days, now) {
  var dateKeys = [];
  for (var k in days) {
    if (Object.prototype.hasOwnProperty.call(days, k)) dateKeys.push(k);
  }
  if (dateKeys.length === 0) return;

  var sheet = getPlannerDaySheet(ss);
  var data = sheet.getDataRange().getValues();

  // 이미 있는 (사용자, 날짜) → 행 번호
  var rowByDate = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() !== userName) continue;
    var existing = formatDateKey(data[i][1]);
    if (existing) rowByDate[existing] = i + 1;
  }

  var newRows = [];
  for (var d = 0; d < dateKeys.length; d++) {
    var dateKey = dateKeys[d];
    var json = JSON.stringify(days[dateKey] || {});
    // 하루치가 셀 한도에 닿는 일은 사실상 없지만, 만약을 대비해 잘라 낸다.
    if (json.length > 45000) json = JSON.stringify({ error: 'too_large', date: dateKey });
    if (rowByDate[dateKey]) {
      sheet.getRange(rowByDate[dateKey], 3, 1, 2).setValues([[json, now]]);
    } else {
      newRows.push([userName, dateKey, json, now]);
    }
  }
  // 새 날짜들은 한 번에 붙여서 호출 횟수를 줄인다.
  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
  }
}

/**
 * [1회 실행] 예전 구조에서 새 구조로 옮긴다.
 *
 * 실행 방법: 앱스 스크립트 편집기 함수 목록에서 'migratePlannerDays'를 고르고 ▶ 실행.
 * (편집기 함수 목록이 한글 이름을 잘 못 잡는 경우가 있어 영문 이름으로 두었다.)
 * '플래너' 셀 하나에 뭉쳐 있던 days를 '플래너일자'의 날짜별 행으로 쪼개고,
 * 원래 셀의 days는 빈 객체로 비운다. 두 번 실행해도 안전하다.
 */
function migratePlannerDays() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PLANNER_SHEET_NAME);
  if (!sheet) return '플래너 시트가 없습니다.';

  var data = sheet.getDataRange().getValues();
  var now = formatDateTime(new Date());
  var moved = 0;
  var report = [];

  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0] || '').trim();
    if (!name) continue;
    var blob;
    try {
      blob = JSON.parse(data[i][1] || 'null');
    } catch (e) {
      report.push(name + ': JSON을 읽을 수 없어 건너뜀');
      continue;
    }
    if (!blob || !blob.days) continue;

    var count = 0;
    for (var k in blob.days) {
      if (Object.prototype.hasOwnProperty.call(blob.days, k)) count++;
    }
    if (count === 0) continue;

    writePlannerDays(ss, name, blob.days, now);
    blob.days = {};
    sheet.getRange(i + 1, 2).setValue(JSON.stringify(blob));
    sheet.getRange(i + 1, 3).setValue(now);
    moved += count;
    report.push(name + ': ' + count + '일치 이전');
  }

  var message = '옮긴 날짜 수: ' + moved + '\n' + report.join('\n');
  Logger.log(message);
  return message;
}

function getPlannerForUser(ss, userName) {
  var name = String(userName || '').trim();
  var base = null;

  var sheet = ss.getSheetByName(PLANNER_SHEET_NAME);
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() === name) {
        try {
          base = JSON.parse(data[i][1] || 'null');
        } catch (e) {
          base = null;
        }
        break;
      }
    }
  }
  if (!base) base = {};

  // 날짜별 계획을 모아 붙인다.
  // base.days에 값이 남아 있으면 아직 옮기지 않은 예전 데이터이므로 바탕으로 깔고,
  // 같은 날짜가 '플래너일자'에도 있으면 그쪽(새 구조)을 우선한다.
  var days = base.days && typeof base.days === 'object' ? base.days : {};
  var daySheet = ss.getSheetByName(PLANNER_DAY_SHEET_NAME);
  if (daySheet) {
    var dayData = daySheet.getDataRange().getValues();
    for (var d = 1; d < dayData.length; d++) {
      if (String(dayData[d][0] || '').trim() !== name) continue;
      var dateKey = formatDateKey(dayData[d][1]);
      if (!dateKey) continue;
      try {
        days[dateKey] = JSON.parse(dayData[d][2] || 'null') || days[dateKey];
      } catch (e2) {
        // 깨진 행은 건너뛴다. 나머지 날짜는 정상적으로 열린다.
      }
    }
  }
  base.days = days;
  return base;
}

function savePlannerForUser(ss, userName, planner) {
  var sheet = getOrCreateSheet(ss, PLANNER_SHEET_NAME, ['사용자', '플래너JSON', '수정일시']);
  var name = String(userName || '').trim();
  var incoming = planner || {};
  var now = formatDateTime(new Date());

  // ① 날짜별 계획은 '플래너일자'로 넘긴다.
  var days = incoming.days && typeof incoming.days === 'object' ? incoming.days : {};
  writePlannerDays(ss, name, days, now);

  // ② '플래너' 시트에는 날짜와 무관한 것만 남긴다. (days는 빈 객체로 비워 둔다)
  var base = {};
  for (var key in incoming) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    if (key === 'days') continue;
    base[key] = incoming[key];
  }
  base.days = {};

  var json = JSON.stringify(base);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === name) {
      sheet.getRange(i + 1, 2).setValue(json);
      sheet.getRange(i + 1, 3).setValue(now);
      return;
    }
  }
  sheet.appendRow([name, json, now]);
}

// ---------------------------------------------------------------------------
// 포인트 정산
//
// 잔액이 어떻게 나온 숫자인지 한 곳에서만 계산한다.
// 예전에는 화면에 쓰는 계산과 잔액 계산이 따로 있어서, 규칙을 하나 고치면
// 다른 쪽이 어긋났다. 이제 buildPointSummary 하나만 고치면 된다.
//
// 규칙
//   문제 하나당 딱 한 번만 포인트를 준다. 가장 먼저 채점된 기록을 쓴다.
//   (예전에는 같은 문제를 다시 풀 때마다 또 들어가서, 한 문제를 반복해 누르면
//    포인트가 계속 불어났다)
//   맞음 20P / 틀림 10P. 체크리스트로 체크한 것은 5P / 3P이고 하루 200P까지.
//   플래너 달성과 사용(차감)은 포인트기록 시트에 적힌 그대로 더한다.
// ---------------------------------------------------------------------------

function buildPointSummary(ss, userName) {
  var solve = { correct: 0, wrong: 0, points: 0 };
  var check = { correct: 0, wrong: 0, points: 0, capped: 0 };
  var repeats = 0;

  var studySheet = ss.getSheetByName(STUDY_LOG_SHEET_NAME);
  if (studySheet) {
    var studyData = studySheet.getDataRange().getValues();
    var seen = {};                 // 이미 포인트를 준 (사용자, 문제코드)
    var checklistByDate = {};      // 체크리스트는 날짜별 상한이 있어 따로 모은다
    for (var i = 1; i < studyData.length; i++) {
      var user = String(studyData[i][5] || '').trim();
      if (userName && user !== userName) continue;
      var answer = studyData[i][2];
      if (answer !== 'O' && answer !== 'X') continue;

      var code = String(studyData[i][1] || '').trim();
      var key = user + '|' + code;
      if (code && seen[key]) { repeats++; continue; }
      if (code) seen[key] = true;

      if (String(studyData[i][7] || '').trim() === CHECKLIST_SOURCE) {
        var dateKey = formatDateKey(studyData[i][0]) || 'unknown';
        checklistByDate[dateKey] = (checklistByDate[dateKey] || 0) +
          (answer === 'O' ? CHECKLIST_POINTS_CORRECT : CHECKLIST_POINTS_WRONG);
        if (answer === 'O') check.correct++; else check.wrong++;
      } else {
        if (answer === 'O') solve.correct++; else solve.wrong++;
        solve.points += pointsForAnswer(answer);
      }
    }
    for (var dk in checklistByDate) {
      if (!Object.prototype.hasOwnProperty.call(checklistByDate, dk)) continue;
      var raw = checklistByDate[dk];
      var given = Math.min(raw, CHECKLIST_DAILY_CAP);
      check.points += given;
      check.capped += (raw - given);   // 상한에 걸려 못 받은 양
    }
  }

  var planner = { count: 0, points: 0 };
  var spent = { count: 0, points: 0 };
  var logs = [];
  var pointSheet = ss.getSheetByName(POINT_LOG_SHEET_NAME);
  if (pointSheet) {
    var pointData = pointSheet.getDataRange().getValues();
    for (var j = 1; j < pointData.length; j++) {
      var pUser = String(pointData[j][3] || '').trim();
      if (userName && pUser !== userName) continue;
      var amount = Number(pointData[j][2]) || 0;
      if (amount >= 0) { planner.count++; planner.points += amount; }
      else { spent.count++; spent.points += amount; }
      logs.push({ date: pointData[j][0], item: pointData[j][1], amount: amount, user: pUser });
    }
  }

  var earned = solve.points + check.points + planner.points;
  return {
    user: userName || '(전체)',
    solve: solve,
    checklist: check,
    planner: planner,
    spent: spent,
    repeatsIgnored: repeats,
    earned: earned,
    balance: earned + spent.points,
    logs: logs
  };
}

function getCurrentPoints(ss, userName) {
  return buildPointSummary(ss, userName).balance;
}

/** 사용자정보 시트에 등록된 이름들. 없으면 학습기록에서 이름을 긁어 온다. */
function listUserNames(ss) {
  var names = {};
  var userSheet = ss.getSheetByName(USER_SHEET_NAME);
  if (userSheet) {
    var data = userSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var n = String(data[i][2] || '').trim();
      if (n) names[n] = true;
    }
  }
  var studySheet = ss.getSheetByName(STUDY_LOG_SHEET_NAME);
  if (studySheet) {
    var sd = studySheet.getDataRange().getValues();
    for (var j = 1; j < sd.length; j++) {
      var m = String(sd[j][5] || '').trim();
      if (m) names[m] = true;
    }
  }
  var out = [];
  for (var k in names) if (Object.prototype.hasOwnProperty.call(names, k)) out.push(k);
  out.sort();
  return out;
}

/**
 * [포인트정산] 탭을 다시 그린다.
 * 스프레드시트 메뉴 [멍멍 수학] → [포인트 정산 새로고침] 에서 부른다.
 */
function writePointSummarySheet(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, POINT_SUMMARY_SHEET_NAME, []);
  sheet.clear();

  var rows = [];
  rows.push(['멍멍 수학 포인트 정산', '', '', '', '', '']);
  rows.push(['만든 시각', formatDateTime(new Date()), '', '', '', '']);
  rows.push(['', '', '', '', '', '']);
  rows.push(['이름', '항목', '개수', '단가', '포인트', '설명']);

  var names = listUserNames(ss);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var s = buildPointSummary(ss, name);
    rows.push([name, '문제 풀이 (맞음)', s.solve.correct, POINTS_PER_CORRECT,
      s.solve.correct * POINTS_PER_CORRECT, '앱에서 직접 풀고 맞은 문제']);
    rows.push([name, '문제 풀이 (틀림)', s.solve.wrong, POINTS_PER_WRONG,
      s.solve.wrong * POINTS_PER_WRONG, '틀려도 푼 것은 인정']);
    rows.push([name, '체크리스트 (맞음)', s.checklist.correct, CHECKLIST_POINTS_CORRECT, '',
      '종이로 풀고 체크한 것']);
    rows.push([name, '체크리스트 (틀림)', s.checklist.wrong, CHECKLIST_POINTS_WRONG, '', '']);
    rows.push([name, '체크리스트 합계 (하루 ' + CHECKLIST_DAILY_CAP + 'P 상한 적용)', '', '',
      s.checklist.points,
      s.checklist.capped > 0 ? ('상한에 걸려 못 받은 ' + s.checklist.capped + 'P 있음') : '']);
    rows.push([name, '플래너 달성 등', s.planner.count, '', s.planner.points,
      '포인트기록 시트에 적힌 적립']);
    rows.push([name, '번 포인트 합계', '', '', s.earned, '']);
    rows.push([name, '쓴 포인트', s.spent.count, '', s.spent.points, '집 업그레이드·보상 교환']);
    rows.push([name, '남은 포인트', '', '', s.balance, '']);
    rows.push([name, '다시 푼 기록 (포인트 없음)', s.repeatsIgnored, '', 0,
      '같은 문제는 처음 채점한 것만 포인트를 준다']);
    rows.push(['', '', '', '', '', '']);
  }

  sheet.getRange(1, 1, rows.length, 6).setValues(rows);
  sheet.getRange(1, 1, 1, 6).merge().setFontWeight('bold').setFontSize(14);
  sheet.getRange(4, 1, 1, 6).setFontWeight('bold').setBackground('#FDE68A');
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(6, 320);
  return { status: 'success', users: names.length };
}

/** 스프레드시트를 열면 상단에 메뉴를 만들어 준다. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('멍멍 수학')
    .addItem('포인트 정산 새로고침', 'refreshPointSummary')
    .addToUi();
}

function refreshPointSummary() {
  var result = writePointSummarySheet(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getActiveSpreadsheet().toast(
    result.users + '명의 포인트를 정산했어요.', '멍멍 수학', 5);
}

// ---------------------------------------------------------------------------
// 학습 체크리스트
//
// 아이가 종이로 풀고 앱에서 체크만 하는 화면. 저장은 두 곳에 나뉜다.
//   '체크리스트' 시트 : 풀기/맞음/틀림/다시/완료 다섯 칸과 날짜. 화면 복원용.
//   '학습기록' 시트   : 채점 결과 O/X. 포인트와 망각곡선 복습이 여기를 보기 때문이다.
//
// 포인트를 두 번 주지 않는 방법:
//   학습기록은 (사용자, 문제코드)에 대해 체크리스트발 행을 딱 하나만 유지한다.
//   같은 문항을 다시 체크하면 그 행을 고쳐 쓰고, 차액만 포인트로 준다.
//   나중에 아이가 앱에서 그 문제를 직접 풀면 일반 채점 행이 따로 쌓이는데,
//   그건 실제로 더 한 일이므로 정당한 추가 포인트다.
// ---------------------------------------------------------------------------

function getChecklistSheet(ss) {
  return getOrCreateSheet(ss, CHECKLIST_SHEET_NAME,
    ['사용자', '문제코드', '풀기', '맞음', '틀림', '다시', '완료', '날짜', '메모', '수정일시']);
}

function checkFlag(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

/** 오늘 체크리스트로 이미 받은 포인트 합계 */
function getChecklistPointsToday(ss, userName, todayKey) {
  var sheet = ss.getSheetByName(STUDY_LOG_SHEET_NAME);
  if (!sheet) return 0;
  var data = sheet.getDataRange().getValues();
  var total = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][5] || '').trim() !== userName) continue;
    if (String(data[i][7] || '').trim() !== CHECKLIST_SOURCE) continue;
    if (formatDateKey(data[i][0]) !== todayKey) continue;
    var mark = data[i][2];
    total += mark === 'O' ? CHECKLIST_POINTS_CORRECT : mark === 'X' ? CHECKLIST_POINTS_WRONG : 0;
  }
  // 화면에 보여주는 값도 상한을 넘지 않게 한다. 실제 잔액 계산(getCurrentPoints)과 같은 규칙.
  return Math.min(total, CHECKLIST_DAILY_CAP);
}

function doGetChecklist(ss, userName) {
  var checks = {};
  var sheet = ss.getSheetByName(CHECKLIST_SHEET_NAME);
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() !== userName) continue;
      var code = String(data[i][1] || '').trim();
      if (!code) continue;
      checks[code] = {
        solved: checkFlag(data[i][2]),
        correct: checkFlag(data[i][3]),
        wrong: checkFlag(data[i][4]),
        retry: checkFlag(data[i][5]),
        done: checkFlag(data[i][6]),
        date: formatDateKey(data[i][7]) || '',
        memo: String(data[i][8] || '')
      };
    }
  }
  return {
    status: 'success',
    checks: checks,
    earnedToday: getChecklistPointsToday(
      ss, userName, Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd'))
  };
}

function handleSaveChecklist(ss, params) {
  var userName = String(params.userName || '').trim();
  if (!userName) throw new Error('사용자 이름이 없습니다.');
  var entries = params.entries || [];
  if (!entries.length) return jsonResponse({ status: 'success', granted: 0, capped: false });

  var now = new Date();
  var todayKey = Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd');
  var nowText = formatDateTime(now);

  // ① 체크 상태를 '체크리스트' 시트에 upsert
  var sheet = getChecklistSheet(ss);
  var data = sheet.getDataRange().getValues();
  var rowByCode = {};
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() !== userName) continue;
    rowByCode[String(data[i][1] || '').trim()] = i + 1;
  }

  var appendRows = [];
  for (var e = 0; e < entries.length; e++) {
    var entry = entries[e] || {};
    var code = String(entry.code || '').trim();
    if (!code) continue;
    var c = entry.checks || {};
    var row = [
      userName, code,
      !!c.solved, !!c.correct, !!c.wrong, !!c.retry, !!c.done,
      String(c.date || ''), String(c.memo || '').slice(0, 200), nowText
    ];
    if (rowByCode[code]) {
      sheet.getRange(rowByCode[code], 1, 1, row.length).setValues([row]);
    } else {
      appendRows.push(row);
    }
  }
  if (appendRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, 10).setValues(appendRows);
  }

  // ② 채점 결과(O/X)를 학습기록에 반영. 포인트는 여기서 계산된다.
  var studySheet = getOrCreateSheet(ss, STUDY_LOG_SHEET_NAME,
    ['풀이 일시', '콘텐츠 코드', '정답여부', '풀이 이미지 URL', '학습시간(초)', '학생 이름', '타이핑 답', '출처']);
  if (studySheet.getRange(1, 8).getValue() === '') {
    studySheet.getRange(1, 8).setValue('출처').setFontWeight('bold');
  }

  var studyData = studySheet.getDataRange().getValues();
  // 이 사용자의 '체크리스트발' 행만 코드별로 찾아 둔다. (일반 채점 행은 건드리지 않는다)
  var studyRowByCode = {};
  var earnedToday = 0;
  for (var s = 1; s < studyData.length; s++) {
    if (String(studyData[s][5] || '').trim() !== userName) continue;
    if (String(studyData[s][7] || '').trim() !== CHECKLIST_SOURCE) continue;
    studyRowByCode[String(studyData[s][1] || '').trim()] = s + 1;
    if (formatDateKey(studyData[s][0]) === todayKey) {
      var m = studyData[s][2];
      earnedToday += m === 'O' ? CHECKLIST_POINTS_CORRECT : m === 'X' ? CHECKLIST_POINTS_WRONG : 0;
    }
  }

  var granted = 0;
  var capped = false;
  var newStudyRows = [];

  for (var k = 0; k < entries.length; k++) {
    var it = entries[k] || {};
    var itCode = String(it.code || '').trim();
    if (!itCode) continue;
    var mark = it.mark === 'O' ? 'O' : it.mark === 'X' ? 'X' : '';
    var existingRow = studyRowByCode[itCode];

    if (!mark) {
      // 채점 단계가 아니다(풀기만 체크). 예전에 남긴 체크리스트 행이 있으면 비운다.
      if (existingRow) studySheet.getRange(existingRow, 3).setValue('');
      continue;
    }

    var value = mark === 'O' ? CHECKLIST_POINTS_CORRECT : CHECKLIST_POINTS_WRONG;
    var previous = 0;
    if (existingRow) {
      var prevMark = studySheet.getRange(existingRow, 3).getValue();
      previous = prevMark === 'O' ? CHECKLIST_POINTS_CORRECT
        : prevMark === 'X' ? CHECKLIST_POINTS_WRONG : 0;
    }
    var delta = value - previous;

    // 하루 상한을 넘는 만큼은 주지 않는다. 체크 자체는 그대로 저장된다.
    if (delta > 0 && earnedToday + granted + delta > CHECKLIST_DAILY_CAP) {
      var room = Math.max(0, CHECKLIST_DAILY_CAP - earnedToday - granted);
      if (room <= 0) capped = true;
      delta = Math.min(delta, room);
      if (delta <= 0) capped = true;
    }

    if (existingRow) {
      studySheet.getRange(existingRow, 1).setValue(nowText);
      studySheet.getRange(existingRow, 3).setValue(mark);
    } else {
      newStudyRows.push([nowText, itCode, mark, '', 0, userName, '', CHECKLIST_SOURCE]);
    }
    granted += Math.max(0, delta);
  }

  if (newStudyRows.length > 0) {
    studySheet.getRange(studySheet.getLastRow() + 1, 1, newStudyRows.length, 8).setValues(newStudyRows);
  }

  return jsonResponse({
    status: 'success',
    granted: granted,
    capped: capped,
    earnedToday: Math.min(earnedToday + granted, CHECKLIST_DAILY_CAP),
    currentPoints: getCurrentPoints(ss, userName)
  });
}

/**
 * 지정된 구글 드라이브 폴더 내의 이미지 파일 이름과 URL을 문제목록 시트에 나열합니다.
 */
function listFilesInFolder() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROBLEM_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(PROBLEM_SHEET_NAME);
  } else {
    sheet.clear();
  }

  var headers = ['차시', '콘텐츠 코드', '문제 이미지 URL', '제출답', '정답여부', '점수'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  var folder = DriveApp.getFolderById(PROBLEM_IMAGE_FOLDER_ID);
  var files = folder.getFiles();
  var rows = [];

  while (files.hasNext()) {
    var file = files.next();
    if (file.getMimeType().indexOf('image/') !== -1) {
      rows.push([
        '',
        file.getName(),
        'https://drive.google.com/uc?export=view&id=' + file.getId(),
        '',
        '',
        ''
      ]);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

/**
 * [영재원 대비_모의고사] 문제집을 1회 설정하는 함수. 문제/정답/해설 이미지가 모두
 * 갖춰진 60문항을 '모의고사문제목록' 시트에 채운다. 이미 시트가 있으면 내용을 지우고 다시 채운다.
 * (03번 문제는 원본 자료에 해설 이미지가 없어 해설 URL이 빈 값으로 들어간다.)
 */
function setupMockExamSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MOCK_EXAM_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(MOCK_EXAM_SHEET_NAME);
  } else {
    sheet.clear();
  }

  var headers = ['문제번호', '문제 이미지 URL', '정답 이미지 URL', '해설 이미지 URL', '정답여부', '점수'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  var entries = [
    ['01', 'https://drive.google.com/uc?export=view&id=1UjTHVEhbScs5rGf2dHia0MKMBpOt9Fuf', 'https://drive.google.com/uc?export=view&id=1OuShzXWeeWQF6qsKn3hIfD8wjRBhvcvj', 'https://drive.google.com/uc?export=view&id=1rH_624IagHB_FBOIjQbgVFTSiGt2Ajqr'],
    ['02', 'https://drive.google.com/uc?export=view&id=1vzK7CYKyX191oyZL49OekGuUQSB3xIMV', 'https://drive.google.com/uc?export=view&id=1cjkjYuPvRRvG4acr4pjSB_wZzpEgPIBT', 'https://drive.google.com/uc?export=view&id=1lYptzQeAQ0R3HIccMWOcLyQ2-KRJBH6y'],
    ['03', 'https://drive.google.com/uc?export=view&id=1YqRurpFSUvQHC49RXDOcnPUkcNKtGmHe', 'https://drive.google.com/uc?export=view&id=13ZPmqmeAkFgJjPjnRyH2udH64YkrcaMH', ''],
    ['04', 'https://drive.google.com/uc?export=view&id=1TEq7yIEUzXjB38o51zSeoXb3cM3l7vgG', 'https://drive.google.com/uc?export=view&id=1ucYIX6z7c863mi8-wTsFpFQ0jVScSp6R', 'https://drive.google.com/uc?export=view&id=1YkTf56VWNf-6gzrswcQi_VK-m0K3nyfn'],
    ['05', 'https://drive.google.com/uc?export=view&id=1k0CHva7kO_BAW3fd0bWA-ZNjytdmJ7je', 'https://drive.google.com/uc?export=view&id=1OxzDBB58ihbigj0sY_VtY0DyhkHyJ0Tn', 'https://drive.google.com/uc?export=view&id=1K7kNr3AHsVfV3cQMCa6K0Ch2j_jtPjXx'],
    ['06', 'https://drive.google.com/uc?export=view&id=1odH34O4ci0bJdEtiKk1BRT1fFt6lIjHz', 'https://drive.google.com/uc?export=view&id=12Fb6HVrW2llGEL9gF5dyeEgGH3tmJF_V', 'https://drive.google.com/uc?export=view&id=1uV_zIDeumSGitHr7yyhHqkZF61CL7N-e'],
    ['07', 'https://drive.google.com/uc?export=view&id=1tP_jL0EWqOqoLxdiBSHXbPj204YiU3KR', 'https://drive.google.com/uc?export=view&id=1PrYNxiuqc7grHPAEnzn6jhkqmBBpWj0a', 'https://drive.google.com/uc?export=view&id=1vlJnX5NXYF5_jd6FgOnG0voQA_wKJ9oN'],
    ['08', 'https://drive.google.com/uc?export=view&id=1NvdcwzJXiLaFmNd9XwdoKz3GOMwkdvj4', 'https://drive.google.com/uc?export=view&id=1CZTe4jiI3fL0efbhTQkv9pcz4lHjbZ4A', 'https://drive.google.com/uc?export=view&id=1ddBsCtZbZFqD1ZdfgCuSKnRpLk1MXd7M'],
    ['09', 'https://drive.google.com/uc?export=view&id=1m6CAJhVUnFF7nXp2SEdytFOjArDDU-lf', 'https://drive.google.com/uc?export=view&id=15oxl9-at6z8M8bkTO5gvi-M0-13vLZbP', 'https://drive.google.com/uc?export=view&id=1SoiAYy9L8hUNTXv64aLInOpXcpWAFHxr'],
    ['10', 'https://drive.google.com/uc?export=view&id=1g7GOVIyZTyj1QBOUS0qYZkQTQOTAAvhf', 'https://drive.google.com/uc?export=view&id=12G8kdbVZT9AA9Xb3dCBIvJGfTE5fEQMn', 'https://drive.google.com/uc?export=view&id=1dHjaVSxm_7-EOlF_u-UTpkGl3d9Unu1s'],
    ['11', 'https://drive.google.com/uc?export=view&id=1RsxjNaLdOTd5gmH_uza0ImPqAYvi1ojy', 'https://drive.google.com/uc?export=view&id=1QKQA6dQhaii0ZJT2XpyaK1FRaeJrKMKE', 'https://drive.google.com/uc?export=view&id=1rAvANJ4xp7UCRkxmbFB_P8F9FtUcmhNv'],
    ['12', 'https://drive.google.com/uc?export=view&id=1NZHSCOwBfsbkVirs31gV7q9HtsZr7IV2', 'https://drive.google.com/uc?export=view&id=1DP8kGfrAChFWGHiA944prStDhavJ6qO0', 'https://drive.google.com/uc?export=view&id=1zx5QPvvzrGujDAQ1JcZs1SUF4nV9kwve'],
    ['13', 'https://drive.google.com/uc?export=view&id=1qJjhenrqx65t0kz6JQ0uxmcR6TRDhVir', 'https://drive.google.com/uc?export=view&id=1GNbbdJye0BNPOML07xbIH8d6GWSkyYG0', 'https://drive.google.com/uc?export=view&id=1nJg8t7fsth43FMvO_JoCsJEGn-ssUDMQ'],
    ['14', 'https://drive.google.com/uc?export=view&id=14PmwrC6Bw_IqEQNW60VBN8T6-rxHmR3Y', 'https://drive.google.com/uc?export=view&id=15cLJ2c0m0LhHdJROaj26qGuvFUfIMVWW', 'https://drive.google.com/uc?export=view&id=1GREgRfOhvlW-qsJGrXUi80ZV8E_r4J9s'],
    ['15', 'https://drive.google.com/uc?export=view&id=1C7YwYDK5L7mN6nSSlWO7kz1byIC1KZ5C', 'https://drive.google.com/uc?export=view&id=1e2BOl3QW03mMTr8Ikcn1si43TK9HyPx-', 'https://drive.google.com/uc?export=view&id=1nC_vSFEaNvQI-O9WZWHRbheXWTJ-RT0R'],
    ['16', 'https://drive.google.com/uc?export=view&id=1_DN0iCM63vkLOaqtlFEICiXjmZ8dCjti', 'https://drive.google.com/uc?export=view&id=1_SvF8X__0t7JZW-TLeoqDsDwdNgeoDY5', 'https://drive.google.com/uc?export=view&id=1Wsd3_dw_Jg8k1ka4wfc7SV_VIYU3uE7L'],
    ['17', 'https://drive.google.com/uc?export=view&id=13S5DUr3kNfrtYptQ51RDs5o8INdRgg5r', 'https://drive.google.com/uc?export=view&id=1gqO10W8FeWKD4IOD_PNwMJ7Uw9LrAV0R', 'https://drive.google.com/uc?export=view&id=1Xkv0BQm6ZF2hcPkn9MquVAxuY14qMkkr'],
    ['18', 'https://drive.google.com/uc?export=view&id=1sj0-NLbLo82blGOm1kcmQ94a1jBK8SWp', 'https://drive.google.com/uc?export=view&id=1Be8v-YAb0gaY0dgna62l7-om1mE-T-0o', 'https://drive.google.com/uc?export=view&id=1z4xHy5qMVcJ53aeaktMkxAAfsWI2Eg3D'],
    ['19', 'https://drive.google.com/uc?export=view&id=1DOkmMyvAMnZwQEuKbcn8NnvltHh1VXUe', 'https://drive.google.com/uc?export=view&id=1EvhHkNR4PC4Ddh6s8kFb5vN0YBAEO3bR', 'https://drive.google.com/uc?export=view&id=1fkTE6Yr_ru8AlDb1SutexnA0WNm07-Bq'],
    ['20', 'https://drive.google.com/uc?export=view&id=1v4IJKJKgjtyCr8DsCt7EQtSOcOvpgGds', 'https://drive.google.com/uc?export=view&id=1aHku-X0U_N9ALW_lI5q3txPMOeY-sMeM', 'https://drive.google.com/uc?export=view&id=15rXFLM93fKDo0XnxeO7RDKTCbn8Th1zw'],
    ['21', 'https://drive.google.com/uc?export=view&id=1wuSR28fO_CGNfTOqZu0--EfJlVzQSd1i', 'https://drive.google.com/uc?export=view&id=1HO0iwaeI2wSOFDaHdgAa8nsWPhiYinUk', 'https://drive.google.com/uc?export=view&id=129N0OEt-qF2o4oVzkK_Igy8rd3dfrqiH'],
    ['22', 'https://drive.google.com/uc?export=view&id=1iO0tr0Yj56a6tm0yECPXM5V7k3s-1x-M', 'https://drive.google.com/uc?export=view&id=10jEsEHZw3WEtObseigEkECJmTOCeULOh', 'https://drive.google.com/uc?export=view&id=1iMEJE5VNxU2J7D7WGVoqcAi5yx2jTASl'],
    ['23', 'https://drive.google.com/uc?export=view&id=1_eCDQM6C_MmDDreHsr5Q6vj-krkdPaxk', 'https://drive.google.com/uc?export=view&id=1VBS5b__gJRukuXpi6pXb5krJpgUbbieH', 'https://drive.google.com/uc?export=view&id=1O860wLjZPdYcBlP3JU8nIOV36azN_gGr'],
    ['24', 'https://drive.google.com/uc?export=view&id=1ubojDliVlccYBzEQk9DiloKgxs-P1rdH', 'https://drive.google.com/uc?export=view&id=1VqzR9MDCcsABDqUV6s6GjEZwwwi-Ft35', 'https://drive.google.com/uc?export=view&id=1rUF6c_IQF67lMoDi6l_zPTmswoQdax5R'],
    ['25', 'https://drive.google.com/uc?export=view&id=1Hr0T7aBJcLa1yV7dovXFy8Dxc2YHXA-2', 'https://drive.google.com/uc?export=view&id=14ljlcT7nozip0x8o6S7rWydidyO-8C0O', 'https://drive.google.com/uc?export=view&id=1nrExR4b9RogPgyKfJGojI2GcdY5cXMQ1'],
    ['26', 'https://drive.google.com/uc?export=view&id=1lDTUrMTgfH_bHHCiI_1Qlj3FOVx0gbL9', 'https://drive.google.com/uc?export=view&id=17R8fliM4aw9WWSFESBi70FRRZTdKaXnK', 'https://drive.google.com/uc?export=view&id=1D0D4j5lY6tX9e6o28v5AUFoKgUuG4JYu'],
    ['27', 'https://drive.google.com/uc?export=view&id=1-ucpZC93BVvyjX6lECj-HKNierLTX5I8', 'https://drive.google.com/uc?export=view&id=1_mUKL5jOKyZyRgO2iT4giF67lxy-bq0N', 'https://drive.google.com/uc?export=view&id=1HOoUgO9si0k5CXfrGaIVpzSp4PVt3eff'],
    ['28', 'https://drive.google.com/uc?export=view&id=1DofS7jFqwbjTrcAKIHvmZbjt72WHfhBS', 'https://drive.google.com/uc?export=view&id=1jJBWLFWJHLPkMPrG54aajxZH6hFzPv2-', 'https://drive.google.com/uc?export=view&id=1efDME0Ycmd4lHZRpEx_Y01Ky7dH7Ao0S'],
    ['29', 'https://drive.google.com/uc?export=view&id=1sROoMPPxYSqgXqN6AC4aB3VB5BFsktpH', 'https://drive.google.com/uc?export=view&id=1DbgWF3vt48Ny_dbRH6TlxRJU9oWD9Ic_', 'https://drive.google.com/uc?export=view&id=1O7PB3-aDMx9K7JelKTznX7aW126V8sPj'],
    ['30', 'https://drive.google.com/uc?export=view&id=1vhsPMtxCQE8gwG29-el-xXypCdWocbFZ', 'https://drive.google.com/uc?export=view&id=1u1YqrHftzB1-OsY9Badq2u-ldLeMLffa', 'https://drive.google.com/uc?export=view&id=1TBtAXuAx6Tp2aDmK0WNfSQk89tVlztPT'],
    ['31', 'https://drive.google.com/uc?export=view&id=1Ew0vhhnhnxsLqbZLuO519lf2aNwFHOuq', 'https://drive.google.com/uc?export=view&id=1XjDVCAucWuq33bO2B4ymTgA7SMbApDjS', 'https://drive.google.com/uc?export=view&id=1PDt_ZlaWC_BsyxMBxqe0HGhg6S0VQjKF'],
    ['32', 'https://drive.google.com/uc?export=view&id=1vgAreg6jAtwBX9IlT7-HFLtDEzZ0pf8F', 'https://drive.google.com/uc?export=view&id=1apDT-wQEBl25g5yT-Jf8DB7WOArQ-FB5', 'https://drive.google.com/uc?export=view&id=1HJLOBtffbA3ho1dmIrOo_CvhEkJkkgt-'],
    ['33', 'https://drive.google.com/uc?export=view&id=1xvJdz2y_kAmW5fCielHn4ksmzY6kNC3T', 'https://drive.google.com/uc?export=view&id=1rrFsD2CaDr6-zoH9efjNasawYfkj6fH_', 'https://drive.google.com/uc?export=view&id=1P7iJgSpiy7TM343N-eiRpEoRP0zQUsSw'],
    ['34', 'https://drive.google.com/uc?export=view&id=1b7VPThbvR9IOzcJ1Nq8Sa4TPxQj4AX1N', 'https://drive.google.com/uc?export=view&id=1agJJpzb7siWoWuQJ85cDSL0d29ODYcM6', 'https://drive.google.com/uc?export=view&id=1JjIWSsbZMSy8Naf79TXMySOd34vCAqwd'],
    ['35', 'https://drive.google.com/uc?export=view&id=1DcHMkcI1o7ordwBPkJLekchTXyzWnUjO', 'https://drive.google.com/uc?export=view&id=1JjStci3Fobj-x7lA6Wtf2VtbmGznMUX1', 'https://drive.google.com/uc?export=view&id=1kWff1Q0V1R909vdyws1RjmdudFhnwah9'],
    ['36', 'https://drive.google.com/uc?export=view&id=1b_9L4ajgPKy1zDavp036a7iUwj78m36C', 'https://drive.google.com/uc?export=view&id=1O0xWmC5mk7GWugEdZNYl6By3OzT3ukk-', 'https://drive.google.com/uc?export=view&id=1qHnVmj7nQkPA8FcMAWzaT0Dyo1eDqCf_'],
    ['37', 'https://drive.google.com/uc?export=view&id=1QWWowhGCwO0k1mzjValYIyoHmhBNIADP', 'https://drive.google.com/uc?export=view&id=1N_4dXLpRlB08UZVdwOvqXtyMs-FKW_8r', 'https://drive.google.com/uc?export=view&id=1qpSxltpVyi4YD7EDN0MKcHB3NEitWOeu'],
    ['38', 'https://drive.google.com/uc?export=view&id=15VUN4oF2_5wbcKJN8iuea2a4irJ2mTqP', 'https://drive.google.com/uc?export=view&id=1ly9yXZ6H5ATHlbJ6AKRVB-gzuB9Tja0d', 'https://drive.google.com/uc?export=view&id=1EVuDHdbMC4YybSCK7SQYAfJZy-MaaqZE'],
    ['39', 'https://drive.google.com/uc?export=view&id=1IjtwhHYfjOub_D6O-dzwXBhKfXAKW1GT', 'https://drive.google.com/uc?export=view&id=1leDcyhTfDAaqIMp2DoB_c5xN3pEK3NMU', 'https://drive.google.com/uc?export=view&id=1kbs6s-OnzyqfnW3PuUZikdbjlsggI-60'],
    ['40', 'https://drive.google.com/uc?export=view&id=1KzEQr5yhUaq06EfaEALX5u8eZpOlP0kT', 'https://drive.google.com/uc?export=view&id=1X-i_Ixlnh0xyt4FZIf-fZFIq3T7iNgHN', 'https://drive.google.com/uc?export=view&id=10pE3PrJ7juUGM1msaGGHBVqmTuzxJtQX'],
    ['41', 'https://drive.google.com/uc?export=view&id=1un5czrCjiIl09k-JfwYxuPnr7VSOSFcu', 'https://drive.google.com/uc?export=view&id=1toRUhjyoB54lIEzmgb3Dwr4sQGZJeE9K', 'https://drive.google.com/uc?export=view&id=1VTOK-aC7HCDfGolMnKM9YK2w6Ysw3NSY'],
    ['42', 'https://drive.google.com/uc?export=view&id=1TWGmpwNwZqwDaNbYFCoa_IaeOfjr0Zin', 'https://drive.google.com/uc?export=view&id=18n9USoF9BtuMOoinbncxVSSCd9u78M1q', 'https://drive.google.com/uc?export=view&id=1bSy_O-u6lAYNr7GP8fdXSY341csKfG3P'],
    ['43', 'https://drive.google.com/uc?export=view&id=1R3dNtPFNMwin0ByXP-8GD41TrG3_mVfF', 'https://drive.google.com/uc?export=view&id=12tUIKbC9_zKOqJZW8xkhFronD_XwErw_', 'https://drive.google.com/uc?export=view&id=1X5yEYWavnAEHf62ZwDrtptwLAfyQGUNB'],
    ['44', 'https://drive.google.com/uc?export=view&id=106DtjDVKPzE1aR9mgyReKjPrZUzXhAN6', 'https://drive.google.com/uc?export=view&id=1YL1jYaRF-bDIWRlW2nGnGRjjg8Asp6I9', 'https://drive.google.com/uc?export=view&id=1r3SFwzKpwElfBVLszQ83IpNSApzV0PUM'],
    ['45', 'https://drive.google.com/uc?export=view&id=1JsVQ-cAHvTCkvUgma5JTyG3rGGqdD2IC', 'https://drive.google.com/uc?export=view&id=1asilc8wQ_TVXjsn-ay3MyUY_TyeZQzb7', 'https://drive.google.com/uc?export=view&id=1R_qSEZNi6JZr5GzxDXre7klBty1p3JfH'],
    ['46', 'https://drive.google.com/uc?export=view&id=1UzmM4XRBINqIF7xccw_6xgRP3TJiDA4Z', 'https://drive.google.com/uc?export=view&id=1NGzSWLhhcmCWg8E-q4XMHVCyke1upOUo', 'https://drive.google.com/uc?export=view&id=18BfmtsAlckMY9UFoKdTJ_DV6Abqq27ff'],
    ['47', 'https://drive.google.com/uc?export=view&id=12mLmQ13oXguBbEGkoV6_krsov7sym00d', 'https://drive.google.com/uc?export=view&id=1AXUIK5d1nQJxr6sdaRvj2jsMQYyoT_W4', 'https://drive.google.com/uc?export=view&id=1pgBxW7MhMXFhc1Md9Sk-keoivPuIV87e'],
    ['48', 'https://drive.google.com/uc?export=view&id=1FJd9bIXaFJ0fjckvfTYnWHJoralRjS4o', 'https://drive.google.com/uc?export=view&id=1lbuXMIHpoHQDCAv60cInwD0k-WnYlyJu', 'https://drive.google.com/uc?export=view&id=1B92C6zNzSlF05tGY_Ats6EgHCmpHuXN5'],
    ['49', 'https://drive.google.com/uc?export=view&id=1bFydZd-KWN6vNtMRxvEzgSzqaPMBuMiS', 'https://drive.google.com/uc?export=view&id=1YZjX4j3wSWs2ky9J6D1Pwu8atpAjdlhq', 'https://drive.google.com/uc?export=view&id=1wqZXbKfrs_FzG-tFHMyUov2Xqw5hDCUv'],
    ['50', 'https://drive.google.com/uc?export=view&id=1XZzRkfrBk9pqOeXkLSnRr-ZF3gZhIGdM', 'https://drive.google.com/uc?export=view&id=1Mi8G-Kqp1zDZPbnN4dS_e-B63b250i3q', 'https://drive.google.com/uc?export=view&id=1lOBS5qaJmDwmrAd1cTOW2_voyCmKynO5'],
    ['51', 'https://drive.google.com/uc?export=view&id=1dZd5oCwPN5g7YX-ef0NPY3i2AY1ni2gs', 'https://drive.google.com/uc?export=view&id=1tC73Ro6pckt8xDZU34LVc_6AKTL2VyoL', 'https://drive.google.com/uc?export=view&id=1tzlKAO468G4G8tnKIb17J0vGeSxnG94z'],
    ['52', 'https://drive.google.com/uc?export=view&id=1ZpEOpSqVTuqmC2LXJVVrbmlq8HFI_MfN', 'https://drive.google.com/uc?export=view&id=1D21VpDoL8GNAvYJB84apyO1tMfJCliU3', 'https://drive.google.com/uc?export=view&id=1YDBAlzLc295NNBLvGc7o6R6pE-Qsx8yd'],
    ['53', 'https://drive.google.com/uc?export=view&id=1CMBpbvy-5pQxTtph0E32D0YQHMJzOxc3', 'https://drive.google.com/uc?export=view&id=1G7-l-INZxh4iWESb0INMxO_Ap9sZ7G9y', 'https://drive.google.com/uc?export=view&id=113zHwCjsdKLw9zM_c-0v0XPnysW_KaeN'],
    ['54', 'https://drive.google.com/uc?export=view&id=1_A5VvsXmS9lCEAbzyEikw2DGm2eUBqVH', 'https://drive.google.com/uc?export=view&id=1aYXzOXYdxuKBVSjtQrnsrS0OGJx-qkAv', 'https://drive.google.com/uc?export=view&id=1Y8rVGFFoQKIw2jixfrDCUOQv4E0nwxe5'],
    ['55', 'https://drive.google.com/uc?export=view&id=1EKN4Sx73M4_6FjyBLdmMqIHlVepJ-jDd', 'https://drive.google.com/uc?export=view&id=1W-Wy6JNVBZ-moC6RiGute1JUePrBkFS7', 'https://drive.google.com/uc?export=view&id=1Fuzqfw8gBhf4VlIqF1csuwsN4ymfA51k'],
    ['56', 'https://drive.google.com/uc?export=view&id=1K71VCM2zkYrNx3LaugsryK-9mLL0PTRs', 'https://drive.google.com/uc?export=view&id=1n6dnR_l_-UPfskwx7VYMn3ukSriQuy3b', 'https://drive.google.com/uc?export=view&id=1EuNcfCQOtvu-4pJLEHhAVsdvTKhC2ll5'],
    ['57', 'https://drive.google.com/uc?export=view&id=1act8vN3fmameLU3UoAA8igVAk8D4QjrW', 'https://drive.google.com/uc?export=view&id=1Ny05Pvd01-BVBt-Ksv1sNftQ-NIMEZse', 'https://drive.google.com/uc?export=view&id=1des-mUb9smA_v9k3m4zKI497B54twPvR'],
    ['58', 'https://drive.google.com/uc?export=view&id=15TSneob4LBhMf_ymVOcyrnNCBVZeihlK', 'https://drive.google.com/uc?export=view&id=1SmkIBm9nPNl1u3LG29U9kXajxpiIJvnd', 'https://drive.google.com/uc?export=view&id=1SaVjlGjH2oUrX79ndO7viS8x2CbG0akg'],
    ['59', 'https://drive.google.com/uc?export=view&id=1bQ-DrLWzlXyBC940_rQQmTuByXpNn1Ba', 'https://drive.google.com/uc?export=view&id=1NW3ZeJRpehpvTVPLbLuosoqnQCBK725E', 'https://drive.google.com/uc?export=view&id=10-mRw_oxuFxBBJrx9EwPE50Ie72tqAGh'],
    ['60', 'https://drive.google.com/uc?export=view&id=1LVMR_3yGleZNupRqmi1JiZkb6yyJmToV', 'https://drive.google.com/uc?export=view&id=1feueWnO4sJTCP4vYraQJDWTJOEtXrsbE', 'https://drive.google.com/uc?export=view&id=1c2F8neSt9wLeDj6pD4DuKlZ1bWBhiolF'],
  ];

  var rows = entries.map(function (entry) {
    return [entry[0], entry[1], entry[2], entry[3], '', ''];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

/**
 * 문제 목록과 현재 사용자의 학습 통계, 포인트 및 풀이 이력을 반환합니다.
 */

// ---------------------------------------------------------------------------
// 마을 어휘 퀴즈 · 공부 명언
// ---------------------------------------------------------------------------

/**
 * [필수 국어 어휘] 탭을 읽는다.
 *   A=번호  B=단어(한자)  C=뜻  D=분야  E=맞힌횟수(총합)  F=사용자별(JSON)
 * 1행은 머리글이라 건너뛴다.
 *
 * rowNumber를 함께 돌려주는 이유: 아이가 문제를 맞혔을 때 그 줄을 바로 찾아
 * 횟수를 올리기 위해서다. 단어로 다시 찾으면 같은 단어가 두 번 있을 때 어긋난다.
 */
function doGetVocab(ss) {
  var sheet = ss.getSheetByName(VOCAB_SHEET_NAME);
  if (!sheet) return { status: 'success', vocab: [] };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'success', vocab: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var word = String(row[1] || '').trim();
    var meaning = String(row[2] || '').trim();
    if (!word || !meaning) continue;
    out.push({
      rowNumber: i + 2,
      no: row[0],
      word: word,
      meaning: meaning,
      field: String(row[3] || '').trim(),
      correctCount: Number(row[4]) || 0
    });
  }
  return { status: 'success', vocab: out };
}

/**
 * [공부명대사] 탭을 읽는다. A열은 비어 있고 B열에 명언이 있다.
 */
function doGetQuotes(ss) {
  var sheet = ss.getSheetByName(QUOTE_SHEET_NAME);
  if (!sheet) return { status: 'success', quotes: [] };

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return { status: 'success', quotes: [] };

  // 1행부터 읽는다. 이 탭은 머리글이 있을 수도, 첫 줄부터 바로 명언일 수도 있어서
  // 무조건 2행부터 읽으면 명언 하나를 잃는다. 머리글처럼 보이는 첫 줄만 건너뛴다.
  var values = sheet.getRange(1, 2, lastRow, 1).getValues();
  var HEADERS = ['명언', '명대사', '공부명언', '공부명대사', '문구', '내용', '글귀'];
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var line = String(values[i][0] || '').trim();
    if (!line) continue;
    if (i === 0 && HEADERS.indexOf(line) !== -1) continue;
    out.push(line);
  }
  return { status: 'success', quotes: out };
}

/**
 * 어휘 퀴즈를 맞혔을 때 횟수를 올린다.
 *
 * E열에는 사람이 눈으로 읽을 총합을 숫자로 두고,
 * F열에는 누가 몇 번 맞혔는지를 {"지윤":3} 형태로 둔다.
 * (E열만 두면 형제가 같이 쓸 때 누구 기록인지 알 수 없고,
 *  F열만 두면 시트를 열었을 때 한눈에 안 들어온다)
 *
 * 틀린 경우에는 아무것도 쓰지 않는다. 호감도만 깎기로 했기 때문이다.
 */
function doSaveVocabResult(ss, userName, rowNumber, correct) {
  var sheet = ss.getSheetByName(VOCAB_SHEET_NAME);
  if (!sheet) throw new Error('[' + VOCAB_SHEET_NAME + '] 탭을 찾을 수 없습니다.');

  var row = Number(rowNumber) || 0;
  if (row < 2 || row > sheet.getLastRow()) {
    throw new Error('어휘 줄 번호가 올바르지 않습니다: ' + rowNumber);
  }
  if (!correct) {
    return { status: 'success', correctCount: Number(sheet.getRange(row, 5).getValue()) || 0 };
  }

  var name = String(userName || '').trim() || '이름없음';

  var byUser = {};
  var raw = String(sheet.getRange(row, 6).getValue() || '').trim();
  if (raw) {
    try { byUser = JSON.parse(raw) || {}; } catch (err) { byUser = {}; }
  }
  byUser[name] = (Number(byUser[name]) || 0) + 1;

  var total = 0;
  for (var key in byUser) {
    if (byUser.hasOwnProperty(key)) total += Number(byUser[key]) || 0;
  }

  sheet.getRange(row, 5).setValue(total);
  sheet.getRange(row, 6).setValue(JSON.stringify(byUser));

  return { status: 'success', correctCount: total, byUser: byUser };
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetUser = String(
      e && e.parameter && e.parameter.userName ? e.parameter.userName : ''
    ).trim();

    // 스터디 플래너/시험 대비 설정 조회. (문제 목록 집계보다 먼저 빠르게 응답)
    if (e && e.parameter && e.parameter.type === 'GET_CHECKLIST') {
      return jsonResponse(doGetChecklist(ss, targetUser));
    }

    if (e && e.parameter && e.parameter.type === 'GET_POINT_SUMMARY') {
      return jsonResponse({ status: 'success', summary: buildPointSummary(ss, targetUser) });
    }

    if (e && e.parameter && e.parameter.type === 'GET_VOCAB') {
      return jsonResponse(doGetVocab(ss));
    }

    if (e && e.parameter && e.parameter.type === 'GET_QUOTES') {
      return jsonResponse(doGetQuotes(ss));
    }

    if (e && e.parameter && e.parameter.type === 'GET_PLANNER') {
      return jsonResponse({
        status: 'success',
        planner: getPlannerForUser(ss, targetUser)
      });
    }

    var dailyStats = {};
    var reviewCounts = {};
    var problemLogs = {};

    var studySheet = ss.getSheetByName(STUDY_LOG_SHEET_NAME);
    var studyData = studySheet ? studySheet.getDataRange().getValues() : [];

    for (var i = 1; i < studyData.length; i++) {
      var studiedAt = studyData[i][0];
      var code = studyData[i][1];
      var isCorrect = studyData[i][2];
      var imageUrl = studyData[i][3];
      var solveTimeSec = Number(studyData[i][4]) || 0;
      var studentName = String(studyData[i][5] || '').trim();

      // 사용자 이름이 전달된 경우 해당 사용자의 기록만 집계한다.
      if (targetUser && studentName !== targetUser) continue;

      if (code) {
        reviewCounts[code] = (reviewCounts[code] || 0) + 1;
        if (!problemLogs[code]) problemLogs[code] = [];
        problemLogs[code].push({
          date: studiedAt,
          isCorrect: isCorrect,
          imageUrl: imageUrl,
          solveTimeSec: solveTimeSec
        });
      }

      var dateKey = formatDateKey(studiedAt);
      if (dateKey) {
        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = {
            solvedCount: 0,
            totalTimeSec: 0,
            pointsEarned: 0
          };
        }
        dailyStats[dateKey].solvedCount += 1;
        dailyStats[dateKey].totalTimeSec += solveTimeSec;
        dailyStats[dateKey].pointsEarned += pointsForAnswer(isCorrect);
      }
    }

    var problemSheet = ss.getSheetByName(PROBLEM_SHEET_NAME);
    var problemData = problemSheet ? problemSheet.getDataRange().getValues() : [];
    var problems = [];

    for (var p = 1; p < problemData.length; p++) {
      var problemCode = String(problemData[p][1] || '').trim();
      if (!problemCode) continue;
      var personalLogs = problemLogs[problemCode] || [];
      var latestPersonalLog = personalLogs.length > 0
        ? personalLogs[personalLogs.length - 1]
        : null;
      problems.push({
        rowNumber: p + 1,
        session: problemData[p][0],
        code: problemCode,
        imageUrl: problemData[p][2],
        submitted: targetUser
          ? (latestPersonalLog ? latestPersonalLog.imageUrl : '')
          : problemData[p][3],
        isCorrect: targetUser
          ? (latestPersonalLog ? latestPersonalLog.isCorrect : '')
          : problemData[p][4],
        score: problemData[p][5],
        reviewCount: reviewCounts[problemCode] || 0,
        historyLogs: personalLogs
      });
    }

    // [영재원 대비_모의고사] 문제집. 채점 기록은 학습기록 시트에 code="MOCK_문제번호"로 저장되므로
    // 위에서 이미 집계한 reviewCounts/problemLogs를 그대로 재사용한다.
    var mockExamSheet = ss.getSheetByName(MOCK_EXAM_SHEET_NAME);
    var mockExamData = mockExamSheet ? mockExamSheet.getDataRange().getValues() : [];
    var mockExamProblems = [];

    for (var m = 1; m < mockExamData.length; m++) {
      var questionNumber = String(mockExamData[m][0] || '').trim();
      if (!questionNumber) continue;
      var mockCode = 'MOCK_' + questionNumber;
      var mockLogs = problemLogs[mockCode] || [];
      var latestMockLog = mockLogs.length > 0 ? mockLogs[mockLogs.length - 1] : null;
      mockExamProblems.push({
        rowNumber: m + 1,
        number: questionNumber,
        code: mockCode,
        questionImageUrl: mockExamData[m][1],
        answerImageUrl: mockExamData[m][2],
        explanationImageUrl: mockExamData[m][3],
        isCorrect: targetUser
          ? (latestMockLog ? latestMockLog.isCorrect : '')
          : mockExamData[m][4],
        score: mockExamData[m][5],
        reviewCount: reviewCounts[mockCode] || 0,
        historyLogs: mockLogs
      });
    }

    var pointSheet = ss.getSheetByName(POINT_LOG_SHEET_NAME);
    var pointLogs = [];
    if (pointSheet) {
      var pointData = pointSheet.getDataRange().getValues();
      for (var q = 1; q < pointData.length; q++) {
        var pointUser = String(pointData[q][3] || '').trim();
        if (targetUser && pointUser !== targetUser) continue;
        pointLogs.push({
          date: pointData[q][0],
          item: pointData[q][1],
          amount: Number(pointData[q][2]) || 0
        });
      }
    }

    // 시트에 없는 문제집(황소처럼 CSV로 관리되는 것들)의 채점 기록.
    // 위에서 이미 학습기록 전체를 problemLogs로 모아 두었으니, 그중 문제목록/모의고사문제목록에
    // 없는 코드만 골라 내려보낸다. 프론트엔드가 CSV로 만든 문제에 이 기록을 붙이면
    // 기기를 바꿔도 O/X와 복습 이력이 그대로 따라온다.
    var sheetCodes = {};
    for (var sc = 0; sc < problems.length; sc++) sheetCodes[problems[sc].code] = true;
    for (var mc = 0; mc < mockExamProblems.length; mc++) sheetCodes[mockExamProblems[mc].code] = true;
    var externalLogs = {};
    for (var logCode in problemLogs) {
      if (!Object.prototype.hasOwnProperty.call(problemLogs, logCode)) continue;
      if (sheetCodes[logCode]) continue;
      externalLogs[logCode] = problemLogs[logCode];
    }

    return jsonResponse({
      status: 'success',
      problems: problems,
      mockExamProblems: mockExamProblems,
      dailyStats: dailyStats,
      currentPoints: getCurrentPoints(ss, targetUser),
      pointLogs: pointLogs,
      externalLogs: externalLogs
    });
  } catch (error) {
    return jsonResponse({ status: 'error', message: String(error) });
  }
}

/**
 * 사용자 등록, 포인트 사용, O/X 채점 요청을 처리합니다.
 * 풀이 이미지 업로드가 실패해도 채점 및 학습기록은 반드시 저장합니다.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var params = JSON.parse(e.postData.contents || '{}');
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (params.type === 'REGISTER_USER') {
      var userSheet = getOrCreateSheet(
        ss,
        USER_SHEET_NAME,
        ['가입일시', '학년', '이름', '성별']
      );
      var requestedName = String(params.name || '').trim();
      if (!requestedName) {
        throw new Error('이름을 입력해 주세요.');
      }
      var userData = userSheet.getDataRange().getValues();
      for (var u = 1; u < userData.length; u++) {
        var savedName = String(userData[u][2] || '').trim();
        if (savedName === requestedName) {
          return jsonResponse({
            status: 'success',
            existing: true,
            grade: userData[u][1],
            name: savedName,
            gender: userData[u][3]
          });
        }
      }
      userSheet.appendRow([
        formatDateTime(new Date()),
        params.grade || '',
        requestedName,
        params.gender || ''
      ]);
      return jsonResponse({
        status: 'success',
        existing: false,
        grade: params.grade || '',
        name: requestedName,
        gender: params.gender || ''
      });
    }

    // 스터디 플래너/시험 대비 설정/학원 숙제 통째로 저장.
    if (params.type === 'VOCAB_RESULT') {
      return jsonResponse(
        doSaveVocabResult(ss, params.userName, params.rowNumber, params.correct === true)
      );
    }

    if (params.type === 'SAVE_CHECKLIST') {
      return handleSaveChecklist(ss, params);
    }

    if (params.type === 'SAVE_PLANNER') {
      savePlannerForUser(ss, params.userName, params.planner);
      return jsonResponse({ status: 'success' });
    }

    // 하루 마감 시 달성률만큼 포인트 지급 (포인트기록 시트에 적립).
    if (params.type === 'PLANNER_POINT') {
      var plannerUser = String(params.userName || '').trim();
      var plannerAmount = Math.max(0, Math.round(Number(params.amount) || 0));
      if (plannerAmount > 0) {
        var plannerPointSheet = getOrCreateSheet(
          ss,
          POINT_LOG_SHEET_NAME,
          ['일시', '보상 내용', '변동 포인트', '사용자']
        );
        plannerPointSheet.appendRow([
          formatDateTime(new Date()),
          '스터디 플래너 달성',
          plannerAmount,
          plannerUser
        ]);
      }
      return jsonResponse({
        status: 'success',
        currentPoints: getCurrentPoints(ss, plannerUser)
      });
    }

    if (params.type === 'REDEEM_POINT') {
      var redeemUser = String(params.userName || '').trim();
      var amount = Math.abs(Math.round(Number(params.amount) || 0));
      if (!params.item || amount <= 0) {
        throw new Error('보상 내용과 차감 포인트를 확인해주세요.');
      }

      var availablePoints = getCurrentPoints(ss, redeemUser);
      if (amount > availablePoints) {
        throw new Error('보유 포인트가 부족합니다.');
      }

      var pointSheet = getOrCreateSheet(
        ss,
        POINT_LOG_SHEET_NAME,
        ['일시', '보상 내용', '변동 포인트', '사용자']
      );
      var redeemedAt = formatDateTime(new Date());
      pointSheet.appendRow([redeemedAt, params.item, -amount, redeemUser]);

      return jsonResponse({
        status: 'success',
        currentPoints: availablePoints - amount,
        redeemedAt: redeemedAt
      });
    }

    var code = String(params.code || '').trim();
    var isCorrect = String(params.isCorrect || '').trim().toUpperCase();
    var userName = String(params.userName || '').trim();
    var solveTimeSec = Math.max(0, Math.round(Number(params.solveTimeSec) || 0));

    if (!code) throw new Error('콘텐츠 코드가 없습니다.');
    if (isCorrect !== 'O' && isCorrect !== 'X') {
      throw new Error('정답여부는 O 또는 X여야 합니다.');
    }

    var warnings = [];
    var answerUrl = '';

    // Drive 오류가 발생해도 아래 학습기록 저장은 계속 진행한다.
    if (params.canvasImage) {
      try {
        var answerFolder = DriveApp.getFolderById(ANSWER_IMAGE_FOLDER_ID);
        var base64Data = String(params.canvasImage)
          .replace(/^data:image\/(?:png|jpeg|jpg);base64,/, '');
        var fileName =
          code + '_' + userName + '_' +
          Utilities.formatDate(new Date(), TIME_ZONE, 'yyyyMMdd_HHmmss') + '.png';
        var blob = Utilities.newBlob(
          Utilities.base64Decode(base64Data),
          'image/png',
          fileName
        );
        var answerFile = answerFolder.createFile(blob);
        answerFile.setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW
        );
        answerUrl =
          'https://drive.google.com/uc?export=view&id=' + answerFile.getId();
      } catch (uploadError) {
        warnings.push('풀이 이미지 저장 실패: ' + String(uploadError));
      }
    }

    // 문제목록(또는 모의고사문제목록) 갱신 실패도 학습기록 저장을 막지 않는다.
    // 모의고사문제목록은 D열이 해설 이미지 URL이라 제출한 손글씨를 덮어쓰면 안 되므로,
    // 정답여부(E열)만 기록하고 제출 이미지는 학습기록(historyLogs)에만 남긴다.
    var isMockExam = params.workbook === 'mockExam';
    // [황소 중2상 1차단평대비]는 문제 데이터가 시트가 아니라 프로젝트의 CSV
    // (public/data/문항목록.csv)에 있다. 그래서 갱신할 시트 행이 없고,
    // 학습기록에만 남긴다. 포인트는 학습기록을 세어 계산하므로 이것만으로 충분하다.
    var isCsvWorkbook = params.workbook === 'hwangso';
    try {
      if (isCsvWorkbook) {
        // 갱신할 시트 행이 없으므로 이 단계를 건너뛴다.
      } else {
        var problemSheet = ss.getSheetByName(isMockExam ? MOCK_EXAM_SHEET_NAME : PROBLEM_SHEET_NAME);
        var rowNumber = Math.round(Number(params.rowNumber) || 0);
        if (problemSheet && rowNumber >= 2 && rowNumber <= problemSheet.getMaxRows()) {
          if (!isMockExam && answerUrl) problemSheet.getRange(rowNumber, 4).setValue(answerUrl);
          problemSheet.getRange(rowNumber, 5).setValue(isCorrect);
        }
      }
    } catch (problemUpdateError) {
      warnings.push('문제목록 갱신 실패: ' + String(problemUpdateError));
    }

    var studySheet = getOrCreateSheet(
      ss,
      STUDY_LOG_SHEET_NAME,
      ['풀이 일시', '콘텐츠 코드', '정답여부', '풀이 이미지 URL', '학습시간(초)', '학생 이름', '타이핑 답']
    );
    if (studySheet.getRange(1, 6).getValue() === '') {
      studySheet.getRange(1, 6).setValue('학생 이름').setFontWeight('bold');
    }
    // G열(타이핑 답)은 나중에 생긴 열이라, 예전에 만들어진 시트에는 머리글이 없다.
    // 처음 한 번만 채워 넣는다. (기존 데이터는 건드리지 않는다)
    if (studySheet.getRange(1, 7).getValue() === '') {
      studySheet.getRange(1, 7).setValue('타이핑 답').setFontWeight('bold');
    }

    var studiedAt = formatDateTime(new Date());
    studySheet.appendRow([
      studiedAt,
      code,
      isCorrect,
      answerUrl,
      solveTimeSec,
      userName,
      // 펜 대신 키보드로 낸 답. 손글씨로만 풀었으면 빈 값이다.
      String(params.typedAnswer || '').slice(0, 200)
    ]);

    var pointsEarned = pointsForAnswer(isCorrect);
    return jsonResponse({
      status: 'success',
      submittedUrl: answerUrl,
      pointsEarned: pointsEarned,
      currentPoints: getCurrentPoints(ss, userName),
      studiedAt: studiedAt,
      warning: warnings.join('\n')
    });
  } catch (error) {
    return jsonResponse({ status: 'error', message: String(error) });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignore) {
      // 잠금을 얻기 전에 실패한 경우에는 해제할 잠금이 없다.
    }
  }
}

// 한글 이름으로 찾고 싶을 때를 위한 별칭. 둘 중 아무거나 실행하면 된다.
function 플래너_구조이전() {
  return migratePlannerDays();
}
