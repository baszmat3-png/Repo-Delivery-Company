'use strict';
/* ريو — لوحة التحكم (ويب). مزامنة فورية عبر SSE + احتياط بالاستعلام الدوري. */
(() => {
const { esc, nf, mny, fd, fdt, dayStart, ago, ST, STC, wa, LOGO, tafqeet, printDoc, saveDocImage, docPage, docA4, doc80, exportXlsx, fillTpl, OFF, DAY } = window.RL;
const API = String(window.RIO_API || '').replace(/\/$/, ''), KEY = 'rio_admin_token';
const $ = (s, r = document) => r.querySelector(s);
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } }, del(k) { try { localStorage.removeItem(k); } catch { /* */ } } };
let RS = ls.get('rio_rsize'); if (!['58', '80', 'a5', 'a4'].includes(RS)) RS = '80';
const APP = 'ريو للتوصيل أسرع';
const tpl = (k) => (SET && SET.templates && SET.templates[k]) || '';
const ordVars = (o) => ({ order_no: o.no, status: ST[o.status] || o.status, merchant: o.merchantName, merchant_phone: o.merchantPhone, merchant_area: o.merchantArea, customer_phone: o.customerPhone, customer_area: o.customerArea, product: o.product, qty: o.qty, product_price: mny(o.productPrice), delivery_price: mny(o.deliveryPrice), total: mny(o.total), driver: o.driverName || '—', note: o.note || '', app: APP, support: (SET && SET.support) || '', date: fdt(o.createdAt) });
const custMsg = (o) => fillTpl(tpl('cust_' + o.status) || tpl('cust_default'), ordVars(o));
const drvMsg = (o, d) => fillTpl(tpl('admin_driver'), { ...ordVars(o), name: d ? d.name : '', phone: d ? d.phone : '' });
const thermal = () => RS === '58' || RS === '80';
const rcls = () => 't80 sz' + RS;
const ST_OK = ['pending', 'picking_up', 'on_the_way', 'delivered', 'rejected', 'no_answer', 'postponed', 'return_sent', 'returned', 'cancelled'];
const stKeys = (cur) => Object.keys(ST).filter((k) => ST_OK.includes(k) || k === cur);
const rOn = () => !SET || (SET.receipts !== 0 && SET.receipts !== false);
const sizeSeg = () => `<div class="row" style="justify-content:center;margin-bottom:10px"><span class="hint">حجم الوصل</span><div class="seg" role="group" aria-label="حجم الوصل">${[['58', '58mm'], ['80', '80mm'], ['a5', 'A5'], ['a4', 'A4']].map(([k, l]) => `<button type="button" data-a="rsize" data-k="${k}" aria-pressed="${RS === k}">${l}</button>`).join('')}</div></div>`;
const docBtns = () => `<button class="btn" data-a="print-doc">${ico('print')} طباعة / PDF</button><button class="btn g" data-a="save-doc">${ico('dl')} حفظ صورة</button>`;
const DONE = ['delivered', 'partial'], RET = ['returned', 'partial', 'rejected'];
const CATS = ['الإيجار', 'الوقود', 'السحب', 'الطعام', 'تنقلات شخصية', 'الإنترنت', 'اشتراكات تقنية', 'رواتب', 'إعلانات', 'صيانة', 'كهرباء وماء', 'أخرى'];
const PAGES_BASE = [['home', 'لوحة المعلومات', 'home'], ['orders', 'الطلبات', 'orders'], ['merchants', 'المتاجر', 'store'], ['drivers', 'المندوبون', 'bike'], ['customers', 'العملاء', 'users'], ['finance', 'المالية والأرباح', 'money'], ['vouchers', 'سندات القبض والصرف', 'voucher'], ['cards', 'كروت الشحن', 'card'], ['settings', 'الإعدادات', 'settings']];
const PAGES = PAGES_BASE.slice();
const ls0 = (() => { try { return JSON.parse(localStorage.getItem('rio_admin_me') || 'null'); } catch { return null; } })();
let ME = ls0, STAFF = [];
const isAdm = () => !ME || ME.role === 'admin';
const perm = (pg) => (isAdm() ? 'edit' : ((ME.perms || {})[pg] || ''));
function applyPerms() {
  PAGES.splice(0, PAGES.length, ...PAGES_BASE.filter((x) => perm(x[0])), ...(isAdm() ? [['staff', 'فريق الإدارة', 'users']] : []));
  if (!PAGES.some((x) => x[0] === P)) P = PAGES.length ? PAGES[0][0] : 'home';
}
const setMe = (u) => { ME = u; try { localStorage.setItem('rio_admin_me', JSON.stringify(u)); } catch { /* ignore */ } applyPerms(); };
const PERM_LV = [['', 'بدون صلاحية'], ['view', 'عرض فقط'], ['edit', 'عرض وتعديل']];
const IC = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>', orders: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>', bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8H8M13 12h5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2.5.6 4 2.3 4 5.5"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="2.8"/><path d="M6 10v4M18 10v4"/>', voucher: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  dl: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', xl: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8l8 8M16 8l-8 8"/>', pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 14h6M9 17h4"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-6h16v6h-3"/><rect x="7" y="14" width="10" height="7"/>', refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>'
};
const ico = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------------- الحالة ---------------- */
let T = ls.get(KEY) || '', P = ls.get('rio_page') || 'home', R = ls.get('rio_range') || 'month', CF = ls.get('rio_cf') || '', CT = ls.get('rio_ct') || '';
let BASIS = ls.get('rio_basis') || 'fees', SORT = ls.get('rio_sort') || 'orders', FP = 'month', VK = 'in', Q = '', FS = 'all', FM = 0;
let MENU = false, D = null, O = [], FN = null, V = [], CARDS = [], SET = null, BATCH = null, E = '', M = null, LIVE = false, DIRTY = false, loading = false;
applyPerms();
if (!['orders', 'active', 'goods'].includes(SORT)) SORT = 'orders';

function range() {
  const n = Date.now(), s = dayStart(n), d = new Date(n + OFF);
  if (R === 'today') return [s, s + DAY];
  if (R === 'week') return [s - 6 * DAY, s + DAY];
  if (R === 'month') return [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFF, s + DAY];
  if (R === 'year') return [Date.UTC(d.getUTCFullYear(), 0, 1) - OFF, s + DAY];
  if (R === 'custom') {
    const a = CF ? Date.parse(CF + 'T00:00:00+03:00') : 0, b = CT ? Date.parse(CT + 'T00:00:00+03:00') + DAY : s + DAY;
    return [a, b];
  }
  return [0, s + DAY];
}
const RN = { today: 'اليوم', week: 'آخر 7 أيام', month: 'هذا الشهر', year: 'هذه السنة', all: 'كل الفترات', custom: 'فترة مخصصة' };
const rangeLabel = () => { const [a, b] = range(); return R === 'all' ? 'كل الفترات' : `${fd(a)} → ${fd(b - 1)}`; };

async function api(m, p, b) {
  let r;
  try { r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(T ? { Authorization: 'Bearer ' + T } : {}) }, body: b ? JSON.stringify(b) : undefined }); }
  catch { throw Error('لا يوجد اتصال بالخادم'); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && T && p !== '/api/login') { logout(); throw Error(j.error || 'انتهت الجلسة'); }
  if (!r.ok) throw Error(j.error || 'حدث خطأ');
  return j;
}
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}
const act = async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok); return r === undefined ? true : r; } catch (e) { toast(e.message, true); return null; } };

/* ---------------- التحميل والمزامنة ---------------- */
let lt = null, es = null, poll = null;
async function load(silent) {
  if (!T) return;
  if (silent && (M && M.type !== 'stmt' || typing())) { DIRTY = true; return; }
  try {
    const [a, b] = range();
    const jobs = [api('GET', `/api/admin/stats?from=${a}&to=${b}`)];
    jobs.push(P === 'orders' ? api('GET', `/api/admin/orders?from=${a}&to=${b}&limit=5000`) : null);
    jobs.push(P === 'home' || P === 'finance' ? api('GET', '/api/admin/finance') : null);
    jobs.push(P === 'vouchers' ? api('GET', `/api/admin/vouchers?from=${a}&to=${b}`) : null);
    jobs.push(P === 'cards' ? api('GET', '/api/admin/cards') : null);
    jobs.push(api('GET', '/api/settings'));
    jobs.push(api('GET', '/api/me'));
    jobs.push(P === 'staff' && isAdm() ? api('GET', '/api/admin/staff') : null);
    const [d, o, f, v, cd, st, me, sf] = await Promise.all(jobs);
    if (me && me.user) setMe(me.user);
    if (sf) STAFF = sf.staff;
    D = d; if (o) O = o.orders; if (f) FN = f; if (v) V = v.vouchers; if (cd) CARDS = cd.cards; if (st) SET = st.settings; E = '';
    if (M && M.type === 'stmt') { try { M.st = await fetchStmt(M.q); } catch { /* ignore */ } }
  } catch (e) { E = e.message; }
  DIRTY = false; draw(); drawModal();
}
const typing = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#view'); };
function connect() {
  disconnect();
  if (!T || !window.EventSource) return;
  es = new EventSource(API + '/api/stream?token=' + encodeURIComponent(T));
  es.onopen = () => { LIVE = true; setLive(); load(true); };
  es.onerror = () => { LIVE = false; setLive(); };
  es.addEventListener('change', () => { clearTimeout(lt); lt = setTimeout(() => load(true), 350); });
}
function disconnect() { if (es) { es.close(); es = null; } LIVE = false; }
function setLive() { document.querySelectorAll('.live').forEach((e) => { e.classList.toggle('on', LIVE); const s = e.querySelector('span'); if (s) s.textContent = LIVE ? 'مزامنة فورية' : 'غير متصل — تحديث دوري'; }); }
setInterval(() => { if (T && !document.hidden && !LIVE) load(true); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && T) load(true); });
function logout() { MENU = false; T = ''; ls.del(KEY); try { localStorage.removeItem('rio_admin_me'); } catch { /* ignore */ } ME = null; applyPerms(); disconnect(); D = null; M = null; draw(); drawModal(); }

/* ---------------- أدوات عرض ---------------- */
const kpi = (l, v, c, sub) => `<div class="kpi ${c || ''}"><small>${l}</small><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
const bdg = (t, c) => `<span class="badge ${c || ''}">${esc(t)}</span>`;
const stB = (s) => bdg(ST[s] || s, STC[s]);
const mm = (n) => `<span class="num">${mny(n)}</span>`;
const nn = (n) => `<span class="num">${nf(n)}</span>`;
const empty = (t, s) => `<div class="empty"><b>${t}</b>${s || ''}</div>`;
const rankB = (i) => `<span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span>`;
const pct = (v, mx) => Math.max(2, Math.round((v / Math.max(1, mx)) * 100));
const norm = (s) => String(s || '').toLowerCase();
const sdate = (t) => { const d = new Date(t + OFF); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); };
const MONTHS = ['كانون 2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين 1', 'تشرين 2', 'كانون 1'];
const mlabel = (t) => MONTHS[new Date(t + OFF).getUTCMonth()];

/* مخطط SVG: type bar|line — series:[{name,color,vals}] */
function chart(labels, series, o = {}) {
  const W = 680, H = o.h || 220, L = 46, B = 26, Tt = 10, pw = W - L - 8, ph = H - B - Tt;
  const mx = Math.max(1, ...series.flatMap((s) => s.vals));
  const mn = o.neg ? Math.min(0, ...series.flatMap((s) => s.vals)) : 0;
  const span = mx - mn || 1;
  const y = (v) => Tt + ph - ((v - mn) / span) * ph;
  const fmt = o.fmt || nf, short = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v)));
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = mn + (span * i) / 4, yy = y(v); g += `<line class="gl" x1="${L}" x2="${W - 8}" y1="${yy}" y2="${yy}"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${short(v)}</text>`; }
  const n = labels.length, step = pw / n, every = Math.ceil(n / (o.ticks || 10));
  let body = '';
  if (o.type === 'line') {
    series.forEach((s) => {
      const pts = s.vals.map((v, i) => [L + step * (i + 0.5), y(v)]);
      body += `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
      body += pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="${s.color}"><title>${esc(labels[i])} · ${esc(s.name)}: ${fmt(s.vals[i])}</title></circle>`).join('');
    });
  } else {
    const k = series.length, bw = Math.min(26, (step * 0.72) / k);
    series.forEach((s, si) => s.vals.forEach((v, i) => {
      const x = L + step * i + (step - bw * k) / 2 + bw * si, y0 = y(Math.max(0, mn)), y1 = y(v);
      body += `<rect x="${x}" y="${Math.min(y0, y1)}" width="${bw - 1.5}" height="${Math.max(1.5, Math.abs(y0 - y1))}" rx="3" fill="${s.color}"><title>${esc(labels[i])} · ${esc(s.name)}: ${fmt(v)}</title></rect>`;
    }));
  }
  const xl = labels.map((l, i) => (i % every === 0 ? `<text x="${L + step * (i + 0.5)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : '')).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'مخطط')}">${g}${body}${xl}</svg><div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

