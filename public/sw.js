// MaveriX Service Worker
// This service worker handles caching and offline functionality

const CACHE_NAME = 'maverix-v1';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Take control of all clients immediately
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
    ])
  );
});

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync event (for future use)
self.addEventListener('sync', (event) => {
  // Background sync handler
});
