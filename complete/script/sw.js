// sw.js

const CACHE_NAME = 'accountant-v2'; // با هر تغییر اساسی در فایل‌ها، این مقدار را افزایش دهید

// لیست فایل‌هایی که می‌خواهیم در هنگام نصب حتماً کش شوند
const urlsToCache = [
    '/',
    '/login.html',
    '/home-complete.html',
    '/users-page.html',
    '/account.html',
    '/script/common.js',
    '/script/firebase-config.js',
    '/script/func.js',
    '/script/usefull.js',
    '/script/edits.js',
    '/styles/account.css',
    '/styles/context-menu.css',
    '/styles/home-complete.css',
    '/styles/icon.css',
    '/styles/modal-1.css',
    '/styles/modal-2.css',
    '/styles/record.css',
    '/styles/scrol.css',
    '/styles/top-box.css',
    '/styles/users-page.css'
];

// نصب Service Worker و کش کردن فایل‌های اولیه
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching initial resources');
            return cache.addAll(urlsToCache);
        })
    );
    // فعال‌سازی بلافاصله (بدون نیاز به بستن تب‌ها)
    self.skipWaiting();
});

// فعال‌سازی: پاک کردن کش‌های قدیمی
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// رهگیری درخواست‌های شبکه
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    const isHtmlRequest = requestUrl.pathname.endsWith('.html') || 
                          requestUrl.pathname === '/' || 
                          requestUrl.pathname.endsWith('/');

    // استراتژی برای فایل‌های HTML: Network First
    if (isHtmlRequest) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // اگر پاسخ معتبر بود، کش را به‌روز کن
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // در صورت آفلاین بودن، از کش استفاده کن
                    return caches.match(event.request);
                })
        );
    } 
    // استراتژی برای منابع استاتیک (CSS, JS, images): Cache First با به‌روزرسانی پس‌زمینه
    else {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(error => {
                        console.warn('[SW] Fetch failed; returning cached version if available.', error);
                    });
                    // اگر پاسخ کش موجود بود، همان را برگردان و در پس‌زمینه به‌روزرسانی کن
                    return cachedResponse || fetchPromise;
                });
            })
        );
    }
});