'use strict';
(() => {
/* ============ أدوات عامة ============ */
const API = String(window.RIO_API || '').replace(/\/$/, '');
const ADMIN_ONLY = !!window.RIO_ADMIN_ONLY;
const TOKEN_KEY = ADMIN_ONLY ? 'rio_admin_token' : 'rio_token';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('en-US');
const num = (n) => `<span class="num">${nf.format(Math.round(n || 0))}</span>`;
const money = (n) => `${num(n)} د.ع`;
const RSIZES = { '58': ['58mm', 384, '58mm auto', '2mm'], '80': ['80mm', 576, '80mm auto', '3mm'], a5: ['A5', 700, 'A5', '8mm'], a4: ['A4', 794, 'A4', '10mm'] };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
let RSIZE = RSIZES[store.get('rio_rsize')] ? store.get('rio_rsize') : '80';
/* تصميم الوصولات (بطاقة الطلب): يُحفظ في جهاز المستخدم ويُطبَّق فوراً على كل بطاقات الطلبات */
const OC_DESIGNS = [
  ['classic', 'كلاسيكي', 'الشكل الحالي'],
  ['bold', 'أسود وأصفر', 'عريض وواضح'],
  ['green', 'أخضر متدرّج', 'مع شريط تقدّم الطلب'],
  ['ticket', 'تذكرة', 'بشكل قسيمة'],
  ['sun', 'أصفر وبني', 'بطاقات ملوّنة'],
  ['night', 'داكن', 'مسار التوصيل']
];
const ocdValid = (k) => OC_DESIGNS.some((d) => d[0] === k);
/* التصميم يحدده المدير من لوحة التحكم (يصل من الخادم)، وتُحفظ آخر قيمة هنا فقط لتفادي الوميض عند فتح التطبيق */
let OCD = ocdValid(store.get('rio_ocd')) ? store.get('rio_ocd') : 'green';
function applyCfg(st) {
  if (!st || !ocdValid(st.ocDesign) || st.ocDesign === OCD) return false;
  OCD = st.ocDesign; store.set('rio_ocd', OCD); S.det = {};
  return true;
}
/* مزامنة إعدادات الإدارة (تصميم الوصولات + تفعيل الوصولات) فور أي تغيير، على أي صفحة كان المستخدم */
async function syncCfg() {
  if (!S.user) return;
  try {
    const r = await api('GET', '/api/settings');
    const st = r.settings || {};
    let ch = applyCfg(st);
    if (S.data && S.data.settings && String(S.data.settings.receipts) !== String(st.receipts)) { S.data.settings.receipts = st.receipts; ch = true; }
    if (!ch) return;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { S.dirty = true; return; }
    render();
  } catch { /* ignore */ }
}
/* تشغيل/إيقاف الوصولات من الإدارة: يخفي زر «وصل» عن التاجر والسائق فقط */
const receiptsOn = () => !S.user || S.user.role === 'admin' || !S.data || !S.data.settings || ![0, false, '0'].includes(S.data.settings.receipts);
const rsizeSeg = () => `<div class="seg" role="group" aria-label="حجم الوصل" style="display:flex;justify-content:center;width:max-content;max-width:100%;margin:0 auto 10px">${Object.keys(RSIZES).map((k) => `<button type="button" data-act="rsize" data-k="${k}" aria-pressed="${RSIZE === k}">${RSIZES[k][0]}</button>`).join('')}</div>`;
const pad = (n) => String(n).padStart(2, '0');
const OFF = 3 * 3600000;
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}
function dt(t) {
  if (!t) return '—';
  const d = new Date(t + OFF);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const fmtPhone = (p) => String(p || '').replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3');
const telLink = (p) => `<a class="phone" href="tel:${esc(p)}" dir="ltr">${esc(fmtPhone(p))}</a>`;
const normArea = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/^ال/, '');
const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

const IC = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  orders: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path d="M16 15h2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5c2.5.6 4 2.3 4 5.5"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  out: '<path d="M10 4H5v16h5M15 8l5 4-5 4M20 12H9"/>',
  chev: '<path d="M15 5l-7 7 7 7"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8H8M13 12h5"/>',
  car: '<path d="M3 15v-4l2-5h14l2 5v4z"/><circle cx="7.5" cy="15.5" r="1.8"/><circle cx="16.5" cy="15.5" r="1.8"/><path d="M5 11h14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  wa: '<path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.8-1z"/><path d="M9 9c.5 3 2.5 5 6 6l1-1.5-2-1-1 .8c-1-.5-1.8-1.3-2.3-2.3l.8-1-1-2z"/>',
  dl: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  support: '<path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/>'
};
const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

const RIO_MARK = '<svg class="rl" width="170" height="108" viewBox="0 0 300 190" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ريوو للتوصيل اسرع" style="display:block;max-width:100%;margin:0 auto 8px"><rect width="300" height="190" rx="30" fill="#ffd21f"/><g fill="#171200"><rect x="216" y="52" width="64" height="13" rx="6"/><rect x="226" y="80" width="54" height="13" rx="6"/><rect x="216" y="108" width="64" height="13" rx="6"/></g><text x="112" y="112" text-anchor="middle" font-family="Cairo,Tahoma,sans-serif" font-weight="900" font-size="92" fill="#171200">ريوو</text><text x="112" y="168" text-anchor="middle" font-family="Cairo,Tahoma,sans-serif" font-weight="700" font-size="22" fill="#5c4d00">للتوصيل أسرع</text></svg>';
const logo = (cls = '') => `<img class="logo-img ${cls}" src="logo.png" alt="ريوو للتوصيل اسرع">`;

const ST = {
  pending: ['بانتظار سائق', 'amber'], picking_up: ['قيد الاستلام من التاجر', 'accent'], on_the_way: ['في الطريق للزبون', 'accent'],
  delivered: ['تم التسليم', 'green'], rejected: ['مرفوض من زبون', 'red'], postponed: ['تأجيل', 'amber'], no_answer: ['لا يرد', 'red'], problem: ['مشكلة', 'red'], other: ['حالة أخرى', 'red'],
  returned: ['راجع — استلمه التاجر', 'blue'], return_sent: ['إرجاع للمتجر — بانتظار تأكيد التاجر', 'amber'], partial: ['راجع جزئي', 'blue'], cancelled: ['ملغي', '']
};
const DRIVER_ST = ['picking_up', 'on_the_way', 'delivered', 'rejected', 'no_answer', 'postponed'];
const ST_OK = ['pending', 'picking_up', 'on_the_way', 'delivered', 'rejected', 'no_answer', 'postponed', 'return_sent', 'returned', 'cancelled'];
const RETURNABLE = ['picking_up', 'on_the_way', 'rejected', 'no_answer', 'postponed'];
const stKeys = (cur) => Object.keys(ST).filter((k) => ST_OK.includes(k) || k === cur);
const pill = (s) => `<span class="pill ${ST[s]?.[1] || ''}">${esc(ST[s]?.[0] || s)}</span>`;
const vehName = (v) => (v === 'car' ? 'سيارة' : 'دراجة');

/* ============ الحالة ============ */
const S = {
  token: store.get(TOKEN_KEY) || (() => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } })(), user: null, tab: '', data: null, loading: false, error: '',
  unread: 0, pushOn: false, sheet: null, menu: null, armed: null, filter: 'all', walletTab: 'log', ordersTab: 'current', adminFilter: 'all', cardsBatch: null, expRange: 'month', det: {}
};
let lastSig = '';
let chatTimer = null;

const TABS = {
  merchant: [['stats', 'الإحصائيات', 'stats'], ['orders', 'الطلبات', 'orders'], ['me', 'حسابي', 'user']],
  driver: [['home', 'الرئيسية', 'home'], ['orders', 'الطلبات', 'orders'], ['wallet', 'المحفظة', 'wallet'], ['me', 'الملف الشخصي', 'user']],
  admin: [['overview', 'نظرة عامة', 'grid'], ['orders', 'الطلبات', 'orders'], ['merchants', 'التجار', 'store'], ['drivers', 'السائقون', 'users'], ['cards', 'كروت الشحن', 'card'], ['settings', 'الإعدادات', 'settings']]
};
const ROLE_NAME = { merchant: 'تاجر', driver: 'سائق', admin: 'مدير' };
const ROLE_ICON = { merchant: 'store', driver: 'pin', admin: 'grid' };

/* ============ الاتصال بالخادم ============ */
async function api(method, path, body) {
  let r;
  try {
    r = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch { throw new Error('لا يوجد اتصال بالخادم، تحقق من الإنترنت'); }
  let j = {};
  try { j = await r.json(); } catch { /* ignore */ }
  if (r.status === 401 && S.token && path !== '/api/login') { logout(); throw new Error(j.error || 'انتهت الجلسة، سجّل الدخول مرة أخرى'); }
  if (!r.ok) throw new Error(j.error || 'حدث خطأ غير متوقع');
  return j;
}

function toast(msg, err) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message || 'تعذّر تنفيذ العملية', true); return null; }
}

/* ============ تحميل البيانات ============ */
function defaultTab() { return TABS[S.user.role][0][0]; }

async function fetchData() {
  const role = S.user.role;
  if (role !== 'admin' && S.tab === 'notifs') return api('GET', '/api/notifs?limit=40');
  if (role === 'merchant') return api('GET', '/api/merchant/home');
  if (role === 'driver') return api('GET', '/api/driver/home');
  const t = S.tab;
  if (t === 'overview') return api('GET', '/api/admin/overview');
  if (t === 'orders') return api('GET', '/api/admin/orders' + (S.adminFilter !== 'all' ? '?status=' + S.adminFilter : ''));
  if (t === 'merchants') return api('GET', '/api/admin/users?role=merchant');
  if (t === 'drivers') return api('GET', '/api/admin/users?role=driver');
  if (t === 'cards') return api('GET', '/api/admin/cards');
  return api('GET', '/api/settings');
}

async function refresh(manual) {
  if (!S.user) return;
  const tab = S.tab;
  if (manual) { S.loading = true; S.error = ''; render(); }
  try {
    const d = await fetchData();
    if (tab !== S.tab) return;
    if (S.user && (S.user.role === 'merchant' || S.user.role === 'driver') && d && d.adsVer !== undefined && d.adsVer !== S.adsVer) {
      try { const a = await api('GET', '/api/ads'); S.ads = a.ads; S.adsVer = d.adsVer; lastSig = ''; } catch { /* ignore */ }
    }
    if (d && d.me && S.user && d.me.id === S.user.id && d.me.name !== S.user.name) S.user = { ...S.user, ...d.me };
    const cfgChanged = d && d.settings ? applyCfg(d.settings) : false;
    const sig = JSON.stringify(d);
    S.loading = false; S.error = '';
    if (tab === 'notifs' && d && d.unread !== undefined) S.unread = d.unread;
    if (sig !== lastSig || manual || cfgChanged) { lastSig = sig; S.data = d; render(); }
  } catch (e) {
    if (!S.user) return;
    S.loading = false;
    if (!S.data) { S.error = e.message; render(); }
  }
}

function go(tab) {
  S.tab = tab; S.data = null; S.error = ''; S.menu = null; S.armed = null; lastSig = '';
  if (location.hash !== '#/' + tab) history.replaceState(null, '', '#/' + tab);
  render();
  window.scrollTo(0, 0);
  refresh();
}

let es = null, liveT = null;
function connectLive() {
  if (es || !S.token || typeof EventSource === 'undefined') return;
  es = new EventSource(API + '/api/stream?token=' + encodeURIComponent(S.token));
  es.addEventListener('change', () => { clearTimeout(liveT); liveT = setTimeout(liveRefresh, 300); setTimeout(checkNotifs, 200); setTimeout(syncCfg, 250); });
}
function disconnectLive() { if (es) { es.close(); es = null; } }
function liveRefresh() {
  if (!S.user || document.hidden) return;
  const a = document.activeElement;
  if (S.sheet || S.menu || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) { S.dirty = true; return; }
  refresh();
}
function setUser(u) { S.user = u; connectLive(); setTimeout(syncCfg, 100); setTimeout(checkNotifs, 600); if (u && u.role !== 'admin') setTimeout(promptOnEntry, 500); }
function logout() {
  S.token = null; S.user = null; S.data = null; S.sheet = null; S.menu = null; lastSig = ''; S.unread = 0; S.pushOn = false; entryAsked = false; S.nperm = '';
  store.del(TOKEN_KEY);
  history.replaceState(null, '', location.pathname);
  stopChat(); disconnectLive();
  render();
}

/* ============ العرض العام ============ */
function render() {
  const app = $('#app');
  document.body.classList.toggle('lock', !!S.sheet);
  app.innerHTML = S.user ? shell() : loginView();
  renderSheet();
}

function shell() {
  const role = S.user.role;
  const tabs = TABS[role];
  const badge = (id) => {
    if (S.data && role === 'driver' && id === 'home' && S.data.available) return S.data.available.length;
    return 0;
  };
  const nav = tabs.map(([id, label, ic]) => {
    const b = badge(id);
    return `<button data-act="tab" data-tab="${id}" ${S.tab === id ? 'aria-current="page"' : ''}>${ico(ic)}<span>${label}</span>${b ? `<span class="badge">${b}</span>` : ''}</button>`;
  }).join('');
  const un = unreadCount();
  const bell = role === 'admin' ? '' : `<button class="bell" id="bell" data-act="notifs" aria-label="الإشعارات">${ico('bell')}<span class="badge" id="bell-n" ${un ? '' : 'hidden'}>${un}</span></button>`;
  const fab = role === 'merchant' && S.tab !== 'me' ? `<button class="btn fab" data-act="new-order">${ico('plus')} إنشاء طلب</button>` : '';
  return `<header class="topbar"><div class="grp">${logo()}<span class="rolechip">${ico(ROLE_ICON[role])}${ROLE_NAME[role]}</span></div><div class="grp">${bell}</div></header>
<div class="shell"><nav class="nav" aria-label="التنقل">${nav}</nav><main class="main"><div class="col ${role === 'admin' ? 'wide' : ''}"><div id="nbanner">${nbannerHtml()}</div>${view()}</div></main></div>${fab}`;
}

function view() {
  if (S.error) return `<div class="empty"><b>تعذّر التحميل</b>${esc(S.error)}<div style="margin-top:14px"><button class="btn sm" data-act="retry">إعادة المحاولة</button></div></div>`;
  if (!S.data) return `<div class="empty">جارٍ التحميل…</div>`;
  const fn = VIEWS[S.user.role + ':' + S.tab];
  return fn ? fn() : '';
}

const head = (title, sub, extra = '') => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${extra}</div>`;
const emptyBox = (t, s) => `<div class="empty"><b>${t}</b>${s || ''}</div>`;

/* ============ تسجيل الدخول ============ */
function loginView() {
  if (ADMIN_ONLY) return `<div class="land"><div class="hero">${logo('big dark')}</div><div class="stack">
    <form class="card stack" data-form="login" autocomplete="on">
      <h2 style="font-size:20px">لوحة تحكم المدير</h2>
      <div class="field"><label for="l-phone">رقم الهاتف</label><input class="in mono" id="l-phone" name="phone" inputmode="tel" autocomplete="username" placeholder="07XX XXX XXXX" required></div>
      <div class="field"><label for="l-pass">كلمة المرور</label><input class="in" id="l-pass" name="password" type="password" autocomplete="current-password" required></div>
      <p class="hint" id="l-err" style="color:var(--red)" role="alert"></p>
      <button class="btn block" type="submit" id="l-btn">دخول</button>
    </form></div></div>`;
  return `<div class="lg">
  <div class="lg-hero"><img src="hero.jpg" alt="ريوو للتوصيل اسرع — أسرع توصيل في بغداد"></div>
  <form class="lg-card" data-form="login" autocomplete="on">
    <h1>تسجيل الدخول</h1><p class="lg-sub">مرحباً بك في ريو</p>
    <div class="lg-in">${ico('phone')}<input id="l-phone" name="phone" inputmode="tel" autocomplete="username" placeholder="رقم الجوال" aria-label="رقم الجوال" required></div>
    <div class="lg-in">${ico('lock')}<input id="l-pass" name="password" type="password" autocomplete="current-password" placeholder="كلمة المرور" aria-label="كلمة المرور" required><button type="button" class="eye" data-act="eye" aria-label="إظهار كلمة المرور">${ico('eye')}</button></div>
    <label class="lg-rem"><input type="checkbox" name="remember" checked> تذكرني</label>
    <p class="hint" id="l-err" style="color:var(--red)" role="alert"></p>
    <button class="btn block" type="submit" id="l-btn">دخول ←</button>
    <div class="lg-or"><span>أو</span></div>
    <button type="button" class="lg-reg" data-act="register" data-role="merchant">${ico('store')} تسجيل كتاجر</button>
    <button type="button" class="lg-reg" data-act="register" data-role="driver">${ico('user')} تسجيل كسائق</button>
    <p class="lg-new">ليس لديك حساب؟ <button type="button" class="lg-link" data-act="register" data-role="driver">إنشاء حساب جديد</button></p>
  </form></div>`;
}

/* ============ التاجر ============ */
const countBy = (arr, list) => arr.filter((o) => list.includes(o.status)).length;

function tile(label, sub, n, color) {
  return `<div class="tile" style="--c:${color}"><span class="ring">${n}</span><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}

