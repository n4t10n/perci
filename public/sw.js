// PWA shell cache v0.9: funcionamiento local primero; la nube opcional no funciona sin conexión.
const CACHE = 'perci-shell-v1.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/app.js?v=1.0', './src/brand.js', './src/account.js', './src/account-ui.js', './src/styles.css?v=1.0',
  './src/pwa.js', './src/data/repository.js',
  './src/data/migration-preflight.js',
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
