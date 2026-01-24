const CACHE_NAME = 'dhu-quiz-v1';
const CACHE_VERSION = 1;

// 静态资源列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/css/mobile.css',
  '/js/app.js',
  '/js/mobile.js',
  '/js/modules/banks.js',
  '/js/modules/practice.js',
  '/js/modules/upload.js',
  '/js/modules/wrongbook.js',
  '/js/modules/rankings.js',
  '/js/modules/progress.js',
  '/js/modules/stats.js',
  '/js/modules/modes.js',
  '/js/modules/core.js',
  '/js/modules/utils.js',
  '/js/modules/settings.js',
  '/js/modules/state.js',
  '/js/modules/index.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// 数据缓存前缀
const DATA_CACHE_PREFIX = 'data-';

// 安装事件：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && !cacheName.startsWith(DATA_CACHE_PREFIX)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 获取事件：拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 对于静态资源，使用缓存优先策略
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) ||
      url.pathname.startsWith('/css/') ||
      url.pathname.startsWith('/js/') ||
      url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 对于数据请求，使用网络优先策略，失败时返回缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 默认使用网络优先
  event.respondWith(networkFirst(request));
});

// 缓存优先策略
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

// 网络优先策略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}
