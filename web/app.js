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
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
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
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  support: '<path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/>'
};
const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

const logo = (cls = '') => `<span class="logo ${cls}" aria-label="ريو للتوصيل أسرع"><span class="logo-lines"><i></i><i></i><i></i></span><span class="logo-col"><span class="logo-word">ريوو</span><span class="logo-sub">للتوصيل أسرع</span></span></span>`;

const ST = {
  pending: ['بانتظار سائق', 'amber'], picking_up: ['قيد الاستلام من التاجر', 'accent'], on_the_way: ['في الطريق للزبون', 'accent'],
  delivered: ['تم التسليم', 'green'], no_answer: ['لا يرد', 'red'], problem: ['مشكلة', 'red'], other: ['حالة أخرى', 'red'],
  returned: ['راجع', 'blue'], partial: ['راجع جزئي', 'blue'], cancelled: ['ملغي', '']
};
const DRIVER_ST = ['picking_up', 'on_the_way', 'delivered', 'no_answer', 'problem', 'other', 'returned', 'partial'];
const pill = (s) => `<span class="pill ${ST[s]?.[1] || ''}">${esc(ST[s]?.[0] || s)}</span>`;
const vehName = (v) => (v === 'car' ? 'سيارة' : 'دراجة');

/* ============ الحالة ============ */
const S = {
  token: store.get(TOKEN_KEY), user: null, tab: '', data: null, loading: false, error: '',
  sheet: null, menu: null, armed: null, filter: 'all', walletTab: 'log', ordersTab: 'current', adminFilter: 'all', cardsBatch: null
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
    const sig = JSON.stringify(d);
    S.loading = false; S.error = '';
    if (sig !== lastSig || manual) { lastSig = sig; S.data = d; render(); }
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

function setUser(u) { S.user = u; }
function logout() {
  S.token = null; S.user = null; S.data = null; S.sheet = null; S.menu = null; lastSig = '';
  store.del(TOKEN_KEY);
  history.replaceState(null, '', location.pathname);
  stopChat();
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
  const fab = role === 'merchant' && S.tab !== 'me' ? `<button class="btn fab" data-act="new-order">${ico('plus')} إنشاء طلب</button>` : '';
  return `<header class="topbar"><div class="grp">${logo()}<span class="rolechip">${ico(ROLE_ICON[role])}${ROLE_NAME[role]}</span></div><button class="link" data-act="logout">تسجيل الخروج</button></header>
<div class="shell"><nav class="nav" aria-label="التنقل">${nav}</nav><main class="main"><div class="col ${role === 'admin' ? 'wide' : ''}">${view()}</div></main></div>${fab}`;
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
  return `<div class="land">
  <div class="intro"><h1>بضائعك توصل أسرع</h1><p class="lead">التاجر يجهّز الطلب ويرفعه، والسائق يستلمه من التاجر ويوصله للزبون، والإدارة تتابع كل شي.</p></div>
  <div class="hero">${logo('big dark')}</div>
  <div class="stack">
    <form class="card stack" data-form="login" autocomplete="on">
      <h2 style="font-size:20px">تسجيل الدخول</h2>
      <div class="field"><label for="l-phone">رقم الهاتف</label><input class="in mono" id="l-phone" name="phone" inputmode="tel" autocomplete="username" placeholder="07XX XXX XXXX" required></div>
      <div class="field"><label for="l-pass">كلمة المرور</label><input class="in" id="l-pass" name="password" type="password" autocomplete="current-password" required></div>
      <p class="hint" id="l-err" style="color:var(--red)" role="alert"></p>
      <button class="btn block" type="submit" id="l-btn">دخول</button>
    </form>
    <div class="roles">
      <div class="role"><span class="ico">${ico('store')}</span><span><b>تاجر</b><small>تابع إحصائيات طلباتك وأنشئ طلبات جديدة</small></span></div>
      <div class="role"><span class="ico">${ico('pin')}</span><span><b>سائق</b><small>اشحن محفظتك واقبل الطلبات وسلّمها</small></span></div>
      <div class="role"><span class="ico">${ico('grid')}</span><span><b>مدير</b><small>لوحة تحكم بالطلبات والتجار والسائقين وكروت الرصيد</small></span></div>
    </div>
    <p class="fine">الحسابات يُنشئها المدير. <a href="privacy.html" class="link">سياسة الخصوصية</a> · <a href="delete-account.html" class="link">حذف الحساب</a></p>
  </div></div>`;
}

/* ============ التاجر ============ */
const countBy = (arr, list) => arr.filter((o) => list.includes(o.status)).length;

function tile(label, sub, n, color) {
  return `<div class="tile" style="--c:${color}"><span class="ring">${n}</span><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}

function merchantOrderCard(o, withCancel) {
  const armed = S.armed === 'c' + o.id;
  return `<article class="card ord">
    <div class="ord-h"><div><div class="ord-no">طلب #${o.no}</div><div class="hint">${esc(o.customerArea)} · ${ago(o.createdAt)}</div></div>${pill(o.status)}</div>
    <dl class="kv">
      <div><dt>المنتج</dt><dd>${esc(o.product)} × ${o.qty}</dd></div>
      <div><dt>التوصيل</dt><dd>${vehName(o.vehicle)} · ${money(o.deliveryPrice)}</dd></div>
      <div><dt>رقم الزبون</dt><dd>${telLink(o.customerPhone)}</dd></div>
      <div><dt>الإجمالي على الزبون</dt><dd>${money(o.total)}</dd></div>
      ${o.driverName ? `<div class="full"><dt>السائق</dt><dd>${esc(o.driverName)}</dd></div>` : ''}
      ${o.note ? `<div class="full"><dt>ملاحظة</dt><dd>${esc(o.note)}</dd></div>` : ''}
    </dl>
    <div class="row wrapx">
      ${o.driverId ? `<button class="btn ghost sm" data-act="chat" data-id="${o.id}">${ico('chat')} محادثة السائق</button>` : ''}
      ${withCancel && o.status === 'pending' ? `<button class="btn danger sm ${armed ? 'arm' : ''}" data-act="cancel" data-id="${o.id}">${armed ? 'اضغط للتأكيد' : 'إلغاء الطلب'}</button>` : ''}
    </div></article>`;
}

const VIEWS = {
  'merchant:stats'() {
    const o = S.data.orders;
    const pend = o.filter((x) => x.status === 'pending');
    return `${head('الإحصائيات', esc(S.user.name))}
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
    const sets = { all: null, active: ['pending', 'picking_up', 'on_the_way'], done: ['delivered'], issues: ['no_answer', 'problem', 'other', 'returned', 'partial', 'cancelled'] };
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
    return `${head('الطلبات المتاحة', d.me.receiving ? 'تُحدَّث القائمة تلقائياً' : '')}
    ${!d.me.receiving ? `<div class="notice red" style="margin-bottom:12px">استقبال الطلبات متوقف. فعّله من «الملف الشخصي» لتتمكن من قبول الطلبات.</div>` : ''}
    <div class="stack">${d.available.length ? d.available.map((o) => `
      <article class="card avail">
        <div class="info"><div class="hint">طلب #${o.no}</div><h3>${esc(o.merchantName)}</h3>
          <div class="muted">${esc(o.merchantArea)} - ${esc(o.customerArea)}</div>
          <div class="price-line">${money(o.productPrice)} + ${money(o.deliveryPrice)}</div>
          <div class="hint">سعر المنتج + سعر التوصيل · رسوم التطبيق ${money(o.sameArea ? s.feeSame : s.feeOther)}</div></div>
        <div class="act"><button class="btn" data-act="accept" data-id="${o.id}">قبول الطلب</button><button class="btn ghost" data-act="note" data-id="${o.id}">ملاحظة</button></div>
      </article>`).join('') : emptyBox('لا توجد طلبات متاحة الآن', 'ستظهر الطلبات الجديدة هنا فور رفعها من التجار.')}</div>`;
  },
  'driver:orders'() {
    const all = S.data.orders;
    const cur = all.filter((o) => ['picking_up', 'on_the_way'].includes(o.status));
    const prev = all.filter((o) => !['picking_up', 'on_the_way'].includes(o.status));
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
    let body;
    if (S.walletTab === 'log') {
      body = w.txs.length ? `<div class="card">${w.txs.map((t) => `<div class="tx"><div><div>${esc(t.label || (t.kind === 'fee' ? 'رسوم التطبيق' : 'عملية'))}${t.orderNo ? ` (طلب #${t.orderNo})` : ''}</div><small class="muted">${ago(t.at)}</small></div><span class="${t.amount < 0 ? 'neg' : 'pos'}">${t.amount < 0 ? '−' : '+'}${money(Math.abs(t.amount))}</span></div>`).join('')}</div>` : emptyBox('لا توجد عمليات بعد');
    } else {
      const max = Math.max(1, ...w.days.map((d) => d.net));
      body = `<div class="card"><div class="lbl">صافي ربحك آخر 7 أيام</div><div class="bars">${w.days.map((d) => `<div><em>${d.net ? nf.format(d.net) : ''}</em><div class="b" style="height:${Math.max(3, Math.round(d.net / max * 110))}px"></div><span>${DAYS[new Date(d.t + OFF).getUTCDay()]}</span></div>`).join('')}</div></div>`;
    }
    return `${head('المحفظة')}
    <div class="stack">
      <div class="balance"><div><small class="muted">رصيدك الحالي</small><strong>${money(w.balance)}</strong></div><span class="ico">${ico('wallet')}</span></div>
      <div class="period">${per('اليوم', w.today)}${per('هذا الأسبوع', w.week)}${per('هذا الشهر', w.month)}</div>
      <p class="hint">كل طلب تقبله يُخصم منه رسوم تطبيق: ${money(s.feeSame)} لتوصيل نفس المنطقة، و${money(s.feeOther)} للمنطقة الثانية.</p>
      <button class="btn" data-act="charge">${ico('card')} شحن الرصيد ببطاقة</button>
      <div class="tabs"><button data-act="wtab" data-t="log" aria-pressed="${S.walletTab === 'log'}">سجل العمليات المالية</button><button data-act="wtab" data-t="rep" aria-pressed="${S.walletTab === 'rep'}">التقارير</button></div>
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
    ${li('stats', 'إحصائيات الطلبات', `طلباتك المسلّمة اليوم ${w.today.n} وصافي ربحك ${nf.format(w.today.net)} د.ع`, 'tab-wallet')}
    ${accountLinks(S.data.settings)}`;
  }
};

