const CACHE_NAME = 'quicklearnfeed-cache-v1';
const urlsToCache = [
  '/',
  '/static/css/styles.css',
  '/static/js/script.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
