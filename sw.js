const CACHE_NAME = 'data-security-module-v1.0.0';
const STATIC_CACHE = 'data-security-static-v1.0.0';

// Static assets to cache
const STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/assets/logo.svg',
  '/assets/logo_dark.svg',
  '/assets/favicon.svg',
  '/assets/Sheet10_Firewalls__IDS.docx',
  '/media/image1.png',
  '/media/image2.png',
  '/media/image3.png',
  '/media/image4.png',
  '/media/image5.png',
  '/media/image6.png',
  '/media/image7.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network with chrome-extension filtering
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Filter out chrome-extension URLs to prevent cache errors
  if (url.protocol === 'chrome-extension:') {
    console.log('[SW] Ignoring chrome-extension request:', url.href);
    return;
  }

  // Filter out unsupported URL schemes
  if (!['http:', 'https:'].includes(url.protocol)) {
    console.log('[SW] Ignoring unsupported URL scheme:', url.protocol);
    return;
  }

  // Handle navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response for caching
          const responseClone = response.clone();

          // Cache successful responses
          if (response.status === 200) {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseClone))
              .catch((error) => console.error('[SW] Cache put error:', error));
          }

          return response;
        })
        .catch(() => {
          // Return cached version or offline fallback
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return offline page if available
              return caches.match('/offline.html')
                .then((offlineResponse) => {
                  return offlineResponse || new Response('Offline - Please check your internet connection', {
                    status: 503,
                    statusText: 'Service Unavailable'
                  });
                });
            });
        })
    );
    return;
  }

  // Handle static assets - serve from cache first, then network
  if (STATIC_FILES.some(staticFile => event.request.url.includes(staticFile))) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request)
            .then((response) => {
              // Cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE)
                  .then((cache) => cache.put(event.request, responseClone))
                  .catch((error) => console.error('[SW] Static cache put error:', error));
              }
              return response;
            })
            .catch((error) => {
              console.error('[SW] Fetch error for static asset:', error);
              // Return a basic fallback for critical assets
              if (event.request.url.includes('logo.svg')) {
                return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="95" fill="#00ACC1"/><text x="100" y="110" text-anchor="middle" fill="white" font-size="24">DS</text></svg>', {
                  headers: { 'Content-Type': 'image/svg+xml' }
                });
              }
            });
        })
    );
    return;
  }

  // Default fetch handling with null checks
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // Validate response before caching
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Check accept header for content type filtering
            const acceptHeader = event.request.headers ? event.request.headers.get('accept') : null;
            if (acceptHeader && !acceptHeader.includes('text/html') && !acceptHeader.includes('*/*')) {
              return response;
            }

            // Clone and cache the response
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseClone))
              .catch((error) => console.error('[SW] Cache put error:', error));

            return response;
          })
          .catch((error) => {
            console.error('[SW] Fetch error:', error);
            // Return offline fallback for HTML requests
            if (event.request.headers && event.request.headers.get('accept') &&
                event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
          });
      })
  );
});

// Message handling for cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});
