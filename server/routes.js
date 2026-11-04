'use strict';
const crypto = require('crypto');
const db = require('./db');
const { sign, verify, hashPassword, checkPassword } = require('./auth');
const { notify, notifyNewOrder, iqd, ST_AR, vapidPublicKey, hasFcm } = require('./push');

const q = db.query;
const DAY = 86400000;
const OFF = (Number(process.env.TZ_OFFSET_MIN) || 180) * 60000; // بغداد UTC+3

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (msg, status = 400) => { throw new HttpError(status, msg); };

/* ---------- أدوات ---------- */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const nd = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d)).replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d));
const normPhone = (s) => nd(s).replace(/\D/g, '');
const validPhone = (p) => /^07\d{9}$/.test(p);
const normArea = (s) => nd(s).trim().replace(/\s+/g, ' ').replace(/^ال/, '');
const clean = (s, max = 120) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const int = (v) => { const n = Math.round(Number(nd(v).replace(/[,\s]/g, ''))); return Number.isFinite(n) ? n : NaN; };

const dayStart = (t) => Math.floor((t + OFF) / DAY) * DAY - OFF;
const weekStart = (t) => { const ds = dayStart(t); const dow = new Date(ds + OFF).getUTCDay(); return ds - ((dow + 1) % 7) * DAY; };
const monthStart = (t) => { const d = new Date(t + OFF); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFF; };
const yearStart = (t) => { const d = new Date(t + OFF); return Date.UTC(d.getUTCFullYear(), 0, 1) - OFF; };
const sumOf = (a, k) => a.reduce((s, o) => s + (Number(o[k]) || 0), 0);
const isRet = (o) => o.status === 'returned' || o.status === 'return_sent' || o.status === 'partial' || o.status === 'rejected';

const STATUSES = ['pending', 'picking_up', 'on_the_way', 'delivered', 'no_answer', 'postponed', 'rejected', 'return_sent', 'returned', 'cancelled'];
const DRIVER_STATUSES = ['picking_up', 'on_the_way', 'delivered', 'rejected', 'no_answer', 'postponed', 'return_sent'];
const RETURNABLE = ['rejected', 'no_answer', 'postponed'];
const TROUBLE = ['no_answer', 'postponed', 'problem', 'other'];
const DONE = ['delivered', 'partial'];

const DEF_SETTINGS = { bikeSame: 3000, bikeOther: 5000, carSame: 5000, carOther: 8000, feeSame: 500, feeOther: 1000, lateMin: 45, support: '', receipts: 1, ocDesign: 'classic' };
/* تصاميم الوصولات (بطاقة الطلب): يختارها المدير وتُطبَّق فوراً على كل الحسابات */
const OC_KEYS = ['classic', 'bold', 'green', 'ticket', 'sun', 'night'];

/* قوالب رسائل الواتساب (تُعدَّل من لوحة التحكم). المتغيرات بين أقواس: {order_no} {product} ... */
const DEF_TEMPLATES = {
  cust_picking_up: 'مرحباً، طلبك رقم #{order_no} من {merchant} قيد الاستلام من المتجر وسيكون عندك قريباً.\nالمنتج: {product} × {qty}\nالمبلغ المطلوب: {total}\n{app}',
  cust_on_the_way: 'مرحباً، المندوب {driver} في الطريق إليك بطلبك رقم #{order_no} من {merchant}.\nالمنتج: {product} × {qty}\nالمبلغ المطلوب: {total}\nيرجى تجهيز المبلغ وإبقاء الهاتف متاحاً.\n{app}',
  cust_delivered: 'تم تسليم طلبك رقم #{order_no} من {merchant}. شكراً لثقتك بنا.\n{app}',
  cust_rejected: 'بخصوص طلبك رقم #{order_no} من {merchant}: تم تسجيل الطلب كمرفوض من طرفك وسيُعاد للمتجر.\n{app}',
  cust_no_answer: 'مرحباً، حاول المندوب {driver} الاتصال بك بخصوص طلبك رقم #{order_no} من {merchant} ولم يتم الرد. يرجى الرد أو مراسلتنا.\n{app}',
  cust_postponed: 'مرحباً، تم تأجيل توصيل طلبك رقم #{order_no} من {merchant} حسب الاتفاق، وسنتواصل معك قبل الموعد الجديد.\n{app}',
  cust_default: 'مرحباً، بخصوص طلبك رقم #{order_no} من {merchant}\nالمنتج: {product} × {qty}\nالمبلغ المطلوب: {total}\n{app}',
  driver_support: 'مرحباً فريق الدعم، أنا المندوب {name} ({phone}).\nأحتاج مساعدة بخصوص الطلب رقم #{order_no} ({merchant}).',
  admin_driver: 'مرحباً {name}، من إدارة {app}:\nبخصوص الطلب رقم #{order_no} من {merchant}.\nالمنتج: {product} × {qty}\nالمبلغ: {total}',
  admin_merchant: 'مرحباً {name}، من إدارة {app}:\nبخصوص الطلب رقم #{order_no}.\nالمنتج: {product} × {qty}\nالمبلغ: {total}',
  account: 'مرحباً {name}\nتم إنشاء حسابك في {app}.\nرابط الدخول: {login_url}\nرقم الهاتف: {phone}\nكلمة المرور: {password}\nيُفضّل تغيير كلمة المرور بعد أول دخول.'
};

async function getSettings() {
  const r = await q(`SELECT value FROM settings WHERE key='main'`);
  let saved = {};
  try { saved = r.rows[0] ? JSON.parse(r.rows[0].value) : {}; } catch { /* ignore */ }
  const templates = { ...DEF_TEMPLATES };
  for (const k of Object.keys(DEF_TEMPLATES)) if (saved.templates && typeof saved.templates[k] === 'string' && saved.templates[k].trim()) templates[k] = saved.templates[k];
  return { ...DEF_SETTINGS, ...saved, templates };
}

/* رابط موقع المتجر: يقبل رابط خرائط (https) أو إحداثيات فقط، ويُرفض غير ذلك */
function cleanUrl(v) {
  const t = String(v || '').trim().slice(0, 600);
  if (!t) return '';
  if (/^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(t)) return t.replace(/\s+/g, '');
  if (!/^https?:\/\/[^\s<>"']+$/i.test(t)) fail('رابط الموقع غير صحيح. الصق رابط الخرائط كاملاً (يبدأ بـ https://)');
  return t;
}

/* صلاحيات فريق الإدارة: {صفحة: 'view'|'edit'} */
const PAGES_ALL = ['home', 'orders', 'merchants', 'drivers', 'customers', 'finance', 'vouchers', 'cards', 'settings'];
function permsOf(u) {
  const o = safeJson(u.perms, {});
  const out = {};
  for (const k of PAGES_ALL) if (o && (o[k] === 'view' || o[k] === 'edit')) out[k] = o[k];
  return out;
}
function cleanPerms(x) {
  const out = {};
  for (const k of PAGES_ALL) if (x && (x[k] === 'view' || x[k] === 'edit')) out[k] = x[k];
  return out;
}
/* يتحقق إن كان المستخدم (مدير أو موظف) يملك صلاحية: pages = صفحة أو قائمة (أي واحدة تكفي) ، level = view|edit */
function can(user, pages, level = 'view') {
  if (user.role === 'admin') return true;
  if (user.role !== 'staff') return false;
  const pm = permsOf(user);
  return (Array.isArray(pages) ? pages : [pages]).some((pg) => (level === 'edit' ? pm[pg] === 'edit' : !!pm[pg]));
}
const need = (user, pages, level) => { if (!can(user, pages, level)) fail('ليست لديك صلاحية لهذا الإجراء', 403); };

const pub = (u) => ({
  id: u.id, role: u.role, name: u.name, phone: u.phone, active: !!u.active,
  area: u.area, vehicle: u.vehicle, balance: u.balance, receiving: !!u.receiving, discount: 0, mapUrl: u.map_url || '', createdAt: u.created_at,
  ...(u.role === 'staff' ? { username: String(u.phone).replace(/^staff:/, ''), perms: permsOf(u) } : {})
});

const ord = (r) => ({
  id: r.id, no: r.num, merchantId: r.merchant_id, merchantName: r.merchant_name, merchantArea: r.merchant_area,
  merchantPhone: r.merchant_phone, customerArea: r.customer_area, customerPhone: r.customer_phone,
  product: r.product, qty: r.qty, vehicle: r.vehicle, sameArea: !!r.same_area, note: r.note,
  productPrice: r.product_price, deliveryPrice: r.delivery_price, total: r.total, status: r.status,
  driverId: r.driver_id, driverName: r.driver_name, fee: r.fee, createdAt: r.created_at, updatedAt: r.updated_at,
  acceptedAt: r.accepted_at, deliveredAt: r.delivered_at, discount: 0, merchantMap: r.merchant_map || '', log: safeJson(r.log, [])
});

function safeJson(s, d) { try { return JSON.parse(s); } catch { return d; } }
const pushLog = (row, status, at) => JSON.stringify([...safeJson(row.log, []), { s: status, at }].slice(-30));

/* ---------- جدول المسارات ---------- */
const routes = [];
function route(method, pattern, opts, handler) {
  if (typeof opts === 'function') { handler = opts; opts = {}; }
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, opts, handler });
}

async function authenticate(req) {
  const h = req.headers.authorization || '';
  const p = verify(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!p) return null;
  const r = await q('SELECT * FROM users WHERE id=$1', [p.id]);
  const u = r.rows[0];
  return u && u.active ? u : null;
}

