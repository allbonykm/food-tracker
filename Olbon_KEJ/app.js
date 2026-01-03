/**
 * 올본한의원 권은재 님 식단기록 앱
 */

const app = {
    // Google Apps Script 웹 앱 URL (배포 후 입력)
    apiUrl: 'https://script.google.com/macros/s/AKfycbx0uY-EVUYi21Ae9sLAQQYfuQYQ1o-xQKNspbZAtofoiBDQkUN6k8Q1i48Bo2OAMlLRrw/exec',

    // 온보딩에서 추가된 메뉴 임시 저장
    onboardingMenus: [],

    // 캐시 설정
    CACHE_KEYS: {
        ONBOARDING_COMPLETE: 'olbonFood_onboardingComplete',
        FREQUENT_MENUS: 'olbonFood_frequentMenus',
        RECENT_MENUS: 'olbonFood_recentMenus'
    },

    // 새로고침 간격 (30초)
    REFRESH_INTERVAL: 30000,
    refreshTimer: null,

    // 초기화
    init() {
        const isOnboardingComplete = localStorage.getItem(this.CACHE_KEYS.ONBOARDING_COMPLETE);

        if (isOnboardingComplete === 'true') {
            // 온보딩 완료 → 메인 앱 표시
            document.getElementById('onboardingPanel').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            this.loadMainData();
        } else {
            // 첫 방문 → 온보딩 표시
            document.getElementById('onboardingPanel').style.display = 'block';
            document.getElementById('mainApp').style.display = 'none';
        }

        // Service Worker 등록
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.log('Service Worker registration failed:', err);
            });
        }
    },

    // 한국 시간 가져오기
    getKoreanDateTime() {
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

        const year = koreaTime.getFullYear();
        const month = String(koreaTime.getMonth() + 1).padStart(2, '0');
        const day = String(koreaTime.getDate()).padStart(2, '0');
        const hours = String(koreaTime.getHours()).padStart(2, '0');
        const minutes = String(koreaTime.getMinutes()).padStart(2, '0');

        return {
            date: `${year}-${month}-${day}`,
            time: `${hours}:${minutes}`,
            display: `${month}월 ${day}일 ${hours}:${minutes}`
        };
    },

    // ==================== 온보딩 관련 ====================

    // 온보딩에서 메뉴 추가
    async addOnboardingMenu() {
        const input = document.getElementById('onboardingInput');
        const menuName = input.value.trim();

        if (!menuName) {
            this.showMessage('onboardingMessage', '메뉴 이름을 입력해주세요', 'error');
            return;
        }

        if (this.onboardingMenus.includes(menuName)) {
            this.showMessage('onboardingMessage', '이미 추가된 메뉴입니다', 'error');
            return;
        }

        try {
            // Google Sheets로 전송
            await this.callApi('addFrequentMenu', { menu: menuName });

            // 로컬 목록에 추가
            this.onboardingMenus.push(menuName);
            this.updateOnboardingMenuList();

            // 입력창 초기화
            input.value = '';
            input.focus();

            this.showMessage('onboardingMessage', `"${menuName}" 추가됨!`, 'success');

            // 입력완료 버튼 활성화
            document.getElementById('completeOnboardingBtn').disabled = false;

        } catch (error) {
            this.showMessage('onboardingMessage', '저장 실패: ' + error.message, 'error');
        }
    },

    // 온보딩 메뉴 목록 업데이트
    updateOnboardingMenuList() {
        const container = document.getElementById('onboardingAddedMenus');

        if (this.onboardingMenus.length === 0) {
            container.innerHTML = '<div class="empty-state">아직 등록된 메뉴가 없습니다</div>';
            return;
        }

        container.innerHTML = this.onboardingMenus.map(menu =>
            `<span class="added-menu-tag">${menu}</span>`
        ).join('');
    },

    // 온보딩 완료
    completeOnboarding() {
        if (this.onboardingMenus.length === 0) {
            this.showMessage('onboardingMessage', '최소 1개 이상의 메뉴를 등록해주세요', 'error');
            return;
        }

        // 온보딩 완료 상태 저장
        localStorage.setItem(this.CACHE_KEYS.ONBOARDING_COMPLETE, 'true');

        // 화면 전환
        document.getElementById('onboardingPanel').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';

        // 메인 데이터 로드
        this.loadMainData();
    },

    // ==================== 메인 앱 ====================

    // 메인 데이터 로드
    async loadMainData() {
        try {
            await Promise.all([
                this.loadFrequentMenus(),
                this.loadRecentMenus()
            ]);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        }
    },

    // 자주 먹는 메뉴 로드
    async loadFrequentMenus() {
        const container = document.getElementById('frequentMenus');

        try {
            const result = await this.callApi('getFrequentMenus');

            if (!result.menus || result.menus.length === 0) {
                container.innerHTML = '<div class="empty-state">등록된 메뉴가 없습니다</div>';
                return;
            }

            container.innerHTML = '';
            result.menus.forEach(menu => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-menu';
                btn.textContent = menu;
                btn.onclick = () => this.saveMenuRecord(menu, btn);
                container.appendChild(btn);
            });

            // 캐시 저장
            localStorage.setItem(this.CACHE_KEYS.FREQUENT_MENUS, JSON.stringify(result.menus));

        } catch (error) {
            // 캐시에서 로드 시도
            const cached = localStorage.getItem(this.CACHE_KEYS.FREQUENT_MENUS);
            if (cached) {
                const menus = JSON.parse(cached);
                container.innerHTML = '';
                menus.forEach(menu => {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-menu';
                    btn.textContent = menu;
                    btn.onclick = () => this.saveMenuRecord(menu, btn);
                    container.appendChild(btn);
                });
            } else {
                container.innerHTML = '<div class="empty-state">메뉴를 불러올 수 없습니다</div>';
            }
        }
    },

    // 최근 등록 메뉴 로드
    async loadRecentMenus() {
        const container = document.getElementById('recentMenus');

        try {
            const result = await this.callApi('getRecentMenus');

            if (!result.menus || result.menus.length === 0) {
                container.innerHTML = '<div class="empty-state">최근 기록이 없습니다</div>';
                return;
            }

            container.innerHTML = '';
            result.menus.forEach(menu => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-menu-recent';
                btn.textContent = menu;
                btn.onclick = () => this.saveMenuRecord(menu, btn);
                container.appendChild(btn);
            });

        } catch (error) {
            container.innerHTML = '<div class="empty-state">최근 기록을 불러올 수 없습니다</div>';
        }
    },

    // 메뉴 기록 저장 (버튼 클릭 시)
    async saveMenuRecord(menuName, btn) {
        const { date, time, display } = this.getKoreanDateTime();

        // 버튼 비활성화 (중복 클릭 방지)
        if (btn) {
            btn.disabled = true;
            btn.classList.add('saving');
        }

        try {
            await this.callApi('saveMenuRecord', {
                date: date,
                time: time,
                menu: menuName
            });

            this.showMessage('foodMessage', `✅ "${menuName}" 기록됨 (${display})`, 'success');

            // 최근 메뉴 새로고침
            await this.loadRecentMenus();

        } catch (error) {
            this.showMessage('foodMessage', '기록 실패: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('saving');
            }
        }
    },

    // 직접 입력으로 메뉴 저장
    async saveCustomMenu() {
        const input = document.getElementById('customMenuInput');
        const menuName = input.value.trim();

        if (!menuName) {
            this.showMessage('foodMessage', '메뉴 이름을 입력해주세요', 'error');
            return;
        }

        await this.saveMenuRecord(menuName, null);
        input.value = '';
    },

    // ==================== 기록 보기 ====================

    // 기록 조회
    async loadRecords() {
        const container = document.getElementById('recordsContent');
        container.innerHTML = '<div class="loading">로딩 중</div>';

        try {
            const result = await this.callApi('getRecords');

            if (!result.records || result.records.length === 0) {
                container.innerHTML = '<div class="empty-state">기록이 없습니다</div>';
                return;
            }

            // 날짜별로 그룹화
            const recordsByDate = this.groupRecordsByDate(result.records);

            // HTML 생성
            let html = '';

            // 날짜별 내림차순 정렬
            const sortedDates = Object.keys(recordsByDate).sort().reverse();

            sortedDates.forEach(date => {
                const records = recordsByDate[date];

                // 날짜 헤더 포맷팅
                const formattedHeader = this.formatDateHeader(date);

                html += `
          <div class="record-day">
            <h3>${formattedHeader}</h3>
            <div class="record-table">
              <div class="record-table-header">
                <span class="col-time">시간</span>
                <span class="col-menu">메뉴</span>
                <span class="col-flag">표시</span>
              </div>
              ${records.map(record => `
                <div class="record-row">
                  <span class="col-time">${record.time}</span>
                  <span class="col-menu">${record.menu}</span>
                  <span class="col-flag">${record.isChecked ? '💡' : ''}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
            });

            container.innerHTML = html;

        } catch (error) {
            container.innerHTML = '<div class="empty-state">기록을 불러올 수 없습니다</div>';
        }
    },

    // 날짜별 그룹화 (시간순 오름차순 정렬)
    groupRecordsByDate(records) {
        const grouped = {};

        records.forEach(record => {
            const date = record.date;
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(record);
        });

        // 각 날짜의 기록을 시간순 오름차순 정렬
        Object.keys(grouped).forEach(date => {
            grouped[date].sort((a, b) => a.time.localeCompare(b.time));
        });

        return grouped;
    },

    // 날짜 헤더 포맷팅
    formatDateHeader(dateStr) {
        try {
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
                const month = dateObj.getMonth() + 1;
                const day = dateObj.getDate();
                const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                const weekday = weekdays[dateObj.getDay()];
                return `${month}월 ${day}일 (${weekday})`;
            }
        } catch (e) { }
        return dateStr;
    },

    // 기록보기 주기적 새로고침 시작
    startRecordsRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this.refreshTimer = setInterval(() => {
            this.loadRecords();
        }, this.REFRESH_INTERVAL);
    },

    // 주기적 새로고침 중지
    stopRecordsRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },

    // ==================== 유틸리티 ====================

    // API 호출
    async callApi(action, data = {}) {
        try {
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

    // 메시지 표시
    showMessage(elementId, message, type) {
        const container = document.getElementById(elementId);
        if (!container) return;

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

        // 기록 탭이면 데이터 로드 및 주기적 새로고침 시작
        if (tabName === 'records') {
            this.loadRecords();
            this.startRecordsRefresh();
        } else {
            this.stopRecordsRefresh();
        }
    },

    // 도움말 페이지 열기
    openGuide() {
        window.open('guide.html', '_blank');
    }
};

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
