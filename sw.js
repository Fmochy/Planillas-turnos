// Service worker: permite usar la aplicación sin internet.
// Con conexión siempre trae la última versión; sin conexión usa la copia guardada.
const CACHE = 'planillas-v1';
const FILES = [
  './', './index.html', './css/styles.css', './lib/exceljs.min.js',
  './js/engine.js', './js/importer.js', './js/exporter.js', './js/app.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
