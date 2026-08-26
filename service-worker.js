// Open Infra Sales Dashboard — Service Worker
// Strategy: stale-while-revalidate. Serves instantly from cache (works offline),
// then refreshes the cache in the background so the next load has the latest data.
const CACHE_NAME = 'oi-dashboard-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './data.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_FILES).catch(function() {
        // If a file is missing/unreachable, don't block install on it
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // data.json is fetched with a cache-busting "?v=" query string on every load.
  // Strip it for cache lookups so we can still serve a (slightly stale) copy offline.
  var isDataJson = req.url.indexOf('data.json') !== -1;
  var cacheKey = isDataJson ? req.url.split('?')[0] : req;

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(cacheKey).then(function(cached) {
        var networkFetch = fetch(req).then(function(res) {
          if (res && res.status === 200) {
            cache.put(cacheKey, res.clone());
          }
          return res;
        }).catch(function() {
          return cached; // offline — fall back to whatever's cached (may be undefined)
        });
        // Serve cached copy immediately if we have one, refresh in background;
        // otherwise wait for the network.
        return cached || networkFetch;
      });
    })
  );
});
