// Network first: the newest version of the site is always used when you are online,
// and the last good copy is used when you are not. So changes show up as soon as GitHub publishes them.
const NAME = 'pooled-drive-web-v2';
const SHELL = ['./', 'app.css', 'app.js', 'ui.js', 'config.js', 'manifest.webmanifest', 'icon-192.png'];
const keyOf = u => { const x = new URL(u, location.href); return x.origin + x.pathname; };   // ignore ?v=...
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(NAME).then(c => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;     // never touch Google or font requests
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => { const copy = res.clone(); caches.open(NAME).then(c => c.put(keyOf(r.url), copy)); return res; }).catch(() => caches.match(keyOf(r.url))));
});
