// خدمة: تخزّن ملفات الواجهة فقط (لا تخزّن API أبداً) + تستقبل إشعارات الدفع حتى والتطبيق مغلق.
const CACHE = 'rio-v17';
const FILES = ['./', 'style.css', 'app.js', 'dialog.js', 'theme.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'hero.jpg', 'logo.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match('./'))));
});

/* ---- إشعارات الدفع ---- */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'ريوو للتوصيل اسرع', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    // يجب أن يُعرض إشعار مع كل دفعة (شرط iOS وكروم) وإلا يُلغى الاشتراك؛ لذلك نجرّب بخيارات كاملة ثم بخيارات بسيطة
    const title = d.title || 'ريوو للتوصيل اسرع';
    try {
      await self.registration.showNotification(title, {
        body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || ('rio-' + (d.id || Date.now())),
        renotify: true, requireInteraction: d.kind === 'order_new', dir: 'rtl', lang: 'ar', vibrate: [250, 100, 250, 100, 250], timestamp: Date.now(), data: d
      });
    } catch {
      await self.registration.showNotification(title, { body: d.body || '', data: d });
    }
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const root = new URL('./', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (d.url) {
      const w = all.find((c) => c.url.includes(d.url));
      if (w) { try { await w.focus(); } catch { /* ignore */ } } else await self.clients.openWindow(root + d.url);
      return;
    }
    const target = all.find((c) => c.url.startsWith(root));
    if (target) {
      try { await target.focus(); } catch { /* ignore */ }
      target.postMessage({ type: 'open-notif', data: d });
    } else {
      await self.clients.openWindow(`${root}?open=${encodeURIComponent(d.kind || 'x')}&id=${encodeURIComponent(d.orderId || '')}&no=${encodeURIComponent(d.orderNo || '')}&nid=${encodeURIComponent(d.id || '')}`);
    }
  })());
});