function li(ic, t, sub, a, extra = '') {
  return `<button class="list-item" data-act="${a}" ${extra}>${ico(ic)}<span class="grow"><b>${t}</b><small>${sub}</small></span><span class="chev">${ico('chev')}</span></button>`;
}
function profileHead(me) {
  return `<div style="text-align:center;margin-top:8px"><div class="avatar">${esc((me.name || '؟').trim().charAt(0))}</div><h1 style="font-size:24px">${esc(me.name)}</h1><p class="muted">${ROLE_NAME[me.role]}</p></div><div style="height:16px"></div>`;
}
function accountLinks(settings) {
  return `<h2 class="sec">الدعم والسياسات</h2>
  ${settings.support ? `<a class="list-item" href="tel:${esc(settings.support)}" style="color:inherit;text-decoration:none">${ico('support')}<span class="grow"><b>التواصل مع الدعم</b><small dir="ltr" style="text-align:right">${esc(fmtPhone(settings.support))}</small></span><span class="chev">${ico('chev')}</span></a>` : ''}
  <a class="list-item" href="privacy.html" style="color:inherit;text-decoration:none">${ico('shield')}<span class="grow"><b>سياسة الخصوصية</b><small>كيف نحمي بياناتك</small></span><span class="chev">${ico('chev')}</span></a>
  ${li('trash', 'حذف الحساب', 'إلغاء حسابك وحذف بياناتك الشخصية', 'delete-me')}
  <button class="btn ghost block" data-act="logout">${ico('out')} تسجيل الخروج</button>`;
}
function profileView(me, settings) {
  return `${profileHead(me)}
  <h2 class="sec">إدارة الحساب</h2>
  ${li('user', 'بياناتي', `${esc(fmtPhone(me.phone))}${me.area ? ' · ' + esc(me.area) : ''}`, 'edit-me')}
  ${li('lock', 'الأمان والخصوصية', 'تحديث كلمة المرور', 'password')}
  ${accountLinks(settings)}`;
}

