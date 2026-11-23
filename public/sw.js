// Minimal service worker so the app can be installed to the home screen.
// Pages are always loaded from the network so data stays current.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
