// sw.js — BarberOS Service Worker
// Gestisce: cache offline + Web Push Notifications

const CACHE = 'barberos-v2';
const ASSETS = ['/', '/index.html', '/manifest.json'];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH (network-first, fallback cache) ────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'BarberOS', body: 'Hai un nuovo aggiornamento', icon: '/icon-192.png' };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon  || '/icon-192.png',
      badge:   data.badge || '/icon-96.png',
      tag:     data.tag   || 'barberos',
      data:    data.url   || '/',
      actions: data.actions || [],
      vibrate: [200, 100, 200],
    })
  );
});

// Tap sulla notifica → apre l'app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});

// ── SYNC IN BACKGROUND ───────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-appointments') {
    e.waitUntil(syncAppointments());
  }
});

async function syncAppointments() {
  // Se offline, ritenta le prenotazioni in coda
  const cache = await caches.open('barberos-pending');
  const reqs  = await cache.keys();
  for (const req of reqs) {
    try {
      const cached = await cache.match(req);
      const body   = await cached.json();
      const res    = await fetch(req, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) await cache.delete(req);
    } catch {}
  }
}
