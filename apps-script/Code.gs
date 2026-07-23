var PROBLEM_SHEET_NAME = '문제목록';
var STUDY_LOG_SHEET_NAME = '학습기록';
var POINT_LOG_SHEET_NAME = '포인트기록';
var USER_SHEET_NAME = '사용자정보';
var PROBLEM_IMAGE_FOLDER_ID = '1QPpZq4iDvnVVaswFQd6YLgY2d4IEGbqG';
var ANSWER_IMAGE_FOLDER_ID = '1YOtQiOrjbxDh3DNwgdwkA65C9bkbdhDr';
var TIME_ZONE = 'Asia/Seoul';

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

function getCurrentPoints(ss, userName) {
  var points = 0;
  var studySheet = ss.getSheetByName(STUDY_LOG_SHEET_NAME);
  if (studySheet) {
    var studyData = studySheet.getDataRange().getValues();
    for (var i = 1; i < studyData.length; i++) {
      var studyUser = String(studyData[i][5] || '').trim();
      if (userName && studyUser !== userName) continue;
      if (studyData[i][2] === 'O') points += 20;
      if (studyData[i][2] === 'X') points += 10;
    }
  }

  var pointSheet = ss.getSheetByName(POINT_LOG_SHEET_NAME);
  if (pointSheet) {
    var pointData = pointSheet.getDataRange().getValues();
    for (var j = 1; j < pointData.length; j++) {
      var pointUser = String(pointData[j][3] || '').trim();
      if (userName && pointUser !== userName) continue;
      points += Number(pointData[j][2]) || 0;
    }
  }
  return points;
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
 * 문제 목록과 현재 사용자의 학습 통계, 포인트 및 풀이 이력을 반환합니다.
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetUser = String(
      e && e.parameter && e.parameter.userName ? e.parameter.userName : ''
    ).trim();
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
        dailyStats[dateKey].pointsEarned += isCorrect === 'O' ? 20 : 10;
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

    return jsonResponse({
      status: 'success',
      problems: problems,
      dailyStats: dailyStats,
      currentPoints: getCurrentPoints(ss, targetUser),
      pointLogs: pointLogs
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

    // 문제목록 갱신 실패도 학습기록 저장을 막지 않는다.
    try {
      var problemSheet = ss.getSheetByName(PROBLEM_SHEET_NAME);
      var rowNumber = Math.round(Number(params.rowNumber) || 0);
      if (problemSheet && rowNumber >= 2 && rowNumber <= problemSheet.getMaxRows()) {
        if (answerUrl) problemSheet.getRange(rowNumber, 4).setValue(answerUrl);
        problemSheet.getRange(rowNumber, 5).setValue(isCorrect);
      }
    } catch (problemUpdateError) {
      warnings.push('문제목록 갱신 실패: ' + String(problemUpdateError));
    }

    var studySheet = getOrCreateSheet(
      ss,
      STUDY_LOG_SHEET_NAME,
      ['풀이 일시', '콘텐츠 코드', '정답여부', '풀이 이미지 URL', '학습시간(초)', '학생 이름']
    );
    if (studySheet.getRange(1, 6).getValue() === '') {
      studySheet.getRange(1, 6).setValue('학생 이름').setFontWeight('bold');
    }

    var studiedAt = formatDateTime(new Date());
    studySheet.appendRow([
      studiedAt,
      code,
      isCorrect,
      answerUrl,
      solveTimeSec,
      userName
    ]);

    var pointsEarned = isCorrect === 'O' ? 20 : 10;
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