/* ---------------- الهيكل ---------------- */
function draw() {
  const r = $('#root');
  if (!T) {
    r.innerHTML = `<div class="login-wrap"><form class="login" id="lf" autocomplete="on">${LOGO}<h2>لوحة تحكم ريو</h2><p class="s">للإدارة</p>
    <input class="in" name="phone" autocomplete="username" placeholder="اسم المستخدم أو رقم الهاتف" required><input class="in" name="password" type="password" autocomplete="current-password" placeholder="كلمة المرور" required>
    <div class="err" id="le" role="alert"></div><button class="btn" style="width:100%;min-height:44px">دخول</button></form></div>`;
    return;
  }
  const keep = {}; let af = null;
  document.querySelectorAll('#view [id]').forEach((e) => { if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) keep[e.id] = e.value; });
  const a = document.activeElement; if (a && a.id && keep[a.id] !== undefined) af = [a.id, a.selectionStart, a.selectionEnd];
  const sy = window.scrollY;
  const badge = (id) => {
    if (!D) return '';
    if (id === 'orders' && D.staleOrders.length) return `<span class="cnt warn">${D.staleOrders.length}</span>`;
    if (id === 'drivers' && D.lateOrders.length) return `<span class="cnt warn">${D.lateOrders.length}</span>`;
    return '';
  };
  if (!PAGES.length) { r.innerHTML = `<div class="login-wrap"><div class="login">${LOGO}<h2>لا توجد صلاحيات</h2><p class="s">لم تُمنح أي صلاحية بعد. تواصل مع المدير.</p><button class="btn" data-a="logout" style="width:100%;min-height:44px">تسجيل الخروج</button></div></div>`; return; }
  const title = (PAGES.find((x) => x[0] === P) || PAGES[0])[1];
  const rng = ['today', 'week', 'month', 'year', 'all', 'custom'].map((k) => `<option value="${k}" ${R === k ? 'selected' : ''}>${RN[k]}</option>`).join('');
  r.innerHTML = `<div class="app${MENU ? ' open' : ''}"><div class="mbar"><button class="mb" data-a="menu" aria-label="القائمة" aria-expanded="${MENU}"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><b>${title}</b>${LOGO}</div><div class="ov" data-a="menu-x"></div><aside class="side"><div class="brand">${LOGO}<div><b>لوحة الإدارة</b><small>ريو للتوصيل أسرع</small></div></div>
  <nav class="nav" aria-label="التنقل">${PAGES.map(([k, l, i]) => `<button data-a="page" data-k="${k}" class="${P === k ? 'on' : ''}" ${P === k ? 'aria-current="page"' : ''}>${ico(i)}<span>${l}</span>${badge(k)}</button>`).join('')}</nav>
  <div class="foot"><div class="live ${LIVE ? 'on' : ''}"><i></i><span>${LIVE ? 'مزامنة فورية' : 'غير متصل — تحديث دوري'}</span></div><br><button data-a="logout">تسجيل الخروج</button></div></aside>
  <main class="main"><div class="top"><div><h2>${title}</h2><div class="sub">${esc(rangeLabel())}</div></div>
  <div class="tools"><select class="in" data-c="range" aria-label="الفترة">${rng}</select>${R === 'custom' ? `<input class="in" type="date" data-c="cf" value="${CF}" aria-label="من"><input class="in" type="date" data-c="ct" value="${CT}" aria-label="إلى">` : ''}<button class="btn g" data-a="reload">${ico('refresh')} تحديث</button></div></div>
  <div id="view" class="${perm(P) === 'edit' ? '' : 'ro'}">${!D ? `<div class="card">${E ? `${esc(E)} <button class="btn sm" data-a="reload">إعادة المحاولة</button>` : 'جارٍ التحميل…'}</div>` : E ? `<div class="card" style="color:var(--red)">${esc(E)}</div>` + page() : page()}</div></main></div>`;
  Object.keys(keep).forEach((id) => { const e = document.getElementById(id); if (e && e.value !== keep[id] && !e.matches('[type=date]') || (e && e.id === 'q')) e.value = keep[id]; });
  if (af) { const e = document.getElementById(af[0]); if (e) { e.focus(); try { e.setSelectionRange(af[1], af[2]); } catch { /* */ } } }
  window.scrollTo(0, sy);
}

function page() {
  return ({ home, orders, merchants, drivers, customers, finance, vouchers, cards, settings, staff })[P]();
}

