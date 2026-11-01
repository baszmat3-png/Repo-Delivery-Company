'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { dispatch, HttpError } = require('./routes');
const { seedAdmin, seedDemo } = require('./seed');
const { verify } = require('./auth');

/* ---- المزامنة الفورية (Server-Sent Events): الخادم يرسل إشارة «تغيّر» فقط، وكل جهاز يعيد جلب بياناته المصرّح بها ---- */
const clients = new Set();
let pingTimer = null;
function broadcast() {
  if (pingTimer) return;
  pingTimer = setTimeout(() => {
    pingTimer = null;
    for (const c of clients) { try { c.write(`event: change\ndata: ${Date.now()}\n\n`); } catch { clients.delete(c); } }
  }, 120);
}
function openStream(req, res, url) {
  const p = verify(url.searchParams.get('token') || '');
  if (!p) return send(res, 401, { error: 'انتهت الجلسة' });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*'
  });
  res.write('retry: 2500\n\n: connected\n\n');
  clients.add(res);
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, 20000);
  req.on('close', () => { clearInterval(hb); clients.delete(res); });
}

const WEB = path.join(__dirname, '..', 'web');
const PORT = Number(process.env.PORT) || 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 200 * 1024) { reject(new HttpError(413, 'الطلب كبير جداً')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'بيانات غير صحيحة')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  const file = path.normalize(path.join(WEB, rel));
  if (!file.startsWith(WEB)) return send(res, 403, 'forbidden', { 'Content-Type': 'text/plain' });
  fs.readFile(file, (err, buf) => {
    if (err) {
      if (path.extname(rel)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
      return fs.readFile(path.join(WEB, 'index.html'), (e2, b2) => (e2 ? send(res, 404, 'Not found', { 'Content-Type': 'text/plain' }) : send(res, 200, b2, { 'Content-Type': MIME['.html'] })));
    }
    const ext = path.extname(file).toLowerCase();
    const noCache = ['/sw.js', '/index.html', '/admin.html', '/admin.js', '/admin-lib.js', '/notify-sw.js', '/admin.css', '/config.js', '/app.js', '/style.css'].includes(rel);
    send(res, 200, buf, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600' });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') return send(res, 200, { ok: true });
    if (url.pathname === '/api/stream' && req.method === 'GET') return openStream(req, res, url);
    if (url.pathname.startsWith('/api/')) {
      const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : null;
      const out = await dispatch(req, body, url);
      if (out === undefined) return send(res, 404, { error: 'المسار غير موجود' });
      if (req.method !== 'GET') broadcast();
      return send(res, 200, out, { 'Cache-Control': 'no-store' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain' });
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    return send(res, 500, { error: 'حدث خطأ في الخادم' });
  }
});

(async () => {
  await db.init();
  await seedAdmin();
  const demo = process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : !db.isPg;
  if (demo) await seedDemo();
  server.listen(PORT, () => console.log(`ريو للتوصيل يعمل على المنفذ ${PORT} (${db.isPg ? 'PostgreSQL' : 'SQLite محلي'})`));
})().catch((e) => { console.error('فشل التشغيل:', e); process.exit(1); });
