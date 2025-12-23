// Service Worker for PWA
const CACHE_NAME = 'food-symptom-tracker-v1';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// 설치 이벤트
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// 활성화 이벤트
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch 이벤트 - Network First 전략 (API 호출용)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // API 응답이면 캐시하지 않음
                if (event.request.url.includes('script.google.com')) {
                    return response;
                }

                // 정적 파일은 캐시
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // 네트워크 실패 시 캐시에서 가져오기
                return caches.match(event.request);
            })
    );
});
