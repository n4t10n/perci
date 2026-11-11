// Percí v1.6 · SW actualizado, un único grafo de módulos por versión.
const CACHE = 'perci-shell-v1.7.6-rutinas-photo-custom-exercise-order-date-summary-left';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/account-ui.js?v=1.7.6',
  './src/account.js?v=1.7.6',
  './src/app.js?v=1.7.6',
  './src/domain/routine-share.js?v=1.7.6',
  './src/brand.js?v=1.7.6',
  './src/data/auto-hydration.js?v=1.7.6',
  './src/data/auto-refresh.js?v=1.7.6',
  './src/data/import-cleanup.js?v=1.7.6',
  './src/data/first-device-hydration.js?v=1.7.6',
  './src/data/migration-preflight.js?v=1.7.6',
  './src/data/offline-outbox.js?v=1.7.6',
  './src/data/record-drafts.js?v=1.7.6',
  './src/data/repository.js?v=1.7.6',
  './src/domain/initial-state.js?v=1.7.6',
  './src/domain/training-insights.js?v=1.7.6',
  './src/domain/routine-session-tools.js?v=1.7.6',
  './src/domain/startup-route.js?v=1.7.6',
  './src/pwa.js?v=1.7.6',
  './src/styles.css?v=1.7.6',
  './assets/favicon.svg',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/perci-horizDark.svg',
  './assets/perci-horizLight.svg',
  './assets/perci-iconDark.svg',
  './assets/perci-iconLight.svg',
  './assets/perci-vertDark.svg',
  './assets/perci-vertLight.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('perci-shell-') && key !== CACHE).map(key => caches.delete(key))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});