/* ============ بطاقة الطلب الموحّدة (التاجر / السائق / المدير) ============ */
const dinar = (n) => `<span class="num">${nf.format(Math.round(n || 0))}</span> دينار`;
const OCI = { store: ico('store'), pin: ico('pin'), phone: ico('phone'), box: ico('orders'), cash: ico('wallet'), user: ico('user'), status: ico('orders') };
const ocRow = (i, l, v, cls = '') => `<div class="oc-r ${cls}"><span class="oc-i">${OCI[i]}</span><span class="oc-l">${l}<i class="oc-c">:</i></span><span class="oc-v">${v}</span></div>`;
const noteBtn = (o) => `<button class="oc-cb r" data-act="note" data-id="${o.id}"><span>ملاحظة</span><span class="oc-ex">!</span></button>`;
const chatBtn = (o) => `<button class="oc-cb g" data-act="chat" data-id="${o.id}"><span>محادثة</span>${ico('chat')}</button>`;
function wazeLinks(o) {
  const url = o.merchantMap || '';
  if (!url && !o.merchantArea) return '';
  const c = mapCoords(url);
  const wz = c ? `https://waze.com/ul?ll=${c[0]},${c[1]}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent((o.merchantName || '') + ' ' + (o.merchantArea || ''))}&navigate=yes`;
  return `<a class="btn soft sm" href="${esc(wz)}" target="_blank" rel="noopener">${ico('pin')} Waze · موقع المتجر</a>${url ? `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">الخريطة</a>` : ''}`;
}
/* opt: corner (أزرار الزاوية العلوية)، status (الحالة)، rows (تفاصيل إضافية)، after (تنبيهات)، actions (الأزرار السفلية) */
function orderCard(o, opt = {}) { return OCD === 'classic' ? ocClassic(o, opt) : odCard(o, opt, OCD); }
function ocClassic(o, opt = {}) {
  const corner = (opt.corner || '') + (opt.noteBtn ? noteBtn(o) : '');
  const rows = (opt.status ? ocRow('status', 'الحالة', opt.status) : '') + (opt.rows || '');
  return `<article class="oc">
    <div class="oc-top"><div class="oc-no">رقم الطلب : <bdi>#${o.no}</bdi><small>${ago(o.createdAt)}</small></div>${corner ? `<div class="oc-corner">${corner}</div>` : ''}</div>
    ${ocRow('store', 'اسم المتجر', esc(o.merchantName))}
    <div class="oc-r"><span class="oc-i"><span class="oc-d">$</span></span><span class="oc-l">سعر الطلب:</span><span class="oc-v">${dinar(o.productPrice)}</span><span class="oc-grp"><span class="oc-plus">+</span><span class="oc-l">التوصيل:</span><span class="oc-v">${dinar(o.deliveryPrice)}</span></span></div>
    ${ocRow('pin', 'عنوان المتجر', `<span class="oc-chip">${esc(o.merchantArea || '—')}</span>`)}
    ${ocRow('pin', 'عنوان الزبون', `<span class="oc-chip">${esc(o.customerArea)}</span>`)}
    ${rows ? `<hr class="oc-sep">${rows}` : ''}${opt.after || ''}
    ${opt.actions ? `<div class="oc-act">${opt.actions}</div>` : ''}
  </article>`;
}

/* ===== التصاميم البديلة لبطاقة الطلب (تصميم الوصولات) ===== */
const OD_STEPS = ['قبول', 'استلام', 'تسليم'];
const OD_DONE = { picking_up: 1, on_the_way: 2, delivered: 3, rejected: 2, no_answer: 2, postponed: 2, return_sent: 2, returned: 2, partial: 2 };
function odSteps(st) {
  const n = OD_DONE[st] || 0;
  return `<div class="od-steps">${OD_STEPS.map((t, i) => `${i ? `<span class="od-ln ${i < n ? 'on' : ''}"></span>` : ''}<span class="od-s ${i < n ? 'on' : ''}"><i>${i < n ? ico('check') : ''}</i><small>${t}</small></span>`).join('')}</div>`;
}
function odCard(o, opt = {}, d = 'bold') {
  const open = !!S.det[o.id];
  const hasDet = !!(opt.rows || opt.actions);
  const initial = esc((o.merchantName || '؟').trim().charAt(0));
  const main = (opt.corner || '') + (opt.noteBtn ? noteBtn(o) : '');
  const delivery = `<span class="od-dl">+ توصيل ${num(o.deliveryPrice)}</span>`;
  const head = `<div class="od-hd"><div class="od-no"><span class="od-nol">رقم الطلب</span><bdi>#${o.no}</bdi></div><span class="od-ago">${ago(o.createdAt)}</span></div>`;
  const stat = opt.status ? `<div class="od-st"><span class="od-sv">${opt.status}</span><span class="od-sl">الحالة</span></div>` : '';
  const store = `<div class="od-store"><span class="od-av">${initial}</span><span class="od-sn"><small>اسم المتجر</small><b>${esc(o.merchantName)}</b></span></div>`;
  const price = d === 'sun'
    ? `<div class="od-pr"><div class="od-pb"><small>سعر الطلب</small><div><b class="od-big">${num(o.productPrice)}</b> <em>دينار</em></div></div><div class="od-db"><small>التوصيل</small><div><b>${num(o.deliveryPrice)}</b> <em>دينار</em></div></div></div>`
    : d === 'night'
      ? `<div class="od-pr"><div class="od-pm"><small class="od-pl">سعر الطلب</small><b class="od-big">${num(o.productPrice)}</b><em>دينار</em></div>${delivery}</div>`
      : `<div class="od-pr"><small class="od-pl">سعر الطلب</small><div class="od-pm"><span class="od-pv"><b class="od-big">${num(o.productPrice)}</b><em>دينار</em></span></div>${d === 'green' ? '' : delivery}${d === 'green' ? delivery : ''}</div>`;
  const addr = `<div class="od-ad"><div class="od-ab"><small>عنوان المتجر</small><b>${esc(o.merchantArea || '—')}</b></div><span class="od-arrow" aria-hidden="true"></span><div class="od-ab"><small>عنوان الزبون</small><b>${esc(o.customerArea)}</b></div></div>`;
  const toggle = hasDet ? `<button type="button" class="od-tg" data-act="det" data-id="${o.id}" aria-expanded="${open}">${open ? '▴ إخفاء التفاصيل' : '▾ عرض التفاصيل'}</button>` : '';
  const det = hasDet && open ? `<div class="od-det">${opt.rows || ''}</div>${opt.actions ? `<div class="od-links">${opt.actions}</div>` : ''}` : '';
  const btns = main ? `<div class="od-main">${main}</div>` : '';
  const tail = `${opt.after || ''}${toggle}${det}${btns}`;
  let inner;
  if (d === 'green') inner = `<div class="od-top">${head}${store}${price}</div><div class="od-body">${opt.status ? stat + odSteps(o.status) : ''}${addr}${tail}</div>`;
  else if (d === 'ticket') inner = `<div class="od-half od-top">${head}${stat}${store}</div><div class="od-half od-bot">${price}${addr}${tail}</div>`;
  else if (d === 'sun') inner = `<div class="od-top">${head}</div><div class="od-body">${stat}${store}${price}${addr}${tail}</div>`;
  else if (d === 'night') inner = `<div class="od-body">${head}${stat}${store}${price}${addr}${tail}</div>`;
  else inner = `<div class="od-top">${head}</div>${stat}<div class="od-body">${store}${price}${addr}${tail}</div>`;
  return `<article class="od od-${d}" data-st="${esc(o.status || '')}">${inner}</article>`;
}
/* معاينة مصغّرة داخل قسم «تصميم الوصولات» (غير تفاعلية) */
function ocPreview(d) {
  const o = { id: 0, no: 1069, createdAt: Date.now() - 14 * 3600000, merchantName: 'متجر الرافدين', productPrice: 1000000, deliveryPrice: 5000, merchantArea: 'الكرادة', customerArea: 'حي اور', status: 'delivered' };
  const opt = { status: pill('delivered'), corner: chatBtn(o), noteBtn: true, rows: d === 'classic' ? '' : ocRow('phone', 'رقم الزبون', '0782 118 9947') };
  const prev = S.det[0]; S.det[0] = false;
  const html = (d === 'classic' ? ocClassic(o, opt) : odCard(o, opt, d)).replace(/\sdata-act="[^"]*"/g, '').replace(/\shref="[^"]*"/g, '');
  S.det[0] = prev;
  return html;
}
function ocDesignPicker() {
  return `<h2 class="sec">تصميم الوصولات</h2><p class="hint" style="margin:-4px 4px 10px">اختر شكل بطاقة الطلب، ويُطبَّق فوراً على حسابات كل التجار والسائقين والمدير.</p>
  <div class="odp" role="radiogroup" aria-label="تصميم الوصولات">${OC_DESIGNS.map(([k, n, sub]) => `<div class="odp-o" role="radio" tabindex="0" aria-checked="${OCD === k}" data-act="ocd" data-d="${k}"><div class="odp-box" aria-hidden="true"><div class="odp-in">${ocPreview(k)}</div></div><b>${n}</b><small>${sub}</small></div>`).join('')}</div>`;
}

const customerRows = (o) => ocRow('phone', 'رقم الزبون', telLink(o.customerPhone)) + ocRow('cash', 'المطلوب من الزبون', money(o.total)) + ocRow('box', 'المنتج', `${esc(o.product)} × ${o.qty} · ${vehName(o.vehicle)}`);

function merchantOrderCard(o, withCancel) {
  const armed = S.armed === 'c' + o.id;
  return orderCard(o, {
    corner: o.driverId ? chatBtn(o) : '', noteBtn: !!o.note,
    status: pill(o.status), rows: customerRows(o) + (o.driverName ? ocRow('user', 'السائق', esc(o.driverName)) : ''),
    after: o.status === 'return_sent' ? `<div class="notice">السائق ${esc(o.driverName || '')} أعلن أنه أرجع الطلب إليك. أكّد الاستلام عند وصول البضاعة.</div>` : '',
    actions: `<a class="btn wa sm" href="${waLink(o)}" target="_blank" rel="noopener">واتساب الزبون</a>${wazeLinks(o)}${o.status === 'return_sent' ? `<button class="btn sm" data-act="ask-recv" data-id="${o.id}">تأكيد استلام المرتجع</button><button class="btn ghost sm" data-act="not-recv" data-id="${o.id}">لم أستلمه</button>` : ''}${withCancel && o.status === 'pending' ? `<button class="btn danger sm ${armed ? 'arm' : ''}" data-act="cancel" data-id="${o.id}">${armed ? 'اضغط للتأكيد' : 'إلغاء الطلب'}</button>` : ''}`
  });
}

function availOrderCard(o, s, receiving) {
  return orderCard(o, {
    corner: `<button class="oc-cb g" data-act="accept" data-id="${o.id}"><span>قبول الطلب</span>${ico('check')}</button><button class="oc-cb r" data-act="note" data-id="${o.id}"><span>ملاحظة</span><span class="oc-ex">!</span></button>`,
    /* قبل قبول الطلب: لا موقع متجر (Waze) ولا تفاصيل منتج، فقط السعر والتوصيل والعنوانين نصاً */
    after: OCD === 'classic' ? `<p class="hint" style="margin-top:12px">رسوم التطبيق عند القبول ${money(o.sameArea ? s.feeSame : s.feeOther)}</p>` : ''
  });
}

function driverOrderCard(o) {
  const open = S.menu === o.id;
  const locked = ['delivered', 'return_sent', 'returned'].includes(o.status);
  const m = '';
  const st = locked ? pill(o.status) : `<span class="menuwrap"><button class="pill ${ST[o.status]?.[1] || ''}" data-act="menu" data-id="${o.id}" aria-haspopup="menu" aria-expanded="${open}">${esc(ST[o.status]?.[0] || o.status)} <span aria-hidden="true">▾</span></button>${m}</span>`;
  return orderCard(o, {
    corner: chatBtn(o), noteBtn: !!o.note,
    status: st, rows: customerRows(o) + ocRow('phone', 'هاتف المتجر', telLink(o.merchantPhone)),
    after: o.status === 'picking_up' ? `<div class="notice">ادفع للتاجر ${money(o.productPrice)} عند الاستلام، وبعدها اضغط على الحالة واختر «تم الاستلام من التاجر».</div>` : '',
    actions: `${receiptsOn() ? `<button class="btn ghost sm" data-act="receipt" data-id="${o.id}">وصل</button>` : ''}<a class="btn wa sm" href="${waLink(o)}" target="_blank" rel="noopener">واتساب الزبون</a><a class="btn ghost sm" href="${supportLink(o)}" target="_blank" rel="noopener">واتساب الدعم</a>${wazeLinks(o)}`
  });
}

/* المدير داخل التطبيق: نفس البطاقة مع التحكم بالحالة */
function adminOrderCard(o) {
  return orderCard(o, {
    corner: o.driverId ? chatBtn(o) : '', noteBtn: !!o.note,
    status: statusSelect(o), rows: customerRows(o) + ocRow('user', 'السائق', esc(o.driverName || '—')),
    actions: `<a class="btn wa sm" href="${waLink(o)}" target="_blank" rel="noopener">واتساب الزبون</a>${receiptsOn() || true ? `<button class="btn ghost sm" data-act="receipt" data-id="${o.id}">وصل</button>` : ''}${wazeLinks(o)}${o.driverId && o.status !== 'pending' ? `<button class="btn soft sm" data-act="requeue" data-id="${o.id}">إعادة للسائقين</button>` : ''}`
  });
}

/* ---------- إعلانات التاجر: شريط صور متحرك تديره لوحة التحكم ---------- */
function adsSlider() {
  const a = S.ads || [];
  if (!a.length) return '';
  const slides = a.map((x, i) => {
    const img = `<img src="${x.image}" alt="إعلان ${i + 1}" draggable="false">`;
    return x.link ? `<a class="ad-s" href="${esc(x.link)}" target="_blank" rel="noopener">${img}</a>` : `<div class="ad-s">${img}</div>`;
  }).join('');
  const dots = a.length > 1 ? `<div class="ad-dots" aria-hidden="true">${a.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>` : '';
  return `<div class="ads" role="region" aria-label="إعلانات"><div class="ad-track">${slides}</div>${dots}</div>`;
}
let adTimer = null;
function adTick() {
  const t = document.querySelector('.ad-track');
  if (!t || document.hidden) return;
  const sl = [...t.children];
  if (sl.length < 2) return;
  const tr = t.getBoundingClientRect(), mid = tr.left + tr.width / 2;
  let cur = 0, best = 1e9;
  sl.forEach((c, i) => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < best) { best = d; cur = i; } });
  sl[(cur + 1) % sl.length].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}
function adDots() {
  const t = document.querySelector('.ad-track'), d = document.querySelectorAll('.ad-dots i');
  if (!t || !d.length) return;
  const tr = t.getBoundingClientRect(), mid = tr.left + tr.width / 2;
  let cur = 0, best = 1e9;
  [...t.children].forEach((c, i) => { const r = c.getBoundingClientRect(), x = Math.abs(r.left + r.width / 2 - mid); if (x < best) { best = x; cur = i; } });
  d.forEach((e, i) => e.classList.toggle('on', i === cur));
}
document.addEventListener('scroll', (e) => { if (e.target && e.target.classList && e.target.classList.contains('ad-track')) adDots(); }, true);
if (!adTimer) adTimer = setInterval(adTick, 4500);

