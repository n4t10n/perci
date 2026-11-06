// PWA shell cache v1.3: autenticación previa online, datos de usuario accesibles offline si se habían guardado.
const CACHE = 'perci-shell-v1.4.1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/app.js?v=1.4.1', './src/brand.js', './src/account.js?v=1.4.1', './src/account-ui.js?v=1.4.1', './src/styles.css?v=1.4.1',
  './src/pwa.js', './src/data/repository.js',
  './src/data/migration-preflight.js', './src/data/import-cleanup.js',
  './src/data/auto-hydration.js?v=1.4.1', './src/data/record-drafts.js?v=1.4.1', './src/data/offline-outbox.js?v=1.4.1',
  './src/domain/initial-state.js', './src/domain/startup-route.js',
  './assets/favicon.svg', './assets/icon-180.png',
  './assets/icon-192.png', './assets/icon-512.png',
  './assets/perci-horizDark.svg', './assets/perci-horizLight.svg',
  './assets/perci-iconDark.svg', './assets/perci-iconLight.svg',
  './assets/perci-vertDark.svg', './assets/perci-vertLight.svg'
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
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (new URL(request.url).pathname.startsWith('/api/')) return; // Datos de cuenta jamás en caché PWA.
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});