/* ---------------- فريق الإدارة ---------------- */
const permBadges = (u) => PAGES_BASE.filter((x) => (u.perms || {})[x[0]]).map((x) => bdg(`${x[1]}${u.perms[x[0]] === 'edit' ? ' ✎' : ''}`, u.perms[x[0]] === 'edit' ? 'green' : 'gray')).join(' ') || '<span class="muted">بدون صلاحيات</span>';
function staff() {
  return `<div class="row between" style="margin-bottom:12px"><p class="muted" style="margin:0">موظفون يدخلون لوحة التحكم بمستخدم وكلمة مرور، وترى كل واحد منهم الصفحات التي تسمح له بها فقط.</p><button class="btn" data-a="staff-add">${ico('plus')} إضافة موظف</button></div>
  ${STAFF.length ? `<div class="card tblwrap"><table><thead><tr><th>الموظف</th><th>اسم المستخدم</th><th>الصلاحيات</th><th></th></tr></thead><tbody>${STAFF.map((u) => `<tr><td><b>${esc(u.name)}</b> ${u.active ? '' : bdg('موقوف', 'red')}</td><td class="num">${esc(u.username)}</td><td>${permBadges(u)}</td>
  <td class="act"><div class="row"><button class="btn sm g" data-a="staff-edit" data-id="${u.id}">تعديل</button><button class="btn sm ${u.active ? 'g' : 'd'}" data-a="staff-toggle" data-id="${u.id}">${u.active ? 'إيقاف' : 'تفعيل'}</button><button class="btn sm d" data-a="staff-del" data-id="${u.id}">حذف</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="card">لا يوجد موظفون بعد. اضغط «إضافة موظف».</div>'}`;
}

/* ---------------- حساب الدخل ---------------- */
const income = (p) => (BASIS === 'fees' ? p.fees : p.cards);
const basisSeg = () => `<div class="seg" role="group" aria-label="أساس حساب الدخل"><button data-a="basis" data-k="fees" aria-pressed="${BASIS === 'fees'}">خصم رسوم الطلبات من الكباتن</button><button data-a="basis" data-k="cards" aria-pressed="${BASIS === 'cards'}">مبيعات كروت الشحن</button></div>`;
const basisHint = () => (BASIS === 'fees'
  ? 'الدخل = الرسوم التي تُخصم فعلياً من محفظة الكابتن لحظة قبول كل طلب (تُسترجع تلقائياً إذا أُعيد الطلب).'
  : 'الدخل = قيمة الكروت التي شحنها الكباتن (وشحن الإدارة اليدوي) — أساس نقدي.');
function periodCards() {
  const P4 = [['today', 'اليوم'], ['week', 'هذا الأسبوع'], ['month', 'هذا الشهر'], ['year', 'هذه السنة']];
  return `<div class="per">${P4.map(([k, l]) => {
    const p = FN.periods[k], inc = income(p), net = inc - p.expenses;
    return `<div class="p"><h4><span>${l}</span><span>${nn(p.orders)} طلب</span></h4><div class="big">${mm(inc)}</div>
    <dl><div><span>رسوم الكباتن المخصومة</span><b>${mm(p.fees)}</b></div><div><span>مبيعات الكروت (${nn(p.cardCount)})</span><b>${mm(p.cards)}</b></div><div><span>المصروفات</span><b class="neg">${mm(p.expenses)}</b></div></dl>
    <div class="net"><span>صافي الربح</span><span class="${net < 0 ? 'neg' : 'pos'}">${mm(net)}</span></div></div>`;
  }).join('')}</div>`;
}

/* ---------------- الرئيسية ---------------- */
function home() {
  const s = D, c = s.counts, late = s.lateOrders.length;
  const inprog = (c.picking_up || 0) + (c.on_the_way || 0);
  const days = s.days.slice(-30);
  const topM = [...s.merchants].sort((a, b) => b.orders - a.orders).filter((x) => x.orders).slice(0, 5), mxM = Math.max(1, ...topM.map((x) => x.orders));
  const topD = [...s.drivers].sort((a, b) => b.delivered - a.delivered).filter((x) => x.orders).slice(0, 5), mxD = Math.max(1, ...topD.map((x) => x.delivered));
  const att = [...s.lateOrders.map((o) => ({ o, why: 'متأخر عند السائق', c: 'red' })), ...s.staleOrders.map((o) => ({ o, why: 'بانتظار سائق منذ مدة', c: 'amber' }))].slice(0, 12);
  return `<div class="row between" style="margin-bottom:12px"><div><b>الدخل والأرباح</b><div class="hint">${basisHint()}</div></div>${basisSeg()}</div>
  ${FN ? periodCards() : ''}
  <div class="kpis">${kpi('إجمالي الطلبات', nn(s.total), 'y', RN[R])}${kpi('تم التسليم', nn(s.delivered), 'g')}${kpi('بانتظار سائق', nn(c.pending || 0), 'a')}${kpi('قيد التنفيذ', nn(inprog), 'b')}${kpi('متأخرة', nn(late), late ? 'r' : '', `أكثر من ${s.lateMin} دقيقة`)}${kpi('راجع', nn((c.returned || 0) + (c.partial || 0)), 'v')}${kpi('مشاكل / لا يرد', nn((c.problem || 0) + (c.no_answer || 0) + (c.other || 0)), 'r')}${kpi('أرصدة الكباتن', mm(s.drivers.reduce((a, u) => a + u.balance, 0)), '')}</div>
  <div class="grid g2"><div class="card"><div class="ch">الطلبات اليومية <small>آخر 30 يوماً ضمن الفترة</small></div>${days.length ? chart(days.map((x) => sdate(x.t)), [{ name: 'كل الطلبات', color: '#f5b400', vals: days.map((x) => x.n) }, { name: 'المسلّمة', color: '#16a34a', vals: days.map((x) => x.d) }], { label: 'الطلبات اليومية' }) : empty('لا بيانات')}</div>
  <div class="card"><div class="ch">الدخل اليومي <small>آخر 30 يوماً · ${BASIS === 'fees' ? 'رسوم الكباتن' : 'مبيعات الكروت'}</small></div>${FN ? chart(FN.daily.map((x) => sdate(x.t)), [{ name: 'الدخل', color: '#16a34a', vals: FN.daily.map(income) }, { name: 'المصروفات', color: '#ef4444', vals: FN.daily.map((x) => x.expenses) }], { type: 'line', fmt: mny, label: 'الدخل اليومي' }) : ''}</div></div>
  <div class="grid g2"><div class="card"><div class="ch">أكثر المتاجر طلباً <button class="btn sm g" data-a="page" data-k="merchants">الكل</button></div>${topM.length ? `<div class="catbars">${topM.map((m, i) => `<div class="cb"><span>${rankB(i)} ${esc(m.name)}</span><div class="bar"><i style="width:${pct(m.orders, mxM)}%"></i></div><b>${nn(m.orders)}</b></div>`).join('')}</div>` : empty('لا طلبات')}</div>
  <div class="card"><div class="ch">أفضل المندوبين إنجازاً <button class="btn sm g" data-a="page" data-k="drivers">الكل</button></div>${topD.length ? `<div class="catbars">${topD.map((m, i) => `<div class="cb"><span>${rankB(i)} ${esc(m.name)}</span><div class="bar"><i style="width:${pct(m.delivered, mxD)}%;background:#16a34a"></i></div><b>${nn(m.delivered)}</b></div>`).join('')}</div>` : empty('لا بيانات')}</div></div>
  <div class="card"><div class="ch">تحتاج متابعة <small>${att.length} طلب</small></div>${att.length ? `<div class="tw"><table><thead><tr><th>الطلب</th><th>المتجر</th><th>الزبون</th><th>السائق</th><th>السبب</th><th>منذ</th><th></th></tr></thead><tbody>${att.map(({ o, why, c: cl }) => `<tr><td><b>#${o.no}</b></td><td>${esc(o.merchantName)}</td><td>${esc(o.customerArea)}</td><td>${esc(o.driverName || '—')}</td><td>${bdg(why, cl)}</td><td>${ago(o.acceptedAt || o.createdAt)}</td><td class="act"><div class="row">${o.driverId ? `<button class="btn sm d" data-a="requeue" data-id="${o.id}">إعادة للسائقين</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : empty('كل شيء يسير بشكل جيد', 'لا توجد طلبات متأخرة.')}</div>`;
}

/* ---------------- الطلبات ---------------- */
const ORD_HEAD = ['رقم الطلب', 'التاريخ', 'الحالة', 'المتجر', 'منطقة الزبون', 'هاتف الزبون', 'المنتج', 'العدد', 'سعر البضاعة', 'أجرة التوصيل', 'الإجمالي', 'المندوب', 'تاريخ التسليم'];
const ordRow = (o) => [o.no, fdt(o.createdAt), ST[o.status] || o.status, o.merchantName, o.customerArea, o.customerPhone, o.product, o.qty, o.productPrice, o.deliveryPrice, o.total, o.driverName || '', o.deliveredAt ? fdt(o.deliveredAt) : ''];
const ordPdfHead = ['#', 'التاريخ', 'الحالة', 'المتجر', 'المنطقة', 'المنتج', '#البضاعة', '#التوصيل', '#الإجمالي', 'المندوب'];
const ordPdfRow = (o) => [o.no, fd(o.createdAt), ST[o.status] || o.status, o.merchantName, o.customerArea, o.product + ' × ' + o.qty, nf(o.productPrice), nf(o.deliveryPrice), nf(o.total), o.driverName || '—'];
function filteredOrders() {
  const q = norm(Q.trim());
  return O.filter((o) => (FS === 'all' || o.status === FS) && (!FM || o.merchantId === FM) && (!q || norm([o.no, o.merchantName, o.customerPhone, o.customerArea, o.driverName, o.product].join(' ')).includes(q)));
}
const ASSIGNABLE = ['pending', 'picking_up', 'on_the_way', 'no_answer', 'postponed', 'problem', 'other'];
const driverPhone = (o) => { const d = D.drivers.find((x) => x.id === o.driverId); return d ? d.phone : ''; };
function ordersList() {
  const l = filteredOrders();
  const tot = l.filter((o) => DONE.includes(o.status));
  return `<div class="tw"><table><thead><tr><th>الطلب</th><th>المتجر</th><th>الزبون</th><th>المنتج</th><th class="n">البضاعة</th><th class="n">التوصيل</th><th class="n">الإجمالي</th><th>المندوب</th><th>الحالة</th><th></th></tr></thead><tbody>
  ${l.slice(0, 400).map((o) => `<tr><td><b>#${o.no}</b><div class="hint">${fdt(o.createdAt)}</div></td><td>${esc(o.merchantName)}</td><td>${esc(o.customerArea)}<div class="hint num">${esc(o.customerPhone)}</div></td><td>${esc(o.product)} × ${o.qty}</td>
  <td class="n">${nn(o.productPrice)}</td><td class="n">${nn(o.deliveryPrice)}</td><td class="n"><b>${nn(o.total)}</b></td><td>${esc(o.driverName || '—')}</td>
  <td><select class="in" style="min-height:34px;padding:4px 8px" data-c="status" data-id="${o.id}" aria-label="حالة الطلب ${o.no}">${stKeys(o.status).map((k) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${ST[k]}</option>`).join('')}</select></td>
  <td class="act"><div class="row">${rOn() ? `<button class="btn sm" data-a="receipt" data-id="${o.id}">وصل</button>` : ''}${o.driverId ? `<button class="btn sm g" data-a="chat" data-id="${o.id}">محادثة</button>` : ''}<a class="btn sm w" target="_blank" rel="noopener" href="${wa(o.customerPhone, custMsg(o))}">واتساب الزبون</a>${o.driverId && driverPhone(o) ? `<a class="btn sm w" target="_blank" rel="noopener" href="${wa(driverPhone(o), drvMsg(o, D.drivers.find((x) => x.id === o.driverId)))}">واتساب السائق</a>` : ''}${ASSIGNABLE.includes(o.status) ? `<button class="btn sm" data-a="assign" data-id="${o.id}">${o.driverId ? 'تحويل لسائق' : 'تعيين سائق'}</button>` : ''}${o.driverId && o.status !== 'pending' ? `<button class="btn sm g" data-a="requeue" data-id="${o.id}">إعادة</button>` : ''}</div></td></tr>`).join('')}
  </tbody>${l.length ? `<tfoot><tr><td colspan="4">${nn(l.length)} طلب (المسلّم ${nn(tot.length)})</td><td class="n">${nn(tot.reduce((a, o) => a + o.productPrice, 0))}</td><td class="n">${nn(tot.reduce((a, o) => a + o.deliveryPrice, 0))}</td><td class="n">${nn(tot.reduce((a, o) => a + o.total, 0))}</td><td colspan="3"></td></tr></tfoot>` : ''}</table></div>${l.length > 400 ? `<p class="hint">يُعرض أول 400 سجل — استخدم البحث أو التصدير للحصول على الكل (${nn(l.length)}).</p>` : ''}${l.length ? '' : empty('لا توجد طلبات مطابقة')}`;
}
function orders() {
  const ms = D.merchants.map((m) => `<option value="${m.id}" ${FM === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  return `<div class="card"><div class="row between" style="margin-bottom:12px"><div class="row"><input class="in" id="q" placeholder="بحث: رقم، متجر، هاتف، منطقة…" value="${esc(Q)}" style="min-width:230px"><select class="in" data-c="fm" id="fm"><option value="0">كل المتاجر</option>${ms}</select></div>
  <div class="row"><button class="btn sm g" data-a="exp-orders">${ico('xl')} Excel</button><button class="btn sm g" data-a="pdf-orders">${ico('pdf')} PDF / طباعة</button></div></div>
  <div class="chips" style="margin-bottom:12px"><button class="chip" data-a="fs" data-k="all" aria-pressed="${FS === 'all'}">الكل</button>${stKeys().map((k) => `<button class="chip" data-a="fs" data-k="${k}" aria-pressed="${FS === k}">${ST[k]} (${D.counts[k] || 0})</button>`).join('')}</div><div id="list">${ordersList()}</div></div>`;
}

/* ---------------- المتاجر ---------------- */
const SORTS = { orders: ['الأكثر طلباً', (a, b) => b.orders - a.orders], active: ['الأكثر نشاطاً', (a, b) => b.lastAt - a.lastAt], goods: ['الأعلى مبيعاً', (a, b) => b.goods - a.goods] };
const mapHref = (u) => (/^https?:/i.test(u) ? u : 'https://www.google.com/maps?q=' + encodeURIComponent(u));
const wapw = (u) => wa(u.phone, `مرحباً ${u.name}، ريو للتوصيل أسرع`);
function merchantList() {
  const q = norm(Q.trim());
  const l = [...D.merchants].filter((m) => !q || norm(m.name + ' ' + m.phone + ' ' + m.area).includes(q)).sort(SORTS[SORT][1]);
  const top = [...D.merchants].sort((a, b) => b.orders - a.orders).filter((x) => x.orders > 0).slice(0, 3).map((x) => x.id);
  const mx = Math.max(1, ...l.map((m) => m.orders));
  const t = (k) => l.reduce((a, m) => a + (m[k] || 0), 0);
  return `<div class="tw"><table><thead><tr><th>#</th><th>المتجر</th><th>الطلبات</th><th class="n">المسلّمة</th><th class="n">الراجع</th><th class="n">قيمة البضائع</th><th class="n">أجور التوصيل</th><th>الموقع</th><th>آخر نشاط</th><th></th></tr></thead><tbody>
  ${l.map((m, i) => `<tr><td>${rankB(i)}</td><td><b>${esc(m.name)}</b> ${!m.active ? bdg('موقوف', 'red') : ''} ${top.includes(m.id) ? bdg('الأكثر طلباً', 'y') : ''}<div class="hint">${esc(m.area)} · <span class="num">${esc(m.phone)}</span></div></td>
  <td style="min-width:120px"><b>${nn(m.orders)}</b><div class="bar"><i style="width:${pct(m.orders, mx)}%"></i></div></td><td class="n">${nn(m.delivered)}</td><td class="n">${m.returned ? `<span class="neg">${nn(m.returned)}</span><div class="hint">${mm(m.returnedValue)}</div>` : '0'}</td>
  <td class="n">${mm(m.goods)}</td><td class="n">${mm(m.delivery)}</td><td>${m.mapUrl ? `<a class="btn sm g" target="_blank" rel="noopener" href="${esc(mapHref(m.mapUrl))}">خريطة</a>` : '<span class="muted">—</span>'}</td><td>${ago(m.lastAt)}</td>
  <td class="act"><div class="row"><button class="btn sm" data-a="stmt" data-t="merchant" data-id="${m.id}">كشف / تصدير</button><button class="btn sm g" data-a="mloc" data-id="${m.id}">العنوان والموقع</button><button class="btn sm g" data-a="pw" data-id="${m.id}">كلمة سر</button><a class="btn sm w" target="_blank" rel="noopener" href="${wapw(m)}">واتساب</a><button class="btn sm ${m.active ? 'g' : 'd'}" data-a="toggle" data-id="${m.id}">${m.active ? 'إيقاف' : 'تفعيل'}</button></div></td></tr>`).join('')}
  </tbody>${l.length ? `<tfoot><tr><td colspan="2">${l.length} متجر</td><td>${nn(t('orders'))}</td><td class="n">${nn(t('delivered'))}</td><td class="n">${nn(t('returned'))}</td><td class="n">${mm(t('goods'))}</td><td class="n">${mm(t('delivery'))}</td><td colspan="3"></td></tr></tfoot>` : ''}</table></div>${l.length ? '' : empty('لا توجد متاجر', 'أضف أول متجر من الزر أعلاه.')}`;
}
function merchants() {
  const m = D.merchants;
  return `<div class="kpis">${kpi('عدد المتاجر', nn(m.length), 'y', nn(m.filter((x) => x.orders).length) + ' نشط في الفترة')}${kpi('طلبات مسلّمة', nn(m.reduce((a, x) => a + x.delivered, 0)), 'g')}${kpi('طلبات راجعة', nn(m.reduce((a, x) => a + x.returned, 0)), 'v', mny(m.reduce((a, x) => a + x.returnedValue, 0)))}${kpi('أجور التوصيل', mm(m.reduce((a, x) => a + x.delivery, 0)), 'b')}</div>
  <div class="card"><div class="row between" style="margin-bottom:12px"><div class="row"><input class="in" id="q" placeholder="بحث عن متجر…" value="${esc(Q)}" style="min-width:220px"><div class="seg" role="group" aria-label="الترتيب">${Object.keys(SORTS).map((k) => `<button data-a="sort" data-k="${k}" aria-pressed="${SORT === k}">${SORTS[k][0]}</button>`).join('')}</div></div>
  <div class="row"><button class="btn sm g" data-a="exp-merchants">${ico('xl')} Excel</button><button class="btn sm g" data-a="pdf-merchants">${ico('pdf')} PDF</button><button class="btn" data-a="add-user" data-r="merchant">${ico('plus')} إضافة متجر</button></div></div><div id="list">${merchantList()}</div></div>`;
}

/* ---------------- المندوبون ---------------- */
function driverList() {
  const q = norm(Q.trim());
  const l = [...D.drivers].filter((m) => !q || norm(m.name + ' ' + m.phone).includes(q)).sort((a, b) => b.delivered - a.delivered);
  return `<div class="tw"><table><thead><tr><th>#</th><th>المندوب</th><th class="n">المنجز</th><th class="n">جارٍ</th><th class="n">متأخر</th><th class="n">راجع</th><th class="n">مشاكل</th><th class="n">الرصيد</th><th class="n">المحصّل</th><th class="n">رسوم مخصومة</th><th>آخر نشاط</th><th></th></tr></thead><tbody>
  ${l.map((m, i) => `<tr><td>${rankB(i)}</td><td><b>${esc(m.name)}</b> ${!m.active ? bdg('موقوف', 'red') : m.receiving ? bdg('يستقبل', 'green') : bdg('متوقف الاستقبال', 'gray')}<div class="hint">${m.vehicle === 'car' ? 'سيارة' : 'دراجة'} · <span class="num">${esc(m.phone)}</span></div></td>
  <td class="n"><b>${nn(m.delivered)}</b></td><td class="n">${nn(m.live)}</td><td class="n">${m.late ? `<b class="neg">${nn(m.late)}</b>` : '0'}</td><td class="n">${nn(m.returned)}</td><td class="n">${nn(m.problems)}</td>
  <td class="n"><b class="${m.balance < (D.settingsFee || 1000) ? 'neg' : ''}">${mm(m.balance)}</b></td><td class="n">${mm(m.collected)}</td><td class="n">${mm(m.fees)}</td><td>${ago(m.lastAt)}</td>
  <td class="act"><div class="row"><button class="btn sm" data-a="stmt" data-t="driver" data-id="${m.id}">كشف / تصدير</button><button class="btn sm g" data-a="adjust" data-id="${m.id}">رصيد</button><button class="btn sm g" data-a="pw" data-id="${m.id}">كلمة سر</button><a class="btn sm w" target="_blank" rel="noopener" href="${wapw(m)}">واتساب</a><button class="btn sm ${m.active ? 'g' : 'd'}" data-a="toggle" data-id="${m.id}">${m.active ? 'إيقاف' : 'تفعيل'}</button></div></td></tr>`).join('')}
  </tbody></table></div>${l.length ? '' : empty('لا يوجد مندوبون')}`;
}
function drivers() {
  const d = D.drivers;
  return `<div class="kpis">${kpi('عدد المندوبين', nn(d.length), 'y', nn(d.filter((x) => x.receiving && x.active).length) + ' يستقبل الطلبات')}${kpi('لديهم طلبات جارية', nn(d.filter((x) => x.live > 0).length), 'b')}${kpi('طلبات متأخرة', nn(D.lateOrders.length), D.lateOrders.length ? 'r' : 'g', `أكثر من ${D.lateMin} دقيقة`)}${kpi('مجموع الأرصدة', mm(d.reduce((a, x) => a + x.balance, 0)), 'g')}${kpi('رسوم مخصومة (الفترة)', mm(D.fees), 'y')}</div>
  <div class="card"><div class="row between" style="margin-bottom:12px"><input class="in" id="q" placeholder="بحث عن مندوب…" value="${esc(Q)}" style="min-width:220px"><div class="row"><button class="btn sm g" data-a="exp-drivers">${ico('xl')} Excel</button><button class="btn sm g" data-a="pdf-drivers">${ico('pdf')} PDF</button><button class="btn" data-a="add-user" data-r="driver">${ico('plus')} إضافة مندوب</button></div></div><div id="list">${driverList()}</div></div>`;
}

/* ---------------- العملاء ---------------- */
function customerList() {
  const q = norm(Q.trim());
  const l = D.customers.filter((c) => !q || norm(c.phone + ' ' + c.area).includes(q));
  return `<div class="tw"><table><thead><tr><th>#</th><th>رقم العميل</th><th>المنطقة</th><th class="n">الطلبات</th><th class="n">المسلّمة</th><th class="n">الراجع</th><th class="n">إجمالي المدفوع</th><th>آخر طلب</th><th></th></tr></thead><tbody>
  ${l.slice(0, 300).map((c, i) => `<tr><td>${rankB(i)}</td><td class="num"><b>${esc(c.phone)}</b></td><td>${esc(c.area)}</td><td class="n"><b>${nn(c.orders)}</b></td><td class="n">${nn(c.delivered)}</td><td class="n">${c.returned ? `<span class="neg">${nn(c.returned)}</span>` : '0'}</td><td class="n">${mm(c.total)}</td><td>${ago(c.lastAt)}</td>
  <td class="act"><div class="row"><button class="btn sm" data-a="stmt" data-t="customer" data-phone="${esc(c.phone)}">كشف / تصدير</button><a class="btn sm w" target="_blank" rel="noopener" href="${wa(c.phone, 'مرحباً، ريو للتوصيل أسرع')}">واتساب</a></div></td></tr>`).join('')}</tbody></table></div>${l.length ? '' : empty('لا يوجد عملاء ضمن الفترة')}`;
}
function customers() {
  const c = D.customers;
  return `<div class="kpis">${kpi('عدد العملاء', nn(c.length), 'y')}${kpi('عملاء متكررون', nn(c.filter((x) => x.orders > 1).length), 'g', 'أكثر من طلب')}${kpi('عملاء لديهم راجع', nn(c.filter((x) => x.returned).length), 'v')}</div>
  <div class="card"><div class="row between" style="margin-bottom:12px"><input class="in" id="q" placeholder="بحث برقم العميل أو المنطقة…" value="${esc(Q)}" style="min-width:240px"><button class="btn sm g" data-a="exp-customers">${ico('xl')} Excel</button></div><div id="list">${customerList()}</div></div>`;
}

/* ---------------- المالية ---------------- */
function finance() {
  if (!FN) return '<div class="card">جارٍ التحميل…</div>';
  const per = FN.periods[FP], inc = income(per), net = inc - per.expenses, cats = Object.entries(per.byCat).sort((a, b) => b[1] - a[1]), mxC = Math.max(1, ...cats.map((x) => x[1]));
  const ex = D.expensesList, mon = FN.monthly;
  const chips = CATS.map((c) => `<button type="button" class="chip" data-a="cat" data-k="${c}">${c}</button>`).join('');
  return `<div class="row between" style="margin-bottom:12px"><div><b>أساس حساب الدخل</b><div class="hint">${basisHint()}</div></div>${basisSeg()}</div>
  ${periodCards()}
  <div class="kpis">${kpi('إجمالي الدخل (كل الأوقات)', mm(income({ fees: FN.all.fees, cards: FN.all.cards })), 'g')}${kpi('إجمالي المصروفات (كل الأوقات)', mm(FN.all.expenses), 'r')}${kpi('صافي (كل الأوقات)', mm(income({ fees: FN.all.fees, cards: FN.all.cards }) - FN.all.expenses), '')}${kpi('أرصدة الكباتن (التزامات)', mm(FN.all.balances), 'b', 'رصيد مدفوع مقدماً')}</div>
  <div class="grid g2"><div class="card"><div class="ch">آخر 12 شهراً</div>${chart(mon.map((x) => mlabel(x.t)), [{ name: 'الدخل', color: '#16a34a', vals: mon.map(income) }, { name: 'المصروفات', color: '#ef4444', vals: mon.map((x) => x.expenses) }], { fmt: mny, ticks: 12, label: 'الدخل والمصروفات الشهرية' })}</div>
  <div class="card"><div class="ch">المصروفات حسب النوع <select class="in" data-c="fp" style="min-height:34px">${[['today', 'اليوم'], ['week', 'هذا الأسبوع'], ['month', 'هذا الشهر'], ['year', 'هذه السنة']].map(([k, l]) => `<option value="${k}" ${FP === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  ${cats.length ? `<div class="catbars">${cats.map(([k, v]) => `<div class="cb"><span>${esc(k)}</span><div class="bar"><i style="width:${pct(v, mxC)}%;background:#ef4444"></i></div><b>${mm(v)}</b></div>`).join('')}</div><div class="net row between" style="margin-top:14px;padding-top:10px;border-top:1px dashed var(--line)"><b>الدخل ${mm(inc)} − المصروفات ${mm(per.expenses)}</b><b class="${net < 0 ? 'neg' : 'pos'}">${mm(net)}</b></div>` : empty('لا مصروفات في هذه الفترة')}</div></div>
  <div class="card"><div class="ch">إضافة مصروف</div><div class="chips" style="margin-bottom:10px">${chips}</div>
  <form class="frm" data-f="expense"><div class="field"><label for="ea">المبلغ (د.ع)</label><input class="in" id="ea" inputmode="numeric" required placeholder="مثال: 50000"></div><div class="field"><label for="ec">النوع</label><input class="in" id="ec" list="cats" required placeholder="اختر أو اكتب"><datalist id="cats">${CATS.map((c) => `<option>${c}</option>`).join('')}</datalist></div>
  <div class="field"><label for="en">ملاحظة</label><input class="in" id="en" placeholder="اختياري"></div><div class="field"><label for="ed">التاريخ</label><input class="in" id="ed" type="date" value="${fd(Date.now())}"></div><div class="field"><button class="btn" style="min-height:40px">${ico('plus')} إضافة</button></div></form></div>
  <div class="card"><div class="ch">سجل المصروفات <small>${RN[R]} · الإجمالي ${mny(D.expenses)}</small><button class="btn sm g" data-a="exp-expenses">${ico('xl')} Excel</button></div>
  ${ex.length ? `<div class="tw"><table><thead><tr><th>التاريخ</th><th>النوع</th><th class="n">المبلغ</th><th>ملاحظة</th><th></th></tr></thead><tbody>${ex.map((e) => `<tr><td>${fd(e.at)}</td><td>${bdg(e.category, 'gray')}</td><td class="n"><b>${mm(e.amount)}</b></td><td>${esc(e.note)}</td><td class="act"><button class="btn sm d" data-a="del-exp" data-id="${e.id}">حذف</button></td></tr>`).join('')}</tbody></table></div>` : empty('لا توجد مصروفات في الفترة المحددة')}</div>`;
}

/* ---------------- السندات ---------------- */
const PT = { merchant: 'متجر', driver: 'مندوب', customer: 'عميل', other: 'جهة أخرى' };
function vouchers() {
  const inn = V.filter((v) => v.kind === 'in'), out = V.filter((v) => v.kind === 'out');
  const sum = (a) => a.reduce((s, v) => s + v.amount, 0);
  return `<div class="kpis">${kpi('سندات القبض', mm(sum(inn)), 'g', nn(inn.length) + ' سند')}${kpi('سندات الصرف', mm(sum(out)), 'r', nn(out.length) + ' سند')}${kpi('الصافي (قبض − صرف)', mm(sum(inn) - sum(out)), '')}</div>
  <div class="card"><div class="ch">سند جديد</div><form data-f="voucher"><div class="row" style="margin-bottom:12px"><div class="seg" role="group" aria-label="نوع السند"><button type="button" class="in-b" data-a="vk" data-k="in" aria-pressed="${VK === 'in'}">سند قبض (استلمنا)</button><button type="button" class="out-b" data-a="vk" data-k="out" aria-pressed="${VK === 'out'}">سند صرف (دفعنا)</button></div></div>
  <div class="frm"><div class="field"><label for="vt">نوع الطرف</label><select class="in" id="vt" data-c="vt">${Object.keys(PT).map((k) => `<option value="${k}">${PT[k]}</option>`).join('')}</select></div>
  <div class="field" id="vparty"><label for="vp">الطرف</label><select class="in" id="vp">${D.merchants.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
  <div class="field"><label for="va">المبلغ (د.ع)</label><input class="in" id="va" inputmode="numeric" required></div><div class="field"><label for="vd">التاريخ</label><input class="in" id="vd" type="date" value="${fd(Date.now())}"></div>
  <div class="field"><label for="vr">رقم مرجع / حوالة</label><input class="in" id="vr" placeholder="اختياري"></div><div class="field" style="grid-column:span 2"><label for="vn">التفاصيل</label><input class="in" id="vn" placeholder="مثال: تسوية حساب الأسبوع"></div>
  <div class="field"><button class="btn" style="min-height:40px">حفظ وإنشاء السند</button></div></div></form></div>
  <div class="card"><div class="ch">السندات <small>${RN[R]}</small><button class="btn sm g" data-a="exp-vouchers">${ico('xl')} Excel</button></div>
  ${V.length ? `<div class="tw"><table><thead><tr><th>الرقم</th><th>النوع</th><th>التاريخ</th><th>الطرف</th><th>التفاصيل</th><th class="n">المبلغ</th><th></th></tr></thead><tbody>${V.map((v) => `<tr><td><b>#${v.no}</b></td><td>${bdg(v.kind === 'in' ? 'قبض' : 'صرف', v.kind === 'in' ? 'green' : 'red')}</td><td>${fd(v.at)}</td><td>${esc(v.partyName)} <span class="hint">(${PT[v.partyType]})</span></td><td>${esc(v.note)}${v.ref ? `<div class="hint">مرجع: ${esc(v.ref)}</div>` : ''}</td><td class="n"><b class="${v.kind === 'in' ? 'pos' : 'neg'}">${mm(v.amount)}</b></td>
  <td class="act"><div class="row">${rOn() ? `<button class="btn sm" data-a="vprint" data-id="${v.id}">وصل / طباعة</button>` : ''}<button class="btn sm d" data-a="vdel" data-id="${v.id}">حذف</button></div></td></tr>`).join('')}</tbody></table></div>` : empty('لا توجد سندات في هذه الفترة')}</div>`;
}
/* ---------------- كروت الشحن ---------------- */
function cards() {
  const free = CARDS.filter((c) => !c.used), used = CARDS.filter((c) => c.used);
  const sum = (a) => a.reduce((t, c) => t + c.amount, 0);
  const grp = (n) => String(n).replace(/(\d{4})(?=\d)/g, '$1 ');
  return `<div class="kpis">${kpi('كل الكروت', nn(CARDS.length), 'y')}${kpi('متاحة', nn(free.length), 'g', mny(sum(free)))}${kpi('مستخدمة', nn(used.length), 'a', mny(sum(used)))}</div>
  <div class="card"><div class="ch">توليد كروت جديدة</div><form data-f="gen-cards"><div class="frm">
  <div class="field"><label for="g-amount">قيمة الكرت</label><select class="in" id="g-amount">${[5000, 10000, 25000, 50000, 100000].map((v) => `<option value="${v}" ${v === 10000 ? 'selected' : ''}>${nf(v)} د.ع</option>`).join('')}</select></div>
  <div class="field"><label for="g-count">العدد (حتى 50)</label><input class="in" id="g-count" type="number" min="1" max="50" value="5" inputmode="numeric"></div>
  <div class="field"><button class="btn" style="min-height:40px">توليد الكروت</button></div></div></form></div>
  ${BATCH ? `<div class="card"><div class="ch">الكروت الجديدة (${BATCH.length}) <button class="btn sm g" data-a="copy" data-t="${esc(BATCH.join('\n'))}">نسخ الكل</button><button class="btn sm g" data-a="batch-x">إخفاء</button></div><div class="num" style="line-height:2.1;direction:ltr;text-align:center">${BATCH.map((n) => esc(grp(n))).join('<br>')}</div></div>` : ''}
  <div class="card"><div class="ch">الكروت <small>${nn(free.length)} متاح من ${nn(CARDS.length)}</small></div>
  ${CARDS.length ? `<div class="tw"><table><thead><tr><th>رقم الكرت</th><th class="n">القيمة</th><th>الحالة</th><th>استخدمه</th><th></th></tr></thead><tbody>${CARDS.map((c) => `<tr><td class="num" style="direction:ltr">${esc(grp(c.number))}</td><td class="n">${mm(c.amount)}</td><td>${c.used ? bdg('مستخدم', 'gray') : bdg('متاح', 'green')}</td><td>${c.used ? `${esc(c.usedBy)}<div class="hint">${fdt(c.usedAt)}</div>` : '—'}</td>
  <td class="act">${c.used ? '' : `<div class="row"><button class="btn sm" data-a="copy" data-t="${esc(c.number)}">نسخ</button><button class="btn sm d" data-a="del-card" data-n="${esc(c.number)}">حذف</button></div>`}</td></tr>`).join('')}</tbody></table></div>` : empty('لا توجد كروت', 'ولّد أول مجموعة كروت من النموذج أعلاه.')}</div>`;
}

/* ---------------- الإعدادات ---------------- */
function settings() {
  if (!SET) return `<div class="card">جارٍ التحميل…</div>`;
  const f = (k, l) => `<div class="field"><label for="s-${k}">${l}</label><input class="in" id="s-${k}" inputmode="numeric" value="${esc(SET[k])}"></div>`;
  return `<form data-f="settings">
  <div class="card"><div class="ch">أسعار التوصيل للزبون <small>بالدينار العراقي</small></div><div class="frm">${f('bikeSame', 'دراجة · نفس المنطقة')}${f('bikeOther', 'دراجة · منطقة ثانية')}${f('carSame', 'سيارة · نفس المنطقة')}${f('carOther', 'سيارة · منطقة ثانية')}</div></div>
  <div class="card"><div class="ch">رسوم التطبيق على السائق <small>تُخصم من محفظة السائق عند قبول كل طلب</small></div><div class="frm">${f('feeSame', 'نفس المنطقة')}${f('feeOther', 'منطقة ثانية')}</div></div>
  <div class="card"><div class="ch">الوصولات <small>تحكم بظهور زر «وصل» في كل مكان</small></div><label class="row" style="gap:10px;align-items:center;cursor:pointer"><input type="checkbox" id="s-receipts" ${SET.receipts !== 0 ? 'checked' : ''} style="width:22px;height:22px"><span><b>تفعيل الوصولات</b><span class="hint" style="display:block">عند الإيقاف يختفي زر «وصل» من حسابات التجار والسائقين ومن لوحة التحكم أيضاً.</span></span></label></div>
  <div class="card"><div class="ch">التنبيهات والدعم</div><div class="frm">${f('lateMin', 'مدة التأخير بالدقائق (لتنبيه الطلبات المتأخرة)')}
  <div class="field"><label for="s-support">رقم الدعم (يظهر للتجار والسائقين)</label><input class="in" id="s-support" inputmode="tel" value="${esc(SET.support || '')}" placeholder="07XX XXX XXXX"></div></div></div>
  <div class="card"><div class="ch">قوالب رسائل الواتساب <small>تتغير هنا وتصل كما تكتبها</small></div>
  <p class="hint" style="margin:0 0 8px">اضغط على متغير لإدخاله في القالب الذي تكتب فيه. تُستبدل المتغيرات بتفاصيل الطلب تلقائياً.</p>
  <div class="chips" style="margin-bottom:12px">${TPL_VARS.map(([v, l]) => `<button type="button" class="chip" data-a="tpl-var" data-v="{${v}}" title="${esc(l)}">{${v}} <small class="muted">${esc(l)}</small></button>`).join('')}</div>
  ${TPL_DEFS.map(([k, l]) => `<div class="field" style="margin-bottom:12px"><label for="t-${k}">${l}</label><textarea class="in" id="t-${k}" rows="4" style="min-height:92px;font-family:inherit">${esc((SET.templates || {})[k] || '')}</textarea><div class="row" style="margin-top:4px"><button type="button" class="btn sm g" data-a="tpl-reset" data-k="${k}">استعادة الافتراضي</button></div></div>`).join('')}</div>
  <div class="err" id="fe" role="alert"></div><button class="btn" style="min-height:44px">حفظ الإعدادات</button></form>`;
}
const TPL_DEFS = [['cust_picking_up', 'رسالة للزبون: قيد الاستلام من التاجر'], ['cust_on_the_way', 'رسالة للزبون: في الطريق للزبون'], ['cust_delivered', 'رسالة للزبون: تم التسليم'], ['cust_rejected', 'رسالة للزبون: مرفوض من زبون'], ['cust_no_answer', 'رسالة للزبون: لا يرد'], ['cust_postponed', 'رسالة للزبون: تأجيل'], ['cust_default', 'رسالة للزبون: عامة (بقية الحالات)'], ['driver_support', 'من السائق إلى الدعم'], ['admin_driver', 'من الإدارة إلى السائق (بخصوص طلب)'], ['admin_merchant', 'من الإدارة إلى التاجر (بخصوص طلب)'], ['account', 'بيانات الحساب الجديد (للتاجر أو السائق)']];
const TPL_VARS = [['order_no', 'رقم الطلب'], ['status', 'الحالة'], ['merchant', 'المتجر'], ['merchant_phone', 'هاتف المتجر'], ['merchant_area', 'عنوان المتجر'], ['customer_phone', 'هاتف الزبون'], ['customer_area', 'منطقة الزبون'], ['product', 'المنتج'], ['qty', 'العدد'], ['product_price', 'سعر المنتج'], ['delivery_price', 'سعر التوصيل'], ['total', 'المبلغ المطلوب'], ['driver', 'المندوب'], ['note', 'الملاحظة'], ['name', 'الاسم'], ['phone', 'الهاتف'], ['password', 'كلمة المرور'], ['login_url', 'رابط الدخول'], ['support', 'رقم الدعم'], ['app', 'اسم التطبيق'], ['date', 'التاريخ']];
let TPLF = '';
document.addEventListener('focusin', (e) => { if (e.target && /^t-/.test(e.target.id || '')) TPLF = e.target.id; });

function voucherDoc80(v) {
  return doc80({ title: v.kind === 'in' ? 'سند قبض' : 'سند صرف', no: v.no, groups: [{ rows: [['التاريخ', fd(v.at)], [v.kind === 'in' ? 'استلمنا من' : 'دفعنا إلى', v.partyName]] }, { boxes: [['المبلغ', mny(v.amount)]] }, { rows: [['كتابةً', tafqeet(v.amount)], ['التفاصيل', v.note || '—']] }] });
}
function curDoc() {
  const m = M;
  if (!m) return null;
  if (m.type === 'receipt') return { title: 'وصل #' + m.o.no, body: orderReceipt(m.o), cls: rcls(), name: `rio-receipt-${m.o.no}.png` };
  if (m.type === 'vprint') return { title: 'سند #' + m.v.no, body: thermal() ? voucherDoc80(m.v) : voucherDoc(m.v), cls: thermal() ? rcls() : 'sz' + RS, name: `rio-voucher-${m.v.no}.png` };
  if (m.type === 'stmt') return { title: 'كشف', body: thermal() ? stmtReceipt(m) : stmtA4(m), cls: thermal() ? rcls() : 'sz' + RS, name: `rio-statement-${fd(Date.now())}.png` };
  if (m.type === 'created') return { title: 'بيانات حساب', body: credDoc(m), cls: rcls(), name: `rio-account-${m.phone}.png` };
  if (m.type === 'pw') { const u = findU(m.id); return u ? { title: 'بيانات حساب', body: credDoc({ role: D.drivers.includes(u) ? 'driver' : 'merchant', name: u.name, phone: u.phone, password: m.done, vehicle: u.vehicle, area: u.area }), cls: rcls(), name: `rio-account-${u.phone}.png` } : null; }
  return null;
}
function voucherDoc(v) {
  const k = v.kind === 'in' ? 'سند قبض' : 'سند صرف';
  return docA4({
    title: k, sub: 'رقم ' + v.no,
    meta: [['رقم السند', '#' + v.no], ['التاريخ', fd(v.at)], [v.kind === 'in' ? 'استلمنا من' : 'دفعنا إلى', v.partyName], ['صفة الطرف', PT[v.partyType]], ...(v.ref ? [['المرجع', v.ref]] : [])],
    sections: []
  }) .replace('<div class="ft">', `<div class="big">${nf(v.amount)} د.ع</div><div class="words">المبلغ كتابةً: ${esc(tafqeet(v.amount))}</div><div class="words" style="background:#fff">التفاصيل: ${esc(v.note || '—')}</div><div class="sig"><div>${v.kind === 'in' ? 'المسلِّم' : 'المستلم'}</div><div>المحاسب</div></div><div class="ft">`);
}

/* ---------------- كشف الحساب ---------------- */
async function fetchStmt(q) {
  const [a, b] = range();
  return api('GET', `/api/admin/statement?type=${q.type}&from=${a}&to=${b}` + (q.id ? `&id=${q.id}` : '') + (q.phone ? `&phone=${encodeURIComponent(q.phone)}` : ''));
}
const TXK = { fee: 'رسوم تطبيق', charge: 'شحن كرت', refund: 'استرجاع رسوم', admin: 'تعديل من الإدارة' };
function sumRows(st) {
  const s = st.summary, t = st.type;
  if (t === 'merchant') return [['عدد الطلبات', nf(s.orders)], ['المسلّمة', nf(s.delivered)], ['الراجعة', nf(s.returned)], ['قيمة الراجع', mny(s.returnedValue)], ['الملغاة', nf(s.cancelled)], ['الجارية', nf(s.open)],
    ['قيمة البضائع المسلّمة', mny(s.goods)], ['أجور التوصيل', mny(s.delivery)], ['المحصّل من الزبائن', mny(s.total)], ['سندات صرف (دُفع له)', mny(s.paid)], ['سندات قبض (استلمنا منه)', mny(s.received)]];
  if (t === 'driver') return [['عدد الطلبات', nf(s.orders)], ['المنجزة', nf(s.delivered)], ['الراجعة', nf(s.returned)], ['الجارية', nf(s.active)], ['المتأخرة', nf(s.late)], ['مشاكل / لا يرد', nf(s.problems)],
    ['المحصّل من الزبائن', mny(s.collected)], ['أجور التوصيل المنجزة', mny(s.delivery)], ['رسوم التطبيق المخصومة', mny(s.fees)], ['صافي ربح المندوب', mny(s.earned)], ['رصيد المحفظة الحالي', mny(s.balance), 1]];
  return [['عدد الطلبات', nf(s.orders)], ['المسلّمة', nf(s.delivered)], ['الراجعة', nf(s.returned)], ['قيمة البضائع', mny(s.goods)], ['أجور التوصيل', mny(s.delivery)], ['إجمالي المدفوع', mny(s.total), 1]];
}
const SCOPES = { all: ['كل الطلبات', () => true], delivered: ['المسلّمة', (o) => DONE.includes(o.status)], returned: ['المرتجعات', (o) => RET.includes(o.status)] };
const stTitle = (st) => ({ merchant: 'كشف حساب متجر', driver: 'كشف حساب مندوب', customer: 'كشف عميل' })[st.type];
const stName = (st) => (st.type === 'customer' ? st.party.phone : st.party.name);
const scoped = (m) => m.st.orders.filter(SCOPES[m.scope][1]);
function stmtBody(m) {
  const st = m.st, l = scoped(m), isM = st.type === 'merchant', isD = st.type === 'driver';
  const rows = sumRows(st);
  const tot = l.filter((o) => DONE.includes(o.status));
  return `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${rows.map(([a, b, hi]) => kpi(a, `<span class="num">${esc(b)}</span>`, hi ? 'y' : '')).join('')}</div>
  <div class="row between" style="margin:6px 0 10px"><div class="chips">${Object.keys(SCOPES).map((k) => `<button class="chip" data-a="scope" data-k="${k}" aria-pressed="${m.scope === k}">${SCOPES[k][0]}${k === 'returned' ? ` (${st.summary.returned})` : ''}</button>`).join('')}</div>
  ${sizeSeg()}<div class="row"><button class="btn sm" data-a="print-doc">${ico('print')} طباعة / PDF</button><button class="btn sm g" data-a="save-doc">${ico('dl')} حفظ صورة</button><button class="btn sm g" data-a="s-xlsx">${ico('xl')} Excel</button>${st.party.phone ? `<a class="btn sm w" target="_blank" rel="noopener" href="${wa(st.party.phone, stmtText(st))}">إرسال الملخص واتساب</a>` : ''}</div></div>
  <div class="tw" style="max-height:44vh"><table><thead><tr><th>الطلب</th><th>التاريخ</th>${isM ? '' : '<th>المتجر</th>'}<th>المنطقة / المنتج</th><th class="n">البضاعة</th><th class="n">التوصيل</th><th class="n">الإجمالي</th>${isD ? '' : '<th>المندوب</th>'}<th>الحالة</th></tr></thead><tbody>
  ${l.map((o) => `<tr><td><b>#${o.no}</b></td><td>${fdt(o.createdAt)}</td>${isM ? '' : `<td>${esc(o.merchantName)}</td>`}<td>${esc(o.customerArea)}<div class="hint">${esc(o.product)} × ${o.qty}</div></td><td class="n">${nn(o.productPrice)}</td><td class="n">${nn(o.deliveryPrice)}</td><td class="n">${nn(o.total)}</td>${isD ? '' : `<td>${esc(o.driverName || '—')}</td>`}<td>${stB(o.status)}</td></tr>`).join('')}</tbody>
  ${l.length ? `<tfoot><tr><td colspan="${isM ? 3 : 4}">${nn(l.length)} طلب</td><td class="n">${nn(tot.reduce((a, o) => a + o.productPrice, 0))}</td><td class="n">${nn(tot.reduce((a, o) => a + o.deliveryPrice, 0))}</td><td class="n">${nn(tot.reduce((a, o) => a + o.total, 0))}</td><td colspan="2"></td></tr></tfoot>` : ''}</table></div>${l.length ? '' : empty('لا توجد طلبات')}
  ${isM && st.vouchers.length ? `<h4 style="margin:16px 0 8px">السندات</h4><div class="tw" style="max-height:25vh"><table><thead><tr><th>الرقم</th><th>النوع</th><th>التاريخ</th><th>التفاصيل</th><th class="n">المبلغ</th></tr></thead><tbody>${st.vouchers.map((v) => `<tr><td>#${v.no}</td><td>${bdg(v.kind === 'in' ? 'قبض' : 'صرف', v.kind === 'in' ? 'green' : 'red')}</td><td>${fd(v.at)}</td><td>${esc(v.note)}</td><td class="n">${mm(v.amount)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${isD && st.txs.length ? `<h4 style="margin:16px 0 8px">حركة المحفظة (الخصم الفعلي والشحن)</h4><div class="tw" style="max-height:25vh"><table><thead><tr><th>التاريخ</th><th>العملية</th><th>الطلب</th><th class="n">المبلغ</th></tr></thead><tbody>${st.txs.map((t) => `<tr><td>${fdt(t.at)}</td><td>${esc(t.label || TXK[t.kind] || t.kind)}</td><td>${t.orderNo ? '#' + t.orderNo : '—'}</td><td class="n"><b class="${t.amount < 0 ? 'neg' : 'pos'}">${t.amount < 0 ? '−' : '+'}${mm(Math.abs(t.amount))}</b></td></tr>`).join('')}</tbody></table></div>` : ''}`;
}
function stmtText(st) {
  const s = st.summary;
  if (st.type === 'merchant') return `${stTitle(st)} — ${st.party.name}\nالفترة: ${rangeLabel()}\nالطلبات: ${s.orders} · المسلّمة: ${s.delivered} · الراجعة: ${s.returned}\nقيمة البضائع المسلّمة: ${mny(s.goods)}\nأجور التوصيل: ${mny(s.delivery)}\nالمدفوع لكم: ${mny(s.paid)}\nريو للتوصيل أسرع`;
  if (st.type === 'driver') return `${stTitle(st)} — ${st.party.name}\nالفترة: ${rangeLabel()}\nالمنجزة: ${s.delivered} · الراجعة: ${s.returned}\nرسوم التطبيق المخصومة: ${mny(s.fees)}\nرصيد محفظتك: ${mny(s.balance)}\nريو للتوصيل أسرع`;
  return `طلباتك لدى ريو للتوصيل أسرع: ${s.orders}\nريو للتوصيل أسرع`;
}
function stmtA4(m) {
  const st = m.st, l = scoped(m), isM = st.type === 'merchant';
  const tot = l.filter((o) => DONE.includes(o.status));
  const sections = [{ title: 'ملخص الحساب', head: ['البند', '#القيمة'], rows: sumRows(st).map(([a, b]) => [a, b]) }];
  sections.push({ title: SCOPES[m.scope][0] + ' — التفاصيل', head: ordPdfHead, rows: l.map(ordPdfRow), foot: ['', '', '', '', '', 'المسلّم', nf(tot.reduce((a, o) => a + o.productPrice, 0)), nf(tot.reduce((a, o) => a + o.deliveryPrice, 0)), nf(tot.reduce((a, o) => a + o.total, 0)), ''] });
  if (isM && st.vouchers.length) sections.push({ title: 'السندات', head: ['الرقم', 'النوع', 'التاريخ', 'التفاصيل', '#المبلغ'], rows: st.vouchers.map((v) => ['#' + v.no, v.kind === 'in' ? 'قبض' : 'صرف', fd(v.at), v.note, nf(v.amount)]) });
  if (st.type === 'driver' && st.txs.length) sections.push({ title: 'حركة المحفظة', head: ['التاريخ', 'العملية', 'الطلب', '#المبلغ'], rows: st.txs.map((t) => [fdt(t.at), t.label || TXK[t.kind] || t.kind, t.orderNo ? '#' + t.orderNo : '—', nf(t.amount)]) });
  const hi = sumRows(st).filter((r) => r[2]).map((r) => [r[0], r[1], true]);
  return docA4({ title: stTitle(st) + ' — ' + stName(st), sub: rangeLabel(), meta: [['الاسم', stName(st)], ['الهاتف', st.party.phone || '—'], ...(st.party.area ? [['المنطقة', st.party.area]] : []), ['الفترة', rangeLabel()], ['النطاق', SCOPES[m.scope][0]]], kpis: hi, sections });
}
function stmtReceipt(m) {
  const st = m.st, s = st.summary;
  const groups = [{ rows: [['الاسم', stName(st)], ['الهاتف', st.party.phone || '—'], ['الفترة', rangeLabel()]] }];
  const all = sumRows(st);
  groups.push({ rows: all.filter((r) => !r[2]).map(([a, b]) => [a, b]) });
  groups.push({ boxes: all.filter((r) => r[2]).map(([a, b]) => [a, b]) });
  void s;
  return doc80({ title: stTitle(st), groups, foot: 'صدر ' + fdt(Date.now()) });
}
function stmtXlsx(m) {
  const st = m.st, sheets = [{ name: 'الملخص', rows: [[stTitle(st), stName(st)], ['الفترة', rangeLabel()], [], ['البند', 'القيمة'], ...sumRows(st).map(([a, b]) => [a, b])] }];
  sheets.push({ name: SCOPES[m.scope][0], rows: [ORD_HEAD, ...scoped(m).map(ordRow)] });
  if (m.scope !== 'returned') sheets.push({ name: 'المرتجعات', rows: [ORD_HEAD, ...st.orders.filter(SCOPES.returned[1]).map(ordRow)] });
  if (st.vouchers.length) sheets.push({ name: 'السندات', rows: [['الرقم', 'النوع', 'التاريخ', 'الطرف', 'المبلغ', 'التفاصيل'], ...st.vouchers.map((v) => [v.no, v.kind === 'in' ? 'قبض' : 'صرف', fd(v.at), v.partyName, v.amount, v.note])] });
  if (st.txs.length) sheets.push({ name: 'حركة المحفظة', rows: [['التاريخ', 'العملية', 'الطلب', 'المبلغ'], ...st.txs.map((t) => [fdt(t.at), t.label || TXK[t.kind] || t.kind, t.orderNo || '', t.amount])] });
  return exportXlsx(`ريو-${stTitle(st)}-${stName(st)}-${fd(Date.now())}`, sheets);
}

/* ---------------- النوافذ ---------------- */
const field = (id, l, inner, h) => `<div class="field"><label for="${id}">${l}</label>${inner}${h ? `<span class="hint">${h}</span>` : ''}</div>`;
const findU = (id) => [...D.merchants, ...D.drivers].find((u) => u.id === id);
function modalHtml() {
  const m = M;
  if (m.type === 'stmt') return [`${stTitle(m.st)}: ${esc(stName(m.st))}`, stmtBody(m), 1];
  if (m.type === 'receipt') {
    const o = m.o;
    return [`وصل طلب #${o.no}`, `${sizeSeg()}<iframe title="معاينة الوصل" srcdoc="${esc(docPage('وصل', orderReceipt(o), rcls()))}" style="width:100%;height:60vh;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe>
    <div class="row" style="margin-top:12px;justify-content:center">${docBtns()}<a class="btn w" target="_blank" rel="noopener" href="${wa(o.customerPhone, custMsg(o))}">واتساب الزبون</a></div>`];
  }
  if (m.type === 'vprint') return [`${m.v.kind === 'in' ? 'سند قبض' : 'سند صرف'} #${m.v.no}`, `${sizeSeg()}<iframe title="معاينة السند" srcdoc="${esc(docPage('سند', thermal() ? voucherDoc80(m.v) : voucherDoc(m.v), thermal() ? rcls() : 'sz' + RS))}" style="width:100%;height:62vh;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe>
    <div class="row" style="margin-top:12px;justify-content:center">${docBtns()}${vPhone(m.v) ? `<a class="btn w" target="_blank" rel="noopener" href="${wa(vPhone(m.v), `${m.v.kind === 'in' ? 'سند قبض' : 'سند صرف'} رقم #${m.v.no}\nالمبلغ: ${mny(m.v.amount)}\nالتاريخ: ${fd(m.v.at)}\nالتفاصيل: ${m.v.note || '—'}\nريو للتوصيل أسرع`)}">واتساب</a>` : ''}</div>`, 1];
  if (m.type === 'add-user') {
    const d = m.role === 'driver';
    return [d ? 'إضافة مندوب' : 'إضافة متجر', `<form data-f="add-user">${field('u-name', d ? 'اسم المندوب' : 'اسم المتجر', '<input class="in" id="u-name" required>')}${field('u-phone', 'رقم الهاتف', '<input class="in" id="u-phone" inputmode="tel" placeholder="07XXXXXXXXX" required>')}
    ${field('u-pass', 'كلمة المرور', `<div class="row"><input class="in grow" id="u-pass" minlength="6" required><button type="button" class="btn g" data-a="gen" data-t="u-pass">توليد</button></div>`, '6 أحرف أو أكثر')}
    ${d ? field('u-veh', 'نوع المركبة', '<select class="in" id="u-veh"><option value="bike">دراجة</option><option value="car">سيارة</option></select>', 'طلبات الدراجة تصل لسائقي الدراجات فقط، وطلبات السيارة لسائقي السيارات فقط') : field('u-area', 'منطقة المتجر', '<input class="in" id="u-area" required>', 'تحدد سعر التوصيل (نفس المنطقة / منطقة ثانية)') + field('u-map', 'رابط موقع المتجر على الخرائط', '<input class="in" id="u-map" inputmode="url" dir="ltr" placeholder="https://maps.google.com/…">', 'يظهر للسائق بعد قبول الطلب ليفتحه في ويز أو أي تطبيق خرائط (اختياري)')}
    <div class="err" id="fe" role="alert"></div><button class="btn" style="width:100%">إنشاء الحساب</button></form>`];
  }
  if (m.type === 'created') {
    const d = m.role === 'driver';
    return [d ? 'تم تسجيل السائق' : 'تم تسجيل التاجر', `<div class="card" style="background:var(--ac-soft);box-shadow:none"><div class="r2"><b>الاسم</b><span>${esc(m.name)}</span></div><div class="r2"><b>رقم الهاتف</b><span class="num">${esc(m.phone)}</span></div>
      <div class="r2"><b>كلمة المرور</b><span class="num" style="font-weight:800;letter-spacing:.05em">${esc(m.password)}</span></div><div class="r2"><b>${d ? 'المركبة' : 'المنطقة'}</b><span>${esc(d ? (m.vehicle === 'car' ? 'سيارة' : 'دراجة') : m.area)}</span></div><div class="r2"><b>رابط الدخول</b><span class="num" style="direction:ltr">${esc(loginUrl())}</span></div></div>
      ${sizeSeg()}<div class="row" style="justify-content:center;margin-top:14px"><a class="btn w" target="_blank" rel="noopener" href="${wa(m.phone, credText(m))}">إرسال بالواتساب</a>${docBtns()}<button class="btn g" data-a="copy" data-t="${esc(credText(m))}">نسخ</button></div>`];
  }
  if (m.type === 'chat') {
    return [`محادثة طلب #${m.o.no}`, `<div class="chatbox" id="chat-box">${chatBoxHtml(m.msgs)}</div><form data-f="chat" class="row"><input class="in grow" id="chat-in" maxlength="500" placeholder="اكتب رسالة للسائق أو التاجر…" autocomplete="off"><button class="btn">إرسال</button></form><div class="err" id="fe" role="alert"></div>`];
  }
  if (m.type === 'staff') {
    const u = m.id ? STAFF.find((x) => x.id === m.id) : null;
    const pm = (u && u.perms) || {};
    return [u ? `تعديل ${esc(u.name)}` : 'إضافة موظف', `<form data-f="staff">
      ${field('st-name', 'الاسم', `<input class="in" id="st-name" value="${esc(u ? u.name : '')}" required>`)}
      ${field('st-user', 'اسم المستخدم (للدخول)', `<input class="in mono" id="st-user" dir="ltr" value="${esc(u ? u.username : '')}" ${u ? 'disabled' : ''} autocapitalize="none" placeholder="مثال: ali.support" required>`, u ? 'لا يمكن تغيير اسم المستخدم' : 'حروف إنكليزية وأرقام فقط')}
      ${field('st-pass', u ? 'كلمة مرور جديدة (اتركها فارغة بدون تغيير)' : 'كلمة المرور', `<input class="in" id="st-pass" autocomplete="off" minlength="6" ${u ? '' : 'required'}>`, '6 أحرف أو أكثر')}
      <div class="field"><label>الصلاحيات</label><div class="card" style="padding:6px 12px">${PAGES_BASE.map(([k, l]) => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>${l}</span><select class="in" id="pm-${k}" style="min-height:38px;max-width:160px">${PERM_LV.map(([v, t]) => `<option value="${v}" ${pm[k] === v || (!pm[k] && !v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`).join('')}</div><span class="hint">«عرض فقط» يرى الصفحة دون تعديل. صفحة «فريق الإدارة» للمدير فقط ولا يمكن منحها.</span></div>
      <div class="err" id="fe" role="alert"></div><button class="btn" style="width:100%">${u ? 'حفظ' : 'إنشاء الحساب'}</button></form>`];
  }
  if (m.type === 'mloc') {
    const u = findU(m.id);
    return [`عنوان وموقع ${esc(u.name)}`, `<form data-f="mloc">${field('l-area', 'منطقة المتجر', `<input class="in" id="l-area" value="${esc(u.area)}" required>`, 'تحدد سعر التوصيل (نفس المنطقة / منطقة ثانية)')}
    ${field('l-map', 'رابط موقع المتجر على الخرائط', `<input class="in" id="l-map" inputmode="url" dir="ltr" value="${esc(u.mapUrl || '')}" placeholder="https://maps.google.com/…">`, 'الصق رابط خرائط جوجل أو ويز أو إحداثيات. يظهر للسائق بعد قبول الطلب. اتركه فارغاً لحذفه.')}
    <div class="err" id="fe" role="alert"></div><button class="btn" style="width:100%">حفظ</button></form>`];
  }
  if (m.type === 'assign') {
    const o = m.o, car = o.vehicle === 'car';
    const ds = D.drivers.filter((x) => x.id !== o.driverId).sort((a, b) => ((b.vehicle === 'car') === car) - ((a.vehicle === 'car') === car));
    return [`${o.driverId ? 'تحويل' : 'تعيين'} الطلب #${o.no} لسائق`, `<form data-f="assign"><p class="muted">طلب ${car ? 'سيارة' : 'دراجة'} — ${esc(o.merchantName)} → ${esc(o.customerArea)}${o.driverId ? `<br>السائق الحالي: <b>${esc(o.driverName)}</b>. سيختفي الطلب منه وتُرجَع له رسوم التطبيق${o.fee ? ` (${mny(o.fee)})` : ''} كاملة.` : ''}</p>
    ${ds.length ? field('as-d', 'السائق', `<select class="in" id="as-d">${ds.map((x) => `<option value="${x.id}" ${x.active ? '' : 'disabled'}>${esc(x.name)} — ${x.vehicle === 'car' ? 'سيارة' : 'دراجة'} — رصيد ${nf(x.balance)} د.ع${x.active ? '' : ' (موقوف)'}</option>`).join('')}</select>`) : `<div class="notice">لا يوجد سائقون آخرون.</div>`}
    <label class="row" style="gap:10px;align-items:center;margin:10px 0 14px;cursor:pointer"><input type="checkbox" id="as-c" checked style="width:20px;height:20px"><span>خصم رسوم التطبيق من السائق الجديد <small class="muted">(ألغِ التحديد لتعيينه بدون خصم)</small></span></label>
    <div class="err" id="fe" role="alert"></div><button class="btn" style="width:100%" ${ds.length ? '' : 'disabled'}>${o.driverId ? 'تحويل الطلب' : 'تعيين الطلب'}</button></form>`];
  }
  if (m.type === 'assigned') {
    const d = m.d;
    return ['تم تعيين الطلب', `<div class="card" style="background:var(--ac-soft);box-shadow:none"><p style="margin:0">الطلب <b>#${m.o.no}</b> أصبح عند <b>${esc(d.name)}</b> بحالة «${esc(ST[m.o.status])}».</p></div>
    <div class="row" style="justify-content:center;margin-top:14px"><a class="btn w" target="_blank" rel="noopener" href="${wa(d.phone, drvMsg(m.o, d))}">إبلاغ السائق بالواتساب</a><button class="btn g" data-a="close">إغلاق</button></div>`];
  }
  if (m.type === 'pw') {
    const u = findU(m.id);
    if (m.done) return [`تم تعيين كلمة السر`, `<div class="card" style="background:var(--ac-soft);box-shadow:none"><p style="margin:0 0 6px">${esc(u.name)} — <span class="num">${esc(u.phone)}</span></p><div class="big" style="font-size:28px;font-weight:800;direction:ltr;text-align:center;letter-spacing:.06em">${esc(m.done)}</div></div>${sizeSeg()}
      <div class="row" style="justify-content:center"><button class="btn g" data-a="copy" data-t="${esc(m.done)}">نسخ</button>${docBtns()}<a class="btn w" target="_blank" rel="noopener" href="${wa(u.phone, `مرحباً ${u.name}\nبيانات الدخول إلى ريو للتوصيل أسرع:\nرقم الهاتف: ${u.phone}\nكلمة المرور: ${m.done}\nيُفضّل تغييرها بعد أول دخول.`)}">إرسال بالواتساب</a></div>`];
    return [`كلمة سر جديدة — ${esc(u.name)}`, `<form data-f="pw">${field('w-p', 'كلمة المرور الجديدة', '<div class="row"><input class="in grow" id="w-p" minlength="6" required autocomplete="off"><button type="button" class="btn g" data-a="gen" data-t="w-p">توليد</button></div>', '6 أحرف أو أكثر. تُسجَّل خروج الجلسات القديمة عند أول انتهاء.')}<div class="err" id="fe" role="alert"></div><button class="btn" style="width:100%">تعيين</button></form>`];
  }
  if (m.type === 'adjust') {
    const u = findU(m.id);
    return [`رصيد ${esc(u.name)}`, `<form data-f="adjust"><div class="card" style="box-shadow:none;background:#f8fafc"><small class="muted">الرصيد الحالي</small><div style="font-size:26px;font-weight:800">${mm(u.balance)}</div></div>
    ${field('a-amt', 'المبلغ (موجب للشحن، سالب للخصم)', '<input class="in" id="a-amt" inputmode="numeric" placeholder="مثال: 10000 أو -5000" required>')}${field('a-lbl', 'السبب', '<input class="in" id="a-lbl" maxlength="80" placeholder="شحن نقدي">')}<div class="err" id="fe" role="alert"></div><button class="btn" style="width:100%">تنفيذ</button></form>`];
  }
  return ['', ''];
}
const vPhone = (v) => { const u = v.partyId && findU(v.partyId); return u ? u.phone : ''; };
function orderReceipt(o) {
  const rows = (a) => ({ rows: a });
  return doc80({
    title: 'وصل توصيل', no: o.no, groups: [rows([['التاريخ', fdt(o.createdAt)], ['الحالة', ST[o.status] || o.status], ['التاجر', o.merchantName]]), rows([['رقم الزبون', o.customerPhone], ['المنطقة', o.customerArea]]), rows([['البضاعة', o.product], ['عدد القطع', String(o.qty)]]),
      { boxes: [['المبلغ المطلوب', mny(o.total)]] }, rows([['أجرة التوصيل', mny(o.deliveryPrice)], ['الصافي للتاجر', mny(o.productPrice)]]), rows([['المندوب', o.driverName || '—']])]
  });
}
const loginUrl = () => { try { return new URL('./', location.href).href; } catch { return location.origin + '/'; } };
const credText = (c) => (tpl('account') ? fillTpl(tpl('account'), { name: c.name, phone: c.phone, password: c.password, login_url: loginUrl(), app: APP }) : `مرحباً ${c.name}
رقم الهاتف: ${c.phone}
كلمة المرور: ${c.password}
رابط الدخول: ${loginUrl()}`);
function credDoc(c) {
  const d = c.role === 'driver';
  return doc80({ title: d ? 'بيانات حساب سائق' : 'بيانات حساب تاجر', groups: [
    { rows: [['الاسم', c.name], ['رقم الهاتف', c.phone], ['كلمة المرور', c.password], d ? ['المركبة', c.vehicle === 'car' ? 'سيارة' : 'دراجة'] : ['المنطقة', c.area || '—']] },
    { rows: [['رابط الدخول', loginUrl()], ['تاريخ التسجيل', fdt(Date.now())]] }
  ], foot: 'يُفضّل تغيير كلمة المرور بعد أول دخول' });
}
/* محادثة الطلب (المدير ↔ السائق/التاجر) */
const chatBoxHtml = (msgs) => (msgs.length ? msgs.map((x) => `<div class="cmsg ${x.role === 'admin' ? 'me' : ''}"><small>${esc(x.name)} · ${fdt(x.at)}</small>${esc(x.text)}</div>`).join('') : '<p class="muted" style="text-align:center;margin:auto">لا توجد رسائل بعد.</p>');
let chatT = null;
async function loadChat() {
  if (!M || M.type !== 'chat') return;
  try {
    const r = await api('GET', `/api/orders/${M.o.id}/messages`);
    if (!M || M.type !== 'chat') return;
    if (M.loaded && JSON.stringify(r.messages) === JSON.stringify(M.msgs)) return;
    M.msgs = r.messages; M.loaded = true;
    const b = $('#chat-box'); if (b) { b.innerHTML = chatBoxHtml(M.msgs); b.scrollTop = b.scrollHeight; }
  } catch { /* ignore */ }
}
const startChat = () => { stopChat(); loadChat(); chatT = setInterval(loadChat, 5000); };
const stopChat = () => { if (chatT) { clearInterval(chatT); chatT = null; } };
function drawModal() {
  const r = $('#modal-root');
  if (!M) { r.innerHTML = ''; document.body.style.overflow = ''; return; }
  const sc = r.querySelector('.modal') ? r.querySelector('.modal').scrollTop : 0;
  const [t, b, wide] = modalHtml();
  r.innerHTML = `<div class="scrim" data-a="close-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(t)}"><div class="mh"><h3>${t}</h3><button class="x" data-a="close" aria-label="إغلاق">×</button></div><div class="mb">${b}</div></div></div>`;
  document.body.style.overflow = 'hidden';
  const md = r.querySelector('.modal'); if (md) md.scrollTop = sc;
  const f = r.querySelector('input:not([type=hidden])'); if (f && !f.value && !M.focused) { f.focus(); M.focused = 1; }
}
const closeModal = () => { stopChat(); M = null; drawModal(); if (DIRTY) load(true); };
const rnd = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const a = new Uint32Array(8); crypto.getRandomValues(a); a.forEach((x) => { s += c[x % c.length]; }); return s; };

/* ---------------- تصدير القوائم ---------------- */
const stamp = () => fd(Date.now());
function listExports(kind) {
  if (kind === 'orders') { const l = filteredOrders(); return { name: 'الطلبات', head: ORD_HEAD, rows: l.map(ordRow), pdf: { head: ordPdfHead, rows: l.map(ordPdfRow) } }; }
  if (kind === 'merchants') {
    const h = ['المتجر', 'الهاتف', 'المنطقة', 'الطلبات', 'المسلّمة', 'الراجع', 'قيمة الراجع', 'قيمة البضائع', 'أجور التوصيل'];
    const r = [...D.merchants].sort(SORTS[SORT][1]).map((m) => [m.name, m.phone, m.area, m.orders, m.delivered, m.returned, m.returnedValue, m.goods, m.delivery]);
    return { name: 'المتاجر', head: h, rows: r, pdf: { head: ['المتجر', '#الطلبات', '#المسلّمة', '#الراجع', '#البضائع', '#التوصيل'], rows: r.map((x) => [x[0], x[3], x[4], x[5], nf(x[7]), nf(x[8])]) } };
  }
  if (kind === 'drivers') {
    const h = ['المندوب', 'الهاتف', 'المنجز', 'الجاري', 'المتأخر', 'الراجع', 'مشاكل', 'الرصيد', 'المحصّل', 'رسوم مخصومة', 'صافي الربح'];
    const r = [...D.drivers].sort((a, b) => b.delivered - a.delivered).map((m) => [m.name, m.phone, m.delivered, m.live, m.late, m.returned, m.problems, m.balance, m.collected, m.fees, m.earned]);
    return { name: 'المندوبون', head: h, rows: r, pdf: { head: ['المندوب', '#المنجز', '#الجاري', '#المتأخر', '#الراجع', '#الرصيد', '#الرسوم'], rows: r.map((x) => [x[0], x[2], x[3], x[4], x[5], nf(x[7]), nf(x[9])]) } };
  }
  if (kind === 'customers') return { name: 'العملاء', head: ['الهاتف', 'المنطقة', 'الطلبات', 'المسلّمة', 'الراجع', 'إجمالي المدفوع'], rows: D.customers.map((c) => [c.phone, c.area, c.orders, c.delivered, c.returned, c.total]) };
  if (kind === 'expenses') return { name: 'المصروفات', head: ['التاريخ', 'النوع', 'المبلغ', 'ملاحظة'], rows: D.expensesList.map((e) => [fd(e.at), e.category, e.amount, e.note]) };
  if (kind === 'vouchers') return { name: 'السندات', head: ['الرقم', 'النوع', 'التاريخ', 'الطرف', 'صفة الطرف', 'المبلغ', 'التفاصيل', 'المرجع'], rows: V.map((v) => [v.no, v.kind === 'in' ? 'قبض' : 'صرف', fd(v.at), v.partyName, PT[v.partyType], v.amount, v.note, v.ref]) };
}
const doExcel = (kind) => { const e = listExports(kind); return exportXlsx(`ريو-${e.name}-${stamp()}`, [{ name: e.name, rows: [e.head, ...e.rows] }]); };
const doPdf = (kind) => { const e = listExports(kind); printDoc(e.name, docA4({ title: e.name, sub: rangeLabel(), sections: [{ head: e.pdf.head, rows: e.pdf.rows }] })); };

/* ---------------- الأحداث ---------------- */
const clickActs = {
  menu() { MENU = !MENU; draw(); },
  'menu-x'() { MENU = false; draw(); },
  page(el) { MENU = false; P = el.dataset.k; ls.set('rio_page', P); Q = ''; FS = 'all'; FM = 0; load(); },
  logout() { logout(); },
  'batch-x'() { BATCH = null; draw(); },
  async 'del-card'(el) { if (confirm('حذف هذا الكرت؟') && await act(() => api('DELETE', '/api/admin/cards/' + el.dataset.n), 'تم الحذف')) load(); },
  reload() { load(); },
  basis(el) { BASIS = el.dataset.k; ls.set('rio_basis', BASIS); draw(); },
  sort(el) { SORT = el.dataset.k; ls.set('rio_sort', SORT); draw(); },
  fs(el) { FS = el.dataset.k; draw(); },
  vk(el) { VK = el.dataset.k; draw(); },
  cat(el) { const i = $('#ec'); if (i) { i.value = el.dataset.k; i.focus(); } },
  scope(el) { M.scope = el.dataset.k; drawModal(); },
  close() { closeModal(); },
  'close-bg'(el, e) { if (e.target === el) closeModal(); },
  'add-user'(el) { M = { type: 'add-user', role: el.dataset.r }; drawModal(); },
  'tpl-var'(el) { const t = document.getElementById(TPLF); if (!t) { toast('اختر قالباً أولاً بالضغط داخله', true); return; } const a = t.selectionStart || 0, b = t.selectionEnd || 0; t.value = t.value.slice(0, a) + el.dataset.v + t.value.slice(b); t.focus(); t.setSelectionRange(a + el.dataset.v.length, a + el.dataset.v.length); },
  async 'tpl-reset'(el) { if (await act(() => api('PUT', '/api/admin/settings', { templates: { [el.dataset.k]: '' } }), 'تمت استعادة القالب الافتراضي')) load(); },
  'staff-add'() { M = { type: 'staff' }; drawModal(); },
  'staff-edit'(el) { M = { type: 'staff', id: Number(el.dataset.id) }; drawModal(); },
  async 'staff-toggle'(el) {
    const u = STAFF.find((x) => x.id === Number(el.dataset.id)); if (!u) return;
    const prev = u.active; u.active = !prev; draw();
    try { await api('PUT', '/api/admin/staff/' + u.id, { active: !prev }); toast(prev ? 'تم إيقاف الموظف' : 'تم تفعيل الموظف'); load(); } catch (e) { u.active = prev; draw(); toast(e.message, true); }
  },
  async 'staff-del'(el) { const u = STAFF.find((x) => x.id === Number(el.dataset.id)); if (u && confirm('حذف حساب ' + u.name + ' نهائياً؟') && await act(() => api('DELETE', '/api/admin/staff/' + u.id), 'تم الحذف')) load(); },
  mloc(el) { M = { type: 'mloc', id: Number(el.dataset.id) }; drawModal(); },
  assign(el) { const o = O.find((x) => x.id === Number(el.dataset.id)); if (o) { M = { type: 'assign', o }; drawModal(); } },
  pw(el) { M = { type: 'pw', id: Number(el.dataset.id) }; drawModal(); },
  adjust(el) { M = { type: 'adjust', id: Number(el.dataset.id) }; drawModal(); },
  gen(el) { document.getElementById(el.dataset.t).value = rnd(); },
  async copy(el) { try { await navigator.clipboard.writeText(el.dataset.t); toast('تم النسخ'); } catch { toast('تعذّر النسخ', true); } },
  receipt(el) { const o = O.find((x) => x.id === Number(el.dataset.id)); if (o) { M = { type: 'receipt', o }; drawModal(); } },
  chat(el) { const o = O.find((x) => x.id === Number(el.dataset.id)); if (o) { M = { type: 'chat', o, msgs: [], loaded: false }; drawModal(); startChat(); } },
  'print-doc'() { const d = curDoc(); if (d) printDoc(d.title, d.body, d.cls); },
  async 'save-doc'() { const d = curDoc(); if (d) await act(() => saveDocImage(d.title, d.body, d.cls, d.name), 'تم حفظ الصورة'); },
  rsize(el) { RS = el.dataset.k; ls.set('rio_rsize', RS); drawModal(); },
  vprint(el) { const v = V.find((x) => x.id === Number(el.dataset.id)); if (v) { M = { type: 'vprint', v }; drawModal(); } },
  async stmt(el) {
    const q = { type: el.dataset.t, id: el.dataset.id, phone: el.dataset.phone };
    const st = await act(() => fetchStmt(q)); if (st) { M = { type: 'stmt', q, st, scope: 'all' }; drawModal(); }
  },
  's-xlsx'() { stmtXlsx(M); },
  'exp-orders'() { doExcel('orders'); }, 'pdf-orders'() { doPdf('orders'); },
  'exp-merchants'() { doExcel('merchants'); }, 'pdf-merchants'() { doPdf('merchants'); },
  'exp-drivers'() { doExcel('drivers'); }, 'pdf-drivers'() { doPdf('drivers'); },
  'exp-customers'() { doExcel('customers'); }, 'exp-expenses'() { doExcel('expenses'); }, 'exp-vouchers'() { doExcel('vouchers'); },
  async toggle(el) {
    const u = findU(Number(el.dataset.id)); if (!u) return;
    const prev = u.active; u.active = prev ? 0 : 1; draw();
    try { await api('PUT', '/api/admin/users/' + u.id, { active: !prev }); toast(prev ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب'); load(); }
    catch (e) { u.active = prev; draw(); toast(e.message, true); }
  },
  async requeue(el) { if (confirm('إعادة الطلب للسائقين وإرجاع رسوم التطبيق للسائق؟') && await act(() => api('POST', `/api/admin/orders/${el.dataset.id}/requeue`), 'أُعيد الطلب للسائقين')) load(); },
  async 'del-exp'(el) { if (confirm('حذف هذا المصروف؟') && await act(() => api('DELETE', '/api/admin/expenses/' + el.dataset.id), 'تم الحذف')) load(); },
  async vdel(el) { if (confirm('حذف هذا السند نهائياً؟ سيتغيّر رصيد الطرف المرتبط به.') && await act(() => api('DELETE', '/api/admin/vouchers/' + el.dataset.id), 'تم الحذف')) load(); }
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el || el.tagName === 'SELECT') return;
  const f = clickActs[el.dataset.a]; if (f) { if (el.tagName === 'A') return; f(el, e); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && M) closeModal(); });
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'q') { Q = t.value; const l = $('#list'); if (l) l.innerHTML = ({ orders: ordersList, merchants: merchantList, drivers: driverList, customers: customerList })[P](); }
  else if (/^(ea|va|a-amt|d-v|g-count|s-(bikeSame|bikeOther|carSame|carOther|feeSame|feeOther|lateMin))$/.test(t.id)) { const v = t.value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); if (v !== t.value) t.value = v; }
});
document.addEventListener('change', async (e) => {
  const t = e.target, c = t.dataset.c; if (!c) return;
  if (c === 'range') { R = t.value; ls.set('rio_range', R); if (R === 'custom' && !CF) { CF = fd(Date.now() - 30 * DAY); CT = fd(Date.now()); ls.set('rio_cf', CF); ls.set('rio_ct', CT); } load(); }
  else if (c === 'cf' || c === 'ct') { if (c === 'cf') { CF = t.value; ls.set('rio_cf', CF); } else { CT = t.value; ls.set('rio_ct', CT); } load(); }
  else if (c === 'status') { if (await act(() => api('POST', `/api/admin/orders/${t.dataset.id}/status`, { status: t.value }), 'تم تغيير الحالة')) load(); else load(); }
  else if (c === 'fm') { FM = Number(t.value); const l = $('#list'); if (l) l.innerHTML = ordersList(); }
  else if (c === 'fp') { FP = t.value; draw(); }
  else if (c === 'vt') {
    const box = $('#vparty');
    box.innerHTML = t.value === 'merchant' || t.value === 'driver'
      ? `<label for="vp">الطرف</label><select class="in" id="vp">${(t.value === 'merchant' ? D.merchants : D.drivers).map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>`
      : `<label for="vp">اسم الطرف</label><input class="in" id="vp" required placeholder="الاسم">`;
  }
});
document.addEventListener('submit', async (e) => {
  const f = e.target; e.preventDefault();
  if (f.id === 'lf') {
    try { const r = await api('POST', '/api/login', { phone: f.phone.value, password: f.password.value }); if (!['admin', 'staff'].includes(r.user.role)) throw Error('هذه اللوحة للإدارة فقط'); T = r.token; ls.set(KEY, T); setMe(r.user); P = PAGES.some((x) => x[0] === P) ? P : (PAGES[0] || ['home'])[0]; connect(); load(); }
    catch (x) { $('#le').textContent = x.message; }
    return;
  }
  const k = f.dataset.f; if (!k) return;
  const fe = $('#fe'); if (fe) fe.textContent = '';
  const btn = f.querySelector('button:not([type=button])'); if (btn) btn.disabled = true;
  const at = (id) => { const v = document.getElementById(id).value; return v ? Date.parse(v + 'T12:00:00+03:00') : Date.now(); };
  try {
    if (k === 'expense') { await api('POST', '/api/admin/expenses', { amount: $('#ea').value, category: $('#ec').value, note: $('#en').value, at: at('ed') }); toast('أُضيف المصروف'); ['ea', 'ec', 'en'].forEach((i) => { $('#' + i).value = ''; }); await load(); }
    else if (k === 'staff') {
      const perms = {}; PAGES_BASE.forEach(([pk]) => { const v = $('#pm-' + pk).value; if (v) perms[pk] = v; });
      if (M.id) { const body = { name: $('#st-name').value, perms }; if ($('#st-pass').value) body.password = $('#st-pass').value; await api('PUT', '/api/admin/staff/' + M.id, body); toast('تم الحفظ'); }
      else { await api('POST', '/api/admin/staff', { name: $('#st-name').value, username: $('#st-user').value, password: $('#st-pass').value, perms }); toast('تم إنشاء حساب الموظف'); }
      M = null; await load();
    }
    else if (k === 'voucher') {
      const t = $('#vt').value, p = $('#vp');
      const body = { kind: VK, partyType: t, amount: $('#va').value, note: $('#vn').value, ref: $('#vr').value, at: at('vd') };
      if (t === 'merchant' || t === 'driver') body.partyId = Number(p.value); else body.partyName = p.value;
      const r = await api('POST', '/api/admin/vouchers', body); toast('تم إنشاء السند #' + r.voucher.no); await load(); M = { type: 'vprint', v: r.voucher }; drawModal();
    }
    else if (k === 'add-user') {
      const d = M.role === 'driver';
      const info = { type: 'created', role: M.role, name: $('#u-name').value.trim(), phone: $('#u-phone').value.trim(), password: $('#u-pass').value, vehicle: d ? $('#u-veh').value : '', area: d ? '' : $('#u-area').value.trim() };
      await api('POST', '/api/admin/users', { role: M.role, name: $('#u-name').value, phone: $('#u-phone').value, password: $('#u-pass').value, vehicle: d ? $('#u-veh').value : undefined, area: d ? '' : $('#u-area').value, mapUrl: d ? undefined : $('#u-map').value });
      toast('تم إنشاء الحساب'); await load(); M = info; drawModal();
    }
    else if (k === 'gen-cards') {
      const r = await api('POST', '/api/admin/cards', { amount: $('#g-amount').value, count: $('#g-count').value });
      BATCH = r.made; toast('تم توليد ' + r.made.length + ' كرت'); await load();
    }
    else if (k === 'settings') {
      const body = {}; ['bikeSame', 'bikeOther', 'carSame', 'carOther', 'feeSame', 'feeOther', 'lateMin'].forEach((x) => { body[x] = $('#s-' + x).value; }); body.support = $('#s-support').value; body.receipts = $('#s-receipts').checked; body.templates = {}; TPL_DEFS.forEach(([k]) => { body.templates[k] = $('#t-' + k).value; });
      const r = await api('PUT', '/api/admin/settings', body); SET = r.settings; toast('تم حفظ الإعدادات'); draw();
    }
    else if (k === 'chat') {
      const inp = $('#chat-in'), t = inp.value.trim();
      if (t) { inp.value = ''; await api('POST', `/api/orders/${M.o.id}/messages`, { text: t }); M.loaded = false; await loadChat(); }
    }
    else if (k === 'mloc') { await api('PUT', '/api/admin/users/' + M.id, { area: $('#l-area').value, mapUrl: $('#l-map').value }); toast('تم الحفظ'); closeModal(); await load(); }
    else if (k === 'assign') {
      const id = Number($('#as-d').value), d = D.drivers.find((x) => x.id === id);
      const r = await api('POST', `/api/admin/orders/${M.o.id}/assign`, { driverId: id, charge: $('#as-c').checked });
      toast('تم تعيين الطلب'); await load(); M = { type: 'assigned', o: r.order, d }; drawModal();
    }
    else if (k === 'pw') { const p = $('#w-p').value; await api('PUT', '/api/admin/users/' + M.id, { password: p }); M.done = p; drawModal(); }
    else if (k === 'adjust') { await api('POST', `/api/admin/users/${M.id}/adjust`, { amount: $('#a-amt').value, label: $('#a-lbl').value }); toast('تم تعديل الرصيد'); closeModal(); await load(); }
  } catch (x) { if (fe) fe.textContent = x.message; else toast(x.message, true); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
});

/* ---------------- التشغيل ---------------- */
draw();
if (T) { connect(); load(); }
})();