function driverOrderCard(o) {
  const open = S.menu === o.id;
  const m = open ? `<div class="menu" role="menu">${DRIVER_ST.map((s) => `<button role="menuitem" data-act="set-status" data-id="${o.id}" data-s="${s}"><span class="ck">${o.status === s ? ico('check') : ''}</span>${ST[s][0]}</button>`).join('')}</div>` : '';
  return `<article class="card ord">
    <div class="ord-h"><div class="menuwrap"><button class="pill ${ST[o.status]?.[1] || ''}" data-act="menu" data-id="${o.id}" aria-haspopup="menu" aria-expanded="${open}">${esc(ST[o.status]?.[0] || o.status)} <span aria-hidden="true">▾</span></button>${m}</div><div class="ord-no">طلب #${o.no}</div></div>
    <dl class="kv">
      <div><dt>الزبون</dt><dd>${esc(o.customerArea)}</dd></div>
      <div><dt>تحصل من الزبون</dt><dd>${money(o.total)}</dd></div>
      <div><dt>رقم الزبون</dt><dd>${telLink(o.customerPhone)}</dd></div>
      <div><dt>دفعت للتاجر</dt><dd>${money(o.productPrice)}</dd></div>
      <div><dt>المنتج</dt><dd>${esc(o.product)} × ${o.qty} · ${vehName(o.vehicle)}</dd></div>
      <div><dt>توصيل</dt><dd>${money(o.deliveryPrice)}</dd></div>
      ${o.note ? `<div class="full"><dt>ملاحظة</dt><dd>${esc(o.note)}</dd></div>` : ''}
    </dl>
    ${o.status === 'picking_up' ? `<div class="notice">ادفع للتاجر ${money(o.productPrice)} عند الاستلام، وبعدها غيّر الحالة إلى «في الطريق للزبون».</div>` : ''}
    <button class="btn ghost block" data-act="chat" data-id="${o.id}">${ico('chat')} محادثة</button>
    <hr class="rule" style="margin:0">
    <dl class="kv"><div><dt>المتجر</dt><dd>${esc(o.merchantName)}</dd></div><div><dt>العنوان</dt><dd>${esc(o.merchantArea)}</dd></div><div class="full"><dt>هاتف المتجر</dt><dd>${telLink(o.merchantPhone)}</dd></div></dl>
  </article>`;
}

