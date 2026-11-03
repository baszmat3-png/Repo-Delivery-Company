'use strict';
/* ريو — عامل خدمة صغير لإشعارات المحادثة فقط (نطاق مستقل ./__notify/ حتى لا يتعارض مع sw.js) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const root = new URL('../', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = all.find((c) => c.url.startsWith(root));
    if (target) {
      try { await target.focus(); } catch { /* ignore */ }
      target.postMessage({ type: 'open-notif', data: d });
    } else {
      await self.clients.openWindow(`${root}?open=${encodeURIComponent(d.kind || 'x')}&id=${encodeURIComponent(d.orderId || '')}&no=${encodeURIComponent(d.orderNo || '')}&nid=${encodeURIComponent(d.id || '')}`);
    }
  })());
});