async function dispatch(req, body, url) {
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(url.pathname);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    let user = null;
    if (!r.opts.public) {
      user = await authenticate(req);
      if (!user) fail('انتهت الجلسة، سجّل الدخول مرة أخرى', 401);
      if (r.opts.roles && !r.opts.roles.includes(user.role)) fail('غير مسموح', 403);
      if (user.role === 'staff' && r.opts.perm) need(user, r.opts.perm[0], r.opts.perm[1]);
    }
    return r.handler({ req, params, query: Object.fromEntries(url.searchParams), body: body || {}, user });
  }
  return undefined;
}

/* ---------- الدخول والحساب ---------- */
const attempts = new Map();
function throttle(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < 10 * 60000);
  if (a.length >= 10) fail('محاولات كثيرة، حاول بعد عدة دقائق', 429);
  a.push(now);
  attempts.set(key, a);
}

route('POST', '/api/login', { public: true }, async (c) => {
  const rawId = String(c.body.phone || '').trim();
  const phone = /^[A-Za-z][A-Za-z0-9_.-]{2,29}$/.test(rawId) ? 'staff:' + rawId.toLowerCase() : normPhone(rawId);
  const pw = String(c.body.password || '');
  if (!phone || !pw) fail('أدخل اسم المستخدم أو رقم الهاتف وكلمة المرور');
  throttle(c.req.socket.remoteAddress + '|' + phone);
  const r = await q('SELECT * FROM users WHERE phone=$1', [phone]);
  const u = r.rows[0];
  if (!u || !(await checkPassword(pw, u.pass_hash))) fail('رقم الهاتف أو كلمة المرور غير صحيحة', 401);
  if (!u.active) fail('هذا الحساب موقوف أو بانتظار موافقة الإدارة، تواصل مع الإدارة', 403);
  return { token: sign({ id: u.id, role: u.role }), user: pub(u) };
});

/* تسجيل ذاتي للتاجر/السائق: يُنشأ الحساب موقوفاً حتى تفعّله الإدارة من لوحة التحكم */
route('POST', '/api/register', { public: true }, async (c) => {
  const b = c.body;
  throttle('reg|' + c.req.socket.remoteAddress);
  const role = b.role === 'merchant' ? 'merchant' : 'driver';
  const name = clean(b.name, 60);
  const phone = normPhone(b.phone);
  const password = String(b.password || '');
  if (name.length < 2) fail('اكتب الاسم');
  if (!validPhone(phone)) fail('رقم الهاتف يجب أن يبدأ بـ 07 ويتكوّن من 11 رقماً');
  if (password.length < 6) fail('كلمة المرور لا تقل عن 6 أحرف');
  if (role === 'merchant' && !clean(b.area, 60)) fail('اكتب منطقة المتجر');
  if (role === 'driver' && !['bike', 'car'].includes(b.vehicle)) fail('اختر نوع المركبة: دراجة أو سيارة');
  const ex = await q('SELECT id FROM users WHERE phone=$1', [phone]);
  if (ex.rows.length) fail('رقم الهاتف مسجّل مسبقاً', 409);
  await db.insert('users', {
    role, name, phone, pass_hash: await hashPassword(password), active: 0, area: role === 'merchant' ? clean(b.area, 60) : '',
    vehicle: b.vehicle === 'car' ? 'car' : 'bike', balance: 0, receiving: 1, discount: 0, map_url: role === 'merchant' ? cleanUrl(b.mapUrl) : '', created_at: Date.now()
  });
  return { ok: true, pending: true };
});

route('GET', '/api/me', async (c) => ({ user: pub(c.user) }));

route('PUT', '/api/me/profile', async (c) => {
  const name = clean(c.body.name, 60);
  if (name.length < 2) fail('اكتب الاسم');
  const patch = { name };
  const u = await db.update('users', 'id', c.user.id, patch);
  return { user: pub(u) };
});

route('PUT', '/api/me/password', async (c) => {
  const next = String(c.body.next || '');
  if (next.length < 6) fail('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف');
  if (!(await checkPassword(String(c.body.current || ''), c.user.pass_hash))) fail('كلمة المرور الحالية غير صحيحة', 403);
  await db.update('users', 'id', c.user.id, { pass_hash: await hashPassword(next) });
  return { ok: true };
});

// حذف الحساب (مطلوب من متجر Play): يُلغى الحساب وتُمسح بياناته الشخصية، وتبقى سجلات الطلبات بدون هوية.
async function deleteAccount(user, password) {
  if (user.role === 'admin' || user.role === 'staff') fail('لا يمكن حذف هذا الحساب من هنا', 403);
  if (!(await checkPassword(String(password || ''), user.pass_hash))) fail('كلمة المرور غير صحيحة', 403);
  await db.update('users', 'id', user.id, {
    name: 'حساب محذوف', phone: 'deleted-' + user.id, active: 0, receiving: 0, area: '',
    pass_hash: await hashPassword(crypto.randomBytes(16).toString('hex'))
  });
  await q('UPDATE messages SET text=$1 WHERE user_id=$2', ['(محذوفة)', user.id]);
  return { ok: true };
}
route('POST', '/api/me/delete', async (c) => deleteAccount(c.user, c.body.password));
route('POST', '/api/delete-account', { public: true }, async (c) => {
  const phone = normPhone(c.body.phone);
  throttle(c.req.socket.remoteAddress + '|del|' + phone);
  const r = await q('SELECT * FROM users WHERE phone=$1', [phone]);
  const u = r.rows[0];
  if (!u || !(await checkPassword(String(c.body.password || ''), u.pass_hash))) fail('رقم الهاتف أو كلمة المرور غير صحيحة', 401);
  return deleteAccount(u, c.body.password);
});

route('GET', '/api/settings', async () => ({ settings: await getSettings() }));

/* ---------- المحادثة ---------- */
async function orderForChat(id, user) {
  const r = await q('SELECT * FROM orders WHERE id=$1', [id]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  const allowed = user.role === 'admin' || (user.role === 'staff' && can(user, 'orders')) || (user.role === 'merchant' && o.merchant_id === user.id) || (user.role === 'driver' && o.driver_id === user.id);
  if (!allowed) fail('غير مسموح', 403);
  return o;
}
route('GET', '/api/orders/:id/messages', async (c) => {
  const o = await orderForChat(Number(c.params.id), c.user);
  const r = await q('SELECT id,user_id,role,name,text,at FROM messages WHERE order_id=$1 ORDER BY at ASC LIMIT 200', [o.id]);
  return { messages: r.rows.map((m) => ({ id: m.id, userId: m.user_id, role: m.role, name: m.name, text: m.text, at: m.at })) };
});
route('POST', '/api/orders/:id/messages', async (c) => {
  const o = await orderForChat(Number(c.params.id), c.user);
  const text = String(c.body.text || '').trim().slice(0, 500);
  if (!text) fail('اكتب رسالة');
  const m = await db.insert('messages', { order_id: o.id, user_id: c.user.id, role: c.user.role === 'staff' ? 'admin' : c.user.role, name: c.user.name, text, at: Date.now() });
  await notify([o.merchant_id, o.driver_id].filter((id) => id && id !== c.user.id), { kind: 'chat', title: `${c.user.name} · طلب #${o.num}`, body: text, orderId: o.id, orderNo: o.num });
  return { message: { id: m.id, userId: m.user_id, role: m.role, name: m.name, text: m.text, at: m.at } };
});

/* ---------- إشعارات المحادثة: رسائل وصلت للمستخدم من الطرف الآخر في طلباته ---------- */
route('GET', '/api/notifications', { roles: ['merchant', 'driver'] }, async (c) => {
  const col = c.user.role === 'driver' ? 'o.driver_id' : 'o.merchant_id';
  const hasAfter = c.query.after !== undefined && c.query.after !== '';
  const after = Number(c.query.after) || 0;
  const base = `FROM messages m JOIN orders o ON o.id=m.order_id WHERE ${col}=$1 AND m.user_id<>$1`;
  if (!hasAfter) {
    const mx = await q(`SELECT COALESCE(MAX(m.id),0) AS n ${base}`, [c.user.id]);
    return { items: [], last: Number(mx.rows[0].n) || 0 };
  }
  const r = await q(`SELECT m.id,m.order_id,m.role,m.name,m.text,m.at,o.num ${base} AND m.id>$2 ORDER BY m.id ASC LIMIT 50`, [c.user.id, after]);
  const items = r.rows.map((m) => ({ id: m.id, orderId: m.order_id, orderNo: m.num, role: m.role, name: m.name, text: m.text, at: m.at }));
  return { items, last: items.length ? items[items.length - 1].id : after };
});

/* ---------- قائمة الإشعارات + الدفع للهاتف ---------- */
const USERS_ONLY = { roles: ['merchant', 'driver'] };
const PUSH_ROLES = { roles: ['merchant', 'driver', 'admin', 'staff'] };
/* المدير والموظفون (صلاحية الطلبات) يستلمون إشعارات الطلبات أيضاً */
async function notifyAdmins(n) {
  try {
    const r = await q(`SELECT * FROM users WHERE role IN ('admin','staff') AND active=1`);
    const ids = r.rows.filter((u) => can(u, 'orders')).map((u) => u.id);
    if (ids.length) await notify(ids, { ...n, url: 'admin.html' });
  } catch (e) { console.warn('[notifyAdmins]', e.message); }
}
const notifOut = (n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, orderId: n.order_id, orderNo: n.order_no, at: n.at, read: !!n.is_read });
route('GET', '/api/notifs', PUSH_ROLES, async (c) => {
  const uid = c.user.id;
  const unread = Number((await q('SELECT COUNT(*) AS n FROM notifs WHERE user_id=$1 AND is_read=0', [uid])).rows[0].n);
  const mx = Number((await q('SELECT COALESCE(MAX(id),0) AS n FROM notifs WHERE user_id=$1', [uid])).rows[0].n);
  if (c.query.after !== undefined && c.query.after !== '') {
    const r = await q('SELECT * FROM notifs WHERE user_id=$1 AND id>$2 ORDER BY id ASC LIMIT 50', [uid, Number(c.query.after) || 0]);
    return { items: r.rows.map(notifOut), last: mx, unread };
  }
  if (c.query.mode === 'poll') return { items: [], last: mx, unread };
  const limit = Math.min(100, Math.max(1, Number(c.query.limit) || 40));
  const before = Number(c.query.before) || 0;
  const r = before
    ? await q(`SELECT * FROM notifs WHERE user_id=$1 AND id<$2 ORDER BY id DESC LIMIT ${limit + 1}`, [uid, before])
    : await q(`SELECT * FROM notifs WHERE user_id=$1 ORDER BY id DESC LIMIT ${limit + 1}`, [uid]);
  const rows = r.rows.slice(0, limit);
  return { items: rows.map(notifOut), hasMore: r.rows.length > limit, last: mx, unread };
});
route('POST', '/api/notifs/read', USERS_ONLY, async (c) => {
  const ids = Array.isArray(c.body.ids) ? c.body.ids.map(Number).filter(Boolean).slice(0, 200) : [];
  if (c.body.all) await q('UPDATE notifs SET is_read=1 WHERE user_id=$1', [c.user.id]);
  else if (c.body.orderId) await q(`UPDATE notifs SET is_read=1 WHERE user_id=$1 AND order_id=$2 AND kind='chat'`, [c.user.id, Number(c.body.orderId)]);
  else for (const id of ids) await q('UPDATE notifs SET is_read=1 WHERE user_id=$1 AND id=$2', [c.user.id, id]);
  return { unread: Number((await q('SELECT COUNT(*) AS n FROM notifs WHERE user_id=$1 AND is_read=0', [c.user.id])).rows[0].n) };
});
route('POST', '/api/notifs/clear', USERS_ONLY, async (c) => { await q('DELETE FROM notifs WHERE user_id=$1', [c.user.id]); return { ok: true }; });

