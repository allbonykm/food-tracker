/**
 * 올본한의원 권은재 님 식단기록 앱 - Google Apps Script 백엔드
 * 
 * 사용법:
 * 1. Google Drive에서 새 Google Sheets 문서를 만드세요.
 * 2. 시트 이름을 "자주먹는메뉴"와 "식단기록"으로 변경하세요.
 * 3. 확장 프로그램 > Apps Script를 클릭하세요.
 * 4. 이 코드를 복사하여 붙여넣으세요.
 * 5. 배포 > 새 배포로 웹 앱을 배포하세요.
 * 6. 배포된 URL을 app.js의 apiUrl에 입력하세요.
 */

// 스프레드시트 ID (본인의 스프레드시트 ID로 교체)
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// 시트 이름
const SHEET_FREQUENT_MENUS = '자주먹는메뉴';
const SHEET_RECORDS = '식단기록';

/**
 * 웹 앱 GET 요청 핸들러
 */
function doGet(e) {
  const action = e.parameter.action;
  
  let result;
  
  try {
    switch (action) {
      case 'addFrequentMenu':
        result = addFrequentMenu(e.parameter.menu);
        break;
      case 'getFrequentMenus':
        result = getFrequentMenus();
        break;
      case 'saveMenuRecord':
        result = saveMenuRecord(e.parameter.date, e.parameter.time, e.parameter.menu);
        break;
      case 'getRecords':
        result = getRecords();
        break;
      case 'getRecentMenus':
        result = getRecentMenus();
        break;
      default:
        result = { success: false, error: '알 수 없는 액션: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 자주 먹는 메뉴 추가
 */
function addFrequentMenu(menu) {
  if (!menu) {
    return { success: false, error: '메뉴 이름이 필요합니다' };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_FREQUENT_MENUS);
  
  // 시트가 없으면 생성
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_FREQUENT_MENUS);
    sheet.appendRow(['메뉴']);
  }
  
  // 메뉴 추가
  sheet.appendRow([menu]);
  
  return { success: true, message: '메뉴가 등록되었습니다' };
}

/**
 * 자주 먹는 메뉴 목록 조회
 */
function getFrequentMenus() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_FREQUENT_MENUS);
  
  if (!sheet) {
    return { success: true, menus: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  const menus = [];
  
  // 첫 행(헤더) 제외
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      menus.push(data[i][0]);
    }
  }
  
  return { success: true, menus: menus };
}

/**
 * 메뉴 기록 저장
 */
function saveMenuRecord(date, time, menu) {
  if (!date || !time || !menu) {
    return { success: false, error: '날짜, 시간, 메뉴가 모두 필요합니다' };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_RECORDS);
  
  // 시트가 없으면 생성
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RECORDS);
    sheet.appendRow(['날짜', '시간', '메뉴', '체크']);
    
    // D열에 체크박스 데이터 유효성 설정
    const range = sheet.getRange('D2:D1000');
    const rule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();
    range.setDataValidation(rule);
  }
  
  // 기록 추가 (체크박스는 기본 false)
  const lastRow = sheet.getLastRow() + 1;
  sheet.getRange(lastRow, 1, 1, 4).setValues([[date, time, menu, false]]);
  
  // 새로 추가된 셀에 체크박스 설정
  const checkboxCell = sheet.getRange(lastRow, 4);
  const rule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .build();
  checkboxCell.setDataValidation(rule);
  
  return { success: true, message: '기록되었습니다' };
}

/**
 * 기록 조회 (체크박스 상태 포함)
 */
function getRecords() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RECORDS);
  
  if (!sheet) {
    return { success: true, records: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  const records = [];
  
  // 첫 행(헤더) 제외
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][2]) {
      // 날짜 포맷 처리
      let dateStr = data[i][0];
      if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
      
      records.push({
        date: dateStr,
        time: data[i][1],
        menu: data[i][2],
        isChecked: data[i][3] === true
      });
    }
  }
  
  return { success: true, records: records };
}

/**
 * 최근 등록 메뉴 조회 (최근 10개, 중복 제거)
 */
function getRecentMenus() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RECORDS);
  
  if (!sheet) {
    return { success: true, menus: [] };
  }
  
  const data = sheet.getDataRange().getValues();
  const menuSet = new Set();
  const recentMenus = [];
  
  // 최신 기록부터 역순으로 조회
  for (let i = data.length - 1; i >= 1 && recentMenus.length < 10; i--) {
    const menu = data[i][2];
    if (menu && !menuSet.has(menu)) {
      menuSet.add(menu);
      recentMenus.push(menu);
    }
  }
  
  return { success: true, menus: recentMenus };
}

/**
 * 초기 설정 함수 (수동 실행)
 * Apps Script 에디터에서 이 함수를 한 번 실행하여 시트를 초기화합니다.
 */
function initializeSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 자주먹는메뉴 시트 생성
  let frequentSheet = ss.getSheetByName(SHEET_FREQUENT_MENUS);
  if (!frequentSheet) {
    frequentSheet = ss.insertSheet(SHEET_FREQUENT_MENUS);
    frequentSheet.appendRow(['메뉴']);
    frequentSheet.getRange('A1').setFontWeight('bold');
  }
  
  // 식단기록 시트 생성
  let recordsSheet = ss.getSheetByName(SHEET_RECORDS);
  if (!recordsSheet) {
    recordsSheet = ss.insertSheet(SHEET_RECORDS);
    recordsSheet.appendRow(['날짜', '시간', '메뉴', '체크']);
    recordsSheet.getRange('A1:D1').setFontWeight('bold');
    
    // D열에 체크박스 데이터 유효성 설정
    const range = recordsSheet.getRange('D2:D1000');
    const rule = SpreadsheetApp.newDataValidation()
      .requireCheckbox()
      .build();
    range.setDataValidation(rule);
  }
  
  Logger.log('시트 초기화가 완료되었습니다.');
}
