// Offline shell for the installed app. The build replaces PRECACHE and VERSION (see vite.config.ts).
// Only the app's own static files are cached: never the API, never a file the user opened (those live in memory),
// never another origin. Anything else goes straight to the network.
const VERSION = '__VERSION__';
const PRECACHE = '__PRECACHE__';
const CACHE = `nain3d-shell-${VERSION}`;

const scope = self.registration.scope;
const shellUrls = Array.isArray(PRECACHE) ? PRECACHE : [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(shellUrls.map((path) => new URL(path, scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('nain3d-shell-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** True for same-origin GET requests to files inside the app's scope that are not API calls. */
function isShellRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (!url.href.startsWith(scope)) return false;
  const path = url.pathname;
  return !path.includes('/api/') && !path.endsWith('/health');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isShellRequest(request)) return;

  if (request.mode === 'navigate') {
    // Fresh page when online, the cached shell when not.
    event.respondWith(
      fetch(request).catch(() => caches.match(new URL('./', scope).href, { ignoreVary: true }).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  event.respondWith(
    // Module scripts are CORS requests, so servers may answer with `Vary: Origin`; the stored copy still applies.
    caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request)),
  );
});
