// sw.js — BarberOS Service Worker
// Gestisce: cache offline + Web Push Notifications

const CACHE = 'barberos-v5';
const ASSETS = ['/', '/index.html', '/manifest.json'];
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='40' fill='%230a0a0a'/%3E%3Ctext y='140' x='20' font-size='140'%3E%E2%9C%82%EF%B8%8F%3C/text%3E%3C/svg%3E";

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

// ── FETCH (solo stesso origine: evita interferenze con blob/download e link esterni in PWA)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = e.request.url;
  if (u.startsWith('blob:') || u.startsWith('data:')) return;
  let originOk = false;
  try { originOk = new URL(u).origin === self.location.origin; } catch (_) {}
  if (!originOk) return;
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
  let data = { title: 'BarberOS', body: 'Hai un nuovo aggiornamento', icon: ICON };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon  || ICON,
      badge:   data.badge || ICON,
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