/* ============ المدير ============ */
const userTable = (role) => {
  const users = S.data.users;
  const isD = role === 'driver';
  return `${head(isD ? 'السائقون' : 'التجار', `${users.length} حساب`, `<button class="btn" data-act="add-user" data-role="${role}">${ico('plus')} ${isD ? 'إضافة سائق' : 'إضافة تاجر'}</button>`)}
  ${users.length ? `<div class="tblwrap"><table><thead><tr><th>الاسم</th><th>الهاتف</th><th>${isD ? 'المركبة' : 'المنطقة'}</th>${isD ? '<th>الرصيد</th>' : ''}<th>الحالة</th><th></th></tr></thead><tbody>
  ${users.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td>${telLink(u.phone)}</td><td>${isD ? vehName(u.vehicle) : esc(u.area)}</td>${isD ? `<td>${money(u.balance)}</td>` : ''}
  <td><button class="pill ${u.active ? 'green' : 'red'}" data-act="toggle-user" data-id="${u.id}">${u.active ? 'فعّال' : 'موقوف'}</button></td>
  <td><div class="row">${isD ? `<button class="btn sm soft" data-act="adjust" data-id="${u.id}">شحن / خصم</button>` : ''}<button class="btn sm ghost" data-act="edit-user" data-id="${u.id}">تعديل</button></div></td></tr>`).join('')}
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
  return `<select class="in" style="min-height:38px;padding:6px 10px;min-width:150px" data-chg="admin-status" data-id="${o.id}" aria-label="حالة الطلب ${o.no}">${Object.keys(ST).map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${ST[s][0]}</option>`).join('')}</select>`;
}
function ordersTable(list) {
  return `<div class="tblwrap"><table><thead><tr><th>الطلب</th><th>التاجر</th><th>الزبون</th><th>المنتج</th><th>الإجمالي</th><th>السائق</th><th>الحالة</th><th></th></tr></thead><tbody>
  ${list.map((o) => `<tr><td><b>#${o.no}</b><div class="hint">${ago(o.createdAt)}</div><div class="row wrapx" style="margin-top:8px"><a class="btn sm wa" href="${waLink(o)}" target="_blank" rel="noopener" aria-label="واتساب الزبون">واتساب</a><button class="btn sm ghost" data-act="receipt" data-id="${o.id}">وصل</button></div></td><td>${esc(o.merchantName)}</td><td>${esc(o.customerArea)}<div>${telLink(o.customerPhone)}</div></td>
  <td>${esc(o.product)} × ${o.qty}<div class="hint">${vehName(o.vehicle)}</div></td><td>${money(o.total)}</td><td>${esc(o.driverName || '—')}</td><td>${statusSelect(o)}</td>
  <td><div class="row wrapx">${o.driverId ? `<button class="btn sm ghost" data-act="chat" data-id="${o.id}">محادثة</button>` : ''}${o.driverId && o.status !== 'pending' ? `<button class="btn sm soft" data-act="requeue" data-id="${o.id}">إعادة للسائقين</button>` : ''}</div></td></tr>`).join('')}
  </tbody></table></div>`;
}

VIEWS['admin:orders'] = () => {
  const list = S.data.orders;
  const chip = (id, l) => `<button class="chip" data-act="afilter" data-f="${id}" aria-pressed="${S.adminFilter === id}">${l}</button>`;
  return `${head('الطلبات', `${list.length} طلب`)}
  <div class="chips">${chip('all', 'الكل')}${Object.keys(ST).map((s) => chip(s, ST[s][0])).join('')}</div>
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
    <div class="card stack"><h2 style="font-size:18px">الدعم</h2><div class="field"><label for="s-support">رقم الدعم (يظهر للتجار والسائقين)</label><input class="in mono" id="s-support" name="support" inputmode="tel" value="${esc(s.support)}" placeholder="07XX XXX XXXX"></div></div>
    <button class="btn" type="submit" style="align-self:flex-start">حفظ الإعدادات</button></form>`;
};

/* ============ وصل الطلب: معاينة / طباعة / صورة / واتساب ============ */
const mny = (n) => `${nf.format(Math.round(n || 0))} د.ع`;
const pad2 = (n) => String(n).padStart(2, '0');
function fmtDT(t) {
  const d = new Date(t + OFF);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
function findOrder(id) {
  const d = S.data || {};
  return (d.orders || []).find((x) => x.id === id) || (d.attention || []).find((x) => x.id === id) || null;
}
function waNumber(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('964')) return d;
  if (d.startsWith('0')) return '964' + d.slice(1);
  return d;
}
function waLink(o) {
  const msg = `مرحباً، بخصوص طلبك رقم #${o.no} من ${o.merchantName}\nالمنتج: ${o.product} × ${o.qty}\nالمبلغ المطلوب: ${mny(o.total)}${o.driverName ? `\nالمندوب: ${o.driverName}` : ''}\nريو للتوصيل أسرع`;
  return `https://wa.me/${waNumber(o.customerPhone)}?text=${encodeURIComponent(msg)}`;
}
function receiptModel(o) {
  return {
    no: o.no,
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
function receiptHtml(o) {
  const m = receiptModel(o);
  const body = m.sections.map((sec, i) => {
    const inner = sec.box
      ? `<div class="box"><span>${esc(sec.box[0])}</span><span dir="ltr">${esc(sec.box[1])}</span></div>`
      : sec.rows.map(([l, v]) => `<div class="r"><b>${esc(l)}</b><span dir="auto">${esc(v)}</span></div>`).join('');
    const nextIsBox = m.sections[i + 1] && m.sections[i + 1].box;
    return inner + (i < m.sections.length - 1 && !sec.box && !nextIsBox ? '<hr>' : '');
  }).join('');
  return `<div class="rcpt"><img class="rl" src="/icons/icon-192.png" alt=""><h3>ريو للتوصيل أسرع</h3><div class="ttl">وصل توصيل</div><div class="no">#${o.no}</div>${body}</div>`;
}
async function receiptCanvas(o) {
  const m = receiptModel(o);
  try { await document.fonts.load('700 24px Cairo'); await document.fonts.load('500 22px "IBM Plex Sans Arabic"'); } catch { /* ignore */ }
  const logo = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = '/icons/icon-192.png'; });
  const W = 640, SC = 2, PAD = 30, ROW = 54;
  let H = 300;
  m.sections.forEach((sec) => { H += sec.box ? 96 : sec.rows.length * ROW + 26; });
  H += 40;
  const c = document.createElement('canvas');
  c.width = W * SC; c.height = H * SC;
  const x = c.getContext('2d');
  x.scale(SC, SC);
  const FF = 'Cairo, "IBM Plex Sans Arabic", Tahoma, sans-serif';
  const rr = (px, py, w, h, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.direction = 'rtl'; x.textBaseline = 'middle'; x.fillStyle = '#111';
  let y = 28;
  if (logo) { x.drawImage(logo, W / 2 - 40, y, 80, 80); }
  y += 112;
  x.textAlign = 'center'; x.font = `800 30px ${FF}`; x.fillText('ريو للتوصيل أسرع', W / 2, y);
  y += 38;
  x.lineWidth = 3; x.strokeStyle = '#111'; rr(PAD - 6, y, W - 2 * PAD + 12, 56, 16); x.stroke();
  x.font = `800 24px ${FF}`; x.fillText('وصل توصيل', W / 2, y + 29);
  y += 92;
  x.font = `800 30px ${FF}`; x.fillText(`#${m.no}`, W / 2, y);
  y += 38;
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
function canvasBlob(c) { return new Promise((res) => c.toBlob(res, 'image/png')); }
async function downloadReceipt(o) {
  const b = await canvasBlob(await receiptCanvas(o));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = `rio-receipt-${o.no}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function shareReceipt(o) {
  try {
    const b = await canvasBlob(await receiptCanvas(o));
    const file = new File([b], `rio-receipt-${o.no}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: `وصل #${o.no}` });
    else await downloadReceipt(o);
  } catch { /* أُلغيت المشاركة */ }
}
function printReceipt(o) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = receiptHtml(o);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
}

