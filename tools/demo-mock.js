/* خادم وهمي داخل المتصفح: يحاكي واجهة API كاملة ببيانات تجريبية في الذاكرة */
(() => {
const MIN = 60000, HR = 3600000, DAY = 86400000, OFF = 3 * HR;
const T = () => Date.now();
const nd = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const phoneOf = (s) => nd(s).replace(/\D/g, '');
const intOf = (v) => Math.round(Number(nd(v).replace(/[,\s]/g, '')));
const normArea = (s) => nd(s).trim().replace(/\s+/g, ' ').replace(/^ال/, '');
const dayStart = (t) => Math.floor((t + OFF) / DAY) * DAY - OFF;
const weekStart = (t) => dayStart(t) - ((new Date(dayStart(t) + OFF).getUTCDay() + 1) % 7) * DAY;
const monthStart = (t) => { const d = new Date(t + OFF); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFF; };
class E extends Error { constructor(s, m) { super(m); this.status = s; } }
const bad = (m, s = 400) => { throw new E(s, m); };

const DB = { settings: { bikeSame: 3000, bikeOther: 5000, carSame: 5000, carOther: 8000, feeSame: 500, feeOther: 1000, support: '' }, users: [], orders: [], cards: [], txs: [], msgs: [], id: 20 };
const nid = () => ++DB.id;
function user(id, role, name, phone, pw, area, vehicle, balance) { DB.users.push({ id, role, name, phone, pw, active: true, area, vehicle, balance, receiving: true, createdAt: T() - 5 * DAY }); }
user(1, 'admin', 'مدير النظام', '07700000000', 'admin1234', '', 'bike', 0);
user(2, 'merchant', 'متجر الرافدين', '07700000201', '123456', 'الكرادة', 'bike', 0);
user(3, 'merchant', 'بيت الأناقة', '07700000202', '123456', 'المنصور', 'bike', 0);
user(4, 'merchant', 'سوق الكرخ', '07700000203', '123456', 'الكرخ', 'bike', 0);
user(5, 'driver', 'علي كريم', '07700000301', '123456', '', 'bike', 5000);
user(6, 'driver', 'حسن جاسم', '07700000302', '123456', '', 'car', 12000);
const U = (id) => DB.users.find((u) => u.id === id);
const pub = (u) => ({ id: u.id, role: u.role, name: u.name, phone: u.phone, active: u.active, area: u.area, vehicle: u.vehicle, balance: u.balance, receiving: u.receiving, createdAt: u.createdAt });

const PRICE = { bike: { same: 3000, other: 5000 }, car: { same: 5000, other: 8000 } };
let no = 1033;
function seedOrder(m, area, phone, product, qty, vehicle, prod, status, driver, createdAgo, doneAgo, note) {
  const same = normArea(m.area) === normArea(area), dp = PRICE[vehicle][same ? 'same' : 'other'], c = T() - createdAgo;
  const fee = driver ? (same ? 500 : 1000) : 0;
  const o = { id: nid(), no: ++no, merchantId: m.id, merchantName: m.name, merchantArea: m.area, merchantPhone: m.phone, customerArea: area, customerPhone: phone, product, qty, vehicle, sameArea: same, note: note || '', productPrice: prod, deliveryPrice: dp, total: prod + dp, status, driverId: driver ? driver.id : null, driverName: driver ? driver.name : '', fee, createdAt: c, updatedAt: c, acceptedAt: null, deliveredAt: null, log: [{ s: 'pending', at: c }] };
  if (driver) { o.acceptedAt = c + 4 * MIN; o.updatedAt = o.acceptedAt; o.log.push({ s: 'picking_up', at: o.acceptedAt }); DB.txs.push({ id: nid(), driverId: driver.id, amount: -fee, kind: 'fee', label: 'رسوم التطبيق', orderNo: o.no, at: o.acceptedAt }); }
  if (doneAgo != null) { o.updatedAt = T() - doneAgo; if (status === 'delivered' || status === 'partial') o.deliveredAt = o.updatedAt; o.log.push({ s: status, at: o.updatedAt }); }
  DB.orders.push(o);
}
const [, , R, A, K, ali, hasan] = [0, 0, U(2), U(3), U(4), U(5), U(6)];
seedOrder(R, 'المنصور', '07700000113', 'ملابس', 5, 'bike', 70000, 'partial', hasan, 3 * DAY, 3 * DAY - 2 * HR);
seedOrder(R, 'الكرادة', '07700000112', 'إلكترونيات', 1, 'bike', 55000, 'returned', hasan, 2 * DAY + 2 * HR, 2 * DAY + HR);
seedOrder(R, 'الجامعة', '07700000111', 'أغذية', 2, 'bike', 9000, 'other', hasan, 2 * DAY, 2 * DAY - HR);
seedOrder(R, 'الشعلة', '07700000110', 'ملابس', 3, 'bike', 40000, 'problem', hasan, DAY + 5 * HR, DAY + 4 * HR);
seedOrder(R, 'الدورة', '07700000109', 'أحذية', 1, 'bike', 32000, 'no_answer', hasan, DAY + 3 * HR, DAY + 2 * HR);
seedOrder(R, 'المنصور', '07700000108', 'إكسسوارات', 4, 'bike', 16000, 'delivered', ali, 170 * MIN, 140 * MIN);
seedOrder(R, 'الكرادة', '07700000107', 'أغذية', 1, 'bike', 12000, 'delivered', ali, 150 * MIN, 100 * MIN);
seedOrder(R, 'الشعلة', '07700000106', 'ملابس', 2, 'bike', 25000, 'delivered', ali, 130 * MIN, 70 * MIN);
seedOrder(R, 'الكرادة', '07700000105', 'عطور', 1, 'bike', 18000, 'delivered', ali, 100 * MIN, 35 * MIN);
seedOrder(R, 'الجامعة', '07700000104', 'أغذية', 3, 'bike', 21000, 'on_the_way', ali, 55 * MIN, null);
seedOrder(K, 'الأعظمية', '07700000103', 'أجهزة منزلية', 1, 'bike', 60000, 'pending', null, 22 * MIN, null, 'يحتاج سلة كبيرة');
seedOrder(A, 'المنصور', '07700000102', 'أدوات منزلية', 1, 'bike', 45000, 'pending', null, 14 * MIN, null);
seedOrder(R, 'الشعلة', '07700000101', 'ملابس', 2, 'bike', 30000, 'pending', null, 6 * MIN, null);
seedOrder(R, 'المنصور', '07772223366', 'إلكترونيات', 1, 'bike', 5000, 'pending', null, 1 * MIN, null, 'اتصل قبل الوصول');
[['482915307261', 5000], ['715340928846', 10000], ['239061547730', 10000], ['908273416652', 25000], ['560147298034', 25000], ['371825960417', 50000]].forEach(([n, a]) => DB.cards.push({ number: n, amount: a, used: false, usedBy: '', usedAt: null, createdAt: T() - 2 * DAY }));
DB.cards.push({ number: '120458736921', amount: 5000, used: true, usedBy: 'علي كريم', usedAt: T() - 3 * HR, createdAt: T() - 2 * DAY });
DB.txs.push({ id: nid(), driverId: 5, amount: 5000, kind: 'charge', label: 'شحن بطاقة', orderNo: null, at: T() - 3 * HR });

const O = (id) => DB.orders.find((o) => o.id === Number(id)) || bad('الطلب غير موجود', 404);
const clone = (x) => JSON.parse(JSON.stringify(x));
const setStatus = (o, s) => { const t = T(); o.status = s; o.updatedAt = t; o.deliveredAt = ['delivered', 'partial'].includes(s) ? (o.deliveredAt || t) : null; o.log.push({ s, at: t }); };
const STATUSES = ['pending', 'picking_up', 'on_the_way', 'delivered', 'no_answer', 'problem', 'other', 'returned', 'partial', 'cancelled'];
const DRV = STATUSES.filter((s) => !['pending', 'cancelled'].includes(s));

function wallet(u) {
  const now = T();
  const done = DB.orders.filter((o) => o.driverId === u.id && ['delivered', 'partial'].includes(o.status));
  const agg = (from, to = Infinity) => { const r = done.filter((o) => o.deliveredAt >= from && o.deliveredAt < to); return { n: r.length, net: r.reduce((a, o) => a + o.deliveryPrice - o.fee, 0) }; };
  const td = dayStart(now), days = [];
  for (let i = 6; i >= 0; i--) days.push({ t: td - i * DAY, ...agg(td - i * DAY, td - i * DAY + DAY) });
  return { balance: u.balance, today: agg(td), week: agg(weekStart(now)), month: agg(monthStart(now)), days, txs: DB.txs.filter((t) => t.driverId === u.id).sort((a, b) => b.at - a.at).slice(0, 60) };
}

const R_ = [];
const route = (m, p, opts, h) => { if (typeof opts === 'function') { h = opts; opts = {}; } R_.push({ m, re: new RegExp('^' + p.replace(/:(\w+)/g, '([^/]+)') + '/?$'), opts, h }); };
const ME = { roles: ['merchant'] }, DR = { roles: ['driver'] }, AD = { roles: ['admin'] };

route('POST', '/api/login', { pub: true }, (c) => {
  const u = DB.users.find((x) => x.phone === phoneOf(c.b.phone));
  if (!u || u.pw !== String(c.b.password || '')) bad('رقم الهاتف أو كلمة المرور غير صحيحة', 401);
  if (!u.active) bad('هذا الحساب موقوف، تواصل مع الإدارة', 403);
  return { token: 'demo-' + u.id, user: pub(u) };
});
route('POST', '/api/delete-account', { pub: true }, (c) => { const u = DB.users.find((x) => x.phone === phoneOf(c.b.phone)); if (!u || u.pw !== c.b.password) bad('بيانات غير صحيحة', 401); u.active = false; return { ok: true }; });
route('GET', '/api/settings', (c) => ({ settings: DB.settings }));
route('GET', '/api/me', (c) => ({ user: pub(c.u) }));
route('PUT', '/api/me/profile', (c) => { if (String(c.b.name || '').trim().length < 2) bad('اكتب الاسم'); c.u.name = c.b.name.trim(); if (c.u.role === 'driver' && ['bike', 'car'].includes(c.b.vehicle)) c.u.vehicle = c.b.vehicle; return { user: pub(c.u) }; });
route('PUT', '/api/me/password', (c) => { if (c.u.pw !== c.b.current) bad('كلمة المرور الحالية غير صحيحة', 403); if (String(c.b.next || '').length < 6) bad('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف'); c.u.pw = c.b.next; return { ok: true }; });
route('POST', '/api/me/delete', (c) => { if (c.u.role === 'admin') bad('لا يمكن حذف حساب المدير من هنا', 403); if (c.u.pw !== c.b.password) bad('كلمة المرور غير صحيحة', 403); c.u.active = false; return { ok: true }; });
route('GET', '/api/orders/:id/messages', (c) => ({ messages: DB.msgs.filter((m) => m.orderId === Number(c.p[0])).map(({ orderId, ...m }) => m) }));
route('POST', '/api/orders/:id/messages', (c) => { const t = String(c.b.text || '').trim(); if (!t) bad('اكتب رسالة'); const m = { id: nid(), orderId: Number(c.p[0]), userId: c.u.id, role: c.u.role, name: c.u.name, text: t.slice(0, 500), at: T() }; DB.msgs.push(m); return { message: m }; });

route('GET', '/api/merchant/home', ME, (c) => ({ me: pub(c.u), settings: DB.settings, orders: clone(DB.orders.filter((o) => o.merchantId === c.u.id).sort((a, b) => b.createdAt - a.createdAt)) }));
route('POST', '/api/merchant/orders', ME, (c) => {
  const b = c.b, area = String(b.customerArea || '').trim(), ph = phoneOf(b.customerPhone), prod = String(b.product || '').trim(), price = intOf(b.productPrice);
  if (!area) bad('اكتب منطقة الزبون'); if (!/^07\d{9}$/.test(ph)) bad('رقم الزبون يجب أن يبدأ بـ 07 ويتكوّن من 11 رقماً'); if (!prod) bad('اكتب نوع المنتج');
  if (!(price > 0)) bad('اكتب سعر المنتج');
  const veh = b.vehicle === 'car' ? 'car' : 'bike', same = b.zone ? b.zone === 'same' : normArea(area) === normArea(c.u.area);
  const dp = DB.settings[veh + (same ? 'Same' : 'Other')], t = T();
  const o = { id: nid(), no: ++no, merchantId: c.u.id, merchantName: c.u.name, merchantArea: c.u.area, merchantPhone: c.u.phone, customerArea: area, customerPhone: ph, product: prod, qty: Math.min(99, Math.max(1, intOf(b.qty) || 1)), vehicle: veh, sameArea: same, note: String(b.note || '').slice(0, 200), productPrice: price, deliveryPrice: dp, total: price + dp, status: 'pending', driverId: null, driverName: '', fee: 0, createdAt: t, updatedAt: t, acceptedAt: null, deliveredAt: null, log: [{ s: 'pending', at: t }] };
  DB.orders.push(o); return { order: clone(o) };
});
route('POST', '/api/merchant/orders/:id/cancel', ME, (c) => { const o = O(c.p[0]); if (o.merchantId !== c.u.id) bad('الطلب غير موجود', 404); if (o.status !== 'pending') bad('لا يمكن إلغاء الطلب بعد قبول السائق له', 409); setStatus(o, 'cancelled'); return { order: clone(o) }; });

route('GET', '/api/driver/home', DR, (c) => ({ me: pub(c.u), settings: DB.settings, available: clone(DB.orders.filter((o) => o.status === 'pending').sort((a, b) => b.createdAt - a.createdAt)), orders: clone(DB.orders.filter((o) => o.driverId === c.u.id).sort((a, b) => b.updatedAt - a.updatedAt)), wallet: wallet(c.u) }));
route('PUT', '/api/driver/receiving', DR, (c) => { c.u.receiving = !!c.b.receiving; return { user: pub(c.u) }; });
route('POST', '/api/driver/orders/:id/accept', DR, (c) => {
  if (!c.u.receiving) bad('فعّل استقبال الطلبات أولاً', 409);
  const o = O(c.p[0]); if (o.status !== 'pending') bad('الطلب لم يعد متاحاً', 409);
  const fee = o.sameArea ? DB.settings.feeSame : DB.settings.feeOther;
  if (c.u.balance < fee) bad('رصيدك لا يكفي لرسوم التطبيق. اشحن المحفظة أولاً', 402);
  c.u.balance -= fee; o.driverId = c.u.id; o.driverName = c.u.name; o.fee = fee; o.acceptedAt = T(); setStatus(o, 'picking_up');
  DB.txs.push({ id: nid(), driverId: c.u.id, amount: -fee, kind: 'fee', label: 'رسوم التطبيق', orderNo: o.no, at: T() });
  return { order: clone(o) };
});
route('POST', '/api/driver/orders/:id/status', DR, (c) => { if (!DRV.includes(c.b.status)) bad('حالة غير صحيحة'); const o = O(c.p[0]); if (o.driverId !== c.u.id) bad('الطلب غير موجود', 404); setStatus(o, c.b.status); return { order: clone(o) }; });
route('POST', '/api/driver/charge', DR, (c) => {
  const n = nd(c.b.number).replace(/\D/g, ''); if (n.length !== 12) bad('رقم البطاقة يتكوّن من 12 رقماً');
  const k = DB.cards.find((x) => x.number === n); if (!k) bad('رقم البطاقة غير صحيح', 404); if (k.used) bad('هذه البطاقة مستخدمة مسبقاً', 409);
  k.used = true; k.usedBy = c.u.name; k.usedAt = T(); c.u.balance += k.amount; DB.txs.push({ id: nid(), driverId: c.u.id, amount: k.amount, kind: 'charge', label: 'شحن بطاقة', orderNo: null, at: T() });
  return { amount: k.amount, balance: c.u.balance };
});

route('GET', '/api/admin/overview', AD, () => {
  const td = dayStart(T()), os = DB.orders, cnt = (f) => os.filter(f).length, drv = DB.users.filter((u) => u.role === 'driver' && u.active);
  const days = []; for (let i = 6; i >= 0; i--) { const f = td - i * DAY; days.push({ t: f, n: cnt((o) => o.createdAt >= f && o.createdAt < f + DAY) }); }
  const att = os.filter((o) => (o.status === 'pending' && o.createdAt < T() - 10 * MIN) || ['no_answer', 'problem', 'other'].includes(o.status)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
  return { ordersToday: cnt((o) => o.createdAt >= td), active: cnt((o) => ['picking_up', 'on_the_way'].includes(o.status)), pending: cnt((o) => o.status === 'pending'), deliveredToday: cnt((o) => ['delivered', 'partial'].includes(o.status) && o.deliveredAt >= td), problemsToday: cnt((o) => ['no_answer', 'problem', 'other'].includes(o.status) && o.updatedAt >= td), feesToday: os.filter((o) => o.acceptedAt >= td).reduce((a, o) => a + o.fee, 0), drivers: drv.length, driverBalances: drv.reduce((a, u) => a + u.balance, 0), merchants: DB.users.filter((u) => u.role === 'merchant' && u.active).length, days, attention: clone(att) };
});
route('GET', '/api/admin/orders', AD, (c) => ({ orders: clone(DB.orders.filter((o) => !STATUSES.includes(c.q.status) || o.status === c.q.status).sort((a, b) => b.createdAt - a.createdAt)) }));
route('POST', '/api/admin/orders/:id/status', AD, (c) => { if (!STATUSES.includes(c.b.status)) bad('حالة غير صحيحة'); const o = O(c.p[0]); setStatus(o, c.b.status); return { order: clone(o) }; });
route('POST', '/api/admin/orders/:id/requeue', AD, (c) => {
  const o = O(c.p[0]); if (o.status === 'pending' || !o.driverId) bad('الطلب غير مسند لسائق', 409);
  const d = U(o.driverId); if (o.fee > 0 && d) { d.balance += o.fee; DB.txs.push({ id: nid(), driverId: d.id, amount: o.fee, kind: 'refund', label: 'استرجاع رسوم التطبيق', orderNo: o.no, at: T() }); }
  o.driverId = null; o.driverName = ''; o.fee = 0; o.acceptedAt = null; setStatus(o, 'pending'); return { order: clone(o) };
});
route('GET', '/api/admin/users', AD, (c) => ({ users: DB.users.filter((u) => u.role === (c.q.role === 'merchant' ? 'merchant' : 'driver')).map(pub).reverse() }));
route('POST', '/api/admin/users', AD, (c) => {
  const b = c.b, role = b.role === 'merchant' ? 'merchant' : 'driver', ph = phoneOf(b.phone);
  if (String(b.name || '').trim().length < 2) bad('اكتب الاسم'); if (!/^07\d{9}$/.test(ph)) bad('رقم الهاتف يجب أن يبدأ بـ 07 ويتكوّن من 11 رقماً'); if (String(b.password || '').length < 6) bad('كلمة المرور لا تقل عن 6 أحرف');
  if (role === 'merchant' && !String(b.area || '').trim()) bad('اكتب منطقة المتجر'); if (DB.users.some((u) => u.phone === ph)) bad('رقم الهاتف مسجّل مسبقاً', 409);
  user(nid(), role, b.name.trim(), ph, b.password, String(b.area || '').trim(), b.vehicle === 'car' ? 'car' : 'bike', 0); return { user: pub(DB.users[DB.users.length - 1]) };
});
route('PUT', '/api/admin/users/:id', AD, (c) => {
  const u = U(Number(c.p[0])); if (!u || u.role === 'admin') bad('المستخدم غير موجود', 404); const b = c.b;
  if (b.phone !== undefined) { const ph = phoneOf(b.phone); if (!/^07\d{9}$/.test(ph)) bad('رقم الهاتف غير صحيح'); if (DB.users.some((x) => x.phone === ph && x.id !== u.id)) bad('رقم الهاتف مسجّل مسبقاً', 409); u.phone = ph; }
  if (b.name !== undefined) { if (String(b.name).trim().length < 2) bad('اكتب الاسم'); u.name = String(b.name).trim(); }
  if (b.area !== undefined) u.area = String(b.area).trim(); if (b.vehicle !== undefined) u.vehicle = b.vehicle === 'car' ? 'car' : 'bike';
  if (b.active !== undefined) u.active = !!b.active; if (b.password) { if (String(b.password).length < 6) bad('كلمة المرور لا تقل عن 6 أحرف'); u.pw = String(b.password); }
  return { user: pub(u) };
});
route('POST', '/api/admin/users/:id/adjust', AD, (c) => {
  const u = U(Number(c.p[0])), a = intOf(c.b.amount); if (!u || u.role !== 'driver' || !a) bad('اكتب مبلغاً صحيحاً');
  if (u.balance + a < 0) bad('تعذّر تعديل الرصيد (تأكد من السائق ومن أن الرصيد يكفي)', 409);
  u.balance += a; DB.txs.push({ id: nid(), driverId: u.id, amount: a, kind: 'admin', label: String(c.b.label || '').trim() || 'تعديل من الإدارة', orderNo: null, at: T() }); return { user: pub(u) };
});
route('GET', '/api/admin/cards', AD, () => ({ cards: clone([...DB.cards].sort((a, b) => b.createdAt - a.createdAt)) }));
route('POST', '/api/admin/cards', AD, (c) => {
  const a = intOf(c.b.amount), n = Math.min(50, Math.max(1, intOf(c.b.count) || 1)); if (!(a >= 1000)) bad('اختر قيمة صحيحة للبطاقة');
  const made = []; for (let i = 0; i < n; i++) { let num; do { num = String(Math.floor(Math.random() * 1e12)).padStart(12, '0'); } while (DB.cards.some((k) => k.number === num)); DB.cards.push({ number: num, amount: a, used: false, usedBy: '', usedAt: null, createdAt: T() + i }); made.push(num); }
  return { made };
});
route('DELETE', '/api/admin/cards/:n', AD, (c) => { const i = DB.cards.findIndex((k) => k.number === c.p[0] && !k.used); if (i < 0) bad('لا يمكن حذف بطاقة مستخدمة', 409); DB.cards.splice(i, 1); return { ok: true }; });
route('PUT', '/api/admin/settings', AD, (c) => {
  for (const k of ['bikeSame', 'bikeOther', 'carSame', 'carOther', 'feeSame', 'feeOther']) if (c.b[k] !== undefined) { const v = intOf(c.b[k]); if (!(v >= 0)) bad('قيمة غير صحيحة'); DB.settings[k] = v; }
  if (c.b.support !== undefined) DB.settings.support = phoneOf(c.b.support).slice(0, 15); return { settings: DB.settings };
});

const realFetch = window.fetch.bind(window);
window.fetch = async (url, opts = {}) => {
  const u = new URL(url, location.href);
  if (!u.pathname.includes('/api/')) return realFetch(url, opts);
  await new Promise((r) => setTimeout(r, 90));
  const path = u.pathname.slice(u.pathname.indexOf('/api/'));
  const send = (s, j) => new Response(JSON.stringify(j), { status: s, headers: { 'Content-Type': 'application/json' } });
  try {
    const m = String(opts.method || 'GET').toUpperCase();
    const tok = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '').replace('Bearer ', '');
    const me = tok.startsWith('demo-') ? U(Number(tok.slice(5))) : null;
    for (const r of R_) {
      if (r.m !== m) continue; const mm = r.re.exec(path); if (!mm) continue;
      if (!r.opts.pub) { if (!me || !me.active) bad('انتهت الجلسة، سجّل الدخول مرة أخرى', 401); if (r.opts.roles && !r.opts.roles.includes(me.role)) bad('غير مسموح', 403); }
      return send(200, r.h({ b: opts.body ? JSON.parse(opts.body) : {}, q: Object.fromEntries(u.searchParams), p: mm.slice(1).map(decodeURIComponent), u: me }));
    }
    return send(404, { error: 'المسار غير موجود' });
  } catch (e) { return send(e.status || 500, { error: e.message }); }
};

/* أزرار دخول سريعة + شريط تنبيه */
const strip = document.createElement('div');
strip.style.cssText = 'background:#ffd21f;color:#171200;font:600 13px/1.5 system-ui,sans-serif;text-align:center;padding:6px 12px;padding-top:calc(6px + env(safe-area-inset-top,0px))';
strip.textContent = 'نسخة تجريبية: البيانات داخل هذه الصفحة فقط وتعود للبداية عند التحديث';
document.body.prepend(strip);
const demos = [['تاجر', '07700000201', '123456'], ['سائق', '07700000301', '123456'], ['مدير', '07700000000', 'admin1234']];
function addQuick() {
  const f = document.querySelector('[data-form=login]');
  if (!f || f.querySelector('.quick')) return;
  const box = document.createElement('div'); box.className = 'quick';
  box.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center';
  box.innerHTML = '<span class="hint" style="width:100%">دخول سريع للتجربة:</span>';
  demos.forEach(([l, p, w]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm'; b.style.flex = '1'; b.textContent = l; b.onclick = () => { f.phone.value = p; f.password.value = w; f.requestSubmit(); }; box.appendChild(b); });
  f.appendChild(box);
}
new MutationObserver(addQuick).observe(document.getElementById('app'), { childList: true, subtree: true });
addQuick();
})();