route('GET', '/api/push/key', { public: true }, async () => ({ key: vapidPublicKey(), fcm: hasFcm() }));
route('POST', '/api/push/subscribe', PUSH_ROLES, async (c) => {
  const b = c.body;
  let type, endpoint, data = '';
  if (b.type === 'fcm') {
    type = 'fcm'; endpoint = String(b.token || '').slice(0, 400);
    if (endpoint.length < 20) fail('رمز غير صحيح');
  } else {
    const s = b.subscription || {};
    type = 'web'; endpoint = String(s.endpoint || '').slice(0, 900);
    if (!/^https:\/\//.test(endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) fail('اشتراك غير صحيح');
    data = JSON.stringify({ keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } });
  }
  await q(`INSERT INTO push_subs(user_id,type,endpoint,data,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, type=excluded.type, data=excluded.data`, [c.user.id, type, endpoint, data, Date.now()]);
  return { ok: true };
});
/* إشعار تجريبي من الإعدادات: يتأكد المستخدم أن الإشعارات تصله فعلاً */
route('POST', '/api/push/test', PUSH_ROLES, async (c) => {
  const [r] = await notify(c.user.id, { kind: 'test', title: 'الإشعارات تعمل ✓', body: 'ستصلك الطلبات وتغيّر حالاتها فور حدوثها' }, { wait: true });
  const x = r || { devices: 0, web: 0, fcm: 0, sent: 0, errors: [] };
  return { ok: true, devices: x.devices, web: x.web, fcm: x.fcm, sent: x.sent, errors: x.errors, fcmConfigured: hasFcm() };
});
route('POST', '/api/push/unsubscribe', PUSH_ROLES, async (c) => {
  const e = String(c.body.endpoint || c.body.token || '');
  if (e) await q('DELETE FROM push_subs WHERE endpoint=$1 AND user_id=$2', [e, c.user.id]);
  return { ok: true };
});

/* ---------- التاجر ---------- */
const MERCHANT = { roles: ['merchant'] };

route('GET', '/api/merchant/home', MERCHANT, async (c) => {
  const r = await q('SELECT * FROM orders WHERE merchant_id=$1 ORDER BY created_at DESC LIMIT 300', [c.user.id]);
  return { me: pub(c.user), settings: await getSettings(), orders: r.rows.map(ord) };
});

// تقرير التاجر لفترة محددة (للتصدير): كل طلبات الفترة بدون حد الـ 300
route('GET', '/api/merchant/report', MERCHANT, async (c) => {
  const from = Number(c.query.from) || 0;
  const to = Number(c.query.to) || Date.now() + DAY;
  const r = await q('SELECT * FROM orders WHERE merchant_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY created_at ASC LIMIT 5000', [c.user.id, from, to]);
  return { me: pub(c.user), orders: r.rows.map(ord) };
});

route('POST', '/api/merchant/orders', MERCHANT, async (c) => {
  const b = c.body;
  const customerArea = clean(b.customerArea, 60);
  const customerPhone = normPhone(b.customerPhone);
  const product = clean(b.product, 80);
  const qty = Math.min(99, Math.max(1, int(b.qty) || 1));
  const vehicle = b.vehicle === 'car' ? 'car' : 'bike';
  const productPrice = int(b.productPrice);
  if (!customerArea) fail('اكتب منطقة الزبون');
  if (!validPhone(customerPhone)) fail('رقم الزبون يجب أن يبدأ بـ 07 ويتكوّن من 11 رقماً');
  if (!product) fail('اكتب نوع المنتج');
  if (!Number.isFinite(productPrice) || productPrice <= 0 || productPrice > 100000000) fail('اكتب سعر المنتج');
  const s = await getSettings();
  const auto = normArea(customerArea) === normArea(c.user.area);
  const same = b.zone === 'same' ? true : b.zone === 'other' ? false : auto;
  const base = s[vehicle + (same ? 'Same' : 'Other')];
  const disc = 0;
  const deliveryPrice = base;
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const m = await q('SELECT COALESCE(MAX(num),1042)+1 AS n FROM orders');
    try {
      const row = await db.insert('orders', {
        num: m.rows[0].n, merchant_id: c.user.id, merchant_name: c.user.name, merchant_area: c.user.area, merchant_phone: c.user.phone, merchant_map: c.user.map_url || '',
        customer_area: customerArea, customer_phone: customerPhone, product, qty, vehicle, same_area: same ? 1 : 0,
        note: clean(b.note, 200), product_price: productPrice, delivery_price: deliveryPrice, total: productPrice + deliveryPrice, discount: disc,
        status: 'pending', driver_id: null, driver_name: '', fee: 0, created_at: now, updated_at: now,
        accepted_at: null, delivered_at: null, log: JSON.stringify([{ s: 'pending', at: now }])
      });
      await notifyNewOrder(row);
      notifyAdmins({ kind: 'order_new', orderId: row.id, orderNo: row.num, title: `طلب جديد #${row.num}`, body: `${row.merchant_name} — ${row.merchant_area} ← ${row.customer_area}\nالمطلوب ${iqd(row.total)}` });
      return { order: ord(row) };
    } catch (e) {
      if (!/unique|duplicate/i.test(String(e.message))) throw e;
    }
  }
  fail('تعذّر إنشاء الطلب، حاول مرة أخرى', 503);
});