/* منع تكبير الشاشة بالأصابع (iOS يتجاهل user-scalable) */
['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });

const VIEWS = {
  'merchant:stats'() {
    const o = S.data.orders;
    const pend = o.filter((x) => x.status === 'pending');
    return `${head('الإحصائيات', esc(S.user.name))}
    ${adsSlider()}
    <div class="tiles">
      ${tile('طلبات مسجلة', 'بانتظار سائق', pend.length, 'var(--amber)')}
      ${tile('قيد التوصيل', '', countBy(o, ['picking_up', 'on_the_way']), 'var(--accent)')}
      ${tile('تم التسليم', '', countBy(o, ['delivered']), 'var(--green)')}
      ${tile('مشاكل', 'لا يرد / مشكلة / أخرى', countBy(o, ['no_answer', 'problem', 'other']), 'var(--red)')}
      ${tile('تم الإرجاع', '', countBy(o, ['returned', 'partial']), 'var(--blue)')}
    </div>
    <button class="btn ghost block" style="margin-top:14px" data-act="tab" data-tab="orders">عرض كل الطلبات (${o.length})</button>
    <h2 class="sec">طلبات مسجلة (${pend.length})</h2>
    <div class="stack">${pend.length ? pend.map((x) => merchantOrderCard(x, true)).join('') : emptyBox('لا توجد طلبات بانتظار سائق', 'اضغط «إنشاء طلب» لإرسال طلب جديد للسائقين.')}</div>`;
  },
  'merchant:orders'() {
    const o = S.data.orders;
    const f = S.filter;
    const sets = { all: null, active: ['pending', 'picking_up', 'on_the_way'], done: ['delivered'], issues: ['return_sent', 'rejected', 'postponed', 'no_answer', 'problem', 'other', 'returned', 'partial', 'cancelled'] };
    const list = sets[f] ? o.filter((x) => sets[f].includes(x.status)) : o;
    const chip = (id, l) => `<button class="chip" data-act="filter" data-f="${id}" aria-pressed="${f === id}">${l}</button>`;
    return `${head('الطلبات', `${o.length} طلب`)}
    <div class="chips">${chip('all', 'الكل')}${chip('active', 'جارية')}${chip('done', 'تم التسليم')}${chip('issues', 'مشاكل ومرتجع')}</div>
    <div class="stack">${list.length ? list.map((x) => merchantOrderCard(x, true)).join('') : emptyBox('لا توجد طلبات هنا')}</div>`;
  },
  'merchant:me'() { return profileView(S.data.me, S.data.settings); },

  /* ----- السائق ----- */
  'driver:home'() {
    const d = S.data;
    const s = d.settings;
    return `${head('الطلبات المتاحة', esc(S.user.name))}
    ${adsSlider()}
    ${!d.me.receiving ? `<div class="notice red" style="margin-bottom:12px">استقبال الطلبات متوقف. فعّله من «الملف الشخصي» لتتمكن من قبول الطلبات.</div>` : ''}
    <div class="stack">${d.available.length ? d.available.map((o) => availOrderCard(o, s, d.me.receiving)).join('') : emptyBox('لا توجد طلبات متاحة الآن', 'ستظهر الطلبات الجديدة هنا فور رفعها من التجار.')}</div>`;
  },
  'driver:orders'() {
    const all = S.data.orders;
    const cur = all.filter((o) => ['picking_up', 'on_the_way', 'postponed', 'rejected', 'no_answer', 'return_sent'].includes(o.status));
    const prev = all.filter((o) => !['picking_up', 'on_the_way', 'postponed', 'rejected', 'no_answer', 'return_sent'].includes(o.status));
    const t = S.ordersTab;
    const list = t === 'current' ? cur : prev;
    return `${head('الطلبات')}
    <div class="tabs" style="margin-bottom:14px"><button data-act="otab" data-t="current" aria-pressed="${t === 'current'}">الحالية (${cur.length})</button><button data-act="otab" data-t="prev" aria-pressed="${t === 'prev'}">السابقة (${prev.length})</button></div>
    <div class="stack">${list.length ? list.map(driverOrderCard).join('') : emptyBox(t === 'current' ? 'لا توجد طلبات حالية' : 'لا توجد طلبات سابقة')}</div>`;
  },
  'driver:wallet'() {
    const w = S.data.wallet;
    const s = S.data.settings;
    const per = (l, p) => `<div><small>${l}</small><b>${p.n}</b><small>طلب موصّل</small><hr><b style="font-size:20px">${nf.format(p.net)}</b><small>ربحك (د.ع)</small></div>`;
    const body = w.txs.length ? `<div class="card">${w.txs.map((t) => `<div class="tx"><div><div>${esc(t.label || (t.kind === 'fee' ? 'رسوم التطبيق' : 'عملية'))}${t.orderNo ? ` (طلب #${t.orderNo})` : ''}</div><small class="muted">${ago(t.at)}</small></div><span class="${t.amount < 0 ? 'neg' : 'pos'}">${t.amount < 0 ? '−' : '+'}${money(Math.abs(t.amount))}</span></div>`).join('')}</div>` : emptyBox('لا توجد عمليات بعد');
    return `${head('المحفظة')}
    <div class="stack">
      <div class="balance"><div><small class="muted">رصيدك الحالي</small><strong>${money(w.balance)}</strong></div><span class="ico">${ico('wallet')}</span></div>
      <div class="period">${per('اليوم', w.today)}${per('هذا الأسبوع', w.week)}${per('هذا الشهر', w.month)}</div>
      <p class="hint">كل طلب تقبله يُخصم منه رسوم تطبيق: ${money(s.feeSame)} لتوصيل نفس المنطقة، و${money(s.feeOther)} للمنطقة الثانية.</p>
      <button class="btn" data-act="charge">${ico('card')} شحن الرصيد ببطاقة</button>
      ${body}</div>`;
  },
  'driver:me'() {
    const me = S.data.me;
    const w = S.data.wallet;
    return `${profileHead(me)}
    <div class="card row between" style="margin-bottom:6px"><div><b>تفعيل استقبال الطلبات</b><div class="hint">تظهر لك الطلبات الجديدة</div></div><button class="toggle" role="switch" aria-checked="${me.receiving}" aria-label="استقبال الطلبات" data-act="receiving"></button></div>
    <h2 class="sec">إدارة الحساب</h2>
    ${li('card', 'شحن الرصيد', 'عبّي محفظتك ببطاقة رصيد', 'charge')}
    ${li('user', 'بياناتي', 'الاسم ورقم الهاتف' + (me.vehicle ? ' · ' + vehName(me.vehicle) : ''), 'edit-me')}
    ${li('lock', 'الأمان والخصوصية', 'تحديث كلمة المرور', 'password')}
    ${li('stats', 'إحصائيات الطلبات وتصديرها', `طلباتك المسلّمة اليوم ${w.today.n} وصافي ربحك ${nf.format(w.today.net)} د.ع`, 'tab-wallet')}
    ${accountLinks(S.data.settings)}`;
  }
};

VIEWS['merchant:notifs'] = VIEWS['driver:notifs'] = notifsView;

function li(ic, t, sub, a, extra = '') {
  return `<button class="list-item" data-act="${a}" ${extra}>${ico(ic)}<span class="grow"><b>${t}</b><small>${sub}</small></span><span class="chev">${ico('chev')}</span></button>`;
}
const VSEAL = `<svg class="vb-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l2.4 1.7 2.9-.2 1 2.8 2.5 1.5-.6 2.9 1.2 2.7-2 2.2-.2 2.9-2.9.9L14 21.6 12 23l-2-1.4-2.4-1.5-2.9-.9-.2-2.9-2-2.2 1.2-2.7-.6-2.9 2.5-1.5 1-2.8 2.9.2z" fill="currentColor"/><path d="M8 12.3l2.7 2.7L16.3 9.4" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const vbadge = (u) => (u && u.verified && (u.role === 'driver' || u.role === 'merchant') ? `<span class="vb ${u.role}" title="حساب موثّق">${VSEAL}</span>` : '');
const upImg = (u, px) => (u && u.avatar ? `<img class="pimg" src="${esc(u.avatar)}" alt="" width="${px}" height="${px}" style="width:${px}px;height:${px}px">` : '');
function resizeImage(file, px = 160) {
  return new Promise((ok, no) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = px;
      const ctx = c.getContext('2d'), m = Math.min(img.width, img.height);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, px, px);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error('تعذّر قراءة الصورة')); };
    img.src = url;
  });
}
function profileHead(me) {
  const cam = `<label class="av-cam" aria-label="تغيير الصورة الشخصية"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/></svg><input type="file" accept="image/*" data-chg="avatar"></label>`;
  return `<div style="text-align:center;margin-top:8px"><div class="av-wrap"><div class="avatar ${me.avatar ? 'img' : ''}">${me.avatar ? `<img src="${esc(me.avatar)}" alt="">` : esc((me.name || '؟').trim().charAt(0))}</div>${cam}</div><h1 style="font-size:24px">${esc(me.name)}${vbadge(me)}</h1><p class="muted">${ROLE_NAME[me.role]}${me.verified ? ' · حساب موثّق' : ''}</p>${me.avatar ? '<button class="lg-link" style="font-size:13px" data-act="rm-avatar">حذف الصورة</button>' : ''}</div><div style="height:16px"></div>`;
}
function accountLinks(settings) {
  const sp = settings.support;
  const msg = encodeURIComponent(`مرحباً، أحتاج مساعدة في تطبيق ريو\nالاسم: ${S.user.name}\nالهاتف: ${S.user.phone}`);
  return `<h2 class="sec">المظهر</h2>${RioTheme.picker('data-act')}
  <h2 class="sec">الإشعارات</h2>${notifSetting()}${li('bell', 'كل الإشعارات', 'سجل كامل بالطلبات والمحفظة والمحادثات', 'notifs')}
  <h2 class="sec">الدعم والسياسات</h2>
  ${sp ? `<a class="list-item" href="https://wa.me/${waNumber(sp)}?text=${msg}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${ico('wa')}<span class="grow"><b>التواصل مع الدعم</b><small dir="ltr" style="text-align:right">${esc(fmtPhone(sp))} · واتساب</small></span><span class="chev">${ico('chev')}</span></a>
  <a class="list-item" href="tel:${esc(sp)}" style="color:inherit;text-decoration:none">${ico('support')}<span class="grow"><b>اتصال بالدعم</b><small dir="ltr" style="text-align:right">${esc(fmtPhone(sp))}</small></span><span class="chev">${ico('chev')}</span></a>` : ''}
  <button class="btn ghost block" style="margin-top:8px" data-act="logout">${ico('out')} تسجيل الخروج</button>`;
}
function profileView(me, settings) {
  return `${profileHead(me)}
  <h2 class="sec">إدارة الحساب</h2>
  ${li('user', 'بياناتي', `${esc(fmtPhone(me.phone))}${me.area ? ' · ' + esc(me.area) : ''}`, 'edit-me')}
  ${li('lock', 'الأمان والخصوصية', 'تحديث كلمة المرور', 'password')}
  ${accountLinks(settings)}`;
}

function mapCoords(url) {
  const m = String(url || '').match(/(-?\d{1,3}\.\d{3,})\s*[,%2C]+\s*(-?\d{1,3}\.\d{3,})/i) || String(url || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? [m[1], m[2]] : null;
}
function tplText(key, vars) {
  const T = (S.data && S.data.settings && S.data.settings.templates) || {};
  return String(T[key] || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}
function ordVars(o) {
  const st = (S.data && S.data.settings) || {};
  return { order_no: o.no, status: (ST[o.status] || [o.status])[0], merchant: o.merchantName, merchant_phone: o.merchantPhone, merchant_area: o.merchantArea, customer_phone: o.customerPhone, customer_area: o.customerArea, product: o.product, qty: o.qty, product_price: mny(o.productPrice), delivery_price: mny(o.deliveryPrice), total: mny(o.total), driver: o.driverName || '—', note: o.note || '', app: 'ريوو للتوصيل اسرع', support: st.support || '', date: fmtDT(o.createdAt), name: (S.user && S.user.name) || '', phone: (S.user && S.user.phone) || '' };
}
function supportLink(o) {
  const sp = (S.data && S.data.settings && S.data.settings.support) || '';
  const msg = tplText('driver_support', ordVars(o)) || `مرحباً، أحتاج مساعدة بخصوص الطلب #${o.no}`;
  return `https://wa.me/${waNumber(sp)}?text=${encodeURIComponent(msg)}`;
}

/* ============ المدير ============ */
const userTable = (role) => {
  const users = S.data.users;
  const isD = role === 'driver';
  return `${head(isD ? 'السائقون' : 'التجار', `${users.length} حساب`, `<button class="btn" data-act="add-user" data-role="${role}">${ico('plus')} ${isD ? 'إضافة سائق' : 'إضافة تاجر'}</button>`)}
  ${users.length ? `<div class="tblwrap"><table><thead><tr><th>الاسم</th><th>الهاتف</th><th>${isD ? 'المركبة' : 'المنطقة'}</th>${isD ? '<th>الرصيد</th>' : ''}<th>الحالة</th><th></th></tr></thead><tbody>
  ${users.map((u) => `<tr><td>${upImg(u, 28)} <b>${esc(u.name)}</b>${vbadge(u)}</td><td>${telLink(u.phone)}</td><td>${isD ? vehName(u.vehicle) : esc(u.area)}</td>${isD ? `<td>${money(u.balance)}</td>` : ''}
  <td><button class="pill ${u.active ? 'green' : 'red'}" data-act="toggle-user" data-id="${u.id}">${u.active ? 'فعّال' : 'موقوف'}</button></td>
  <td><div class="row">${isD ? `<button class="btn sm soft" data-act="adjust" data-id="${u.id}">شحن / خصم</button>` : ''}<button class="btn sm ${u.verified ? 'ghost' : 'soft'}" data-act="verify-user" data-id="${u.id}">${u.verified ? 'إلغاء التوثيق' : 'توثيق'}</button><button class="btn sm ghost" data-act="edit-user" data-id="${u.id}">تعديل</button><button class="btn sm danger" data-act="del-user" data-id="${u.id}">حذف</button></div></td></tr>`).join('')}
  </tbody></table></div>` : emptyBox('لا توجد حسابات بعد', 'اضغط الزر أعلاه لإضافة أول حساب.')}`;
};

VIEWS['admin:overview'] = () => {
  const d = S.data;
  const k = (l, v) => `<div class="kpi"><small>${l}</small><strong>${v}</strong></div>`;
  const max = Math.max(1, ...d.days.map((x) => x.n));
  return `${head('نظرة عامة', 'ملخص اليوم')}
  <div class="kpis">${k('طلبات اليوم', num(d.ordersToday))}${k('بانتظار سائق', num(d.pending))}${k('قيد التنفيذ', num(d.active))}${k('سُلّمت اليوم', num(d.deliveredToday))}${k('مشاكل اليوم', num(d.problemsToday))}${k('رسوم التطبيق اليوم', money(d.feesToday))}${k('التجار', num(d.merchants))}${k('السائقون', num(d.drivers))}${k('مجموع أرصدة السائقين', money(d.driverBalances))}</div>
  <h2 class="sec">الطلبات آخر 7 أيام</h2>
  <div class="card"><div class="bars">${d.days.map((x) => `<div><em>${x.n || ''}</em><div class="b" style="height:${Math.max(3, Math.round(x.n / max * 110))}px"></div><span>${DAYS[new Date(x.t + OFF).getUTCDay()]}</span></div>`).join('')}</div></div>
  <h2 class="sec">تحتاج متابعة</h2>
  ${d.attention.length ? ordersTable(d.attention) : emptyBox('كل شيء يسير بشكل جيد', 'لا توجد طلبات متأخرة أو بها مشاكل.')}`;
};

