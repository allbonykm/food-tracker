/**
 * 식단 및 증상 추적 앱 - 메인 애플리케이션
 */

const app = {
  apiUrl: '',
  selectedFoods: new Set(),
  selectedSymptoms: new Set(),
  allFoods: [],

  // 초기화
  init() {
    // LocalStorage에서 API URL 불러오기
    this.apiUrl = localStorage.getItem('apiUrl') || '';

    if (this.apiUrl) {
      document.getElementById('settingsPanel').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      this.loadInitialData();
    } else {
      document.getElementById('settingsPanel').style.display = 'block';
      document.getElementById('mainApp').style.display = 'none';
    }

    // Service Worker 등록
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker registration failed:', err);
      });
    }
  },

  // API URL 저장
  saveApiUrl() {
    const urlInput = document.getElementById('apiUrl');
    const url = urlInput.value.trim();

    if (!url) {
      this.showSettingsStatus('URL을 입력해주세요', 'error');
      return;
    }

    // URL 유효성 검사
    if (!url.startsWith('https://script.google.com')) {
      this.showSettingsStatus('올바른 Google Apps Script URL을 입력해주세요', 'error');
      return;
    }

    this.apiUrl = url;
    localStorage.setItem('apiUrl', url);
    this.showSettingsStatus('설정이 저장되었습니다', 'success');

    setTimeout(() => {
      document.getElementById('settingsPanel').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      this.loadInitialData();
    }, 1000);
  },

  // 설정 상태 메시지 표시
  showSettingsStatus(message, type) {
    const statusDiv = document.getElementById('settingsStatus');
    statusDiv.textContent = message;
    statusDiv.className = `settings-status ${type}`;
    statusDiv.style.display = 'block';
  },

  // 초기 데이터 로드
  async loadInitialData() {
    try {
      await Promise.all([
        this.loadMainFoods(),
        this.loadMainSymptoms(),
        this.loadRecentFoods()
      ]);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  },

  // API 호출
  async callApi(action, data = {}) {
    try {
      // URL 파라미터 생성
      const params = new URLSearchParams({
        action: action,
        ...data
      });

      const url = `${this.apiUrl}?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '알 수 없는 오류');
      }

      return result;
    } catch (error) {
      console.error('API 호출 실패:', error);
      throw error;
    }
  },

  // 주요 음식 로드
  async loadMainFoods() {
    try {
      const result = await this.callApi('getMainFoods');
      const container = document.getElementById('mainFoods');
      container.innerHTML = '';

      result.foods.forEach(food => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-food';
        btn.textContent = food;
        btn.onclick = () => this.toggleFood(food, btn);
        container.appendChild(btn);
      });
    } catch (error) {
      document.getElementById('mainFoods').innerHTML =
        '<div class="empty-state">음식을 불러올 수 없습니다</div>';
    }
  },

  // 주요 증상 로드
  async loadMainSymptoms() {
    try {
      const result = await this.callApi('getMainSymptoms');
      const container = document.getElementById('mainSymptoms');
      container.innerHTML = '';

      result.symptoms.forEach(symptom => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-symptom';
        btn.textContent = symptom;
        btn.onclick = () => this.toggleSymptom(symptom, btn);
        container.appendChild(btn);
      });
    } catch (error) {
      document.getElementById('mainSymptoms').innerHTML =
        '<div class="empty-state">증상을 불러올 수 없습니다</div>';
    }
  },

  // 최근 음식 로드
  async loadRecentFoods() {
    try {
      const result = await this.callApi('getRecentFoods');
      const container = document.getElementById('recentFoods');

      if (result.foods.length === 0) {
        container.innerHTML = '<div class="empty-state">최근 기록이 없습니다</div>';
        return;
      }

      container.innerHTML = '';
      result.foods.forEach(food => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-food';
        btn.textContent = food;
        btn.onclick = () => this.toggleFood(food, btn);
        container.appendChild(btn);
      });
    } catch (error) {
      document.getElementById('recentFoods').innerHTML =
        '<div class="empty-state">최근 기록을 불러올 수 없습니다</div>';
    }
  },

  // 전체 음식 목록 로드 (검색용)
  async loadAllFoods() {
    if (this.allFoods.length > 0) return;

    try {
      const result = await this.callApi('getAllFoods');
      this.allFoods = result.foods;
    } catch (error) {
      console.error('전체 음식 로드 실패:', error);
    }
  },

  // 음식 검색
  async searchFoods(query) {
    const container = document.getElementById('searchResults');

    if (!query.trim()) {
      container.innerHTML = '';
      return;
    }

    await this.loadAllFoods();

    const filtered = this.allFoods.filter(food =>
      food.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">검색 결과가 없습니다</div>';
      return;
    }

    container.innerHTML = '';
    filtered.forEach(food => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-food';
      btn.textContent = food;
      btn.onclick = () => {
        this.toggleFood(food, btn);
        document.getElementById('foodSearch').value = '';
        container.innerHTML = '';
      };
      container.appendChild(btn);
    });
  },

  // 음식 선택 토글
  toggleFood(food, btn) {
    if (this.selectedFoods.has(food)) {
      this.selectedFoods.delete(food);
      btn.classList.remove('selected');
    } else {
      this.selectedFoods.add(food);
      btn.classList.add('selected');
    }
    this.updateFoodSelection();
  },

  // 증상 선택 토글
  toggleSymptom(symptom, btn) {
    if (this.selectedSymptoms.has(symptom)) {
      this.selectedSymptoms.delete(symptom);
      btn.classList.remove('selected');
    } else {
      this.selectedSymptoms.add(symptom);
      btn.classList.add('selected');
    }
    this.updateSymptomSelection();
  },

  // 음식 선택 표시 업데이트
  updateFoodSelection() {
    const container = document.getElementById('foodSelection');

    if (this.selectedFoods.size === 0) {
      container.innerHTML = '<div class="selection-placeholder">음식을 선택해주세요</div>';
      container.classList.remove('has-items');
      return;
    }

    container.classList.add('has-items');
    const itemsHtml = Array.from(this.selectedFoods)
      .map(food => `
        <span class="selected-tag">
          ${food}
          <span class="remove" onclick="app.removeFood('${food}')">×</span>
        </span>
      `)
      .join('');

    container.innerHTML = `<div class="selected-items">${itemsHtml}</div>`;
  },

  // 증상 선택 표시 업데이트
  updateSymptomSelection() {
    const container = document.getElementById('symptomSelection');

    if (this.selectedSymptoms.size === 0) {
      container.innerHTML = '<div class="selection-placeholder">증상을 선택해주세요</div>';
      container.classList.remove('has-items');
      return;
    }

    container.classList.add('has-items');
    const itemsHtml = Array.from(this.selectedSymptoms)
      .map(symptom => `
        <span class="selected-tag">
          ${symptom}
          <span class="remove" onclick="app.removeSymptom('${symptom}')">×</span>
        </span>
      `)
      .join('');

    container.innerHTML = `<div class="selected-items">${itemsHtml}</div>`;
  },

  // 음식 제거
  removeFood(food) {
    this.selectedFoods.delete(food);
    // 버튼 선택 해제
    document.querySelectorAll('.btn-food').forEach(btn => {
      if (btn.textContent === food) {
        btn.classList.remove('selected');
      }
    });
    this.updateFoodSelection();
  },

  // 증상 제거
  removeSymptom(symptom) {
    this.selectedSymptoms.delete(symptom);
    // 버튼 선택 해제
    document.querySelectorAll('.btn-symptom').forEach(btn => {
      if (btn.textContent === symptom) {
        btn.classList.remove('selected');
      }
    });
    this.updateSymptomSelection();
  },

  // 현재 날짜/시간 가져오기
  getCurrentDateTime() {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    return { date, time };
  },

  // 식단 기록 저장
  async saveFoodRecord() {
    if (this.selectedFoods.size === 0) {
      this.showMessage('foodMessage', '음식을 선택해주세요', 'error');
      return;
    }

    try {
      const { date, time } = this.getCurrentDateTime();
      const result = await this.callApi('saveFoodRecord', {
        date: date,
        time: time,
        foods: JSON.stringify(Array.from(this.selectedFoods))
      });

      this.showMessage('foodMessage', result.message, 'success');

      // 선택 초기화
      this.selectedFoods.clear();
      document.querySelectorAll('.btn-food.selected').forEach(btn => {
        btn.classList.remove('selected');
      });
      this.updateFoodSelection();

      // 최근 음식 다시 로드
      await this.loadRecentFoods();

    } catch (error) {
      this.showMessage('foodMessage', '저장 실패: ' + error.message, 'error');
    }
  },

  // 증상 기록 저장
  async saveSymptomRecord() {
    if (this.selectedSymptoms.size === 0) {
      this.showMessage('symptomMessage', '증상을 선택해주세요', 'error');
      return;
    }

    try {
      const { date, time } = this.getCurrentDateTime();
      const result = await this.callApi('saveSymptomRecord', {
        date: date,
        time: time,
        symptoms: JSON.stringify(Array.from(this.selectedSymptoms))
      });

      this.showMessage('symptomMessage', result.message, 'success');

      // 선택 초기화
      this.selectedSymptoms.clear();
      document.querySelectorAll('.btn-symptom.selected').forEach(btn => {
        btn.classList.remove('selected');
      });
      this.updateSymptomSelection();

    } catch (error) {
      this.showMessage('symptomMessage', '저장 실패: ' + error.message, 'error');
    }
  },

  // 메시지 표시
  showMessage(elementId, message, type) {
    const container = document.getElementById(elementId);
    container.innerHTML = `<div class="message ${type}">${message}</div>`;

    setTimeout(() => {
      container.innerHTML = '';
    }, 3000);
  },

  // 탭 전환
  switchTab(tabName) {
    // 모든 탭 버튼과 콘텐츠 비활성화
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // 선택된 탭 활성화
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');

    // 기록 탭이면 데이터 로드
    if (tabName === 'records') {
      this.loadRecords(7);
    }

    // 분석 탭이면 초기 상태 유지 (사용자가 기간 선택할 때까지)
    if (tabName === 'analysis') {
      const analysisContent = document.getElementById('analysisContent');
      if (analysisContent.innerHTML.includes('로딩') || analysisContent.innerHTML.includes('분석')) {
        // 이미 분석 중이거나 완료된 상태면 그대로 유지
      } else if (!analysisContent.innerHTML.includes('analysis-table')) {
        // 결과가 없으면 초기 메시지 표시
        analysisContent.innerHTML = '<div class="empty-state">분석 기간을 선택해주세요</div>';
      }
    }
  },

  // 기록 조회
  async loadRecords(days) {
    const container = document.getElementById('recordsContent');
    container.innerHTML = '<div class="loading">로딩 중</div>';

    try {
      const result = await this.callApi('getRecords', { days: days });

      if (result.foodRecords.length === 0 && result.symptomRecords.length === 0) {
        container.innerHTML = '<div class="empty-state">기록이 없습니다</div>';
        return;
      }

      // 날짜별로 그룹화
      const recordsByDate = this.groupRecordsByDate(result.foodRecords, result.symptomRecords);

      // HTML 생성
      let html = '';
      Object.keys(recordsByDate).sort().reverse().forEach(date => {
        const records = recordsByDate[date];
        html += `
          <div class="record-day">
            <h3>${this.formatDate(date)}</h3>
            ${records.map(record => `
              <div class="record-item ${record.type}">
                <div class="record-time">${record.time}</div>
                <div class="record-content">
                  <div class="record-type">${record.type === 'food' ? '식단' : '증상'}</div>
                  ${record.item}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      });

      container.innerHTML = html;

    } catch (error) {
      container.innerHTML = '<div class="empty-state">기록을 불러올 수 없습니다</div>';
    }
  },

  // 날짜별 그룹화
  groupRecordsByDate(foodRecords, symptomRecords) {
    const grouped = {};

    foodRecords.forEach(record => {
      const date = record.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push({
        type: 'food',
        time: record.time,
        item: record.item
      });
    });

    symptomRecords.forEach(record => {
      const date = record.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push({
        type: 'symptom',
        time: record.time,
        item: record.item
      });
    });

    // 각 날짜의 기록을 시간순 정렬
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => a.time.localeCompare(b.time));
    });

    return grouped;
  },

  // 날짜 포맷
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = dateStr.split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateOnly === todayStr) {
      return '오늘';
    } else if (dateOnly === yesterdayStr) {
      return '어제';
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const weekday = weekdays[date.getDay()];
      return `${month}월 ${day}일 (${weekday})`;
    }
  },

  // 분석 데이터 로드
  async loadAnalysis(days) {
    const container = document.getElementById('analysisContent');
    container.innerHTML = '<div class="loading">분석 중...</div>';

    try {
      const result = await this.callApi('getAnalysisData', { days: days });

      if (result.foodRecords.length === 0 || result.symptomRecords.length === 0) {
        container.innerHTML = '<div class="empty-state">분석할 데이터가 충분하지 않습니다. 식단과 증상을 더 기록해주세요.</div>';
        return;
      }

      // 상관관계 분석
      const analysis = this.calculateCorrelation(result.foodRecords, result.symptomRecords);

      // 결과 렌더링
      this.renderAnalysisResults(analysis, container);

    } catch (error) {
      container.innerHTML = '<div class="empty-state">분석을 불러올 수 없습니다</div>';
    }
  },

  // 상관관계 계산
  calculateCorrelation(foodRecords, symptomRecords) {
    const correlations = {};

    // 각 음식 섭취 기록에 대해
    foodRecords.forEach(foodRecord => {
      const foodDateTime = this.parseDateTime(foodRecord.date, foodRecord.time);
      const foodItem = foodRecord.item;

      if (!correlations[foodItem]) {
        correlations[foodItem] = {
          totalIntake: 0,
          symptoms: {}
        };
      }
      correlations[foodItem].totalIntake++;

      // 해당 음식 섭취 후 발생한 증상 찾기
      symptomRecords.forEach(symptomRecord => {
        const symptomDateTime = this.parseDateTime(symptomRecord.date, symptomRecord.time);
        const symptomItem = symptomRecord.item;

        // 증상이 음식 섭취 후에 발생했는지 확인
        const timeDiffMs = symptomDateTime - foodDateTime;
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

        // 음식 섭취 후 0~24시간 내 증상만 고려
        if (timeDiffHours >= 0 && timeDiffHours <= 24) {
          if (!correlations[foodItem].symptoms[symptomItem]) {
            correlations[foodItem].symptoms[symptomItem] = {
              '0-2h': 0,
              '2-6h': 0,
              '6-12h': 0,
              '12-24h': 0,
              total: 0
            };
          }

          // 시간대별 분류
          if (timeDiffHours < 2) {
            correlations[foodItem].symptoms[symptomItem]['0-2h']++;
          } else if (timeDiffHours < 6) {
            correlations[foodItem].symptoms[symptomItem]['2-6h']++;
          } else if (timeDiffHours < 12) {
            correlations[foodItem].symptoms[symptomItem]['6-12h']++;
          } else {
            correlations[foodItem].symptoms[symptomItem]['12-24h']++;
          }

          correlations[foodItem].symptoms[symptomItem].total++;
        }
      });
    });

    // 위험도 점수 계산 및 정렬
    const analysisResults = [];

    Object.keys(correlations).forEach(food => {
      const foodData = correlations[food];

      Object.keys(foodData.symptoms).forEach(symptom => {
        const symptomData = foodData.symptoms[symptom];
        const riskScore = (symptomData.total / foodData.totalIntake * 100).toFixed(1);

        analysisResults.push({
          food: food,
          symptom: symptom,
          riskScore: parseFloat(riskScore),
          occurrences: symptomData.total,
          totalIntake: foodData.totalIntake,
          timeWindows: {
            '0-2h': symptomData['0-2h'],
            '2-6h': symptomData['2-6h'],
            '6-12h': symptomData['6-12h'],
            '12-24h': symptomData['12-24h']
          }
        });
      });
    });

    // 위험도 점수로 내림차순 정렬
    analysisResults.sort((a, b) => b.riskScore - a.riskScore);

    return analysisResults;
  },

  // 날짜와 시간을 Date 객체로 변환
  parseDateTime(date, time) {
    // date가 문자열인 경우 (YYYY-MM-DD)
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const timeStr = time || '00:00';
    return new Date(`${dateStr}T${timeStr}:00`);
  },

  // 분석 결과 렌더링
  renderAnalysisResults(results, container) {
    if (results.length === 0) {
      container.innerHTML = '<div class="empty-state">상관관계가 발견되지 않았습니다</div>';
      return;
    }

    let html = `
      <div class="analysis-summary">
        <p><strong>총 ${results.length}개</strong>의 음식-증상 상관관계가 발견되었습니다.</p>
      </div>
      <div class="analysis-table-wrapper">
        <table class="analysis-table">
          <thead>
            <tr>
              <th>음식</th>
              <th>증상</th>
              <th>위험도</th>
              <th>발생 횟수</th>
              <th>시간대별 발생</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(result => {
      const riskClass = this.getRiskClass(result.riskScore);
      const timeWindowsText = `0-2h: ${result.timeWindows['0-2h']} | 2-6h: ${result.timeWindows['2-6h']} | 6-12h: ${result.timeWindows['6-12h']} | 12-24h: ${result.timeWindows['12-24h']}`;

      html += `
        <tr>
          <td><strong>${result.food}</strong></td>
          <td>${result.symptom}</td>
          <td>
            <span class="risk-badge ${riskClass}">
              ${result.riskScore}%
            </span>
          </td>
          <td>${result.occurrences} / ${result.totalIntake}회</td>
          <td class="time-windows">${timeWindowsText}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
      <div class="analysis-legend">
        <h4>해석 가이드</h4>
        <ul>
          <li><span class="risk-badge risk-high">높음</span>: 50% 이상 - 해당 음식이 증상을 유발할 가능성이 높습니다</li>
          <li><span class="risk-badge risk-medium">중간</span>: 25-50% - 주의가 필요합니다</li>
          <li><span class="risk-badge risk-low">낮음</span>: 25% 미만 - 우연일 가능성이 있으나 관찰이 필요합니다</li>
        </ul>
        <p style="margin-top: 1rem; color: #666; font-size: 0.9rem;">
          💡 시간대별 발생: 음식 섭취 후 증상이 나타난 시간대를 표시합니다. 예를 들어 "0-2h: 3"은 해당 음식 섭취 후 2시간 이내에 3번 증상이 발생했음을 의미합니다.
        </p>
      </div>
    `;

    container.innerHTML = html;
  },

  // 위험도에 따른 CSS 클래스 반환
  getRiskClass(riskScore) {
    if (riskScore >= 50) return 'risk-high';
    if (riskScore >= 25) return 'risk-medium';
    return 'risk-low';
  }
};

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