route('POST', '/api/merchant/orders/:id/cancel', MERCHANT, async (c) => {
  const r = await q('SELECT * FROM orders WHERE id=$1 AND merchant_id=$2', [Number(c.params.id), c.user.id]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  const now = Date.now();
  const u = await q(`UPDATE orders SET status='cancelled',updated_at=$1,log=$2 WHERE id=$3 AND status='pending' RETURNING *`, [now, pushLog(o, 'cancelled', now), o.id]);
  if (!u.rows.length) fail('لا يمكن إلغاء الطلب بعد قبول السائق له', 409);
  notifyAdmins({ kind: 'order_status', orderId: o.id, orderNo: o.num, title: `التاجر ألغى الطلب #${o.num}`, body: o.merchant_name });
  return { order: ord(u.rows[0]) };
});

route('POST', '/api/merchant/orders/:id/return', MERCHANT, async (c) => {
  const r = await q('SELECT * FROM orders WHERE id=$1 AND merchant_id=$2', [Number(c.params.id), c.user.id]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  if (o.status !== 'return_sent') fail('هذا الطلب ليس بانتظار تأكيد الإرجاع', 409);
  const now = Date.now();
  const status = c.body.received === false ? 'rejected' : 'returned';
  const patch = { status, updated_at: now, delivered_at: status === 'returned' ? now : null, log: pushLog(o, status, now) };
  /* عند تأكيد التاجر استلام المرتجع تُردّ رسوم التطبيق المخصومة من السائق عند قبول الطلب (مرة واحدة فقط) */
  if (status === 'returned' && o.fee > 0 && o.driver_id) {
    await q('UPDATE users SET balance=balance+$1 WHERE id=$2', [o.fee, o.driver_id]);
    await db.insert('txs', { driver_id: o.driver_id, amount: o.fee, kind: 'refund', label: 'استرجاع رسوم التطبيق (تأكيد استلام المرتجع)', order_num: o.num, at: now });
    patch.fee = 0;
  }
  const u = await db.update('orders', 'id', o.id, patch);
  if (o.driver_id) await notify(o.driver_id, { kind: 'order_status', orderId: o.id, orderNo: o.num, title: status === 'returned' ? `أكّد التاجر استلام المرتجع #${o.num}` : `التاجر لم يستلم المرتجع #${o.num}`, body: `${o.merchant_name} · ${ST_AR[status]}` });
  return { order: ord(u) };
});

/* ---------- السائق ---------- */
const DRIVER = { roles: ['driver'] };

async function walletFor(user) {
  const now = Date.now();
  const since = Math.min(monthStart(now), weekStart(now), dayStart(now) - 6 * DAY);
  const done = await q(`SELECT delivery_price,fee,delivered_at FROM orders WHERE driver_id=$1 AND status IN ('delivered','partial') AND delivered_at>=$2`, [user.id, since]);
  const agg = (from) => {
    const rows = done.rows.filter((o) => o.delivered_at >= from);
    return { n: rows.length, net: rows.reduce((a, o) => a + (o.delivery_price - o.fee), 0) };
  };
  const today = dayStart(now);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const from = today - i * DAY;
    const rows = done.rows.filter((o) => o.delivered_at >= from && o.delivered_at < from + DAY);
    days.push({ t: from, n: rows.length, net: rows.reduce((a, o) => a + (o.delivery_price - o.fee), 0) });
  }
  const tx = await q('SELECT * FROM txs WHERE driver_id=$1 ORDER BY at DESC LIMIT 60', [user.id]);
  return {
    balance: user.balance, today: agg(today), week: agg(weekStart(now)), month: agg(monthStart(now)), days,
    txs: tx.rows.map((t) => ({ id: t.id, amount: t.amount, kind: t.kind, label: t.label, orderNo: t.order_num, at: t.at }))
  };
}

route('GET', '/api/driver/home', DRIVER, async (c) => {
  const avail = await q(`SELECT * FROM orders WHERE status='pending' AND vehicle=$1 ORDER BY created_at DESC LIMIT 50`, [c.user.vehicle === 'car' ? 'car' : 'bike']);
  const mine = await q('SELECT * FROM orders WHERE driver_id=$1 ORDER BY updated_at DESC LIMIT 150', [c.user.id]);
  return {
    me: pub(c.user), settings: await getSettings(), available: avail.rows.map(ord), orders: mine.rows.map(ord), wallet: await walletFor(c.user)
  };
});

// تقرير السائق لفترة محددة (للتصدير): الطلبات التي قبلها السائق خلال الفترة
route('GET', '/api/driver/report', DRIVER, async (c) => {
  const from = Number(c.query.from) || 0;
  const to = Number(c.query.to) || Date.now() + DAY;
  const r = await q('SELECT * FROM orders WHERE driver_id=$1 AND COALESCE(accepted_at,created_at)>=$2 AND COALESCE(accepted_at,created_at)<$3 ORDER BY COALESCE(accepted_at,created_at) ASC LIMIT 5000', [c.user.id, from, to]);
  return { me: pub(c.user), orders: r.rows.map(ord) };
});

route('PUT', '/api/driver/receiving', DRIVER, async (c) => {
  const u = await db.update('users', 'id', c.user.id, { receiving: c.body.receiving ? 1 : 0 });
  return { user: pub(u) };
});

route('POST', '/api/driver/orders/:id/accept', DRIVER, async (c) => {
  const u = c.user;
  if (!u.receiving) fail('فعّل استقبال الطلبات أولاً', 409);
  const r = await q('SELECT * FROM orders WHERE id=$1', [Number(c.params.id)]);
  const o = r.rows[0];
  if (!o || o.status !== 'pending') fail('الطلب لم يعد متاحاً', 409);
  if ((o.vehicle === 'car' ? 'car' : 'bike') !== (u.vehicle === 'car' ? 'car' : 'bike')) fail(o.vehicle === 'car' ? 'هذا الطلب لسائقي السيارات فقط' : 'هذا الطلب لسائقي الدراجات فقط', 403);
  const s = await getSettings();
  const fee = o.same_area ? s.feeSame : s.feeOther;
  const pay = await q('UPDATE users SET balance=balance-$1 WHERE id=$2 AND balance>=$1 RETURNING balance', [fee, u.id]);
  if (!pay.rows.length) fail('رصيدك لا يكفي لرسوم التطبيق. اشحن المحفظة أولاً', 402);
  const now = Date.now();
  const claim = await q(
    `UPDATE orders SET status='picking_up',driver_id=$1,driver_name=$2,fee=$3,accepted_at=$4,updated_at=$4,log=$5 WHERE id=$6 AND status='pending' RETURNING *`,
    [u.id, u.name, fee, now, pushLog(o, 'picking_up', now), o.id]
  );
  if (!claim.rows.length) {
    await q('UPDATE users SET balance=balance+$1 WHERE id=$2', [fee, u.id]);
    fail('سائق آخر قبل هذا الطلب قبلك', 409);
  }
  await db.insert('txs', { driver_id: u.id, amount: -fee, kind: 'fee', label: 'رسوم التطبيق', order_num: o.num, at: now });
  notifyAdmins({ kind: 'order_status', orderId: o.id, orderNo: o.num, title: `السائق ${u.name} قبل الطلب #${o.num}`, body: `${o.merchant_name} · ${o.customer_area}` });
  await notify(o.merchant_id, { kind: 'order_accepted', orderId: o.id, orderNo: o.num, title: `تم قبول طلبك #${o.num}`, body: `السائق ${u.name} قبل الطلب وهو في طريقه لاستلامه من المتجر` });
  if (fee > 0) await notify(u.id, { kind: 'wallet_debit', orderId: o.id, orderNo: o.num, title: `خصم رسوم التطبيق −${iqd(fee)}`, body: `طلب #${o.num} · رصيدك الحالي ${iqd(pay.rows[0].balance)}` });
  return { order: ord(claim.rows[0]) };
});

route('POST', '/api/driver/orders/:id/status', DRIVER, async (c) => {
  const status = String(c.body.status || '');
  if (!DRIVER_STATUSES.includes(status)) fail('حالة غير صحيحة');
  const r = await q('SELECT * FROM orders WHERE id=$1 AND driver_id=$2', [Number(c.params.id), c.user.id]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  if (o.status === 'delivered') fail('تم تسليم هذا الطلب ولا يمكن تغيير حالته', 409);
  if (o.status === 'return_sent' || o.status === 'returned') fail('تم إرجاع هذا الطلب للتاجر ولا يمكن تغيير حالته', 409);
  if (status === 'return_sent' && !RETURNABLE.includes(o.status)) fail('يمكن الإرجاع للتاجر بعد حالة: مرفوض أو لا يرد أو تأجيل', 409);
  const now = Date.now();
  const u = await db.update('orders', 'id', o.id, {
    status, updated_at: now, delivered_at: DONE.includes(status) ? (o.delivered_at || now) : null, log: pushLog(o, status, now)
  });
  if (status !== o.status) {
    const T = { picking_up: 'السائق في طريقه لاستلام الطلب', on_the_way: 'الطلب في الطريق إلى الزبون', delivered: 'تم تسليم الطلب للزبون', rejected: 'الزبون رفض الطلب', no_answer: 'الزبون لا يرد على السائق', postponed: 'تم تأجيل الطلب', return_sent: 'السائق أرجع الطلب إليك، أكّد استلامه' };
    notifyAdmins({ kind: 'order_status', orderId: o.id, orderNo: o.num, title: `طلب #${o.num}: ${ST_AR[status]}`, body: `${o.merchant_name} · السائق ${c.user.name}` });
    await notify(o.merchant_id, { kind: 'order_status', orderId: o.id, orderNo: o.num, title: `طلب #${o.num}: ${ST_AR[status]}`, body: `${T[status] || ST_AR[status]} · السائق ${c.user.name}` });
  }
  return { order: ord(u) };
});

route('POST', '/api/driver/charge', DRIVER, async (c) => {
  const number = nd(c.body.number).replace(/\D/g, '');
  if (number.length !== 12) fail('رقم البطاقة يتكوّن من 12 رقماً');
  throttle(c.req.socket.remoteAddress + '|card|' + c.user.id);
  const now = Date.now();
  const used = await q('UPDATE cards SET used=1,used_by=$1,used_at=$2 WHERE number=$3 AND used=0 RETURNING *', [c.user.name, now, number]);
  if (!used.rows.length) {
    const ex = await q('SELECT used FROM cards WHERE number=$1', [number]);
    fail(ex.rows.length ? 'هذه البطاقة مستخدمة مسبقاً' : 'رقم البطاقة غير صحيح', ex.rows.length ? 409 : 404);
  }
  const amount = used.rows[0].amount;
  const b = await q('UPDATE users SET balance=balance+$1 WHERE id=$2 RETURNING balance', [amount, c.user.id]);
  await db.insert('txs', { driver_id: c.user.id, amount, kind: 'charge', label: 'شحن بطاقة', order_num: null, at: now });
  await notify(c.user.id, { kind: 'wallet_credit', title: `تم شحن محفظتك +${iqd(amount)}`, body: `شحن ببطاقة · رصيدك الحالي ${iqd(b.rows[0].balance)}` });
  return { amount, balance: b.rows[0].balance };
});

/* ---------- المدير ---------- */
const ADMIN = { roles: ['admin'] };
const ADM = (pages, level = 'view') => ({ roles: ['admin', 'staff'], perm: [pages, level] });
const ANYPAGE = PAGES_ALL;

route('GET', '/api/admin/overview', ADM('home'), async () => {
  const now = Date.now();
  const today = dayStart(now);
  const one = async (sql, p = []) => (await q(sql, p)).rows[0] || {};
  const todayN = await one('SELECT COUNT(*) AS n FROM orders WHERE created_at>=$1', [today]);
  const active = await one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('picking_up','on_the_way')`);
  const pending = await one(`SELECT COUNT(*) AS n FROM orders WHERE status='pending'`);
  const delivered = await one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('delivered','partial') AND delivered_at>=$1`, [today]);
  const problems = await one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('no_answer','postponed','problem','other') AND updated_at>=$1`, [today]);
  const fees = await one('SELECT COALESCE(SUM(fee),0) AS n FROM orders WHERE accepted_at>=$1', [today]);
  const drivers = await one(`SELECT COUNT(*) AS n, COALESCE(SUM(balance),0) AS bal FROM users WHERE role='driver' AND active=1`);
  const merchants = await one(`SELECT COUNT(*) AS n FROM users WHERE role='merchant' AND active=1`);
  const days = [];
  const since = today - 6 * DAY;
  const recent = await q('SELECT created_at FROM orders WHERE created_at>=$1', [since]);
  for (let i = 6; i >= 0; i--) {
    const from = today - i * DAY;
    days.push({ t: from, n: recent.rows.filter((o) => o.created_at >= from && o.created_at < from + DAY).length });
  }
  const stale = await q(`SELECT * FROM orders WHERE status='pending' AND created_at<$1 ORDER BY created_at ASC LIMIT 10`, [now - 10 * 60000]);
  const trouble = await q(`SELECT * FROM orders WHERE status IN ('no_answer','postponed','problem','other') ORDER BY updated_at DESC LIMIT 10`);
  return {
    ordersToday: todayN.n, active: active.n, pending: pending.n, deliveredToday: delivered.n, problemsToday: problems.n,
    feesToday: fees.n, drivers: drivers.n, driverBalances: drivers.bal, merchants: merchants.n, days,
    attention: [...stale.rows, ...trouble.rows].map(ord)
  };
});

route('GET', '/api/admin/orders', ADM('orders'), async (c) => {
  const w = [], p = [];
  const add = (sql, v) => { p.push(v); w.push(sql.replace('?', '$' + p.length)); };
  if (STATUSES.includes(c.query.status)) add('status=?', c.query.status);
  if (Number(c.query.from)) add('created_at>=?', Number(c.query.from));
  if (Number(c.query.to)) add('created_at<?', Number(c.query.to));
  if (Number(c.query.merchantId)) add('merchant_id=?', Number(c.query.merchantId));
  if (Number(c.query.driverId)) add('driver_id=?', Number(c.query.driverId));
  if (c.query.phone) add('customer_phone=?', normPhone(c.query.phone));
  const limit = Math.min(5000, Math.max(1, Number(c.query.limit) || 300));
  const r = await q(`SELECT * FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ${limit}`, p);
  return { orders: r.rows.map(ord) };
});

route('POST', '/api/admin/orders/:id/status', ADM('orders', 'edit'), async (c) => {
  const status = String(c.body.status || '');
  if (!STATUSES.includes(status)) fail('حالة غير صحيحة');
  const r = await q('SELECT * FROM orders WHERE id=$1', [Number(c.params.id)]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  const now = Date.now();
  const u = await db.update('orders', 'id', o.id, {
    status, updated_at: now, delivered_at: DONE.includes(status) ? (o.delivered_at || now) : null, log: pushLog(o, status, now)
  });
  if (status !== o.status) await notify([o.merchant_id, o.driver_id].filter(Boolean), { kind: 'order_status', orderId: o.id, orderNo: o.num, title: `الإدارة غيّرت حالة الطلب #${o.num}`, body: `الحالة الآن: ${ST_AR[status]}` });
  return { order: ord(u) };
});

route('POST', '/api/admin/orders/:id/requeue', ADM('orders', 'edit'), async (c) => {
  const r = await q('SELECT * FROM orders WHERE id=$1', [Number(c.params.id)]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  if (o.status === 'pending' || !o.driver_id) fail('الطلب غير مسند لسائق', 409);
  const now = Date.now();
  if (o.fee > 0) {
    await q('UPDATE users SET balance=balance+$1 WHERE id=$2', [o.fee, o.driver_id]);
    await db.insert('txs', { driver_id: o.driver_id, amount: o.fee, kind: 'refund', label: 'استرجاع رسوم التطبيق', order_num: o.num, at: now });
  }
  const u = await db.update('orders', 'id', o.id, {
    status: 'pending', driver_id: null, driver_name: '', fee: 0, accepted_at: null, delivered_at: null, updated_at: now, log: pushLog(o, 'pending', now)
  });
  const prevDriver = o.driver_id;
  await notify(prevDriver, { kind: 'order_returned', orderId: o.id, orderNo: o.num, title: `سُحب منك الطلب #${o.num}`, body: 'أعادته الإدارة إلى قائمة السائقين' });
  if (o.fee > 0) await notify(prevDriver, { kind: 'wallet_credit', orderId: o.id, orderNo: o.num, title: `أُرجعت رسوم التطبيق +${iqd(o.fee)}`, body: `طلب #${o.num}` });
  await notify(o.merchant_id, { kind: 'order_status', orderId: o.id, orderNo: o.num, title: `أُعيد طلبك #${o.num} للسائقين`, body: 'بانتظار سائق جديد' });
  await notifyNewOrder(u, prevDriver);
  return { order: ord(u) };
});

/* تعيين الطلب لسائق محدد: يُسحب من السائق السابق (مع إرجاع رسومه كاملة) ويُسند للجديد */
route('POST', '/api/admin/orders/:id/assign', ADM('orders', 'edit'), async (c) => {
  const r = await q('SELECT * FROM orders WHERE id=$1', [Number(c.params.id)]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  if (['delivered', 'partial', 'returned', 'rejected', 'cancelled'].includes(o.status)) fail('لا يمكن تعيين طلب منتهٍ أو ملغي', 409);
  const dr = await q(`SELECT * FROM users WHERE id=$1 AND role='driver' AND active=1`, [Number(c.body.driverId)]);
  const d = dr.rows[0];
  if (!d) fail('اختر سائقاً فعّالاً', 404);
  if (o.driver_id === d.id) fail('الطلب مسند لهذا السائق أصلاً', 409);
  const s = await getSettings();
  const now = Date.now();
  const charge = c.body.charge !== false;
  const fee = charge ? (o.same_area ? s.feeSame : s.feeOther) : 0;
  if (fee > 0) {
    const pay = await q('UPDATE users SET balance=balance-$1 WHERE id=$2 AND balance>=$1 RETURNING balance', [fee, d.id]);
    if (!pay.rows.length) fail('رصيد السائق لا يكفي لرسوم التطبيق. اشحن رصيده أو عيّن الطلب بدون خصم الرسوم', 402);
  }
  if (o.driver_id && o.fee > 0) {
    await q('UPDATE users SET balance=balance+$1 WHERE id=$2', [o.fee, o.driver_id]);
    await db.insert('txs', { driver_id: o.driver_id, amount: o.fee, kind: 'refund', label: 'استرجاع رسوم التطبيق (تحويل الطلب)', order_num: o.num, at: now });
  }
  if (fee > 0) await db.insert('txs', { driver_id: d.id, amount: -fee, kind: 'fee', label: 'رسوم التطبيق', order_num: o.num, at: now });
  const u = await db.update('orders', 'id', o.id, {
    status: 'picking_up', driver_id: d.id, driver_name: d.name, fee, accepted_at: now, delivered_at: null, updated_at: now, log: pushLog(o, 'picking_up', now)
  });
  await notify(d.id, { kind: 'order_assigned', orderId: o.id, orderNo: o.num, title: `عُيّن لك الطلب #${o.num}`, body: `${o.merchant_name} — ${o.merchant_area} ← ${o.customer_area}` });
  if (fee > 0) await notify(d.id, { kind: 'wallet_debit', orderId: o.id, orderNo: o.num, title: `خصم رسوم التطبيق −${iqd(fee)}`, body: `طلب #${o.num}` });
  if (o.driver_id && o.driver_id !== d.id) {
    await notify(o.driver_id, { kind: 'order_returned', orderId: o.id, orderNo: o.num, title: `سُحب منك الطلب #${o.num}`, body: 'حوّلته الإدارة إلى سائق آخر' });
    if (o.fee > 0) await notify(o.driver_id, { kind: 'wallet_credit', orderId: o.id, orderNo: o.num, title: `أُرجعت رسوم التطبيق +${iqd(o.fee)}`, body: `طلب #${o.num}` });
  }
  await notify(o.merchant_id, { kind: 'order_accepted', orderId: o.id, orderNo: o.num, title: `عُيّن سائق لطلبك #${o.num}`, body: `السائق ${d.name}` });
  return { order: ord(u) };
});

route('GET', '/api/admin/users', ADM(['merchants', 'drivers', 'orders']), async (c) => {
  const role = c.query.role === 'merchant' ? 'merchant' : 'driver';
  need(c.user, [role === 'merchant' ? 'merchants' : 'drivers', 'orders']);
  const r = await q(`SELECT * FROM users WHERE role=$1 AND phone NOT LIKE 'deleted-%' ORDER BY created_at DESC LIMIT 500`, [role]);
  return { users: r.rows.map(pub) };
});

route('POST', '/api/admin/users', ADM(['merchants', 'drivers'], 'edit'), async (c) => {
  const b = c.body;
  const role = b.role === 'merchant' ? 'merchant' : 'driver';
  need(c.user, role === 'merchant' ? 'merchants' : 'drivers', 'edit');
  const name = clean(b.name, 60);
  const phone = normPhone(b.phone);
  const password = String(b.password || '');
  if (name.length < 2) fail('اكتب الاسم');
  if (!validPhone(phone)) fail('رقم الهاتف يجب أن يبدأ بـ 07 ويتكوّن من 11 رقماً');
  if (password.length < 6) fail('كلمة المرور لا تقل عن 6 أحرف');
  if (role === 'merchant' && !clean(b.area, 60)) fail('اكتب منطقة المتجر');
  const ex = await q('SELECT id FROM users WHERE phone=$1', [phone]);
  if (ex.rows.length) fail('رقم الهاتف مسجّل مسبقاً', 409);
  const u = await db.insert('users', {
    role, name, phone, pass_hash: await hashPassword(password), active: 1, area: clean(b.area, 60),
    vehicle: b.vehicle === 'car' ? 'car' : 'bike', balance: 0, receiving: 1, discount: 0, map_url: role === 'merchant' ? cleanUrl(b.mapUrl) : '', created_at: Date.now()
  });
  return { user: pub(u) };
});

route('PUT', '/api/admin/users/:id', ADM(['merchants', 'drivers'], 'edit'), async (c) => {
  const b = c.body;
  const r = await q(`SELECT * FROM users WHERE id=$1 AND role IN ('driver','merchant')`, [Number(c.params.id)]);
  const u = r.rows[0];
  if (!u) fail('المستخدم غير موجود', 404);
  need(c.user, u.role === 'merchant' ? 'merchants' : 'drivers', 'edit');
  const patch = {};
  if (b.name !== undefined) { patch.name = clean(b.name, 60); if (patch.name.length < 2) fail('اكتب الاسم'); }
  if (b.phone !== undefined) {
    patch.phone = normPhone(b.phone);
    if (!validPhone(patch.phone)) fail('رقم الهاتف غير صحيح');
    const ex = await q('SELECT id FROM users WHERE phone=$1 AND id<>$2', [patch.phone, u.id]);
    if (ex.rows.length) fail('رقم الهاتف مسجّل مسبقاً', 409);
  }
  if (b.area !== undefined) patch.area = clean(b.area, 60);
  if (b.vehicle !== undefined) patch.vehicle = b.vehicle === 'car' ? 'car' : 'bike';
  if (b.active !== undefined) patch.active = b.active ? 1 : 0;
  if (b.mapUrl !== undefined && u.role === 'merchant') patch.map_url = cleanUrl(b.mapUrl);
  if (b.password) {
    if (String(b.password).length < 6) fail('كلمة المرور لا تقل عن 6 أحرف');
    patch.pass_hash = await hashPassword(String(b.password));
  }
  if (!Object.keys(patch).length) fail('لا يوجد ما يُحدَّث');
  const saved = await db.update('users', 'id', u.id, patch);
  if (patch.map_url !== undefined) await q(`UPDATE orders SET merchant_map=$1 WHERE merchant_id=$2 AND status NOT IN ('delivered','partial','returned','rejected','cancelled')`, [patch.map_url, u.id]);
  return { user: pub(saved) };
});

route('POST', '/api/admin/users/:id/adjust', ADM('drivers', 'edit'), async (c) => {
  const amount = int(c.body.amount);
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000000) fail('اكتب مبلغاً صحيحاً');
  const r = amount > 0
    ? await q(`UPDATE users SET balance=balance+$1 WHERE id=$2 AND role='driver' RETURNING *`, [amount, Number(c.params.id)])
    : await q(`UPDATE users SET balance=balance+$1 WHERE id=$2 AND role='driver' AND balance+$1>=0 RETURNING *`, [amount, Number(c.params.id)]);
  if (!r.rows.length) fail('تعذّر تعديل الرصيد (تأكد من السائق ومن أن الرصيد يكفي)', 409);
  const lbl = clean(c.body.label, 80) || 'تعديل من الإدارة';
  await db.insert('txs', { driver_id: r.rows[0].id, amount, kind: 'admin', label: lbl, order_num: null, at: Date.now() });
  await notify(r.rows[0].id, { kind: amount > 0 ? 'wallet_credit' : 'wallet_debit', title: amount > 0 ? `شحن من الإدارة +${iqd(amount)}` : `سحب من الإدارة −${iqd(-amount)}`, body: `${lbl} · رصيدك الحالي ${iqd(r.rows[0].balance)}` });
  return { user: pub(r.rows[0]) };
});

/* ---------- فريق الإدارة (للمدير فقط): موظفون بصلاحيات محددة ---------- */
const validUsername = (x) => /^[A-Za-z][A-Za-z0-9_.-]{2,29}$/.test(x);
route('GET', '/api/admin/staff', ADMIN, async () => {
  const r = await q(`SELECT * FROM users WHERE role='staff' ORDER BY created_at DESC LIMIT 200`);
  return { staff: r.rows.map(pub) };
});
route('POST', '/api/admin/staff', ADMIN, async (c) => {
  const b = c.body;
  const name = clean(b.name, 60);
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (name.length < 2) fail('اكتب الاسم');
  if (!validUsername(username)) fail('اسم المستخدم: حروف إنكليزية وأرقام فقط (3 أحرف على الأقل) ويبدأ بحرف');
  if (password.length < 6) fail('كلمة المرور لا تقل عن 6 أحرف');
  const ex = await q('SELECT id FROM users WHERE phone=$1', ['staff:' + username]);
  if (ex.rows.length) fail('اسم المستخدم مستخدم مسبقاً', 409);
  const u = await db.insert('users', {
    role: 'staff', name, phone: 'staff:' + username, pass_hash: await hashPassword(password), active: 1, area: '', vehicle: 'bike', balance: 0, receiving: 0,
    discount: 0, map_url: '', perms: JSON.stringify(cleanPerms(b.perms)), created_at: Date.now()
  });
  return { user: pub(u) };
});
route('PUT', '/api/admin/staff/:id', ADMIN, async (c) => {
  const b = c.body;
  const r = await q(`SELECT * FROM users WHERE id=$1 AND role='staff'`, [Number(c.params.id)]);
  const u = r.rows[0];
  if (!u) fail('الموظف غير موجود', 404);
  const patch = {};
  if (b.name !== undefined) { patch.name = clean(b.name, 60); if (patch.name.length < 2) fail('اكتب الاسم'); }
  if (b.perms !== undefined) patch.perms = JSON.stringify(cleanPerms(b.perms));
  if (b.active !== undefined) patch.active = b.active ? 1 : 0;
  if (b.password) {
    if (String(b.password).length < 6) fail('كلمة المرور لا تقل عن 6 أحرف');
    patch.pass_hash = await hashPassword(String(b.password));
  }
  if (!Object.keys(patch).length) fail('لا يوجد ما يُحدَّث');
  return { user: pub(await db.update('users', 'id', u.id, patch)) };
});
route('DELETE', '/api/admin/staff/:id', ADMIN, async (c) => {
  const r = await q(`SELECT id FROM users WHERE id=$1 AND role='staff'`, [Number(c.params.id)]);
  if (!r.rows.length) fail('الموظف غير موجود', 404);
  await q('DELETE FROM users WHERE id=$1', [r.rows[0].id]);
  return { ok: true };
});

route('GET', '/api/admin/cards', ADM('cards'), async () => {
  const r = await q('SELECT * FROM cards ORDER BY created_at DESC, number DESC LIMIT 400');
  return { cards: r.rows.map((k) => ({ number: k.number, amount: k.amount, used: !!k.used, usedBy: k.used_by, usedAt: k.used_at, createdAt: k.created_at })) };
});

route('POST', '/api/admin/cards', ADM('cards', 'edit'), async (c) => {
  const amount = int(c.body.amount);
  const count = Math.min(50, Math.max(1, int(c.body.count) || 1));
  if (!Number.isFinite(amount) || amount < 1000 || amount > 10000000) fail('اختر قيمة صحيحة للبطاقة');
  const now = Date.now();
  const made = [];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 8; t++) {
      const number = String(crypto.randomInt(0, 1e12)).padStart(12, '0');
      try { await db.insert('cards', { number, amount, used: 0, used_by: '', used_at: null, created_at: now }); made.push(number); break; }
      catch (e) { if (!/unique|duplicate|primary/i.test(String(e.message))) throw e; }
    }
  }
  return { made };
});

