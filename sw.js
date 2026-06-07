/* SPARK Service Worker — v1 */
var CACHE_NAME = 'spark-static-v1';

var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/about.html',
  '/admin.html',
  '/profile.html',
  '/leaderboard.html',
  '/404.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/css/animations.css',
  '/assets/css/chats.css',
  '/assets/css/miniprofile.css',
  '/assets/css/spark-onboarding.css',
  '/assets/css/about.css',
  '/assets/css/404.css',
  '/assets/css/pwa.css',
  '/assets/js/theme.js',
  '/assets/js/spark-onboarding.js',
  '/assets/js/animations.js',
  '/assets/js/cinematic-intro.js',
  '/assets/js/profile-edit.js',
  '/assets/js/miniprofile.js',
  '/assets/js/onboarding.js',
  '/assets/js/app.js',
  '/assets/js/chats-engine.js',
  '/assets/js/data.js',
  '/assets/js/integrations.js',
  '/assets/js/pwa.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

// ── Install: precache static shell ──────────────────────────────────────────
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.allSettled(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] Skip cache:', url, err.message);
          });
        })
      );
    })
  );
});

// ── Activate: purge old cache versions ──────────────────────────────────────
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ── Message: skipWaiting on demand ──────────────────────────────────────────
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url;
  try { url = new URL(event.request.url); } catch (e) { return; }

  // Network-Only: Supabase API + external CDNs + realtime
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('deno.dev') ||
    url.hostname.includes('deno.net')
  ) {
    return; // let browser handle normally
  }

  // Network-First for HTML navigation: always try to get fresh page, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(function (response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // Cache-First / Stale-While-Revalidate for static assets
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function () { return cached; });

      return cached || network;
    })
  );
});
