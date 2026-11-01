const VERSION = 'quant-coach-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const CORE_FILES = [
  '/',
  '/index.html',
  '/question-bank.json',
  '/verified-solutions.pdf',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(CORE_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(name => name.startsWith('quant-coach-') && name !== SHELL_CACHE)
        .map(name => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/index.html', response.clone());
        return response;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && (
        url.pathname.startsWith('/assets/') ||
        url.pathname === '/question-bank.json' ||
        url.pathname === '/verified-solutions.pdf' ||
        url.pathname === '/manifest.webmanifest' ||
        url.pathname.startsWith('/icons/')
      )) {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