route('DELETE', '/api/admin/cards/:number', ADM('cards', 'edit'), async (c) => {
  const r = await q('DELETE FROM cards WHERE number=$1 AND used=0', [c.params.number]);
  if (!r.count) fail('لا يمكن حذف بطاقة مستخدمة', 409);
  return { ok: true };
});

route('PUT', '/api/admin/settings', ADM('settings', 'edit'), async (c) => {
  const next = { ...(await getSettings()) };
  { const r0 = await q(`SELECT value FROM settings WHERE key='main'`); let sv = {}; try { sv = r0.rows[0] ? JSON.parse(r0.rows[0].value) : {}; } catch { /* ignore */ } next.templates = sv.templates || {}; }
  for (const k of ['bikeSame', 'bikeOther', 'carSame', 'carOther', 'feeSame', 'feeOther', 'lateMin']) {
    if (c.body[k] !== undefined) {
      const v = int(c.body[k]);
      if (!Number.isFinite(v) || v < 0 || v > 10000000) fail('قيمة غير صحيحة: ' + k);
      next[k] = v;
    }
  }
  if (c.body.templates && typeof c.body.templates === 'object') {
    const t = { ...(next.templates || {}) };
    for (const k of Object.keys(DEF_TEMPLATES)) {
      if (c.body.templates[k] === undefined) continue;
      const v = String(c.body.templates[k] || '').slice(0, 1200).trim();
      if (!v || v === DEF_TEMPLATES[k]) delete t[k]; else t[k] = v;
    }
    next.templates = t;
  }
  if (c.body.ocDesign !== undefined) {
    if (!OC_KEYS.includes(c.body.ocDesign)) fail('تصميم وصل غير صحيح');
    next.ocDesign = c.body.ocDesign;
  }
  if (c.body.receipts !== undefined) next.receipts = [true, 1, '1', 'true'].includes(c.body.receipts) ? 1 : 0;
  if (c.body.support !== undefined) next.support = normPhone(c.body.support).slice(0, 15);
  await q(`INSERT INTO settings(key,value) VALUES('main',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [JSON.stringify(next)]);
  return { settings: await getSettings() };
});

/* ---------- طلب واحد (يُفتح من الإشعار): كل دور يرى ما يخصه فقط ---------- */
route('GET', '/api/orders/:id', { roles: ['merchant', 'driver', 'admin', 'staff'] }, async (c) => {
  const id = Number(c.params.id);
  if (!Number.isInteger(id)) fail('طلب غير صحيح');
  const r = await q('SELECT * FROM orders WHERE id=$1', [id]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود أو تم حذفه', 404);
  const u = c.user;
  if (u.role === 'merchant' && o.merchant_id !== u.id) fail('غير مسموح', 403);
  if (u.role === 'driver' && o.driver_id !== u.id && !(o.status === 'pending' && o.vehicle === (u.vehicle === 'car' ? 'car' : 'bike'))) fail('غير مسموح', 403);
  if (u.role === 'staff') need(u, 'orders', 'view');
  return { order: ord(o) };
});

/* ---------- تصفير الطلبات والحسابات التجريبية (المدير فقط) ---------- */
const DEMO_PHONES = ['07700000201', '07700000202', '07700000203', '07700000301', '07700000302'];
route('POST', '/api/admin/reset', ADMIN, async (c) => {
  if (c.body.confirm !== true) fail('يجب تأكيد عملية الحذف');
  const wantOrders = c.body.orders === true, wantDemo = c.body.demo === true;
  if (!wantOrders && !wantDemo) fail('اختر ما تريد حذفه');
  const cnt = async (sql, p = []) => Number((await q(sql, p)).rows[0].n) || 0;
  const out = { orders: 0, accounts: 0 };
  let demoIds = [];
  if (wantDemo) {
    const ph = DEMO_PHONES.map((_, i) => '$' + (i + 1)).join(',');
    const r = await q(`SELECT id FROM users WHERE role IN ('merchant','driver') AND phone IN (${ph})`, DEMO_PHONES);
    demoIds = r.rows.map((x) => Number(x.id)).filter(Number.isInteger);
  }
  const ids = demoIds.join(',');
  if (wantOrders) {
    out.orders = await cnt('SELECT COUNT(*) AS n FROM orders');
    await q('DELETE FROM messages');
    await q('DELETE FROM notifs WHERE order_id IS NOT NULL');
    await q('DELETE FROM orders');
  } else if (demoIds.length) {
    const o = await q(`SELECT id FROM orders WHERE merchant_id IN (${ids}) OR driver_id IN (${ids})`);
    const oids = o.rows.map((x) => Number(x.id)).filter(Number.isInteger);
    out.orders = oids.length;
    if (oids.length) {
      await q(`DELETE FROM messages WHERE order_id IN (${oids.join(',')})`);
      await q(`DELETE FROM notifs WHERE order_id IN (${oids.join(',')})`);
      await q(`DELETE FROM orders WHERE id IN (${oids.join(',')})`);
    }
  }
  if (demoIds.length) {
    await q(`DELETE FROM txs WHERE driver_id IN (${ids})`);
    await q(`DELETE FROM messages WHERE user_id IN (${ids})`);
    await q(`DELETE FROM notifs WHERE user_id IN (${ids})`);
    await q(`DELETE FROM push_subs WHERE user_id IN (${ids})`);
    await q(`DELETE FROM users WHERE id IN (${ids})`);
    out.accounts = demoIds.length;
  }
  if (wantDemo) await q(`INSERT INTO settings(key,value) VALUES('demo_cleared','1') ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  return { ok: true, ...out };
});

route('GET', '/api/admin/stats', ADM(ANYPAGE), async (c) => {
  const from = Number(c.query.from) || 0;
  const to = Number(c.query.to) || Date.now() + DAY;
  const now = Date.now();
  const set = await getSettings();
  const lateMs = (Number(set.lateMin) || 45) * 60000;
  const os = (await q('SELECT * FROM orders WHERE created_at>=$1 AND created_at<$2', [from, to])).rows;
  const ex = (await q('SELECT * FROM expenses WHERE at>=$1 AND at<$2 ORDER BY at DESC', [from, to])).rows;
  const sc = async (sql) => Number((await q(sql, [from, to])).rows[0].n);
  const fees = await sc('SELECT COALESCE(SUM(fee),0) AS n FROM orders WHERE accepted_at>=$1 AND accepted_at<$2');
  const cards = await sc(`SELECT COALESCE(SUM(amount),0) AS n FROM txs WHERE kind='charge' AND at>=$1 AND at<$2`);
  const users = (await q(`SELECT * FROM users WHERE role IN ('merchant','driver') AND phone NOT LIKE 'deleted-%' ORDER BY created_at DESC`)).rows;
  const live = (await q(`SELECT * FROM orders WHERE status IN ('picking_up','on_the_way')`)).rows;
  const stale = (await q(`SELECT * FROM orders WHERE status='pending' AND created_at<$1`, [now - 10 * 60000])).rows;
  const goodsAll = (await q(`SELECT merchant_id AS id, COALESCE(SUM(product_price),0) AS n FROM orders WHERE status IN ('delivered','partial') GROUP BY merchant_id`)).rows;
  const vAll = (await q(`SELECT party_id AS id, kind, COALESCE(SUM(amount),0) AS n FROM vouchers WHERE party_type='merchant' GROUP BY party_id, kind`)).rows;
  const owed = {};
  goodsAll.forEach((r) => { owed[r.id] = (owed[r.id] || 0) + Number(r.n); });
  vAll.forEach((r) => { owed[r.id] = (owed[r.id] || 0) + (r.kind === 'out' ? -1 : 1) * Number(r.n); });
  const done = os.filter((o) => DONE.includes(o.status));
  const counts = {};
  os.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
  const days = {};
  os.forEach((o) => { const k = dayStart(o.created_at); days[k] = days[k] || { t: k, n: 0, d: 0 }; days[k].n++; if (DONE.includes(o.status)) days[k].d++; });
  const expTotal = sumOf(ex, 'amount');
  const merchants = users.filter((u) => u.role === 'merchant').map((u) => {
    const m = os.filter((o) => o.merchant_id === u.id); const d = m.filter((o) => DONE.includes(o.status)); const r = m.filter(isRet);
    return {
      ...pub(u), orders: m.length, delivered: d.length, returned: r.length, returnedValue: sumOf(r, 'product_price'),
      cancelled: m.filter((o) => o.status === 'cancelled').length, open: m.filter((o) => ['pending', 'picking_up', 'on_the_way'].includes(o.status)).length,
      goods: sumOf(d, 'product_price'), delivery: sumOf(d, 'delivery_price'), discountTotal: sumOf(d, 'discount'),
      owed: owed[u.id] || 0, lastAt: m.reduce((a, o) => Math.max(a, o.created_at), 0)
    };
  });
  const drivers = users.filter((u) => u.role === 'driver').map((u) => {
    const m = os.filter((o) => o.driver_id === u.id); const d = m.filter((o) => DONE.includes(o.status)); const r = m.filter(isRet);
    const mine = live.filter((o) => o.driver_id === u.id);
    return {
      ...pub(u), orders: m.length, delivered: d.length, returned: r.length, fees: sumOf(m, 'fee'), collected: sumOf(d, 'total'),
      earned: sumOf(d, 'delivery_price') - sumOf(d, 'fee'), live: mine.length,
      late: mine.filter((o) => o.accepted_at && now - o.accepted_at > lateMs).length,
      problems: m.filter((o) => TROUBLE.includes(o.status)).length,
      lastAt: m.reduce((a, o) => Math.max(a, o.updated_at), 0)
    };
  });
  const cm = {};
  os.forEach((o) => {
    const x = cm[o.customer_phone] || (cm[o.customer_phone] = { phone: o.customer_phone, area: o.customer_area, orders: 0, delivered: 0, returned: 0, total: 0, lastAt: 0 });
    x.orders++; if (DONE.includes(o.status)) { x.delivered++; x.total += o.total; } if (isRet(o)) x.returned++;
    x.lastAt = Math.max(x.lastAt, o.created_at);
  });
  return {
    total: os.length, counts, delivered: done.length, goods: sumOf(done, 'product_price'), delivery: sumOf(done, 'delivery_price'),
    fees, cards, expenses: expTotal, net: fees - expTotal, days: Object.values(days).sort((a, b) => a.t - b.t),
    expensesList: ex.map((e) => ({ id: e.id, amount: e.amount, category: e.category, note: e.note, at: e.at })), merchants, drivers,
    customers: can(c.user, 'customers') ? Object.values(cm).sort((a, b) => b.orders - a.orders).slice(0, 1000) : [],
    lateOrders: live.filter((o) => o.accepted_at && now - o.accepted_at > lateMs).map(ord),
    staleOrders: stale.map(ord), lateMin: Number(set.lateMin) || 45, now
  };
});

route('POST', '/api/admin/expenses', ADM('finance', 'edit'), async (c) => {
  const amount = int(c.body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000000) fail('اكتب مبلغاً صحيحاً');
  const e = await db.insert('expenses', { amount, category: clean(c.body.category, 40) || 'عام', note: clean(c.body.note, 160), at: Number(c.body.at) || Date.now(), created_at: Date.now() });
  return { expense: e };
});

route('DELETE', '/api/admin/expenses/:id', ADM('finance', 'edit'), async (c) => {
  const r = await q('DELETE FROM expenses WHERE id=$1', [Number(c.params.id)]);
  if (!r.count) fail('المصروف غير موجود', 404);
  return { ok: true };
});


/* ---------- المالية: الدخل اليومي/الأسبوعي/الشهري/السنوي ---------- */
route('GET', '/api/admin/finance', ADM(['finance', 'home']), async () => {
  const now = Date.now();
  const today = dayStart(now), week = weekStart(now), month = monthStart(now), year = yearStart(now);
  const yd = new Date(now + OFF);
  const m12 = Date.UTC(yd.getUTCFullYear(), yd.getUTCMonth() - 11, 1) - OFF;
  const since = Math.min(year, m12, today - 29 * DAY);
  // الرسوم المخصومة من الكباتن لحظة قبول الطلب (تُصفَّر عند إرجاع الطلب للسائقين)
  const fr = (await q('SELECT fee, accepted_at AS t FROM orders WHERE accepted_at>=$1 AND fee>0', [since])).rows;
  // مبيعات الكروت + الشحن اليدوي (الموجب) وسحب الإدارة (السالب)
  const cr = (await q(`SELECT amount, kind, at AS t FROM txs WHERE kind IN ('charge','admin') AND at>=$1`, [since])).rows;
  const er = (await q('SELECT amount, category, at AS t FROM expenses WHERE at>=$1', [since])).rows;
  const agg = (a, b = Infinity) => {
    const f = fr.filter((r) => r.t >= a && r.t < b), c = cr.filter((r) => r.t >= a && r.t < b), e = er.filter((r) => r.t >= a && r.t < b);
    const byCat = {}; e.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
    return { fees: sumOf(f, 'fee'), orders: f.length, cards: sumOf(c, 'amount'), cardCount: c.filter((x) => x.kind === 'charge').length, expenses: sumOf(e, 'amount'), byCat };
  };
  const daily = [];
  for (let i = 29; i >= 0; i--) { const t = today - i * DAY; daily.push({ t, ...agg(t, t + DAY) }); }
  const monthly = [];
  for (let i = 11; i >= 0; i--) {
    const t = Date.UTC(yd.getUTCFullYear(), yd.getUTCMonth() - i, 1) - OFF;
    const t2 = Date.UTC(yd.getUTCFullYear(), yd.getUTCMonth() - i + 1, 1) - OFF;
    monthly.push({ t, ...agg(t, t2) });
  }
  const one = async (sql) => Number((await q(sql)).rows[0].n);
  const all = {
    fees: await one('SELECT COALESCE(SUM(fee),0) AS n FROM orders WHERE fee>0'),
    cards: await one(`SELECT COALESCE(SUM(amount),0) AS n FROM txs WHERE kind IN ('charge','admin')`),
    expenses: await one('SELECT COALESCE(SUM(amount),0) AS n FROM expenses'),
    balances: await one(`SELECT COALESCE(SUM(balance),0) AS n FROM users WHERE role='driver'`)
  };
  return { periods: { today: agg(today), week: agg(week), month: agg(month), year: agg(year) }, daily, monthly, all, now };
});

/* ---------- سندات القبض والصرف ---------- */
const vch = (v) => ({ id: v.id, no: v.num, kind: v.kind, partyType: v.party_type, partyId: v.party_id, partyName: v.party_name, amount: v.amount, note: v.note, ref: v.ref, at: v.at, createdAt: v.created_at });

route('GET', '/api/admin/vouchers', ADM('vouchers'), async (c) => {
  const from = Number(c.query.from) || 0;
  const to = Number(c.query.to) || Date.now() + DAY;
  const r = await q('SELECT * FROM vouchers WHERE at>=$1 AND at<$2 ORDER BY at DESC, id DESC LIMIT 3000', [from, to]);
  return { vouchers: r.rows.map(vch) };
});

route('POST', '/api/admin/vouchers', ADM('vouchers', 'edit'), async (c) => {
  const b = c.body;
  const kind = b.kind === 'out' ? 'out' : b.kind === 'in' ? 'in' : fail('اختر نوع السند (قبض أو صرف)');
  const amount = int(b.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000000) fail('اكتب مبلغاً صحيحاً');
  const partyType = ['merchant', 'driver', 'customer', 'other'].includes(b.partyType) ? b.partyType : 'other';
  let partyId = null, partyName = clean(b.partyName, 80);
  if (partyType === 'merchant' || partyType === 'driver') {
    const u = (await q('SELECT * FROM users WHERE id=$1 AND role=$2', [Number(b.partyId), partyType])).rows[0];
    if (!u) fail('الطرف المختار غير موجود', 404);
    partyId = u.id; partyName = u.name;
  }
  if (!partyName) fail('اكتب اسم الطرف');
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const m = await q('SELECT COALESCE(MAX(num),0)+1 AS n FROM vouchers');
    try {
      const row = await db.insert('vouchers', {
        num: m.rows[0].n, kind, party_type: partyType, party_id: partyId, party_name: partyName, amount,
        note: clean(b.note, 300), ref: clean(b.ref, 60), at: Number(b.at) || now, created_at: now
      });
      return { voucher: vch(row) };
    } catch (e) { if (!/unique|duplicate/i.test(String(e.message))) throw e; }
  }
  fail('تعذّر إنشاء السند، حاول مرة أخرى', 503);
});

