// Percí v1.6 · SW actualizado, un único grafo de módulos por versión.
const CACHE = 'perci-shell-v1.12.0-exercise-gifs';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/account-ui.js?v=1.7.6',
  './src/account.js?v=1.7.6',
  './src/app.js?v=1.12.0',
  './src/domain/routine-share.js?v=1.7.6',
  './src/domain/historical-sets.js?v=1.10.0',
  './src/domain/exercise-catalog.js?v=1.12.0',
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
  './src/styles.css?v=1.12.0',
  './assets/favicon.svg',
  './assets/exercises/aperturas-mancuernas.webp',
  './assets/exercises/crunch-abdominal.webp',
  './assets/exercises/curl-biceps.webp',
  './assets/exercises/curl-martillo.webp',
  './assets/exercises/dominadas.webp',
  './assets/exercises/elevacion-lateral.webp',
  './assets/exercises/extension-triceps-polea.webp',
  './assets/exercises/hip-thrust.webp',
  './assets/exercises/jalon-pecho.webp',
  './assets/exercises/pajaros-mancuernas.webp',
  './assets/exercises/peso-muerto.webp',
  './assets/exercises/peso-muerto-rumano.webp',
  './assets/exercises/plancha.webp',
  './assets/exercises/prensa-piernas.webp',
  './assets/exercises/press-banca.webp',
  './assets/exercises/press-militar.webp',
  './assets/exercises/remo-mancuerna.webp',
  './assets/exercises/remo-polea-baja.webp',
  './assets/exercises/sentadilla.webp',
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