function statusSelect(o) {
  return `<select class="in" style="min-height:38px;padding:6px 10px;min-width:150px" data-chg="admin-status" data-id="${o.id}" aria-label="حالة الطلب ${o.no}">${stKeys(o.status).map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${ST[s][0]}</option>`).join('')}</select>`;
}
function ordersTable(list) {
  return `<div class="stack">${list.map(adminOrderCard).join('')}</div>`;
}

VIEWS['admin:orders'] = () => {
  const list = S.data.orders;
  const chip = (id, l) => `<button class="chip" data-act="afilter" data-f="${id}" aria-pressed="${S.adminFilter === id}">${l}</button>`;
  return `${head('الطلبات', `${list.length} طلب`)}
  <div class="chips">${chip('all', 'الكل')}${stKeys().map((s) => chip(s, ST[s][0])).join('')}</div>
  ${list.length ? ordersTable(list) : emptyBox('لا توجد طلبات بهذه الحالة')}`;
};
VIEWS['admin:merchants'] = () => userTable('merchant');
VIEWS['admin:drivers'] = () => userTable('driver');

VIEWS['admin:cards'] = () => {
  const cards = S.data.cards;
  const free = cards.filter((c) => !c.used);
  const b = S.cardsBatch;
  return `${head('كروت الشحن', `${free.length} غير مستخدم من ${cards.length}`)}
  <form class="card row wrapx" data-form="gen-cards" style="margin-bottom:14px;align-items:flex-end">
    <div class="field grow" style="min-width:150px"><label for="g-amount">قيمة الكرت</label><select class="in" id="g-amount" name="amount">${[5000, 10000, 25000, 50000, 100000].map((v) => `<option value="${v}" ${v === 10000 ? 'selected' : ''}>${nf.format(v)} د.ع</option>`).join('')}</select></div>
    <div class="field" style="width:110px"><label for="g-count">العدد</label><input class="in" id="g-count" name="count" type="number" min="1" max="50" value="5" inputmode="numeric"></div>
    <button class="btn" type="submit">توليد كروت</button></form>
  ${b ? `<div class="card" style="margin-bottom:14px"><div class="row between wrapx"><b>الكروت الجديدة (${b.length})</b><button class="btn sm soft" data-act="copy" data-text="${esc(b.join('\n'))}">${ico('copy')} نسخ الكل</button></div><div class="mono" style="margin-top:8px;line-height:2">${b.map((n) => esc(n.replace(/(\d{4})(?=\d)/g, '$1 '))).join('<br>')}</div></div>` : ''}
  ${cards.length ? `<div class="tblwrap"><table><thead><tr><th>رقم الكرت</th><th>القيمة</th><th>الحالة</th><th>استخدمه</th><th></th></tr></thead><tbody>
  ${cards.map((c) => `<tr><td><span class="mono">${esc(c.number.replace(/(\d{4})(?=\d)/g, '$1 '))}</span></td><td>${money(c.amount)}</td><td><span class="pill ${c.used ? '' : 'green'}">${c.used ? 'مستخدم' : 'متاح'}</span></td><td>${c.used ? `${esc(c.usedBy)}<div class="hint">${dt(c.usedAt)}</div>` : '—'}</td>
  <td>${c.used ? '' : `<div class="row"><button class="btn sm ghost" data-act="copy" data-text="${esc(c.number)}">نسخ</button><button class="btn sm danger" data-act="del-card" data-n="${c.number}" aria-label="حذف الكرت">${ico('trash')}</button></div>`}</td></tr>`).join('')}
  </tbody></table></div>` : emptyBox('لا توجد كروت', 'ولّد أول مجموعة كروت من النموذج أعلاه.')}`;
};

VIEWS['admin:settings'] = () => {
  const s = S.data.settings;
  const f = (k, l) => `<div class="field"><label for="s-${k}">${l}</label><input class="in" id="s-${k}" name="${k}" inputmode="numeric" value="${s[k]}"></div>`;
  return `${head('الإعدادات', 'الأسعار بالدينار العراقي')}
  <form class="stack" data-form="settings">
    <div class="card stack"><h2 style="font-size:18px">أسعار التوصيل للزبون</h2>
      <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${f('bikeSame', 'دراجة · نفس المنطقة')}${f('bikeOther', 'دراجة · منطقة ثانية')}${f('carSame', 'سيارة · نفس المنطقة')}${f('carOther', 'سيارة · منطقة ثانية')}</div></div>
    <div class="card stack"><h2 style="font-size:18px">رسوم التطبيق على السائق</h2><p class="hint">تُخصم من محفظة السائق عند قبول كل طلب.</p>
      <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${f('feeSame', 'نفس المنطقة')}${f('feeOther', 'منطقة ثانية')}</div></div>
    <div class="card stack"><h2 style="font-size:18px">الوصولات</h2><label class="row" style="gap:10px;align-items:center;cursor:pointer"><input type="checkbox" id="s-receipts" name="receipts" ${s.receipts !== 0 ? 'checked' : ''} style="width:22px;height:22px"><span><b>تفعيل الوصولات</b><span class="hint" style="display:block">عند الإيقاف يختفي زر «وصل» من حسابات التجار والسائقين. تبقى متاحة لك كمدير.</span></span></label></div>
    <div class="card stack"><h2 style="font-size:18px">الدعم</h2><div class="field"><label for="s-support">رقم الدعم (يظهر للتجار والسائقين)</label><input class="in mono" id="s-support" name="support" inputmode="tel" value="${esc(s.support)}" placeholder="07XX XXX XXXX"></div></div>
    <button class="btn" type="submit" style="align-self:flex-start">حفظ الإعدادات</button></form>
  <h2 class="sec">المظهر</h2>${RioTheme.picker('data-act')}
  ${ocDesignPicker()}
  <button class="btn ghost block" style="margin-top:16px" data-act="logout">${ico('out')} تسجيل الخروج</button>`;
};

/* ============ وصل الطلب: معاينة / طباعة / صورة / واتساب ============ */
const mny = (n) => `${nf.format(Math.round(n || 0))} د.ع`;
const pad2 = (n) => String(n).padStart(2, '0');
function fmtDT(t) {
  const d = new Date(t + OFF);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
let ONE = null; // آخر طلب فُتح من إشعار
function findOrder(id) {
  const d = S.data || {};
  return (d.orders || []).find((x) => x.id === id) || (d.attention || []).find((x) => x.id === id) || (d.available || []).find((x) => x.id === id) || (ONE && ONE.id === id ? ONE : null);
}
/* عند الدخول على إشعار طلب: يظهر الطلب المقصود فقط (وليس قائمة كل الطلبات) */
async function openOrderOnly(id, no) {
  id = Number(id); if (!id || !S.user) return;
  openSheet({ type: 'order-one', id, no: no || id, o: null, loading: true, err: '' });
  try {
    const r = await api('GET', '/api/orders/' + id);
    ONE = r.order;
    if (S.sheet && S.sheet.type === 'order-one' && S.sheet.id === id) { S.sheet.o = r.order; S.sheet.loading = false; render(); }
  } catch (e) {
    if (S.sheet && S.sheet.type === 'order-one' && S.sheet.id === id) { S.sheet.loading = false; S.sheet.err = e.message || 'تعذّر فتح الطلب'; render(); }
  }
}
function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('964')) return d;
  if (d.startsWith('0')) return '964' + d.slice(1);
  return d;
}
function waLink(o) {
  const msg = tplText('cust_' + o.status, ordVars(o)) || tplText('cust_default', ordVars(o)) || `مرحباً، بخصوص طلبك رقم #${o.no} من ${o.merchantName}