/* ============ النوافذ المنبثقة ============ */
function sheetShell(title, body) {
  return `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-h"><h2>${title}</h2><button class="x" data-act="close-sheet" aria-label="إغلاق">${ico('x')}</button></div>${body}</div>`;
}
function openSheet(s) { S.sheet = s; render(); setTimeout(() => { const f = $('.sheet [autofocus], .sheet input:not([type=hidden]), .sheet textarea'); if (f) f.focus(); }, 60); }
function closeSheet() { S.sheet = null; stopChat(); render(); }

const field = (id, label, inner, hint) => `<div class="field"><label for="${id}">${label}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;

function renderSheet() {
  const root = $('#sheet-root');
  const s = S.sheet;
  if (!s) { root.hidden = true; root.innerHTML = ''; return; }
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
    const o = S.data.available.find((x) => x.id === s.id);
    return [`ملاحظة طلب #${o ? o.no : ''}`, `<p>${o && o.note ? esc(o.note) : '<span class="muted">لا توجد ملاحظات من التاجر لهذا الطلب.</span>'}</p>`];
  },
  receipt(s) {
    const o = findOrder(s.id);
    if (!o) return ['وصل الطلب', '<p class="muted">تعذّر العثور على الطلب.</p>'];
    return [`وصل طلب #${o.no}`, `<div class="rcpt-wrap">${receiptHtml(o)}</div>
    <div class="row wrapx" style="margin-top:14px;justify-content:center">
      <button class="btn" data-act="print-receipt" data-id="${o.id}">طباعة</button>
      <button class="btn ghost" data-act="dl-receipt" data-id="${o.id}">تنزيل صورة</button>
      ${navigator.share ? `<button class="btn ghost" data-act="share-receipt" data-id="${o.id}">مشاركة</button>` : ''}
      <a class="btn wa" href="${waLink(o)}" target="_blank" rel="noopener">واتساب الزبون</a>
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
      ${field('m-name', 'الاسم', `<input class="in" id="m-name" name="name" value="${esc(me.name)}" required>`)}
      ${field('m-phone', 'رقم الهاتف', `<input class="in mono" id="m-phone" value="${esc(fmtPhone(me.phone))}" disabled>`, 'لتغيير رقم الهاتف تواصل مع الإدارة.')}
      ${me.role === 'driver' ? `<div class="field"><span class="lbl">المركبة</span><div class="seg"><button type="button" data-act="me-veh" data-v="bike" aria-pressed="${(S.sheet.vehicle || me.vehicle) === 'bike'}">${ico('bike')} دراجة</button><button type="button" data-act="me-veh" data-v="car" aria-pressed="${(S.sheet.vehicle || me.vehicle) === 'car'}">${ico('car')} سيارة</button></div></div>` : ''}
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
      <p class="hint" id="u-err" style="color:var(--red)" role="alert"></p><button class="btn block" type="submit">إنشاء الحساب</button></form>`];
  },
  'edit-user'(s) {
    const u = S.data.users.find((x) => x.id === s.id);
    if (!u) return ['تعديل', ''];
    return [`تعديل ${esc(u.name)}`, `<form class="stack" data-form="edit-user">
      ${field('e-name', 'الاسم', `<input class="in" id="e-name" name="name" value="${esc(u.name)}" required>`)}
      ${field('e-phone', 'رقم الهاتف', `<input class="in mono" id="e-phone" name="phone" value="${esc(u.phone)}" inputmode="tel" required>`)}
      ${u.role === 'merchant' ? field('e-area', 'المنطقة', `<input class="in" id="e-area" name="area" value="${esc(u.area)}" required>`) : `<div class="field"><span class="lbl">المركبة</span><div class="seg"><button type="button" data-act="eu-veh" data-v="bike" aria-pressed="${(s.vehicle || u.vehicle) === 'bike'}">${ico('bike')} دراجة</button><button type="button" data-act="eu-veh" data-v="car" aria-pressed="${(s.vehicle || u.vehicle) === 'car'}">${ico('car')} سيارة</button></div></div>`}
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
  'tab-wallet': () => go('wallet'),
  logout: () => logout(),
  retry: () => refresh(true),
  filter: (el) => { S.filter = el.dataset.f; render(); },
  afilter: (el) => { S.adminFilter = el.dataset.f; S.data = null; lastSig = ''; render(); refresh(); },
  otab: (el) => { S.ordersTab = el.dataset.t; S.menu = null; render(); },
  wtab: (el) => { S.walletTab = el.dataset.t; render(); },
  'new-order': () => openSheet({ type: 'new-order', form: newOrderForm() }),
  receipt: (el) => openSheet({ type: 'receipt', id: Number(el.dataset.id) }),
  'print-receipt': (el) => { const o = findOrder(Number(el.dataset.id)); if (o) printReceipt(o); },
  'dl-receipt': (el) => { const o = findOrder(Number(el.dataset.id)); if (o) downloadReceipt(o); },
  'share-receipt': (el) => { const o = findOrder(Number(el.dataset.id)); if (o) shareReceipt(o); },
  note: (el) => openSheet({ type: 'note', id: Number(el.dataset.id) }),
  charge: () => openSheet({ type: 'charge' }),
  'edit-me': () => openSheet({ type: 'edit-me' }),
  password: () => openSheet({ type: 'password' }),
  'delete-me': () => openSheet({ type: 'delete-me' }),
  'close-sheet': () => closeSheet(),
  'add-user': (el) => openSheet({ type: 'add-user', role: el.dataset.role }),
  'edit-user': (el) => openSheet({ type: 'edit-user', id: Number(el.dataset.id) }),
  adjust: (el) => openSheet({ type: 'adjust', id: Number(el.dataset.id) }),
  menu: (el) => { const id = Number(el.dataset.id); S.menu = S.menu === id ? null : id; render(); },
  qty: (el) => { const f = S.sheet.form; f.qty = Math.min(99, Math.max(1, f.qty + Number(el.dataset.d))); updateOrderForm(); },
  veh: (el) => { S.sheet.form.vehicle = el.dataset.v; updateOrderForm(); },
  zone: (el) => { S.sheet.form.zone = el.dataset.z; S.sheet.form.zoneManual = true; updateOrderForm(); },
  'me-veh': (el) => { S.sheet.vehicle = el.dataset.v; syncVeh(el); },
  'nu-veh': (el) => { S.sheet.vehicle = el.dataset.v; syncVeh(el); },
  'eu-veh': (el) => { S.sheet.vehicle = el.dataset.v; syncVeh(el); },
  async chat(el) {
    const id = Number(el.dataset.id);
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
  async 'set-status'(el) {
    S.menu = null;
    if (await act(() => api('POST', `/api/driver/orders/${el.dataset.id}/status`, { status: el.dataset.s }), 'تم تحديث الحالة')) refresh(true); else render();
  },
  async receiving() {
    const next = !S.data.me.receiving;
    if (await act(() => api('PUT', '/api/driver/receiving', { receiving: next }), next ? 'تم تفعيل استقبال الطلبات' : 'تم إيقاف استقبال الطلبات')) refresh(true);
  },
  async 'toggle-user'(el) {
    const u = S.data.users.find((x) => x.id === Number(el.dataset.id));
    if (u && await act(() => api('PUT', `/api/admin/users/${u.id}`, { active: !u.active }), u.active ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب')) refresh(true);
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
  const el = e.target.closest('[data-act]');
  if (S.menu && !(el && el.dataset.act === 'menu') && !e.target.closest('.menu')) { S.menu = null; if (!el) render(); }
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { if (el.tagName === 'A') return; fn(el); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (S.sheet) closeSheet(); else if (S.menu) { S.menu = null; render(); } } });

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
  if (t.dataset && t.dataset.chg === 'admin-status') {
    if (await act(() => api('POST', `/api/admin/orders/${t.dataset.id}/status`, { status: t.value }), 'تم تغيير الحالة')) refresh(true); else refresh(true);
  }
});

const FORMS = {
  async login(f, err) {
    const r = await api('POST', '/api/login', { phone: f.phone.value, password: f.password.value });
    if (ADMIN_ONLY && r.user.role !== 'admin') throw new Error('هذه اللوحة للمدير فقط');
    S.token = r.token; store.set(TOKEN_KEY, r.token); setUser(r.user);
    go(S.tab && TABS[r.user.role].some((t) => t[0] === S.tab) ? S.tab : defaultTab());
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
    const r = await api('PUT', '/api/me/profile', { name: f.name.value, vehicle: S.sheet.vehicle });
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
    await api('POST', '/api/admin/users', { role: S.sheet.role, name: f.name.value, phone: f.phone.value, password: f.password.value, area: f.area ? f.area.value : '', vehicle: S.sheet.vehicle || 'bike' });
    toast('تم إنشاء الحساب'); closeSheet(); refresh(true);
  },
  async 'edit-user'(f) {
    const body = { name: f.name.value, phone: f.phone.value };
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
    await api('PUT', '/api/admin/settings', body);
    toast('تم حفظ الإعدادات'); refresh(true);
  }
};
const ERR_ID = { login: 'l-err', 'new-order': 'o-err', charge: 'c-err', 'edit-me': 'm-err', password: 'p-err', 'delete-me': 'd-err', 'add-user': 'u-err', 'edit-user': 'e-err', adjust: 'a-err' };

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
  if (S.user && t && t !== S.tab && TABS[S.user.role].some((x) => x[0] === t)) go(t);
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
      if (ADMIN_ONLY && r.user.role !== 'admin') throw new Error('not admin');
      setUser(r.user);
      const ok = TABS[r.user.role].some((t) => t[0] === wanted);
      go(ok ? wanted : defaultTab());
      return;
    } catch { /* يظهر تسجيل الدخول */ }
  }
  render();
}
boot();
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
