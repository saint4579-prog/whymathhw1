var PROBLEM_SHEET_NAME = '문제목록';
var MOCK_EXAM_SHEET_NAME = '모의고사문제목록';
var STUDY_LOG_SHEET_NAME = '학습기록';
var POINT_LOG_SHEET_NAME = '포인트기록';
var USER_SHEET_NAME = '사용자정보';
// 스터디 플래너/시험 대비 설정/학원 숙제를 사용자별 JSON 한 덩어리로 저장하는 시트.
var PLANNER_SHEET_NAME = '플래너';
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

function getPlannerForUser(ss, userName) {
  var sheet = ss.getSheetByName(PLANNER_SHEET_NAME);
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  var name = String(userName || '').trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === name) {
      try {
        return JSON.parse(data[i][1] || 'null');
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

function savePlannerForUser(ss, userName, planner) {
  var sheet = getOrCreateSheet(ss, PLANNER_SHEET_NAME, ['사용자', '플래너JSON', '수정일시']);
  var name = String(userName || '').trim();
  var json = JSON.stringify(planner || {});
  var now = formatDateTime(new Date());
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

function getCurrentPoints(ss, userName) {
  var points = 0;
  var studySheet = ss.getSheetByName(STUDY_LOG_SHEET_NAME);
  if (studySheet) {
    var studyData = studySheet.getDataRange().getValues();
    for (var i = 1; i < studyData.length; i++) {
      var studyUser = String(studyData[i][5] || '').trim();
      if (userName && studyUser !== userName) continue;
      var answer = studyData[i][2];
      if (answer === 'O' || answer === 'X') points += pointsForAnswer(answer);
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
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var targetUser = String(
      e && e.parameter && e.parameter.userName ? e.parameter.userName : ''
    ).trim();

    // 스터디 플래너/시험 대비 설정 조회. (문제 목록 집계보다 먼저 빠르게 응답)
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

    return jsonResponse({
      status: 'success',
      problems: problems,
      mockExamProblems: mockExamProblems,
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

    // 스터디 플래너/시험 대비 설정/학원 숙제 통째로 저장.
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
    try {
      var problemSheet = ss.getSheetByName(isMockExam ? MOCK_EXAM_SHEET_NAME : PROBLEM_SHEET_NAME);
      var rowNumber = Math.round(Number(params.rowNumber) || 0);
      if (problemSheet && rowNumber >= 2 && rowNumber <= problemSheet.getMaxRows()) {
        if (!isMockExam && answerUrl) problemSheet.getRange(rowNumber, 4).setValue(answerUrl);
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