المبلغ المطلوب: ${mny(o.total)}`;
  return `https://wa.me/${waNumber(o.customerPhone)}?text=${encodeURIComponent(msg)}`;
}
function receiptModel(o) {
  return {
    title: 'وصل توصيل', no: o.no,
    sections: [
      { rows: [['التاريخ', fmtDT(o.createdAt)], ['الحالة', (ST[o.status] || [o.status])[0]], ['التاجر', o.merchantName]] },
      { rows: [['رقم الزبون', o.customerPhone], ['المنطقة', o.customerArea]] },
      { rows: [['البضاعة', o.product], ['عدد القطع', String(o.qty)]] },
      { box: ['المبلغ المطلوب', mny(o.total)] },
      { rows: [['أجرة التوصيل', mny(o.deliveryPrice)], ['الصافي للتاجر', mny(o.productPrice)]] },
      { rows: [['المندوب', o.driverName || '—']] }
    ]
  };
}
const receiptHtml = (o) => modelHtml(receiptModel(o));
function modelHtml(m) {
  const body = m.sections.map((sec, i) => {
    const inner = sec.box
      ? `<div class="box"><span>${esc(sec.box[0])}</span><span dir="ltr">${esc(sec.box[1])}</span></div>`
      : sec.rows.map(([l, v]) => `<div class="r"><b>${esc(l)}</b><span dir="auto">${esc(v)}</span></div>`).join('');
    const nextIsBox = m.sections[i + 1] && m.sections[i + 1].box;
    return inner + (i < m.sections.length - 1 && !sec.box && !nextIsBox ? '<hr>' : '');
  }).join('');
  return `<div class="rcpt sz${RSIZE}">${RIO_MARK}<h3>ريوو للتوصيل اسرع</h3>${m.heading ? `<h3 class="rh">${esc(m.heading)}</h3>` : ''}<div class="ttl">${esc(m.title)}</div>${m.no ? `<div class="no">#${esc(m.no)}</div>` : '<div style="height:10px"></div>'}${body}</div>`;
}
const receiptCanvas = (o) => modelCanvas(receiptModel(o));
async function modelCanvas(m) {
  try { await document.fonts.load('900 60px Cairo'); await document.fonts.load('700 24px Cairo'); await document.fonts.load('500 22px "IBM Plex Sans Arabic"'); } catch { /* ignore */ }
  const W = 640, SC = 2, PAD = 30, ROW = 54;
  let H = 360 + (m.heading ? 48 : 0) - (m.no ? 0 : 48);
  m.sections.forEach((sec) => { H += sec.box ? 96 : sec.rows.length * ROW + 26; });
  H += 40;
  const OUT = RSIZES[RSIZE][1], K = OUT / W;
  const c = document.createElement('canvas');
  c.width = Math.round(OUT * SC); c.height = Math.round(H * K * SC);
  const x = c.getContext('2d');
  x.scale(SC * K, SC * K);
  const FF = 'Cairo, "IBM Plex Sans Arabic", Tahoma, sans-serif';
  const rr = (px, py, w, h, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.direction = 'rtl'; x.textBaseline = 'middle'; x.fillStyle = '#111';
  let y = 28;
  { // الشعار: خلفية صفراء + كلمة ريو + خطوط السرعة
    const lw = 240, lh = 152, lx = W / 2 - lw / 2;
    x.fillStyle = '#ffd21f'; rr(lx, y, lw, lh, 24); x.fill();
    x.fillStyle = '#171200';
    [[0.69, 0.30, 0.24], [0.72, 0.45, 0.2], [0.69, 0.60, 0.24]].forEach(([fx, fy, fw]) => { rr(lx + lw * fx, y + lh * fy - 5, lw * fw, 10, 5); x.fill(); });
    x.textAlign = 'center'; x.font = `900 78px ${FF}`; x.fillText('ريوو', lx + lw * 0.37, y + lh * 0.50);
    x.fillStyle = '#5c4d00'; x.font = `700 18px ${FF}`; x.fillText('للتوصيل أسرع', lx + lw * 0.35, y + lh * 0.88);
    x.fillStyle = '#111';
  }
  y += lh0() + 24;
  x.textAlign = 'center'; x.font = `800 30px ${FF}`; x.fillText('ريوو للتوصيل اسرع', W / 2, y);
  y += m.heading ? 40 : 38;
  if (m.heading) { x.font = `800 26px ${FF}`; x.fillText(m.heading, W / 2, y, W - 2 * PAD); y += 44; }
  x.lineWidth = 3; x.strokeStyle = '#111'; rr(PAD - 6, y, W - 2 * PAD + 12, 56, 16); x.stroke();
  x.font = `800 24px ${FF}`; x.fillText(m.title, W / 2, y + 29);
  y += 92;
  if (m.no) { x.font = `800 30px ${FF}`; x.fillText(`#${m.no}`, W / 2, y); y += 38; } else y -= 10;
  m.sections.forEach((sec, i) => {
    if (sec.box) {
      x.lineWidth = 3; rr(PAD - 6, y, W - 2 * PAD + 12, 72, 16); x.stroke();
      x.font = `800 26px ${FF}`; x.textAlign = 'right'; x.fillText(sec.box[0], W - PAD - 8, y + 37);
      x.textAlign = 'left'; x.fillText(sec.box[1], PAD + 8, y + 37);
      y += 96;
    } else {
      sec.rows.forEach(([l, v]) => {
        x.font = `800 23px ${FF}`; x.textAlign = 'right'; x.fillText(l, W - PAD, y + ROW / 2);
        const lw = x.measureText(l).width;
        x.font = `500 23px ${FF}`; x.textAlign = 'left'; x.fillText(v, PAD, y + ROW / 2, W - 2 * PAD - lw - 20);
        y += ROW;
      });
      const nextIsBox = m.sections[i + 1] && m.sections[i + 1].box;
      if (i < m.sections.length - 1 && !nextIsBox) {
        x.setLineDash([8, 6]); x.lineWidth = 1.5; x.strokeStyle = '#888';
        x.beginPath(); x.moveTo(PAD, y + 10); x.lineTo(W - PAD, y + 10); x.stroke(); x.setLineDash([]); x.strokeStyle = '#111';
      }
      y += 26;
    }
  });
  return c;
}
const lh0 = () => 152;
function canvasBlob(c) { return new Promise((res) => c.toBlob(res, 'image/png')); }
async function saveBlob(b, name) {
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    try {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(b); });
      await capPlugin('Filesystem').writeFile({ path: 'Rio/' + name, data, directory: 'DOCUMENTS', recursive: true });
      toast('تم حفظ الصورة في المستندات ← Rio');
      return;
    } catch { /* نكمل بالتنزيل العادي */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function downloadModel(m, name) {
  const b = await canvasBlob(await modelCanvas(m));
  if (b) { await saveBlob(b, name); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function shareModel(m, name, title) {
  try {
    const b = await canvasBlob(await modelCanvas(m));
    const file = new File([b], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title });
    else await downloadModel(m, name);
  } catch { /* أُلغيت المشاركة */ }
}
function printModel(m) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = modelHtml(m);
  let ps = document.getElementById('page-style');
  if (!ps) { ps = document.createElement('style'); ps.id = 'page-style'; document.head.appendChild(ps); }
  ps.textContent = `@page{size:${RSIZES[RSIZE][2]};margin:${RSIZES[RSIZE][3]}}`;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
}
const downloadReceipt = (o) => downloadModel(receiptModel(o), `rio-receipt-${o.no}.png`);
const shareReceipt = (o) => shareModel(receiptModel(o), `rio-receipt-${o.no}.png`, `وصل #${o.no}`);
const printReceipt = (o) => printModel(receiptModel(o));

/* ============ التقارير والتصدير (Excel / Word / وصل مختصر) ============ */
const RANGES = [['today', 'اليوم'], ['week', 'آخر 7 أيام'], ['month', 'هذا الشهر'], ['all', 'الكل']];
const DONE_ST = ['delivered', 'partial'];
const sumK = (a, k) => a.reduce((t, o) => t + (Number(o[k]) || 0), 0);
function rangeBounds(k) {
  const n = Date.now(), ds = Math.floor((n + OFF) / 86400000) * 86400000 - OFF, d = new Date(n + OFF);
  if (k === 'today') return [ds, ds + 86400000];
  if (k === 'week') return [ds - 6 * 86400000, ds + 86400000];
  if (k === 'month') return [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFF, ds + 86400000];
  return [0, ds + 86400000];
}
function periodText(k) { const [a, b] = rangeBounds(k); return k === 'all' ? 'كل الفترات' : `${fmtDT(a).slice(0, 10)} → ${fmtDT(b - 1).slice(0, 10)}`; }
const kfmt = (k) => (k[2] === 'money' ? mny(k[1]) : String(k[1]));

function merchantReport(orders, rk) {
  const list = orders.filter((o) => o.status !== 'cancelled');
  const counted = list.filter((o) => DONE_ST.includes(o.status) || o.status === 'returned');
  const ret = counted.filter((o) => o.status === 'returned');
  const ok = counted.filter((o) => o.status !== 'returned');
  const gross = sumK(counted, 'total'), retAmt = sumK(ret, 'total'), net = gross - retAmt, delivery = sumK(ok, 'deliveryPrice'), due = net - delivery;
  const open = list.length - counted.length;
  const rows = list.map((o) => {
    const isRet = o.status === 'returned', isOk = DONE_ST.includes(o.status);
    return [o.no, fmtDT(o.createdAt), (ST[o.status] || [o.status])[0], o.customerArea, `${o.product} × ${o.qty}`, o.productPrice, o.deliveryPrice, o.total, isRet ? o.total : isOk ? 0 : '', isOk ? o.total : isRet ? 0 : ''];
  });
  const kpis = [
    ['عدد الطلبات المنتهية (مسلّم + راجع)', counted.length, 'n'], ['الإجمالي الكلي', gross, 'money'], [`الراجع (${ret.length} طلب)`, retAmt, 'money'],
    ['الصافي بعد خصم الراجع', net, 'money'], ['كلف التوصيل', delivery, 'money'], ['المستحق للتاجر (الصافي − كلف التوصيل)', due, 'money']
  ];
  if (open) kpis.push(['طلبات غير محتسبة (قيد التنفيذ / مشاكل)', open, 'n']);
  const m = {
    title: 'وصل ملخص الطلبات', heading: S.user.name,
    sections: [
      { rows: [['الفترة', periodText(rk)], ['التاريخ', fmtDT(Date.now())]] },
      { rows: [['عدد الطلبات', String(counted.length)], ['منها راجع', String(ret.length)]] },
      { rows: [['الإجمالي الكلي', mny(gross)], ['الراجع', '−' + mny(retAmt)]] },
      { rows: [['الصافي', mny(net)], ['كلف التوصيل', '−' + mny(delivery)]] },
      { box: ['المستحق للتاجر', mny(due)] }
    ]
  };
  return {
    kind: 'merchant', title: 'كشف حساب الطلبات', owner: S.user.name, period: periodText(rk), kpis, receipt: m,
    head: ['#', 'التاريخ', 'الحالة', 'المنطقة', 'المنتج', 'سعر المنتج', 'التوصيل', 'الإجمالي', 'الراجع', 'الصافي'], rows,
    foot: ['', '', '', '', 'المجموع (للمنتهي)', sumK(counted, 'productPrice'), sumK(counted, 'deliveryPrice'), gross, retAmt, net],
    note: 'الراجع يُخصم من الإجمالي الكلي. الراجع الجزئي يُحتسب كطلب مسلّم. الطلبات غير المنتهية تظهر في الجدول ولا تدخل في المجاميع.'
  };
}

function driverReport(orders, rk) {
  const done = orders.filter((o) => DONE_ST.includes(o.status));
  const collected = sumK(done, 'total'), paid = sumK(done, 'productPrice'), deliv = sumK(done, 'deliveryPrice'), fees = sumK(done, 'fee'), profit = deliv - fees;
  const rows = orders.map((o) => {
    const d = DONE_ST.includes(o.status);
    return [o.no, fmtDT(o.acceptedAt || o.createdAt), (ST[o.status] || [o.status])[0], o.merchantName, o.customerArea, d ? o.total : '', d ? o.productPrice : '', d ? o.deliveryPrice : '', d ? o.fee : '', d ? o.deliveryPrice - o.fee : ''];
  });
  const kpis = [
    ['عدد الطلبات المسلّمة', done.length, 'n'], ['المحصّل من الزبائن', collected, 'money'], ['المدفوع للتجار', paid, 'money'], ['أجور التوصيل', deliv, 'money'],
    ['عمولة التطبيق', fees, 'money'], ['ربحك الصافي (التوصيل − العمولة)', profit, 'money'], ['المستحق للشركة (عمولة التطبيق)', fees, 'money']
  ];
  const m = {
    title: 'وصل ملخص السائق', heading: S.user.name,
    sections: [
      { rows: [['الفترة', periodText(rk)], ['التاريخ', fmtDT(Date.now())]] },
      { rows: [['الطلبات المسلّمة', String(done.length)], ['المحصّل من الزبائن', mny(collected)], ['المدفوع للتجار', mny(paid)]] },
      { rows: [['أجور التوصيل', mny(deliv)], ['عمولة التطبيق', '−' + mny(fees)]] },
      { box: ['ربحك الصافي', mny(profit)] },
      { rows: [['المستحق للشركة', mny(fees)], ['حالة الدفع', 'مخصوم من المحفظة']] }
    ]
  };
  return {
    kind: 'driver', title: 'كشف إحصائيات السائق', owner: S.user.name, period: periodText(rk), kpis, receipt: m,
    head: ['#', 'التاريخ', 'الحالة', 'المتجر', 'المنطقة', 'تحصيل من الزبون', 'دفعت للتاجر', 'التوصيل', 'عمولة التطبيق', 'ربحك'], rows,
    foot: ['', '', '', '', 'المجموع (المسلّم)', collected, paid, deliv, fees, profit],
    note: 'عمولة التطبيق تُخصم من محفظتك تلقائياً عند قبول الطلب. المجاميع تشمل الطلبات المسلّمة فقط.'
  };
}

async function buildReport() {
  const [from, to] = rangeBounds(S.expRange);
  const isDriver = S.user.role === 'driver';
  const r = await api('GET', `/api/${isDriver ? 'driver' : 'merchant'}/report?from=${from}&to=${to}`);
  return isDriver ? driverReport(r.orders, S.expRange) : merchantReport(r.orders, S.expRange);
}

let libP = null;
function loadLib() {
  if (window.RL) return Promise.resolve(window.RL);
  if (libP) return libP;
  libP = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'admin-lib.js';
    sc.onload = () => res(window.RL);
    sc.onerror = () => { libP = null; rej(new Error('تعذّر تحميل أدوات التصدير، تحقق من الاتصال')); };
    document.head.appendChild(sc);
  });
  return libP;
}
const stampName = (rep) => `ريو-${rep.kind === 'driver' ? 'سائق' : 'تاجر'}-${fmtDT(Date.now()).slice(0, 10)}`;
function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
async function exportReportXlsx(rep) {
  const RL = await loadLib();
  const rows = [['ريوو للتوصيل اسرع'], [`${rep.title} — ${rep.owner}`], ['الفترة', rep.period], [], rep.head, ...rep.rows, rep.foot, [], ['الملخص'], ...rep.kpis.map((k) => [k[0], k[1]]), [], [rep.note]];
  await RL.exportXlsx(stampName(rep), [{ name: 'التقرير', rows }]);
}
function reportWordHtml(rep) {
  const td = (v, n) => `<td${n ? ' style="text-align:left;direction:ltr"' : ''}>${esc(typeof v === 'number' ? nf.format(v) : v)}</td>`;
  const numCol = (i) => i >= 5;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(rep.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page{size:A4 landscape;margin:1.2cm}body{font-family:Cairo,Tahoma,Arial,sans-serif;direction:rtl;font-size:11pt}h1{font-size:20pt;margin:0}h2{font-size:13pt;border-right:6px solid #ffd21f;padding-right:8px}table{border-collapse:collapse;width:100%;margin-bottom:12px}th{background:#111;color:#fff;padding:5px 7px;text-align:right}td{border:1px solid #bbb;padding:4px 7px}.k td{font-weight:bold}.hi td{background:#ffd21f;font-weight:bold}.t td{background:#fff3b0;font-weight:bold}</style></head><body dir="rtl">
<h1>ريوو للتوصيل اسرع</h1><h2>${esc(rep.title)} — ${esc(rep.owner)}</h2><p>الفترة: ${esc(rep.period)} &nbsp;|&nbsp; تاريخ الإصدار: ${esc(fmtDT(Date.now()))}</p>
<table><tbody>${rep.kpis.map((k, i) => `<tr class="${i === rep.kpis.length - 1 || /الصافي|المستحق/.test(k[0]) ? 'hi' : 'k'}"><td>${esc(k[0])}</td><td style="text-align:left;direction:ltr">${esc(kfmt(k))}</td></tr>`).join('')}</tbody></table>
<h2>تفاصيل الطلبات</h2><table><thead><tr>${rep.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rep.rows.map((r) => `<tr>${r.map((c, i) => td(c, numCol(i) || i === 0)).join('')}</tr>`).join('')}</tbody><tfoot><tr class="t">${rep.foot.map((c, i) => td(c, numCol(i))).join('')}</tr></tfoot></table>
<p style="color:#555">${esc(rep.note)}</p></body></html>`;
}
function exportReportWord(rep) { saveBlob(new Blob(['\ufeff', reportWordHtml(rep)], { type: 'application/msword' }), stampName(rep) + '.doc'); }

function exportCard(title, hint) {
  const chips = RANGES.map(([k, l]) => `<button class="chip" data-act="exp-range" data-k="${k}" aria-pressed="${S.expRange === k}">${l}</button>`).join('');
  return `<h2 class="sec">${title}</h2><div class="card stack"><div class="lbl">الفترة</div><div class="chips" style="margin:0">${chips}</div>
  <div class="row wrapx"><button class="btn ghost grow" data-act="exp-xlsx">${ico('dl')} Excel</button><button class="btn ghost grow" data-act="exp-word">${ico('dl')} Word</button>${receiptsOn() ? '<button class="btn grow" data-act="exp-receipt">وصل مختصر</button>' : ''}</div>
  <p class="hint">${hint}</p></div>`;
}

/* ============ الإشعارات: قائمة كاملة من الخادم + دفع للهاتف ============ */
/* Capacitor يُحمَّل هنا بدون حزمة JS، فلا توجد registerPlugin: نستخدم كائن Plugins الذي يحقنه الجسر الأصلي */
function capPlugin(name) {
  const c = window.Capacitor || {};
  if (typeof c.registerPlugin === 'function') return c.registerPlugin(name);
  if (c.Plugins && c.Plugins[name]) return c.Plugins[name];
  throw new Error('إضافة ' + name + ' غير متاحة (نفّذ npx cap sync android وأعد البناء)');
}
let nBusy = false, audioCtx = null, notifReg = null;
const nKey = (k) => `rio_${k}_${S.user ? S.user.id : 0}`;
const isNative = () => { const c = window.Capacitor; return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform()); };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
// الآيفون لا يسمح بالإشعارات إلا للتطبيق المُثبَّت على الشاشة الرئيسية (iOS 16.4 فأحدث)
const needsIosInstall = () => !isNative() && isIOS() && !isStandalone();
const IOS_HELP = 'على الآيفون: اضغط زر المشاركة ⬆︎ في Safari ← «إضافة إلى الشاشة الرئيسية» ← افتح ريو من الأيقونة الجديدة ← اسمح بالإشعارات';
const unreadCount = () => (S.user && S.user.role !== 'admin' ? S.unread || 0 : 0);
function updateBell() {
  const b = $('#bell-n'); if (!b) return;
  const n = unreadCount(); b.textContent = n > 99 ? '99+' : n; b.hidden = !n;
}
function setUnread(n) { S.unread = Number(n) || 0; updateBell(); }
async function markServerRead(body) {
  try { const r = await api('POST', '/api/notifs/read', body); setUnread(r.unread); } catch { /* ignore */ }
}
function markChatRead(orderId) { return markServerRead({ orderId }); }
function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* ignore */ }
}
function beep() {
  try {
    unlockAudio();
    if (audioCtx) {
      const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 988;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.5);
    }
    if (navigator.vibrate) navigator.vibrate(200);
  } catch { /* ignore */ }
}
function whenActive(reg) {
  return new Promise((res) => {
    if (reg.active) return res(reg);
    const sw = reg.installing || reg.waiting;
    if (!sw) return res(null);
    sw.addEventListener('statechange', () => { if (sw.state === 'activated') res(reg); });
    setTimeout(() => res(reg.active ? reg : null), 4000);
  });
}
/* احتياط: إشعار نظام محلي إذا لم يتوفر الدفع الحقيقي (التطبيق في الخلفية فقط) */
async function notifyReg() {
  if (notifReg) return notifReg;
  if (!('serviceWorker' in navigator)) return null;
  try { const reg = await navigator.serviceWorker.register('notify-sw.js', { scope: './__notify/' }); notifReg = await whenActive(reg); return notifReg; } catch { return null; }
}
async function systemNotify(m) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || nOff()) return;
  const data = { kind: m.kind, orderId: m.orderId, orderNo: m.orderNo, id: m.id };
  const opts = { body: m.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'rio-' + m.id, renotify: true, requireInteraction: m.kind === 'order_new', vibrate: [250, 100, 250], dir: 'rtl', lang: 'ar', data };
  try {
    const reg = await notifyReg();
    if (reg) { await reg.showNotification(m.title, opts); return; }
    const n = new Notification(m.title, opts);
    n.onclick = () => { window.focus(); handleNotifTap(data); n.close(); };
  } catch { /* بعض المتصفحات لا تدعم الإشعارات */ }
}
async function checkNotifs() {
  if (!S.user || !['merchant', 'driver'].includes(S.user.role) || nBusy) return;
  nBusy = true;
  try {
    const last = store.get(nKey('nlast2'));
    const r = await api('GET', last !== null ? `/api/notifs?after=${last}` : '/api/notifs?mode=poll');
    store.set(nKey('nlast2'), String(r.last));
    setUnread(r.unread);
    if (!r.items.length) return;
    const openId = S.sheet && S.sheet.type === 'chat' && !document.hidden ? S.sheet.id : null;
    const seen = r.items.filter((m) => m.kind === 'chat' && m.orderId === openId);
    if (seen.length) markChatRead(openId);
    const fresh = r.items.filter((m) => !seen.includes(m));
    if (S.tab === 'notifs' && !document.hidden) refresh();
    if (!fresh.length) return;
    const m = fresh[fresh.length - 1];
    if (!S.pushOn) fresh.slice(-3).forEach(systemNotify); // بديل الدفع: يظهر في لوحة إشعارات الجهاز فوراً
    if (!document.hidden) { beep(); toast(m.title); }
  } catch { /* ignore */ } finally { nBusy = false; }
}

/* تنقّل عند الضغط على إشعار (من القائمة أو من إشعار النظام) */
function handleNotifTap(d) {
  if (!S.user || !d) return;
  const kind = String(d.kind || ''), id = Number(d.orderId) || 0;
  if (d.id) markServerRead({ ids: [Number(d.id)] });
  S.sheet = null;
  if (kind === 'chat' && id) return openChatFor(id, d.orderNo);
  const driver = S.user.role === 'driver';
  if (kind.startsWith('wallet')) return go(driver ? 'wallet' : 'notifs');
  if (kind.startsWith('order') && id) return openOrderOnly(id, d.orderNo);
  if (kind === 'order_new') return go(driver ? 'home' : 'orders');
  if (kind.startsWith('order')) { if (driver) S.ordersTab = 'current'; return go('orders'); }
  return go('notifs');
}
function openChatFor(id, no) {
  id = Number(id); if (!id || !S.user) return;
  markChatRead(id);
  S.sheet = null;
  openSheet({ type: 'chat', id, no: no || id, msgs: [], loaded: false });
  startChat();
}
function openPendingChat() {
  try {
    const p = new URLSearchParams(location.search);
    const kind = p.get('open') || (p.get('chat') ? 'chat' : '');
    if (!kind) return;
    const id = p.get('id') || p.get('chat'), no = p.get('no');
    history.replaceState(null, '', location.pathname + location.hash);
    handleNotifTap({ kind, orderId: id, orderNo: no, id: p.get('nid') });
  } catch { /* ignore */ }
}

/* ---- صفحة الإشعارات ---- */
const NK = { chat: ['chat', 'blue'], order_new: ['orders', 'accent'], order_accepted: ['check', 'green'], order_assigned: ['orders', 'accent'], order_status: ['orders', 'amber'], order_returned: ['x', 'red'], wallet_credit: ['wallet', 'green'], wallet_debit: ['wallet', 'red'] };
function notifsView() {
  const d = S.data, items = d.items || [];
  const tools = `<div class="nt-tools"><button class="btn ghost sm" data-act="notif-readall" ${d.unread ? '' : 'disabled'}>${ico('check')} تحديد الكل كمقروء</button><button class="btn danger sm" data-act="notif-clear" ${items.length ? '' : 'disabled'}>${ico('trash')} مسح الكل</button></div>`;
  const list = items.map((n) => { const [ic, c] = NK[n.kind] || ['bell', '']; return `<button class="nt ${n.read ? '' : 'unread'}" data-act="open-notif" data-id="${n.id}" data-kind="${n.kind}" data-order="${n.orderId || ''}" data-no="${n.orderNo || ''}"><span class="nt-ic ${c}">${ico(ic)}</span><span class="nt-b"><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<small>${ago(n.at)} · ${dt(n.at)}</small></span>${n.read ? '' : '<span class="dot" aria-label="جديد"></span>'}</button>`; }).join('');
  return `${head('الإشعارات', d.unread ? `${d.unread} غير مقروء` : 'كل شيء مقروء', `<button class="btn ghost sm" data-act="notif-back">${ico('chev')} رجوع</button>`)}${tools}
  ${items.length ? `<div class="nt-list">${list}</div>${d.hasMore ? '<button class="btn ghost block" style="margin-top:12px" data-act="notif-more">عرض المزيد</button>' : ''}` : emptyBox('لا توجد إشعارات بعد', 'ستظهر هنا الطلبات الجديدة وقبولها ورفضها وإرجاعها وعمليات المحفظة والمحادثات.')}`;
}

/* ---- الدفع للهاتف: يصل حتى والتطبيق مغلق ---- */
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const key64 = (b64) => { const pad = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
const webPushOk = () => !isNative() && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
async function ensureWebPush() {
  if (!webPushOk() || Notification.permission !== 'granted' || nOff() || !S.user || ADMIN_ONLY) return false;
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 5000);
    const k = await api('GET', '/api/push/key');
    if (!k.key) return false;
    let sub = await reg.pushManager.getSubscription();
    if (sub && store.get('rio_push_key') !== k.key) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key64(k.key) });
    store.set('rio_push_key', k.key);
    await api('POST', '/api/push/subscribe', { type: 'web', subscription: sub.toJSON() });
    S.pushOn = true; return true;
  } catch { return false; }
}
let nativeBound = false;
async function refreshNativePerm() {
  if (!isNative()) return;
  try { const r = await capPlugin('PushNotifications').checkPermissions(); S.nperm = r.receive || ''; } catch { /* ignore */ }
}
async function ensureNativePush() {
  if (!isNative() || !S.user) return false;
  try {
    const PN = capPlugin('PushNotifications');
    const LN = capPlugin('LocalNotifications');
    // 1) الإذن أولاً: يظهر نافذة النظام فور الدخول دون أي خطوة قبلها يمكن أن تفشل
    const perm = await PN.requestPermissions();
    S.nperm = perm.receive || '';
    S.nerr = '';
    updateNBanner();
    if (perm.receive !== 'granted') return false;
    // 2) قناة عالية الأهمية: يظهر الإشعار منبثقاً مع صوت واهتزاز فور وصوله
    try { await PN.createChannel({ id: 'rio_orders', name: 'الطلبات وتغيّر حالاتها', description: 'إشعارات فورية بالطلبات الجديدة وتغيّر حالتها', importance: 5, visibility: 1, vibration: true, lights: true }); } catch { /* ignore */ }
    // 3) المستمعات (مرة واحدة)
    if (!nativeBound) {
      nativeBound = true;
      try { await PN.addListener('registration', async (t) => { store.set('rio_fcm', t.value); try { await api('POST', '/api/push/subscribe', { type: 'fcm', token: t.value }); store.set('rio_native_push', '1'); S.pushOn = true; updateNBanner(); if (S.tab === 'me' && !S.sheet) render(); } catch { /* ignore */ } }); } catch { /* ignore */ }
      try { await PN.addListener('registrationError', (e) => { store.del('rio_native_push'); S.nerr = 'تعذّر التسجيل في Firebase: ' + ((e && e.error) || 'تأكد من ملف google-services.json'); }); } catch { /* ignore */ }
      try { await PN.addListener('pushNotificationActionPerformed', (a) => { const d = (a.notification && a.notification.data) || {}; handleNotifTap({ kind: d.kind, orderId: d.orderId, orderNo: d.orderNo, id: d.id }); }); } catch { /* ignore */ }
      // التطبيق مفتوح: أندرويد لا يعرض إشعار الدفع وحده، فنعرضه في لوحة الإشعارات يدوياً
      try {
        await PN.addListener('pushNotificationReceived', async (n) => {
          const d = n.data || {};
          beep();
          try { await LN.schedule({ notifications: [{ id: (Number(d.id) || Date.now()) % 2147483000, title: n.title || d.title || 'ريوو للتوصيل اسرع', body: n.body || d.body || '', channelId: 'rio_orders', extra: d }] }); } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
      try { await LN.addListener('localNotificationActionPerformed', (a) => { const d = (a.notification && a.notification.extra) || {}; handleNotifTap({ kind: d.kind, orderId: d.orderId, orderNo: d.orderNo, id: d.id }); }); } catch { /* ignore */ }
    }
    try { await LN.requestPermissions(); } catch { /* ignore */ }
    // بدون google-services.json المطابق يتعطل أندرويد عند register() فلا نستدعيه
    if (window.RIO_FCM === false) { S.nerr = 'إشعارات التطبيق المغلق غير مفعّلة (ملف Firebase غير مضاف)'; updateNBanner(); return false; }
    await PN.register();
    return true;
  } catch (e) {
    S.nerr = 'تعذّر تفعيل الإشعارات: ' + ((e && e.message) || e);
    updateNBanner();
    return false;
  }
}
const ensurePush = () => (isNative() ? ensureNativePush() : ensureWebPush());
async function unsubscribePush() {
  try {
    if (isNative()) { const t = store.get('rio_fcm'); if (t) await api('POST', '/api/push/unsubscribe', { token: t }); store.del('rio_native_push'); }
    else if (webPushOk()) { const reg = await withTimeout(navigator.serviceWorker.ready, 1500); const sub = await reg.pushManager.getSubscription(); if (sub) await api('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint }); }
  } catch { /* ignore */ }
  S.pushOn = false;
}
async function doLogout() {
  if (S.user && S.user.role !== 'admin') { try { await withTimeout(unsubscribePush(), 2500); } catch { /* ignore */ } }
  logout();
}
/* ---- حالة الإذن + طلبه فور الدخول ---- */
const nOff = () => store.get(nKey('notif_off')) === '1';
let entryAsked = false, clickAsked = false;
function notifState() {
  if (isNative()) return nOff() ? 'off' : S.nperm === 'granted' ? 'on' : S.nperm === 'denied' ? 'blocked' : 'ask';
  if (needsIosInstall()) return 'ios';
  if (typeof Notification === 'undefined') return 'na';
  const p = Notification.permission;
  if (p === 'denied') return 'blocked';
  if (p === 'default') return 'ask';
  return nOff() ? 'off' : 'on';
}
const blockedHelp = () => (isNative() ? 'افتح إعدادات الهاتف ← التطبيقات ← ريو للتوصيل ← الإشعارات ← تفعيل' : 'اضغط على أيقونة القفل بجانب عنوان الموقع ← الإشعارات ← سماح، ثم حدّث الصفحة');
function nbannerHtml() {
  if (!S.user || S.user.role === 'admin') return '';
  const st = notifState();
  if (st === 'ask') return `<div class="nbanner">${ico('bell')}<div class="grow"><b>اسمح بالإشعارات</b><small>لتصلك الطلبات وتغيّر حالاتها فوراً في لوحة إشعارات جهازك</small>${isNative() && S.nerr ? `<small>${esc(S.nerr)}</small>` : ''}</div><button class="btn sm" data-act="enable-notifs">سماح</button></div>`;
  if (st === 'ios') return `<div class="nbanner warn">${ico('bell')}<div class="grow"><b>ثبّت التطبيق ليصلك الإشعار وهو مغلق</b><small>${IOS_HELP}</small></div></div>`;
  if (st === 'blocked') return `<div class="nbanner warn">${ico('bell')}<div class="grow"><b>الإشعارات محظورة</b><small>${blockedHelp()}</small></div>${isNative() ? '' : '<button class="btn ghost sm" data-act="reload">تحديث</button>'}</div>`;
  return '';
}
function updateNBanner() { const b = $('#nbanner'); if (b) b.innerHTML = nbannerHtml(); }
const requestWebPerm = () => new Promise((res) => { try { const r = Notification.requestPermission(res); if (r && r.then) r.then(res, () => res('default')); } catch { res('default'); } });
/* يُنفَّذ فور دخول التاجر/السائق: يظهر طلب السماح مباشرة */
async function promptOnEntry() {
  if (!S.user || S.user.role === 'admin' || entryAsked) return;
  entryAsked = true;
  if (isNative()) {
    await refreshNativePerm();
    if (!nOff()) {
      // يطلب الإذن فور الدخول، ويعيد المحاولة تلقائياً إذا لم تكن واجهة التطبيق جاهزة بعد
      for (const wait of [0, 2500, 7000]) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        if (!S.user) return;
        if (await ensureNativePush() || S.nperm === 'denied') break;
      }
    }
    updateNBanner(); return;
  }
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default' && !nOff()) {
    const t0 = Date.now();
    await requestWebPerm();
    // رجع فوراً دون أن يرى المستخدم نافذة (متصفح يشترط ضغطة) ← نطلب عند أول ضغطة
    clickAsked = Date.now() - t0 > 400;
    updateNBanner();
  }
  if (Notification.permission === 'granted') await ensureWebPush();
  updateNBanner();
  if (S.tab === 'me' && !S.sheet) render();
}
async function askNotifPermission() {
  store.del(nKey('notif_off'));
  if (isNative()) { const ok = await ensureNativePush(); toast(ok ? 'تم تفعيل الإشعارات' : 'لم يتم منح إذن الإشعارات', !ok); updateNBanner(); if (S.user && S.tab === 'me' && !S.sheet) render(); return; }
  if (typeof Notification === 'undefined') return;
  try {
    const r = Notification.permission === 'granted' ? 'granted' : await requestWebPerm();
    updateNBanner();
    if (r === 'granted') { const ok = await ensureWebPush(); toast(ok ? 'تم تفعيل الإشعارات' : 'تم تفعيل الإشعارات داخل المتصفح'); }
    else if (r === 'denied') toast('الإشعارات محظورة — ' + blockedHelp(), true);
  } catch { /* ignore */ }
  updateNBanner();
  if (S.user && S.tab === 'me' && !S.sheet) render();
}
async function toggleNotifs() {
  const st = notifState();
  if (st === 'on') { store.set(nKey('notif_off'), '1'); await unsubscribePush(); toast('تم إيقاف الإشعارات'); updateNBanner(); if (S.tab === 'me' && !S.sheet) render(); }
  else if (st === 'ios') toast(IOS_HELP, true);
  else if (st === 'blocked') toast(blockedHelp(), true);
  else askNotifPermission();
}
async function testNotif() {
  try {
    const r = await api('POST', '/api/push/test');
    if (!r.devices) toast('لا يوجد جهاز مسجّل للإشعارات — أغلق التطبيق وافتحه من جديد ثم اسمح بالإشعارات', true);
    else if (r.fcm && !r.fcmConfigured && !r.sent) toast('إعداد Firebase ناقص في الخادم (FIREBASE_SERVICE_ACCOUNT)', true);
    else if (!r.sent) toast('فشل الإرسال: ' + ((r.errors && r.errors[0]) || 'سبب غير معروف'), true);
    else toast('تم الإرسال ✓ — سيظهر خلال ثوانٍ في لوحة إشعارات جهازك');
  } catch (e) { toast('تعذّر إرسال الإشعار التجريبي', true); }
  setTimeout(checkNotifs, 400);
}
function notifSetting() {
  const st = notifState();
  if (st === 'na') return `<div class="list-item">${ico('bell')}<span class="grow"><b>إشعارات الطلبات</b><small>${isIOS() ? 'حدّث الآيفون إلى iOS 16.4 أو أحدث لتصلك الإشعارات' : 'هذا المتصفح لا يدعم الإشعارات — جرّب Chrome أو ثبّت التطبيق'}</small></span></div>`;
  if (st === 'ios') return `<div class="list-item">${ico('bell')}<span class="grow"><b>إشعارات الطلبات</b><small>${IOS_HELP}</small></span></div>`;
  const bg = isNative() || (webPushOk() && S.pushOn);
  const sub = { on: bg ? 'مفعّلة ✓ — تصلك الطلبات وتغيّر حالاتها فوراً حتى لو كان التطبيق مغلقاً' : webPushOk() ? 'مفعّلة ✓ — جارٍ تفعيل الاستقبال في الخلفية…' : 'مفعّلة ✓ — تظهر ما دام الموقع مفتوحاً (ثبّت التطبيق على الشاشة الرئيسية لتصل وهو مغلق)', off: 'متوقفة — اضغط المفتاح لتفعيلها', ask: 'غير مفعّلة — اضغط المفتاح وسيظهر طلب السماح', blocked: 'محظورة — ' + blockedHelp() }[st];
  return `<div class="list-item">${ico('bell')}<span class="grow"><b>إشعارات الطلبات</b><small>${sub}</small></span><button type="button" class="toggle" role="switch" aria-checked="${st === 'on'}" aria-label="تفعيل الإشعارات" data-act="toggle-notifs"></button></div>${st === 'on' ? `<button class="list-item" data-act="test-notif">${ico('check')}<span class="grow"><b>إرسال إشعار تجريبي</b><small>للتأكد أنه يصل إلى لوحة إشعارات جهازك</small></span><span class="chev">${ico('chev')}</span></button>` : ''}`;
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { const d = e.data || {}; if (d.type === 'open-notif') handleNotifTap(d.data); else if (d.type === 'open-chat') openChatFor(d.orderId, d.orderNo); });
let lastPushSync = 0;
function resyncPush() {
  if (!S.user || S.user.role === 'admin' || nOff()) return;
  const granted = isNative() ? S.nperm === 'granted' : (webPushOk() && Notification.permission === 'granted');
  if (granted && Date.now() - lastPushSync < 600000) return;
  lastPushSync = Date.now();
  if (isNative()) { if (S.nperm !== 'denied') ensureNativePush(); }
  else if (granted) ensureWebPush();
}
setInterval(checkNotifs, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkNotifs(); syncCfg(); refreshNativePerm().then(() => { updateNBanner(); resyncPush(); }); updateNBanner(); } });

/* ============ النوافذ المنبثقة ============ */
function sheetShell(title, body) {
  return `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><h2>${title}</h2><button class="x" data-act="close-sheet" aria-label="إغلاق">${ico('x')}</button></div>${body}</div>`;
}
function openSheet(s) { S.sheet = s; render(); setTimeout(() => { const f = $('.sheet [autofocus], .sheet input:not([type=hidden]), .sheet textarea'); if (f) f.focus(); }, 60); }
function closeSheet() { S.sheet = null; stopChat(); render(); if (S.dirty) { S.dirty = false; refresh(); } }

const field = (id, label, inner, hint) => `<div class="field"><label for="${id}">${label}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;

function renderSheet() {
  const root = $('#sheet-root');
  const s = S.sheet;
  if (!s) { root.hidden = true; root.innerHTML = ''; return; }
  if ((s.type === 'receipt' || s.type === 'report-receipt') && !receiptsOn()) { S.sheet = null; root.hidden = true; root.innerHTML = ''; return; }
  root.hidden = false;
  const b = SHEETS[s.type];
  root.innerHTML = b ? sheetShell(...b(s)) : '';
}

const SHEETS = {
  'new-order'(s) {
    const f = s.form;
    const st = S.data.settings;
    const body = `<form class="stack" data-form="new-order" novalidate>
      ${field('o-area', 'منطقة الزبون', `<input class="in" id="o-area" name="customerArea" data-in="no" placeholder="مثال: الشعلة" value="${esc(f.customerArea)}" required>`)}
      ${field('o-phone', 'رقم الزبون', `<input class="in mono" id="o-phone" name="customerPhone" data-in="no" inputmode="tel" placeholder="07XX XXX XXXX" value="${esc(f.customerPhone)}" required>`)}
      ${field('o-prod', 'نوع المنتج', `<input class="in" id="o-prod" name="product" data-in="no" placeholder="مثال: ملابس" value="${esc(f.product)}" required>`)}
      <div class="field"><span class="lbl">العدد</span><div class="stepper"><button type="button" data-act="qty" data-d="1" aria-label="زيادة">+</button><b id="o-qty">${f.qty}</b><button type="button" data-act="qty" data-d="-1" aria-label="إنقاص">−</button></div></div>
      <div class="field"><span class="lbl">نوع التوصيل</span><div class="seg" id="o-veh"><button type="button" data-act="veh" data-v="bike" aria-pressed="${f.vehicle === 'bike'}">${ico('bike')} دراجة</button><button type="button" data-act="veh" data-v="car" aria-pressed="${f.vehicle === 'car'}">${ico('car')} سيارة</button></div></div>
      <div class="field"><span class="lbl">سعر التوصيل</span><div class="seg" id="o-zone"></div><span class="hint" id="o-zhint">منطقة متجرك: ${esc(S.user.area)}. يتحدد السعر تلقائياً حسب منطقة الزبون وتقدر تغيّره.</span></div>
      ${field('o-price', 'سعر المنتج (د.ع)', `<input class="in" id="o-price" name="productPrice" data-in="no" inputmode="numeric" placeholder="مثال: 30000" value="${esc(f.productPrice)}" required>`)}
      ${field('o-note', 'ملاحظة للسائق (اختياري)', `<textarea class="in" id="o-note" name="note" data-in="no" maxlength="200">${esc(f.note)}</textarea>`)}
      <div class="row between" style="border-top:1px dashed var(--line);padding-top:12px"><b>السعر الإجمالي</b><b id="o-total" style="font-size:20px"></b></div>
      <p class="hint">السائق يدفع لك سعر المنتج عند الاستلام، ويحصّل الإجمالي من الزبون.</p>
      <p class="hint" id="o-err" style="color:var(--red)" role="alert"></p>
      <button class="btn block" type="submit" id="o-btn">إرسال الطلب</button></form>`;
    setTimeout(updateOrderForm, 0);
    void st;
    return ['إنشاء طلب', body];
  },
  note(s) {
    const o = findOrder(s.id);
    return [`ملاحظة طلب #${o ? o.no : ''}`, `<p>${o && o.note ? esc(o.note) : '<span class="muted">لا توجد ملاحظات من التاجر لهذا الطلب.</span>'}</p>`];
  },
  'order-one'(s) {
    const t = `طلب #${s.no}`;
    if (s.loading) return [t, '<p class="muted" style="text-align:center">جارٍ التحميل…</p>'];
    const o = findOrder(s.id) || s.o;
    if (!o) return [t, `<p class="muted" style="text-align:center">${esc(s.err || 'تعذّر العثور على الطلب.')}</p>`];
    const role = S.user.role;
    let card;
    if (role === 'merchant') card = merchantOrderCard(o, true);
    else if (role === 'driver') card = o.status === 'pending' && !o.driverId ? availOrderCard(o, (S.data && S.data.settings) || { feeSame: 0, feeOther: 0 }, true) : driverOrderCard(o);
    else card = adminOrderCard(o);
    return [`طلب #${o.no}`, `<div class="one-order">${card}</div>`];
  },
  receipt(s) {
    const o = findOrder(s.id);
    if (!o) return ['وصل الطلب', '<p class="muted">تعذّر العثور على الطلب.</p>'];
    return [`وصل طلب #${o.no}`, `${rsizeSeg()}<div class="rcpt-wrap">${receiptHtml(o)}</div>
    <div class="row wrapx" style="margin-top:14px;justify-content:center">
      <button class="btn" data-act="print-receipt" data-id="${o.id}">طباعة</button>
      <button class="btn ghost" data-act="dl-receipt" data-id="${o.id}">حفظ صورة</button>
      ${navigator.share ? `<button class="btn ghost" data-act="share-receipt" data-id="${o.id}">مشاركة</button>` : ''}
      <a class="btn wa" href="${waLink(o)}" target="_blank" rel="noopener">واتساب الزبون</a>
    </div>`];
  },
  register(s) {
    const m = s.role === 'merchant';
    return [m ? 'تسجيل كتاجر' : 'تسجيل كسائق', `<form class="stack" data-form="register">
      <div class="seg"><button type="button" data-act="register-role" data-role="merchant" aria-pressed="${m}">${ico('store')} تاجر</button><button type="button" data-act="register-role" data-role="driver" aria-pressed="${!m}">${ico('user')} سائق</button></div>
      ${field('r-name', m ? 'اسم المتجر' : 'اسمك الكامل', '<input class="in" id="r-name" name="name" required>')}
      ${field('r-phone', 'رقم الهاتف', '<input class="in mono" id="r-phone" name="phone" inputmode="tel" placeholder="07XX XXX XXXX" required>')}
      ${field('r-pass', 'كلمة المرور', '<input class="in" id="r-pass" name="password" type="password" minlength="6" autocomplete="new-password" required>', '6 أحرف أو أكثر')}
      ${m ? field('r-area', 'منطقة المتجر', '<input class="in" id="r-area" name="area" placeholder="مثال: الكرادة" required>') + field('r-map', 'رابط موقع المتجر على الخريطة (اختياري)', '<input class="in mono" id="r-map" name="mapUrl" dir="ltr" placeholder="https://maps.app.goo.gl/...">', 'يظهر للسائق ليصل إليك بسهولة') : `<div class="field"><span class="lbl">نوع المركبة</span><div class="seg"><button type="button" data-act="nu-veh" data-v="bike" aria-pressed="${(s.vehicle || 'bike') === 'bike'}">${ico('bike')} دراجة</button><button type="button" data-act="nu-veh" data-v="car" aria-pressed="${s.vehicle === 'car'}">${ico('car')} سيارة</button></div></div>`}
      <p class="hint">بعد التسجيل تراجع الإدارة طلبك وتفعّل حسابك، ثم تستطيع الدخول.</p>
      <p class="hint" id="r-err" style="color:var(--red)" role="alert"></p><button class="btn block" type="submit">إنشاء الحساب</button></form>`];
  },
  registered() {
    return ['تم إرسال طلبك', `<p style="text-align:center;font-size:17px;margin:8px 0 18px">تم إنشاء حسابك وهو بانتظار موافقة الإدارة. سنفعّله قريباً، وبعدها سجّل الدخول برقم هاتفك وكلمة المرور.</p><button class="btn block" data-act="close-sheet">حسناً</button>`];
  },
  /* تغيير حالة الطلب: ورقة سفلية كاملة تظهر فوق شريط التنقل ولا تُقصّ داخل البطاقة */
  status(s) {
    const o = findOrder(s.id);
    if (!o) return ['حالة الطلب', '<p class="muted">تعذّر العثور على الطلب.</p>'];
    const opt = (k, label) => `<button type="button" class="st-opt ${o.status === k ? 'on' : ''}" data-act="set-status" data-id="${o.id}" data-s="${k}"><span class="ck">${o.status === k ? ico('check') : ''}</span>${label}</button>`;
    /* بعد القبول: خيار واحد فقط. وبعد الاستلام تظهر باقي الخيارات */
    if (o.status === 'picking_up') return [`حالة الطلب #${o.no}`, `<div class="st-list" role="menu">${opt('on_the_way', 'تم الاستلام من التاجر')}</div><p class="hint" style="text-align:center;margin-top:10px">بعد الضغط تتحدث الحالة تلقائياً إلى «في الطريق للزبون».</p>`];
    const keys = (o.status === 'on_the_way' ? [] : ['on_the_way']).concat(['no_answer', 'postponed', 'rejected', 'delivered']);
    const LBL = { on_the_way: 'في الطريق للزبون', no_answer: 'لا يرد', postponed: 'مؤجل', rejected: 'مرفوض', delivered: 'تم التسليم' };
    const btns = keys.map((k) => opt(k, LBL[k])).join('');
    const ret = !['delivered', 'return_sent', 'returned'].includes(o.status) ? `<button type="button" class="st-opt" data-act="ask-return" data-id="${o.id}"><span class="ck"></span><b>إرجاع للتاجر</b></button>` : '';
    return [`حالة الطلب #${o.no}`, `<div class="st-list" role="menu">${btns}${ret}</div>`];
  },
  confirm(s) {
    return [s.title, `<p style="text-align:center;font-size:17px;margin:8px 0 18px">${esc(s.text)}</p><div class="row"><button class="btn danger grow" data-act="${s.yes}" data-id="${s.id}">نعم</button><button class="btn ghost grow" data-act="close-sheet">لا</button></div>`];
  },
  'report-receipt'(s) {
    const m = s.rep.receipt;
    return ['وصل مختصر', `${rsizeSeg()}<div class="rcpt-wrap">${modelHtml(m)}</div>
    <div class="row wrapx" style="margin-top:14px;justify-content:center">
      <button class="btn" data-act="rr-print">طباعة</button>
      <button class="btn ghost" data-act="rr-png">حفظ صورة</button>
      ${navigator.share ? `<button class="btn ghost" data-act="rr-share">مشاركة</button>` : ''}
    </div>`];
  },
  chat(s) {
    return [`محادثة طلب #${s.no}`, `<div class="chat" id="chat-box">${chatHtml(s.msgs)}</div><form class="row" data-form="chat"><input class="in grow" id="chat-in" name="text" maxlength="500" placeholder="اكتب رسالة…" autocomplete="off" aria-label="رسالة"><button class="btn" type="submit">إرسال</button></form>`];
  },
  charge() {
    return ['شحن رصيد المحفظة', `<form class="stack" data-form="charge"><p class="muted">لشحن الرصيد قم بإدخال رقم البطاقة</p>
      <div class="card-viz">${logo('dark')}<div class="no">1234 5678 9012</div><b>بطاقة شحن</b></div>
      ${field('c-num', 'رقم البطاقة', '<input class="in mono" id="c-num" name="number" data-in="card" inputmode="numeric" maxlength="14" placeholder="0000 0000 0000" autocomplete="off" required>', 'تحصل على رقم البطاقة من الإدارة أو وكيل ريو.')}
      <p class="hint" id="c-err" style="color:var(--red)" role="alert"></p>
      <button class="btn block" type="submit">شحن</button></form>`];
  },
  'edit-me'() {
    const me = S.user;
    return ['بياناتي', `<form class="stack" data-form="edit-me">
      ${field('m-name', 'الاسم', `<input class="in" id="m-name" name="name" value="${esc(me.name)}" ${me.role === 'merchant' || me.role === 'driver' ? 'disabled' : 'required'}>`, me.role === 'merchant' || me.role === 'driver' ? 'لتغيير الاسم تواصل مع الإدارة.' : '')}
      ${field('m-phone', 'رقم الهاتف', `<input class="in mono" id="m-phone" value="${esc(fmtPhone(me.phone))}" disabled>`, 'لتغيير رقم الهاتف تواصل مع الإدارة.')}
      <p class="hint" id="m-err" style="color:var(--red)" role="alert"></p><button class="btn block" type="submit">حفظ</button></form>`];
  },
  password() {
    return ['الأمان والخصوصية', `<form class="stack" data-form="password">
      ${field('p-cur', 'كلمة المرور الحالية', '<input class="in" id="p-cur" name="current" type="password" autocomplete="current-password" required>')}
      ${field('p-new', 'كلمة المرور الجديدة', '<input class="in" id="p-new" name="next" type="password" autocomplete="new-password" minlength="6" required>', '6 أحرف أو أكثر')}
      <p class="hint" id="p-err" style="color:var(--red)" role="alert"></p><button class="btn block" type="submit">تحديث كلمة المرور</button></form>`];
  },
  'delete-me'() {
    return ['حذف الحساب', `<form class="stack" data-form="delete-me"><div class="notice red">سيتم إلغاء حسابك نهائياً وحذف اسمك ورقمك. تبقى سجلات الطلبات المالية بدون هوية. لا يمكن التراجع.</div>
      ${field('d-pass', 'اكتب كلمة المرور للتأكيد', '<input class="in" id="d-pass" name="password" type="password" autocomplete="current-password" required>')}
      <p class="hint" id="d-err" style="color:var(--red)" role="alert"></p><button class="btn block danger arm" type="submit">حذف حسابي نهائياً</button></form>`];
  },
  'add-user'(s) {
    const d = s.role === 'driver';
    return [d ? 'إضافة سائق' : 'إضافة تاجر', `<form class="stack" data-form="add-user">
      ${field('u-name', d ? 'اسم السائق' : 'اسم المتجر', '<input class="in" id="u-name" name="name" required>')}
      ${field('u-phone', 'رقم الهاتف', '<input class="in mono" id="u-phone" name="phone" inputmode="tel" placeholder="07XX XXX XXXX" required>')}
      ${field('u-pass', 'كلمة المرور', '<input class="in" id="u-pass" name="password" minlength="6" required>', '6 أحرف أو أكثر. أعطها للمستخدم ليغيّرها بعد أول دخول.')}
      ${d ? `<div class="field"><span class="lbl">المركبة</span><div class="seg"><button type="button" data-act="nu-veh" data-v="bike" aria-pressed="${(s.vehicle || 'bike') === 'bike'}">${ico('bike')} دراجة</button><button type="button" data-act="nu-veh" data-v="car" aria-pressed="${s.vehicle === 'car'}">${ico('car')} سيارة</button></div></div>` : field('u-area', 'منطقة المتجر', '<input class="in" id="u-area" name="area" placeholder="مثال: الكرادة" required>', 'تُستخدم لتحديد سعر التوصيل (نفس المنطقة أو منطقة ثانية).')}
      ${d ? '' : field('u-map', 'رابط موقع المتجر على الخريطة (اختياري)', '<input class="in mono" id="u-map" name="mapUrl" dir="ltr" placeholder="https://maps.app.goo.gl/...">', 'يظهر للسائقين ليفتحوه عبر Waze أو أي تطبيق خرائط')}
      <p class="hint" id="u-err" style="color:var(--red)" role="alert"></p><button class="btn block" type="submit">إنشاء الحساب</button></form>`];
  },
  'edit-user'(s) {
    const u = S.data.users.find((x) => x.id === s.id);
    if (!u) return ['تعديل', ''];
    return [`تعديل ${esc(u.name)}`, `<form class="stack" data-form="edit-user">
      ${field('e-name', 'الاسم', `<input class="in" id="e-name" name="name" value="${esc(u.name)}" required>`)}
      ${field('e-phone', 'رقم الهاتف', `<input class="in mono" id="e-phone" name="phone" value="${esc(u.phone)}" inputmode="tel" required>`)}
      ${u.role === 'merchant' ? field('e-area', 'المنطقة', `<input class="in" id="e-area" name="area" value="${esc(u.area)}" required>`) : `<div class="field"><span class="lbl">المركبة</span><div class="seg"><button type="button" data-act="eu-veh" data-v="bike" aria-pressed="${(s.vehicle || u.vehicle) === 'bike'}">${ico('bike')} دراجة</button><button type="button" data-act="eu-veh" data-v="car" aria-pressed="${(s.vehicle || u.vehicle) === 'car'}">${ico('car')} سيارة</button></div></div>`}
      ${u.role === 'merchant' ? field('e-map', 'رابط موقع المتجر على الخريطة', `<input class="in mono" id="e-map" name="mapUrl" dir="ltr" value="${esc(u.mapUrl || '')}" placeholder="https://maps.app.goo.gl/...">`, 'يظهر للسائق ليفتحه عبر Waze أو أي تطبيق خرائط') : ''}
      ${field('e-pass', 'كلمة مرور جديدة (اتركها فارغة بدون تغيير)', '<input class="in" id="e-pass" name="password" minlength="6" autocomplete="off">')}
      <p class="hint" id="e-err" style="color:var(--red)" role="alert"></p><button class="btn block" type="submit">حفظ</button></form>`];
  },
  adjust(s) {
    const u = S.data.users.find((x) => x.id === s.id);
    if (!u) return ['الرصيد', ''];
    return [`رصيد ${esc(u.name)}`, `<form class="stack" data-form="adjust"><div class="balance"><div><small class="muted">الرصيد الحالي</small><strong style="font-size:30px">${money(u.balance)}</strong></div></div>
      ${field('a-amt', 'المبلغ (موجب للشحن، سالب للخصم)', '<input class="in mono" id="a-amt" name="amount" inputmode="numeric" placeholder="مثال: 10000 أو -5000" required>')}
      ${field('a-lbl', 'السبب (اختياري)', '<input class="in" id="a-lbl" name="label" maxlength="80" placeholder="شحن نقدي">')}
      <p class="hint" id="a-err" style="color:var(--red)" role="alert"></p><button class="btn block" type="submit">تنفيذ</button></form>`];
  }
};

/* ----- نموذج الطلب ----- */
function newOrderForm() { return { customerArea: '', customerPhone: '', product: '', qty: 1, vehicle: 'bike', zone: null, zoneManual: false, productPrice: '', note: '' }; }
function updateOrderForm() {
  const s = S.sheet;
  if (!s || s.type !== 'new-order' || !$('#o-zone')) return;
  const f = s.form;
  const st = S.data.settings;
  if (!f.zoneManual) f.zone = f.customerArea.trim() && normArea(f.customerArea) === normArea(S.user.area) ? 'same' : 'other';
  const p = (z) => st[f.vehicle + (z === 'same' ? 'Same' : 'Other')];
  $('#o-zone').innerHTML = ['same', 'other'].map((z) => `<button type="button" data-act="zone" data-z="${z}" aria-pressed="${f.zone === z}">${money(p(z))}<small>${z === 'same' ? 'نفس المنطقة' : 'منطقة ثانية'}</small></button>`).join('');
  const price = Number(digits(f.productPrice).replace(/[,\s]/g, '')) || 0;
  $('#o-total').innerHTML = money(price + p(f.zone));
  $('#o-qty').textContent = f.qty;
  document.querySelectorAll('#o-veh button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === f.vehicle)));
}

/* ----- المحادثة ----- */
const chatHtml = (msgs) => (msgs.length ? msgs.map((m) => `<div class="msg ${m.userId === S.user.id ? 'me' : ''}"><small>${esc(m.name)} · ${dt(m.at)}</small>${esc(m.text)}</div>`).join('') : '<p class="muted" style="text-align:center;margin:auto">لا توجد رسائل بعد. ابدأ المحادثة.</p>');
async function loadChat() {
  const s = S.sheet;
  if (!s || s.type !== 'chat') return;
  try {
    const r = await api('GET', `/api/orders/${s.id}/messages`);
    if (!S.sheet || S.sheet.type !== 'chat') return;
    if (JSON.stringify(r.messages) === JSON.stringify(s.msgs) && s.loaded) return;
    s.msgs = r.messages; s.loaded = true;
    const box = $('#chat-box');
    if (box) { box.innerHTML = chatHtml(s.msgs); box.scrollTop = box.scrollHeight; }
  } catch { /* ignore */ }
}
function startChat() { stopChat(); loadChat(); chatTimer = setInterval(loadChat, 5000); }
function stopChat() { if (chatTimer) { clearInterval(chatTimer); chatTimer = null; } }

/* ============ الأحداث ============ */
const ACTIONS = {
  tab: (el) => go(el.dataset.tab),
  'tab-wallet': () => { go('wallet'); },
  logout: () => doLogout(),
  theme: (el) => { RioTheme.set(el.dataset.t); render(); },
  ocd: async (el) => {
    const k = el.dataset.d;
    if (!S.user || S.user.role !== 'admin' || !ocdValid(k) || k === OCD) return;
    const r = await act(() => api('PUT', '/api/admin/settings', { ocDesign: k }));
    if (!r) return;
    applyCfg(r.settings); render();
    toast('تم تطبيق تصميم «' + OC_DESIGNS.find((x) => x[0] === k)[1] + '» على كل الحسابات');
  },
  det: (el) => { const id = el.dataset.id; S.det[id] = !S.det[id]; render(); },
  retry: () => refresh(true),
  filter: (el) => { S.filter = el.dataset.f; render(); },
  afilter: (el) => { S.adminFilter = el.dataset.f; S.data = null; lastSig = ''; render(); refresh(); },
  otab: (el) => { S.ordersTab = el.dataset.t; S.menu = null; render(); },
  wtab: (el) => { S.walletTab = el.dataset.t; render(); },
  'new-order': () => openSheet({ type: 'new-order', form: newOrderForm() }),
  receipt: (el) => receiptsOn() && openSheet({ type: 'receipt', id: Number(el.dataset.id) }),
  rsize: (el) => { RSIZE = el.dataset.k; store.set('rio_rsize', RSIZE); renderSheet(); },
  'print-receipt': (el) => { const o = findOrder(Number(el.dataset.id)); if (o) printReceipt(o); },
  'dl-receipt': (el) => { const o = findOrder(Number(el.dataset.id)); if (o) downloadReceipt(o); },
  'share-receipt': (el) => { const o = findOrder(Number(el.dataset.id)); if (o) shareReceipt(o); },
  note: (el) => openSheet({ type: 'note', id: Number(el.dataset.id) }),
  charge: () => openSheet({ type: 'charge' }),
  'edit-me': () => openSheet({ type: 'edit-me' }),
  password: () => openSheet({ type: 'password' }),
  'delete-me': () => openSheet({ type: 'delete-me' }),
  'close-sheet': () => closeSheet(),
  register: (el) => { openSheet({ type: 'register', role: el.dataset.role, vehicle: 'bike' }); },
  'register-role': (el) => openSheet({ type: 'register', role: el.dataset.role, vehicle: S.sheet.vehicle || 'bike' }),
  eye: (el) => { const i = el.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'); },
  'ask-return': (el) => { S.menu = null; openSheet({ type: 'confirm', title: 'إرجاع الطلب', text: 'عزيزي الكابتن، هل أنت متأكد من إرجاع الطلب للتاجر؟', yes: 'do-return', id: el.dataset.id }); },
  'ask-recv': (el) => openSheet({ type: 'confirm', title: 'استلام المرتجع', text: 'هل استلمت الطلب المرتجع من السائق؟', yes: 'do-recv', id: el.dataset.id }),
  'add-user': (el) => openSheet({ type: 'add-user', role: el.dataset.role }),
  'edit-user': (el) => openSheet({ type: 'edit-user', id: Number(el.dataset.id) }),
  adjust: (el) => openSheet({ type: 'adjust', id: Number(el.dataset.id) }),
  menu: (el) => { S.menu = null; openSheet({ type: 'status', id: Number(el.dataset.id) }); },
  qty: (el) => { const f = S.sheet.form; f.qty = Math.min(99, Math.max(1, f.qty + Number(el.dataset.d))); updateOrderForm(); },
  veh: (el) => { S.sheet.form.vehicle = el.dataset.v; updateOrderForm(); },
  zone: (el) => { S.sheet.form.zone = el.dataset.z; S.sheet.form.zoneManual = true; updateOrderForm(); },
  'me-veh': (el) => { S.sheet.vehicle = el.dataset.v; syncVeh(el); },
  'nu-veh': (el) => { S.sheet.vehicle = el.dataset.v; syncVeh(el); },
  'eu-veh': (el) => { S.sheet.vehicle = el.dataset.v; syncVeh(el); },
  'exp-range': (el) => { S.expRange = el.dataset.k; render(); },
  async 'exp-xlsx'() { const rep = await act(buildReport); if (rep) await act(() => exportReportXlsx(rep), 'تم تجهيز ملف Excel'); },
  async 'exp-word'() { const rep = await act(buildReport); if (rep) { exportReportWord(rep); toast('تم تجهيز ملف Word'); } },
  async 'exp-receipt'() { if (!receiptsOn()) return; const rep = await act(buildReport); if (rep) openSheet({ type: 'report-receipt', rep }); },
  'rr-print': () => printModel(S.sheet.rep.receipt),
  'rr-png': () => downloadModel(S.sheet.rep.receipt, `rio-summary-${fmtDT(Date.now()).slice(0, 10)}.png`),
  'rr-share': () => shareModel(S.sheet.rep.receipt, `rio-summary-${fmtDT(Date.now()).slice(0, 10)}.png`, 'وصل مختصر'),
  notifs: () => go('notifs'),
  'notif-back': () => go(defaultTab()),
  'open-notif': (el) => { const it = (S.data.items || []).find((n) => n.id === Number(el.dataset.id)); if (it) it.read = true; handleNotifTap({ id: el.dataset.id, kind: el.dataset.kind, orderId: el.dataset.order, orderNo: el.dataset.no }); },
  async 'notif-readall'() { await markServerRead({ all: true }); (S.data.items || []).forEach((n) => { n.read = true; }); S.data.unread = 0; lastSig = ''; render(); },
  async 'notif-clear'() { if (await act(() => api('POST', '/api/notifs/clear'), 'تم مسح الإشعارات')) { setUnread(0); refresh(true); } },
  async 'notif-more'() {
    const items = S.data.items || [];
    const r = await act(() => api('GET', `/api/notifs?limit=40&before=${items[items.length - 1].id}`));
    if (r) { S.data.items = items.concat(r.items); S.data.hasMore = r.hasMore; render(); }
  },
  'enable-notifs': () => askNotifPermission(),
  'toggle-notifs': () => toggleNotifs(),
  'test-notif': () => testNotif(),
  reload: () => location.reload(),
  async chat(el) {
    const id = Number(el.dataset.id);
    markChatRead(id);
    const all = [...(S.data.orders || []), ...(S.data.attention || [])];
    const o = all.find((x) => x.id === id);
    openSheet({ type: 'chat', id, no: o ? o.no : id, msgs: [], loaded: false });
    startChat();
  },
  async cancel(el) {
    const id = el.dataset.id;
    if (S.armed !== 'c' + id) { S.armed = 'c' + id; render(); setTimeout(() => { if (S.armed === 'c' + id) { S.armed = null; render(); } }, 4000); return; }
    S.armed = null;
    if (await act(() => api('POST', `/api/merchant/orders/${id}/cancel`), 'تم إلغاء الطلب')) refresh(true);
  },
  async accept(el) {
    if (await act(() => api('POST', `/api/driver/orders/${el.dataset.id}/accept`), 'تم قبول الطلب. توجّه للتاجر لاستلامه')) { S.ordersTab = 'current'; go('orders'); } else refresh(true);
  },
  async 'do-return'(el) {
    const id = el.dataset.id; closeSheet();
    if (await act(() => api('POST', `/api/driver/orders/${id}/status`, { status: 'return_sent' }), 'تم تسجيل الإرجاع — بانتظار تأكيد التاجر')) refresh(true);
  },
  async 'do-recv'(el) {
    const id = el.dataset.id; closeSheet();
    if (await act(() => api('POST', `/api/merchant/orders/${id}/return`, { received: true }), 'تم تأكيد استلام المرتجع')) refresh(true);
  },
  async 'not-recv'(el) {
    if (await act(() => api('POST', `/api/merchant/orders/${el.dataset.id}/return`, { received: false }), 'تم تسجيل أنك لم تستلم الطلب')) refresh(true);
  },
  async 'set-status'(el) {
    S.menu = null; if (S.sheet && S.sheet.type === 'status') { S.sheet = null; render(); }
    if (await act(() => api('POST', `/api/driver/orders/${el.dataset.id}/status`, { status: el.dataset.s }), 'تم تحديث الحالة')) refresh(true); else render();
  },
  async receiving() {
    const next = !S.data.me.receiving;
    if (await act(() => api('PUT', '/api/driver/receiving', { receiving: next }), next ? 'تم تفعيل استقبال الطلبات' : 'تم إيقاف استقبال الطلبات')) refresh(true);
  },
  async 'rm-avatar'() { if (await act(() => api('PUT', '/api/me/profile', { avatar: '' }).then((r) => setUser(r.user)), 'تم حذف الصورة')) render(); },
  async 'del-user'(el) {
    const u = S.data.users.find((x) => x.id === Number(el.dataset.id)); if (!u) return;
    if (!(await RioDialog.confirm(`حذف «${u.name}» نهائياً؟ تبقى طلباته القديمة في السجل ولا يمكنه الدخول بعد ذلك.`))) return;
    if (await act(() => api('DELETE', `/api/admin/users/${u.id}`), 'تم حذف الحساب')) refresh(true);
  },
  async 'verify-user'(el) {
    const u = S.data.users.find((x) => x.id === Number(el.dataset.id)); if (!u) return;
    const prev = !!u.verified; u.verified = !prev; render();
    try { await api('PUT', `/api/admin/users/${u.id}`, { verified: !prev }); toast(prev ? 'أُلغي توثيق الحساب' : 'تم توثيق الحساب'); refresh(true); }
    catch (e) { u.verified = prev; render(); toast(e.message, true); }
  },
  async 'toggle-user'(el) {
    const u = S.data.users.find((x) => x.id === Number(el.dataset.id)); if (!u) return;
    const prev = u.active; u.active = prev ? 0 : 1; render();
    try { await api('PUT', `/api/admin/users/${u.id}`, { active: !prev }); toast(prev ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب'); refresh(true); }
    catch (e) { u.active = prev; render(); toast(e.message, true); }
  },
  async requeue(el) {
    if (S.armed !== 'r' + el.dataset.id) { S.armed = 'r' + el.dataset.id; el.textContent = 'اضغط للتأكيد'; setTimeout(() => { S.armed = null; if (el.isConnected) el.textContent = 'إعادة للسائقين'; }, 4000); return; }
    S.armed = null;
    if (await act(() => api('POST', `/api/admin/orders/${el.dataset.id}/requeue`), 'أُعيد الطلب للسائقين وأُرجعت الرسوم')) refresh(true);
  },
  async 'del-card'(el) {
    if (S.armed !== 'k' + el.dataset.n) { S.armed = 'k' + el.dataset.n; el.classList.add('arm'); setTimeout(() => { S.armed = null; el.classList.remove('arm'); }, 4000); return; }
    S.armed = null;
    if (await act(() => api('DELETE', `/api/admin/cards/${el.dataset.n}`), 'تم حذف الكرت')) refresh(true);
  },
  async copy(el) {
    const text = el.dataset.text;
    try { await navigator.clipboard.writeText(text); toast('تم النسخ'); }
    catch { toast('تعذّر النسخ تلقائياً، انسخ الرقم يدوياً', true); }
  }
};
function syncVeh(el) { el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); }

document.addEventListener('click', (e) => {
  unlockAudio();
  if (S.user && S.user.role !== 'admin' && !clickAsked && !nOff() && notifState() === 'ask') { clickAsked = true; askNotifPermission(); }
  const el = e.target.closest('[data-act]');
  if (S.menu && !(el && el.dataset.act === 'menu') && !e.target.closest('.menu')) { S.menu = null; if (!el) render(); }
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { if (el.tagName === 'A') return; fn(el); }
});

document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.odp-o')) { e.preventDefault(); ACTIONS.ocd(e.target); return; } if (e.key === 'Escape') { if (S.sheet) closeSheet(); else if (S.menu) { S.menu = null; render(); } } });

document.addEventListener('input', (e) => {
  const t = e.target;
  const k = t.dataset && t.dataset.in;
  if (k === 'no' && S.sheet && S.sheet.type === 'new-order') {
    const map = { customerArea: 'customerArea', customerPhone: 'customerPhone', product: 'product', productPrice: 'productPrice', note: 'note' };
    S.sheet.form[map[t.name]] = t.value;
    updateOrderForm();
  } else if (k === 'card') {
    const d = digits(t.value).replace(/\D/g, '').slice(0, 12);
    t.value = d.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.chg === 'avatar' && t.files && t.files[0]) {
    try { const av = await resizeImage(t.files[0]); const r = await api('PUT', '/api/me/profile', { avatar: av }); setUser(r.user); toast('تم تحديث الصورة'); render(); } catch (err) { toast(err.message || 'تعذّر رفع الصورة', true); }
    t.value = ''; return;
  }
  if (t.dataset && t.dataset.chg === 'admin-status') {
    if (await act(() => api('POST', `/api/admin/orders/${t.dataset.id}/status`, { status: t.value }), 'تم تغيير الحالة')) refresh(true); else refresh(true);
  }
});

const FORMS = {
  async register(f) {
    const role = S.sheet.role;
    await api('POST', '/api/register', { role, name: f.name.value, phone: f.phone.value, password: f.password.value, area: f.area ? f.area.value : '', mapUrl: f.mapUrl ? f.mapUrl.value : '', vehicle: S.sheet.vehicle || 'bike' });
    closeSheet(); openSheet({ type: 'registered' });
  },
  async login(f, err) {
    const r = await api('POST', '/api/login', { phone: f.phone.value, password: f.password.value });
    if (r.user.role === 'staff') throw new Error('حساب الإدارة يدخل من لوحة التحكم (صفحة admin.html)');
    if (ADMIN_ONLY && r.user.role !== 'admin') throw new Error('هذه اللوحة للمدير فقط');
    S.token = r.token; if (f.remember && !f.remember.checked) { try { sessionStorage.setItem(TOKEN_KEY, r.token); } catch { /* ignore */ } store.del(TOKEN_KEY); } else store.set(TOKEN_KEY, r.token); setUser(r.user);
    go(S.tab && TABS[r.user.role].some((t) => t[0] === S.tab) ? S.tab : defaultTab());
    openPendingChat();
    void err;
  },
  async 'new-order'(f) {
    const form = S.sheet.form;
    const body = { customerArea: form.customerArea, customerPhone: form.customerPhone, product: form.product, qty: form.qty, vehicle: form.vehicle, zone: form.zone, productPrice: form.productPrice, note: form.note };
    await api('POST', '/api/merchant/orders', body);
    toast('أُرسل الطلب للسائقين');
    closeSheet(); go('stats');
  },
  async charge(f) {
    const r = await api('POST', '/api/driver/charge', { number: f.number.value });
    toast(`تم شحن ${nf.format(r.amount)} د.ع`);
    closeSheet(); refresh(true);
  },
  async 'edit-me'(f) {
    const locked = S.user.role === 'merchant' || S.user.role === 'driver';
    const r = await api('PUT', '/api/me/profile', locked ? {} : { name: f.name.value });
    setUser(r.user); toast('تم حفظ بياناتك'); closeSheet(); refresh(true);
  },
  async password(f) { await api('PUT', '/api/me/password', { current: f.current.value, next: f.next.value }); toast('تم تحديث كلمة المرور'); closeSheet(); },
  async 'delete-me'(f) { await api('POST', '/api/me/delete', { password: f.password.value }); toast('تم حذف حسابك'); closeSheet(); logout(); },
  async chat(f) {
    const text = f.text.value.trim();
    if (!text) return;
    f.text.value = '';
    await api('POST', `/api/orders/${S.sheet.id}/messages`, { text });
    S.sheet.loaded = false; await loadChat();
  },
  async 'add-user'(f) {
    await api('POST', '/api/admin/users', { role: S.sheet.role, name: f.name.value, phone: f.phone.value, password: f.password.value, area: f.area ? f.area.value : '', mapUrl: f.mapUrl ? f.mapUrl.value : '', vehicle: S.sheet.vehicle || 'bike' });
    toast('تم إنشاء الحساب'); closeSheet(); refresh(true);
  },
  async 'edit-user'(f) {
    const body = { name: f.name.value, phone: f.phone.value };
    if (f.mapUrl) body.mapUrl = f.mapUrl.value;
    if (f.area) body.area = f.area.value; else body.vehicle = S.sheet.vehicle || S.data.users.find((x) => x.id === S.sheet.id).vehicle;
    if (f.password.value) body.password = f.password.value;
    await api('PUT', `/api/admin/users/${S.sheet.id}`, body);
    toast('تم الحفظ'); closeSheet(); refresh(true);
  },
  async adjust(f) {
    await api('POST', `/api/admin/users/${S.sheet.id}/adjust`, { amount: f.amount.value, label: f.label.value });
    toast('تم تعديل الرصيد'); closeSheet(); refresh(true);
  },
  async 'gen-cards'(f) {
    const r = await api('POST', '/api/admin/cards', { amount: f.amount.value, count: f.count.value });
    S.cardsBatch = r.made; toast(`تم توليد ${r.made.length} كرت`); refresh(true);
  },
  async settings(f) {
    const body = {};
    for (const k of ['bikeSame', 'bikeOther', 'carSame', 'carOther', 'feeSame', 'feeOther', 'support']) body[k] = f[k].value;
    body.receipts = f.receipts.checked;
    await api('PUT', '/api/admin/settings', body);
    toast('تم حفظ الإعدادات'); refresh(true);
  }
};
const ERR_ID = { login: 'l-err', 'new-order': 'o-err', charge: 'c-err', 'edit-me': 'm-err', password: 'p-err', 'delete-me': 'd-err', 'add-user': 'u-err', 'edit-user': 'e-err', adjust: 'a-err', register: 'r-err' };

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const name = form.dataset.form;
  const fn = FORMS[name];
  if (!fn) return;
  const btn = form.querySelector('button[type=submit]');
  const errEl = ERR_ID[name] && $('#' + ERR_ID[name]);
  if (errEl) errEl.textContent = '';
  if (btn) btn.disabled = true;
  try { await fn(form.elements, errEl); }
  catch (er) { if (errEl) errEl.textContent = er.message; else toast(er.message, true); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
});

/* ============ التشغيل ============ */
window.addEventListener('hashchange', () => {
  const t = location.hash.replace('#/', '');
  if (S.user && t && t !== S.tab && (t === 'notifs' && S.user.role !== 'admin' || TABS[S.user.role].some((x) => x[0] === t))) go(t);
});

setInterval(() => {
  if (!S.user || S.sheet || S.menu || document.hidden) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  refresh();
}, 10000);

async function boot() {
  const wanted = location.hash.replace('#/', '');
  if (S.token) {
    try {
      const r = await api('GET', '/api/me');
      if (r.user.role === 'staff' || (ADMIN_ONLY && r.user.role !== 'admin')) throw new Error('not admin');
      setUser(r.user);
      const ok = TABS[r.user.role].some((t) => t[0] === wanted) || (wanted === 'notifs' && r.user.role !== 'admin');
      go(ok ? wanted : defaultTab());
      openPendingChat();
      return;
    } catch { /* يظهر تسجيل الدخول */ }
  }
  render();
}
boot();
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
