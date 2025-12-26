/**
 * SERVICE WORKER (THE OFFLINE GUARDIAN)
 * Version: 2.1.0 (Patched: Chart.js Offline Support)
 * Strategy: "Shell First, Lazy Rest"
 * * 1. INSTALL: Caches only the critical "App Shell" (HTML/CSS/Core JS).
 * 2. FETCH: Intercepts requests.
 * - Critical Assets -> Cache First (Speed).
 * - Logic/Views -> Stale-While-Revalidate (Updates in background).
 * - External CDNs -> Cache First (Save bandwidth).
 */

const CACHE_NAME = 'upsc-v4-theme-update'';

// 1. THE APP SHELL (Download these immediately)
// Keep this list SMALL for fast boot.
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/js/main.js',
    './assets/js/config.js',
    './assets/js/ui/ui-manager.js',
    './assets/js/ui/views/ui-home.js',      // Home View
    './assets/js/ui/components/ui-header.js', // Navigation
    './assets/js/services/data-seeder.js',    // The Database Generator
    './assets/js/services/db.js',              // The Database Connection
    // 🛡️ FIX: Pre-cache Chart.js so Analytics works offline immediately
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// ============================================================
// 1. INSTALL PHASE ( The Setup )
// ============================================================

self.addEventListener('install', (event) => {
    console.log('孫 SW: Installing...');
    
    // Skip waiting forces this SW to become active immediately
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('孫 SW: Pre-caching App Shell...');
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
});

// ============================================================
// 2. ACTIVATE PHASE ( The Cleanup )
// ============================================================

self.addEventListener('activate', (event) => {
    console.log('孫 SW: Activated.');
    
    // Claim clients immediately so the user doesn't need to refresh
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Delete old caches (Migration Strategy)
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) {
                            console.log('孫 SW: Deleting old cache', key);
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

// ============================================================
// 3. FETCH PHASE ( The Interceptor )
// ============================================================

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // A. IGNORE NON-GET REQUESTS (Post/Put etc.)
    if (event.request.method !== 'GET') return;

    // B. STRATEGY: STALE-WHILE-REVALIDATE
    // Best for: JS Files, Views, Engines.
    // Logic: "Give me the cached version FAST, but check network for updates in background."
    if (url.pathname.includes('/assets/js/') || url.pathname.includes('/ui/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                
                // Fetch from network to update cache for NEXT time
                const networkFetch = fetch(event.request).then((networkResponse) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });

                // Return cached response immediately if available, else wait for network
                return cachedResponse || networkFetch;
            })
        );
        return;
    }

    // C. STRATEGY: CACHE FIRST, FALLBACK TO NETWORK
    // Best for: Images, Fonts, External CDNs (Tailwind, FontAwesome, Chart.js)
    // Logic: "If I have it, use it. These files rarely change."
    if (
        url.pathname.includes('/assets/icons/') || 
        url.pathname.includes('/assets/audio/') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('cdnjs.cloudflare.com') || 
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')
    ) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(event.request).then((networkResponse) => {
                    // Check if valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                        return networkResponse;
                    }

                    // Cache it for future
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                }).catch(() => {
                    // Offline Fallback for Images? (Optional)
                    // if (event.request.destination === 'image') return caches.match('/assets/icons/offline.png');
                });
            })
        );
        return;
    }

    // D. DEFAULT: NETWORK ONLY
    // For API calls or anything else (Data Seeding is local, so this handles edge cases)
    event.respondWith(fetch(event.request));
});

