/*
 * Service worker: makes the app installable and lets it open without internet.
 *
 * - The page itself (index.html): try the network first so updates arrive.
 *   If there's no answer within 3 s (weak signal) or no internet, open the
 *   saved copy instead; a late answer still updates the saved copy.
 * - Other app files (scripts, styles, icons): use the saved copy if there is
 *   one, otherwise download and save it. Their names change on every build,
 *   so a saved copy is never out of date. When a new index.html arrives,
 *   saved scripts and styles it no longer uses are deleted.
 * - Roboto font files from Google Fonts: saved the same way.
 * - Everything else (Gemini, the Apps Script) is never cached; those are
 *   POST requests and always go to the network. So is the app's
 *   "new version?" check, which asks with cache: 'no-store'.
 *
 * Change CACHE when this file changes, so old saved files are cleared.
 */

const CACHE = 'macro-tracker-v2';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const SLOW_MS = 3000;

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
  if (request.cache === 'no-store') return; // the "new version?" check

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (sameOrigin && request.mode === 'navigate') {
    event.respondWith(networkFirst(event));
  } else if (sameOrigin || isFont) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(event) {
  const cache = await caches.open(CACHE);

  // The download keeps going even if we answer from the saved copy first.
  const fromNetwork = fetch(event.request).then(async (response) => {
    if (response.ok) {
      await cache.put('./', response.clone());
      await removeOldFiles(cache, await response.clone().text());
    }
    return response;
  });
  event.waitUntil(fromNetwork.catch(() => {}));

  const saved = await cache.match('./');
  if (!saved) return fromNetwork.catch(() => Response.error()); // first visit: must wait

  const slow = new Promise((resolve) => setTimeout(() => resolve(saved), SLOW_MS));
  return Promise.race([fromNetwork, slow]).catch(() => saved); // no internet: saved copy
}

/** Deletes saved scripts and styles (assets/…) the new index.html doesn't use. */
async function removeOldFiles(cache, html) {
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    const file = path.slice(path.indexOf('assets/'));
    if (path.includes('/assets/') && !html.includes(file)) await cache.delete(request);
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
