/* СИГНАЛ · service worker
   Кешируется только оболочка приложения.
   Видео, сегменты HLS/DASH, прокси, CDN и API — всегда напрямую в сеть,
   чтобы не ломать Range-запросы и не забивать кеш. */
'use strict';

const CACHE = 'signal-shell-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  /* всё стороннее — только сеть */
  if (url.origin !== self.location.origin) return;

  /* медиа и Range — только сеть */
  if (req.headers.has('range')) return;
  if (/\.(mp4|webm|m3u8|mpd|ts|m4s|mp3|aac|vtt|png|jpg)(\?|$)/i.test(url.pathname)) return;

  /* навигация: сеть, при офлайне — оболочка */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || Response.error()));
    })
  );
});