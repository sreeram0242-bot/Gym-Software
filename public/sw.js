self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A minimal fetch event listener is required for Chrome's PWA install criteria
  event.respondWith(fetch(event.request).catch(() => {
    return new Response('Network error occurred.');
  }));
});