route('DELETE', '/api/admin/vouchers/:id', ADM('vouchers', 'edit'), async (c) => {
  const r = await q('DELETE FROM vouchers WHERE id=$1', [Number(c.params.id)]);
  if (!r.count) fail('السند غير موجود', 404);
  return { ok: true };
});

/* ---------- كشف حساب (متجر / مندوب / عميل) ---------- */
route('GET', '/api/admin/statement', ADM(['merchants', 'drivers', 'customers', 'finance']), async (c) => {
  const type = ['merchant', 'driver', 'customer'].includes(c.query.type) ? c.query.type : fail('نوع الكشف غير صحيح');
  need(c.user, type === 'merchant' ? 'merchants' : type === 'driver' ? 'drivers' : 'customers');
  const from = Number(c.query.from) || 0;
  const to = Number(c.query.to) || Date.now() + DAY;
  const now = Date.now();
  const set = await getSettings();
  const lateMs = (Number(set.lateMin) || 45) * 60000;
  let party, os, vs = [], txs = [];
  if (type === 'customer') {
    const phone = normPhone(c.query.phone);
    if (!phone) fail('رقم العميل مطلوب');
    os = (await q('SELECT * FROM orders WHERE customer_phone=$1 AND created_at>=$2 AND created_at<$3 ORDER BY created_at DESC', [phone, from, to])).rows;
    party = { name: os[0] ? 'عميل ' + os[0].customer_area : 'عميل', phone, area: os[0] ? os[0].customer_area : '' };
  } else {
    const u = (await q('SELECT * FROM users WHERE id=$1 AND role=$2', [Number(c.query.id), type])).rows[0];
    if (!u) fail('الحساب غير موجود', 404);
    party = pub(u);
    const col = type === 'merchant' ? 'merchant_id' : 'driver_id';
    os = (await q(`SELECT * FROM orders WHERE ${col}=$1 AND created_at>=$2 AND created_at<$3 ORDER BY created_at DESC`, [u.id, from, to])).rows;
    if (type === 'merchant') vs = (await q(`SELECT * FROM vouchers WHERE party_type='merchant' AND party_id=$1 AND at>=$2 AND at<$3 ORDER BY at DESC`, [u.id, from, to])).rows;
    if (type === 'driver') txs = (await q('SELECT * FROM txs WHERE driver_id=$1 AND at>=$2 AND at<$3 ORDER BY at DESC LIMIT 1000', [u.id, from, to])).rows;
  }
  const done = os.filter((o) => DONE.includes(o.status)), ret = os.filter(isRet);
  const summary = {
    orders: os.length, delivered: done.length, returned: ret.length, returnedValue: sumOf(ret, 'product_price'),
    cancelled: os.filter((o) => o.status === 'cancelled').length,
    open: os.filter((o) => ['pending', 'picking_up', 'on_the_way'].includes(o.status)).length,
    goods: sumOf(done, 'product_price'), delivery: sumOf(done, 'delivery_price'), total: sumOf(done, 'total'), discountTotal: sumOf(done, 'discount')
  };
  if (type === 'merchant') {
    const g = Number((await q(`SELECT COALESCE(SUM(product_price),0) AS n FROM orders WHERE merchant_id=$1 AND status IN ('delivered','partial')`, [party.id])).rows[0].n);
    const vv = (await q(`SELECT kind, COALESCE(SUM(amount),0) AS n FROM vouchers WHERE party_type='merchant' AND party_id=$1 GROUP BY kind`, [party.id])).rows;
    const out = Number((vv.find((r) => r.kind === 'out') || {}).n || 0), inn = Number((vv.find((r) => r.kind === 'in') || {}).n || 0);
    summary.paid = sumOf(vs.filter((v) => v.kind === 'out'), 'amount');
    summary.received = sumOf(vs.filter((v) => v.kind === 'in'), 'amount');
    summary.owedPeriod = summary.goods - summary.paid + summary.received;
    summary.owedAll = g - out + inn;
  }
  if (type === 'driver') {
    const mine = os.filter((o) => ['picking_up', 'on_the_way'].includes(o.status));
    summary.fees = sumOf(os, 'fee'); summary.collected = summary.total; summary.earned = summary.delivery - sumOf(done, 'fee');
    summary.balance = party.balance; summary.active = mine.length;
    summary.late = mine.filter((o) => o.accepted_at && now - o.accepted_at > lateMs).length;
    summary.problems = os.filter((o) => TROUBLE.includes(o.status)).length;
  }
  return {
    type, party, from, to, summary, orders: os.map(ord), vouchers: vs.map(vch),
    txs: txs.map((t) => ({ id: t.id, amount: t.amount, kind: t.kind, label: t.label, orderNo: t.order_num, at: t.at }))
  };
});

module.exports = { dispatch, HttpError, getSettings };
