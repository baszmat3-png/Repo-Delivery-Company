'use strict';
/**
 * الإشعارات: تخزين في قاعدة البيانات + دفع للهاتف حتى لو كان التطبيق مغلقاً.
 *  - المتصفح / PWA: Web Push (VAPID + تشفير aes128gcm حسب RFC 8030/8291/8292) بدون أي حزمة خارجية.
 *  - تطبيق أندرويد: Firebase Cloud Messaging (HTTP v1) عند ضبط FIREBASE_SERVICE_ACCOUNT.
 * أي فشل في الإرسال لا يؤثر أبداً على العملية الأصلية (قبول طلب، شحن...).
 */
const crypto = require('crypto');
const db = require('./db');

const q = db.query;
const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s), 'base64url');
const nf = new Intl.NumberFormat('en-US');
const iqd = (n) => `${nf.format(Math.round(Number(n) || 0))} د.ع`;

/* ---------------- مفاتيح VAPID (تُولَّد مرة واحدة وتُحفظ في قاعدة البيانات) ---------------- */
let VAPID = null; // { pub: Buffer(65), key: KeyObject }
async function initPush() {
  const r = await q(`SELECT value FROM settings WHERE key='vapid'`);
  let jwk = null;
  try { jwk = r.rows[0] ? JSON.parse(r.rows[0].value) : null; } catch { jwk = null; }
  if (!jwk || !jwk.d || !jwk.x || !jwk.y) {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const j = privateKey.export({ format: 'jwk' });
    jwk = { kty: 'EC', crv: 'P-256', x: j.x, y: j.y, d: j.d };
    await q(`INSERT INTO settings(key,value) VALUES('vapid',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [JSON.stringify(jwk)]);
  }
  VAPID = {
    pub: Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]),
    key: crypto.createPrivateKey({ key: jwk, format: 'jwk' })
  };
}
const vapidPublicKey = () => (VAPID ? b64u(VAPID.pub) : '');

function vapidHeader(endpoint) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || 'mailto:admin@rio-delivery.app' }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: VAPID.key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${b64u(VAPID.pub)}`;
}

/* ---------------- تشفير الرسالة (RFC 8291, aes128gcm) ---------------- */
function encryptPayload(sub, text) {
  const uaPub = fromB64u(sub.keys.p256dh);
  const auth = fromB64u(sub.keys.auth);
  if (uaPub.length !== 65 || uaPub[0] !== 4 || auth.length < 16) throw new Error('bad subscription keys');
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPub);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const enc = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, enc]);
}

async function sendWeb(row, payload) {
  const sub = JSON.parse(row.data);
  const body = encryptPayload({ keys: sub.keys }, JSON.stringify(payload));
  const res = await fetch(row.endpoint, {
    method: 'POST',
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high', Authorization: vapidHeader(row.endpoint) },
    body,
    signal: AbortSignal.timeout(10000)
  });
  if (res.status === 404 || res.status === 410) await q('DELETE FROM push_subs WHERE id=$1', [row.id]);
  else if (!res.ok) console.warn('[push] web', res.status);
}

/* ---------------- FCM (تطبيق أندرويد) ---------------- */
let fcmCfg;
function fcmConfig() {
  if (fcmCfg !== undefined) return fcmCfg;
  fcmCfg = null;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const t = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const j = JSON.parse(t);
    if (j.client_email && j.private_key && j.project_id) fcmCfg = j;
  } catch { console.warn('[push] FIREBASE_SERVICE_ACCOUNT غير صالح'); }
  return fcmCfg;
}
let fcmTok = { v: '', exp: 0 };
async function fcmAccessToken() {
  if (fcmTok.v && Date.now() < fcmTok.exp - 60000) return fcmTok.v;
  const c = fcmConfig();
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(c.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }), signal: AbortSignal.timeout(10000)
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('fcm auth failed');
  fcmTok = { v: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return fcmTok.v;
}
async function sendFcm(row, payload) {
  const c = fcmConfig();
  if (!c) return;
  const data = {};
  for (const [k, v] of Object.entries(payload)) if (v !== undefined && v !== null) data[k] = String(v);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + (await fcmAccessToken()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token: row.endpoint, notification: { title: payload.title, body: payload.body }, data, android: { priority: 'HIGH', notification: { sound: 'default', tag: payload.tag } } } }),
    signal: AbortSignal.timeout(10000)
  });
  if (res.status === 404 || res.status === 400) {
    const j = await res.json().catch(() => ({}));
    if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(JSON.stringify(j))) await q('DELETE FROM push_subs WHERE id=$1', [row.id]);
  } else if (!res.ok) console.warn('[push] fcm', res.status);
}

async function pushTo(userId, payload) {
  const subs = (await q('SELECT * FROM push_subs WHERE user_id=$1', [userId])).rows;
  await Promise.allSettled(subs.map((s) => (s.type === 'fcm' ? sendFcm(s, payload) : VAPID ? sendWeb(s, payload) : null)));
}

/* ---------------- الواجهة العامة ---------------- */
/**
 * يحفظ إشعاراً لكل مستخدم ويدفعه لهاتفه في الخلفية.
 * n = { kind, title, body, orderId, orderNo }
 */
async function notify(userIds, n) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).map(Number).filter(Boolean))];
  for (const uid of ids) {
    try {
      const at = Date.now();
      const row = await db.insert('notifs', { user_id: uid, kind: n.kind, title: n.title, body: n.body || '', order_id: n.orderId || null, order_no: n.orderNo || null, at, is_read: 0 });
      await q('DELETE FROM notifs WHERE user_id=$1 AND id NOT IN (SELECT id FROM notifs WHERE user_id=$1 ORDER BY id DESC LIMIT 300)', [uid]);
      const payload = { id: row.id, kind: n.kind, title: n.title, body: n.body || '', orderId: n.orderId || '', orderNo: n.orderNo || '', tag: `rio-${n.kind}-${n.orderId || row.id}` };
      pushTo(uid, payload).catch(() => {});
    } catch (e) { console.warn('[notify]', e.message); }
  }
}

const ST_AR = {
  pending: 'بانتظار سائق', picking_up: 'قيد الاستلام من التاجر', on_the_way: 'في الطريق للزبون', delivered: 'تم التسليم', rejected: 'مرفوض من زبون',
  postponed: 'تأجيل', no_answer: 'لا يرد', problem: 'مشكلة', other: 'حالة أخرى', returned: 'راجع — استلمه التاجر', return_sent: 'أُرجع للتاجر — بانتظار تأكيده',
  partial: 'راجع جزئي', cancelled: 'ملغي'
};

/* طلب جديد (أو أُعيد للانتظار): يصل كل سائق فعّال يستقبل الطلبات ومركبته تناسب الطلب */
async function notifyNewOrder(o, exceptId) {
  const r = await q(`SELECT id FROM users WHERE role='driver' AND active=1 AND receiving=1 AND vehicle=$1`, [o.vehicle === 'car' ? 'car' : 'bike']);
  await notify(r.rows.map((x) => x.id).filter((id) => id !== exceptId), {
    kind: 'order_new', title: `طلب جديد #${o.num}`, orderId: o.id, orderNo: o.num,
    body: `${o.merchant_name} — ${o.merchant_area} ← ${o.customer_area}\nسعر الطلب ${iqd(o.product_price)} + توصيل ${iqd(o.delivery_price)}`
  });
}

module.exports = { initPush, vapidPublicKey, notify, notifyNewOrder, encryptPayload, vapidHeader, iqd, ST_AR, hasFcm: () => !!fcmConfig() };
