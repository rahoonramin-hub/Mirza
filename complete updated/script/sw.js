// sw.js

const CACHE_NAME = 'accountant-v5';

const CORE_ASSETS = [
    '/',
    '/manifest.json',
    '/login.html',
    '/home-complete.html',
    '/users-page.html',
    '/account.html',
    '/settings.html',

    '/script/common.js',
    '/script/firebase-config.js',
    '/script/func.js',
    '/script/usefull.js',
    '/script/edits.js',
    '/script/home-complete.js',
    '/script/account.js',
    '/script/users-page.js',
    '/script/settings.js',
    '/script/offline-db.js',
    '/script/sync-manager.js',

    '/styles/login.css',
    '/styles/account.css',
    '/styles/context-menu.css',
    '/styles/home-complete.css',
    '/styles/icon.css',
    '/styles/modal-1.css',
    '/styles/modal-2.css',
    '/styles/modal-export-advanced.css',
    '/styles/record.css',
    '/styles/scrol.css',
    '/styles/settings.css',
    '/styles/top-box.css',
    '/styles/users-page.css',

    '/prof/img.JPG',
    '/prof/isha.jpg',
    '/prof/Capture.JPG',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/16x16.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/24x24.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Notification.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Small.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/32x32.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/ldpi.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Small-40.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/48x48.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/AppIcon24x24@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/mdpi.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Small-50.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/AppIcon27.5x27.5@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Small@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Notification@3x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/64x64.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/hdpi.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-72.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-76.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/AppIcon40x40@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Small-40@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Small@3x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/AppIcon44x44@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/xhdpi.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-Small-50@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-60@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/128x128.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-72@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/xxhdpi.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-76@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-83.5@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/AppIcon86x86@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/Icon-60@3x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/xxxhdpi.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/AppIcon98x98@2x.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/256x256.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/512x512.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/GooglePlayStore.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/iTunesArtwork.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/1024x1024.png',
    '/script/AppIconResizer_202604221359_89e18cefd677f77aa4624a69ac32fde5/iTunesArtwork@2x.png'
];

const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-regular-400.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://unpkg.com/dexie/dist/dexie.js',
    'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js',
    'https://cdn.skypack.dev/dexie'
];

async function cacheAsset(cache, url, useNoCors = false) {
    try {
        const request = new Request(url, useNoCors ? { mode: 'no-cors' } : { cache: 'reload' });
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
            await cache.put(url, response.clone());
        }
    } catch (error) {
        console.warn('[SW] Failed to cache:', url, error);
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(CORE_ASSETS.map((url) => cacheAsset(cache, url)));
        await Promise.all(EXTERNAL_ASSETS.map((url) => cacheAsset(cache, url, true)));
    })());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map((cacheName) => {
                if (cacheName !== CACHE_NAME) {
                    return caches.delete(cacheName);
                }
                return Promise.resolve();
            })
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return;

    const isNavigate = event.request.mode === 'navigate';

    if (isNavigate) {
        event.respondWith((async () => {
            try {
                const response = await fetch(event.request);
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, response.clone());
                return response;
            } catch (error) {
                const cachedPage = await caches.match(event.request);
                if (cachedPage) return cachedPage;
                return caches.match('/login.html');
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        try {
            const response = await fetch(event.request);
            if (response && (response.ok || response.type === 'opaque')) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, response.clone());
            }
            return response;
        } catch (error) {
            return cached;
        }
    })());
});
