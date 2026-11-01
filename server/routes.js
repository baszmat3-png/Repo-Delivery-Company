'use strict';
const crypto = require('crypto');
const db = require('./db');
const { sign, verify, hashPassword, checkPassword } = require('./auth');

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

const STATUSES = ['pending', 'picking_up', 'on_the_way', 'delivered', 'no_answer', 'problem', 'other', 'returned', 'partial', 'cancelled'];
const DRIVER_STATUSES = ['picking_up', 'on_the_way', 'delivered', 'no_answer', 'problem', 'other', 'returned', 'partial'];
const DONE = ['delivered', 'partial'];

const DEF_SETTINGS = { bikeSame: 3000, bikeOther: 5000, carSame: 5000, carOther: 8000, feeSame: 500, feeOther: 1000, support: '' };

async function getSettings() {
  const r = await q(`SELECT value FROM settings WHERE key='main'`);
  let saved = {};
  try { saved = r.rows[0] ? JSON.parse(r.rows[0].value) : {}; } catch { /* ignore */ }
  return { ...DEF_SETTINGS, ...saved };
}

const pub = (u) => ({
  id: u.id, role: u.role, name: u.name, phone: u.phone, active: !!u.active,
  area: u.area, vehicle: u.vehicle, balance: u.balance, receiving: !!u.receiving, createdAt: u.created_at
});

const ord = (r) => ({
  id: r.id, no: r.num, merchantId: r.merchant_id, merchantName: r.merchant_name, merchantArea: r.merchant_area,
  merchantPhone: r.merchant_phone, customerArea: r.customer_area, customerPhone: r.customer_phone,
  product: r.product, qty: r.qty, vehicle: r.vehicle, sameArea: !!r.same_area, note: r.note,
  productPrice: r.product_price, deliveryPrice: r.delivery_price, total: r.total, status: r.status,
  driverId: r.driver_id, driverName: r.driver_name, fee: r.fee, createdAt: r.created_at, updatedAt: r.updated_at,
  acceptedAt: r.accepted_at, deliveredAt: r.delivered_at, log: safeJson(r.log, [])
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
  const phone = normPhone(c.body.phone);
  const pw = String(c.body.password || '');
  if (!phone || !pw) fail('أدخل رقم الهاتف وكلمة المرور');
  throttle(c.req.socket.remoteAddress + '|' + phone);
  const r = await q('SELECT * FROM users WHERE phone=$1', [phone]);
  const u = r.rows[0];
  if (!u || !(await checkPassword(pw, u.pass_hash))) fail('رقم الهاتف أو كلمة المرور غير صحيحة', 401);
  if (!u.active) fail('هذا الحساب موقوف، تواصل مع الإدارة', 403);
  return { token: sign({ id: u.id, role: u.role }), user: pub(u) };
});

route('GET', '/api/me', async (c) => ({ user: pub(c.user) }));

route('PUT', '/api/me/profile', async (c) => {
  const name = clean(c.body.name, 60);
  if (name.length < 2) fail('اكتب الاسم');
  const patch = { name };
  if (c.user.role === 'driver' && ['bike', 'car'].includes(c.body.vehicle)) patch.vehicle = c.body.vehicle;
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
  if (user.role === 'admin') fail('لا يمكن حذف حساب المدير من هنا', 403);
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
  const allowed = user.role === 'admin' || (user.role === 'merchant' && o.merchant_id === user.id) || (user.role === 'driver' && o.driver_id === user.id);
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
  const m = await db.insert('messages', { order_id: o.id, user_id: c.user.id, role: c.user.role, name: c.user.name, text, at: Date.now() });
  return { message: { id: m.id, userId: m.user_id, role: m.role, name: m.name, text: m.text, at: m.at } };
});

/* ---------- التاجر ---------- */
const MERCHANT = { roles: ['merchant'] };

