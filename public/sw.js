/*
 * Service worker: makes the app installable and lets it open without internet.
 *
 * - The page itself (index.html): try the network first so updates arrive,
 *   fall back to the saved copy when offline.
 * - Other app files (scripts, styles, icons): use the saved copy if there is
 *   one, otherwise download and save it. Their names change on every build,
 *   so a saved copy is never out of date.
 * - Roboto font files from Google Fonts: saved the same way.
 * - Everything else (Gemini, the Apps Script) is never cached; those are
 *   POST requests and always go to the network.
 *
 * Change CACHE when this file changes, so old saved files are cleared.
 */

const CACHE = 'macro-tracker-v1';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return; // API calls: leave alone

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (sameOrigin && request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (sameOrigin || isFont) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('./', response.clone());
    return response;
  } catch {
    return (await cache.match('./')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