route('GET', '/api/merchant/home', MERCHANT, async (c) => {
  const r = await q('SELECT * FROM orders WHERE merchant_id=$1 ORDER BY created_at DESC LIMIT 300', [c.user.id]);
  return { me: pub(c.user), settings: await getSettings(), orders: r.rows.map(ord) };
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
  const deliveryPrice = s[vehicle + (same ? 'Same' : 'Other')];
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const m = await q('SELECT COALESCE(MAX(num),1042)+1 AS n FROM orders');
    try {
      const row = await db.insert('orders', {
        num: m.rows[0].n, merchant_id: c.user.id, merchant_name: c.user.name, merchant_area: c.user.area, merchant_phone: c.user.phone,
        customer_area: customerArea, customer_phone: customerPhone, product, qty, vehicle, same_area: same ? 1 : 0,
        note: clean(b.note, 200), product_price: productPrice, delivery_price: deliveryPrice, total: productPrice + deliveryPrice,
        status: 'pending', driver_id: null, driver_name: '', fee: 0, created_at: now, updated_at: now,
        accepted_at: null, delivered_at: null, log: JSON.stringify([{ s: 'pending', at: now }])
      });
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
  return { order: ord(u.rows[0]) };
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
  const avail = await q(`SELECT * FROM orders WHERE status='pending' ORDER BY created_at DESC LIMIT 50`);
  const mine = await q('SELECT * FROM orders WHERE driver_id=$1 ORDER BY updated_at DESC LIMIT 150', [c.user.id]);
  return {
    me: pub(c.user), settings: await getSettings(), available: avail.rows.map(ord), orders: mine.rows.map(ord), wallet: await walletFor(c.user)
  };
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
  return { order: ord(claim.rows[0]) };
});

route('POST', '/api/driver/orders/:id/status', DRIVER, async (c) => {
  const status = String(c.body.status || '');
  if (!DRIVER_STATUSES.includes(status)) fail('حالة غير صحيحة');
  const r = await q('SELECT * FROM orders WHERE id=$1 AND driver_id=$2', [Number(c.params.id), c.user.id]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  const now = Date.now();
  const u = await db.update('orders', 'id', o.id, {
    status, updated_at: now, delivered_at: DONE.includes(status) ? (o.delivered_at || now) : null, log: pushLog(o, status, now)
  });
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
  return { amount, balance: b.rows[0].balance };
});

/* ---------- المدير ---------- */
const ADMIN = { roles: ['admin'] };

route('GET', '/api/admin/overview', ADMIN, async () => {
  const now = Date.now();
  const today = dayStart(now);
  const one = async (sql, p = []) => (await q(sql, p)).rows[0] || {};
  const todayN = await one('SELECT COUNT(*) AS n FROM orders WHERE created_at>=$1', [today]);
  const active = await one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('picking_up','on_the_way')`);
  const pending = await one(`SELECT COUNT(*) AS n FROM orders WHERE status='pending'`);
  const delivered = await one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('delivered','partial') AND delivered_at>=$1`, [today]);
  const problems = await one(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('no_answer','problem','other') AND updated_at>=$1`, [today]);
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
  const trouble = await q(`SELECT * FROM orders WHERE status IN ('no_answer','problem','other') ORDER BY updated_at DESC LIMIT 10`);
  return {
    ordersToday: todayN.n, active: active.n, pending: pending.n, deliveredToday: delivered.n, problemsToday: problems.n,
    feesToday: fees.n, drivers: drivers.n, driverBalances: drivers.bal, merchants: merchants.n, days,
    attention: [...stale.rows, ...trouble.rows].map(ord)
  };
});

route('GET', '/api/admin/orders', ADMIN, async (c) => {
  const st = c.query.status;
  const r = STATUSES.includes(st)
    ? await q('SELECT * FROM orders WHERE status=$1 ORDER BY created_at DESC LIMIT 300', [st])
    : await q('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300');
  return { orders: r.rows.map(ord) };
});

route('POST', '/api/admin/orders/:id/status', ADMIN, async (c) => {
  const status = String(c.body.status || '');
  if (!STATUSES.includes(status)) fail('حالة غير صحيحة');
  const r = await q('SELECT * FROM orders WHERE id=$1', [Number(c.params.id)]);
  const o = r.rows[0];
  if (!o) fail('الطلب غير موجود', 404);
  const now = Date.now();
  const u = await db.update('orders', 'id', o.id, {
    status, updated_at: now, delivered_at: DONE.includes(status) ? (o.delivered_at || now) : null, log: pushLog(o, status, now)
  });
  return { order: ord(u) };
});

route('POST', '/api/admin/orders/:id/requeue', ADMIN, async (c) => {
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
  return { order: ord(u) };
});

route('GET', '/api/admin/users', ADMIN, async (c) => {
  const role = c.query.role === 'merchant' ? 'merchant' : 'driver';
  const r = await q(`SELECT * FROM users WHERE role=$1 AND phone NOT LIKE 'deleted-%' ORDER BY created_at DESC LIMIT 500`, [role]);
  return { users: r.rows.map(pub) };
});

route('POST', '/api/admin/users', ADMIN, async (c) => {
  const b = c.body;
  const role = b.role === 'merchant' ? 'merchant' : 'driver';
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
    vehicle: b.vehicle === 'car' ? 'car' : 'bike', balance: 0, receiving: 1, created_at: Date.now()
  });
  return { user: pub(u) };
});

route('PUT', '/api/admin/users/:id', ADMIN, async (c) => {
  const b = c.body;
  const r = await q(`SELECT * FROM users WHERE id=$1 AND role IN ('driver','merchant')`, [Number(c.params.id)]);
  const u = r.rows[0];
  if (!u) fail('المستخدم غير موجود', 404);
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
  if (b.password) {
    if (String(b.password).length < 6) fail('كلمة المرور لا تقل عن 6 أحرف');
    patch.pass_hash = await hashPassword(String(b.password));
  }
  if (!Object.keys(patch).length) fail('لا يوجد ما يُحدَّث');
  return { user: pub(await db.update('users', 'id', u.id, patch)) };
});

route('POST', '/api/admin/users/:id/adjust', ADMIN, async (c) => {
  const amount = int(c.body.amount);
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000000) fail('اكتب مبلغاً صحيحاً');
  const r = amount > 0
    ? await q(`UPDATE users SET balance=balance+$1 WHERE id=$2 AND role='driver' RETURNING *`, [amount, Number(c.params.id)])
    : await q(`UPDATE users SET balance=balance+$1 WHERE id=$2 AND role='driver' AND balance+$1>=0 RETURNING *`, [amount, Number(c.params.id)]);
  if (!r.rows.length) fail('تعذّر تعديل الرصيد (تأكد من السائق ومن أن الرصيد يكفي)', 409);
  await db.insert('txs', { driver_id: r.rows[0].id, amount, kind: 'admin', label: clean(c.body.label, 80) || 'تعديل من الإدارة', order_num: null, at: Date.now() });
  return { user: pub(r.rows[0]) };
});

route('GET', '/api/admin/cards', ADMIN, async () => {
  const r = await q('SELECT * FROM cards ORDER BY created_at DESC, number DESC LIMIT 400');
  return { cards: r.rows.map((k) => ({ number: k.number, amount: k.amount, used: !!k.used, usedBy: k.used_by, usedAt: k.used_at, createdAt: k.created_at })) };
});

route('POST', '/api/admin/cards', ADMIN, async (c) => {
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

route('DELETE', '/api/admin/cards/:number', ADMIN, async (c) => {
  const r = await q('DELETE FROM cards WHERE number=$1 AND used=0', [c.params.number]);
  if (!r.count) fail('لا يمكن حذف بطاقة مستخدمة', 409);
  return { ok: true };
});

route('PUT', '/api/admin/settings', ADMIN, async (c) => {
  const next = { ...(await getSettings()) };
  for (const k of ['bikeSame', 'bikeOther', 'carSame', 'carOther', 'feeSame', 'feeOther']) {
    if (c.body[k] !== undefined) {
      const v = int(c.body[k]);
      if (!Number.isFinite(v) || v < 0 || v > 10000000) fail('قيمة غير صحيحة: ' + k);
      next[k] = v;
    }
  }
  if (c.body.support !== undefined) next.support = normPhone(c.body.support).slice(0, 15);
  await q(`INSERT INTO settings(key,value) VALUES('main',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [JSON.stringify(next)]);
  return { settings: next };
});

module.exports = { dispatch, HttpError, getSettings };
