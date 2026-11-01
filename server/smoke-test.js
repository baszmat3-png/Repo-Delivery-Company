'use strict';
// اختبار شامل سريع للـ API:  node smoke-test.js  (الخادم يعمل على http://localhost:3111 ببيانات تجريبية)
const BASE = process.env.BASE || 'http://localhost:3111';
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { failN++; console.log('  ✗ FAIL:', m); } };
async function call(method, path, token, body) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, ...j };
}
const login = async (phone, password) => (await call('POST', '/api/login', null, { phone, password }));

(async () => {
  console.log('الدخول');
  const bad = await login('07700000201', 'wrong'); ok(bad.s === 401, 'كلمة مرور خاطئة تُرفض');
  const A = await login('07700000000', 'admin1234'); ok(A.token && A.user.role === 'admin', 'دخول المدير');
  const M = await login('0770 000 0201', '123456'); ok(M.token && M.user.role === 'merchant', 'دخول التاجر (مع مسافات)');
  const D1 = await login('07700000301', '123456'), D2 = await login('07700000302', '123456'); ok(D1.token && D2.token, 'دخول سائقين');
  const noauth = await call('GET', '/api/merchant/home'); ok(noauth.s === 401, 'بدون توكن يُرفض');
  const wrongRole = await call('GET', '/api/admin/overview', M.token); ok(wrongRole.s === 403, 'التاجر لا يدخل لوحة المدير');

  console.log('التاجر');
  const home = await call('GET', '/api/merchant/home', M.token); ok(home.orders.length >= 8 && home.settings.feeSame === 500, 'قائمة طلبات التاجر والإعدادات');
  const badOrder = await call('POST', '/api/merchant/orders', M.token, { customerArea: 'الشعلة', customerPhone: '123', product: 'ملابس', productPrice: 1000 }); ok(badOrder.s === 400, 'رقم زبون خاطئ يُرفض');
  const cr = await call('POST', '/api/merchant/orders', M.token, { customerArea: 'الكرادة', customerPhone: '٠٧٧٠١٢٣٤٥٦٧', product: 'عطور', qty: 2, vehicle: 'bike', productPrice: '١٠٬٠٠٠'.replace('٬', ','), note: 'x' });
  ok(cr.order && cr.order.deliveryPrice === 3000 && cr.order.sameArea && cr.order.total === 13000, 'طلب بنفس المنطقة: توصيل 3000 والإجمالي 13000');
  const cr2 = await call('POST', '/api/merchant/orders', M.token, { customerArea: 'الشعلة', customerPhone: '07701234567', product: 'ملابس', vehicle: 'car', productPrice: 20000 });
  ok(cr2.order && cr2.order.deliveryPrice === 8000 && !cr2.order.sameArea, 'سيارة لمنطقة ثانية: 8000');
  ok(cr2.order.no === cr.order.no + 1, 'ترقيم متسلسل');

  console.log('السائق: قبول الطلب والرسوم');
  const d1 = await call('GET', '/api/driver/home', D1.token); const bal0 = d1.me.balance;
  ok(d1.available.some((o) => o.id === cr.order.id), 'الطلب الجديد ظاهر للسائقين');
  const [r1, r2] = await Promise.all([call('POST', `/api/driver/orders/${cr.order.id}/accept`, D1.token), call('POST', `/api/driver/orders/${cr.order.id}/accept`, D2.token)]);
  ok([r1.s, r2.s].filter((x) => x === 200).length === 1, 'سائق واحد فقط يقبل الطلب عند التسابق');
  const winner = r1.s === 200 ? D1 : D2, loser = r1.s === 200 ? D2 : D1;
  const wh = await call('GET', '/api/driver/home', winner.token), lh = await call('GET', '/api/driver/home', loser.token);
  const wBefore = winner === D1 ? bal0 : 12000;
  ok(wh.me.balance === wBefore - 500, 'خصم 500 من الفائز فقط');
  ok(lh.me.balance === (winner === D1 ? 12000 : bal0), 'الخاسر لم يُخصم منه شيء');
  const st = await call('POST', `/api/driver/orders/${cr.order.id}/status`, winner.token, { status: 'on_the_way' }); ok(st.order.status === 'on_the_way', 'تغيير الحالة: في الطريق');
  const bad2 = await call('POST', `/api/driver/orders/${cr.order.id}/status`, loser.token, { status: 'delivered' }); ok(bad2.s === 404, 'سائق آخر لا يغيّر حالة الطلب');
  const dl = await call('POST', `/api/driver/orders/${cr.order.id}/status`, winner.token, { status: 'delivered' }); ok(dl.order.deliveredAt > 0, 'تم التسليم + وقت التسليم');
  const w2 = await call('GET', '/api/driver/home', winner.token); ok(w2.wallet.today.n >= 1 && w2.wallet.days.length === 7, 'إحصائيات المحفظة');
  const cancelTooLate = await call('POST', `/api/merchant/orders/${cr.order.id}/cancel`, M.token); ok(cancelTooLate.s === 409, 'لا يُلغى طلب بعد قبوله');
  const cancel = await call('POST', `/api/merchant/orders/${cr2.order.id}/cancel`, M.token); ok(cancel.order.status === 'cancelled', 'إلغاء طلب بانتظار سائق');

  console.log('المحفظة وكروت الشحن');
  const ch = await call('POST', '/api/driver/charge', D1.token, { number: '4829 1530 7261' }); ok(ch.amount === 5000, 'شحن 5000 ببطاقة صحيحة');
  const ch2 = await call('POST', '/api/driver/charge', D2.token, { number: '482915307261' }); ok(ch2.s === 409, 'بطاقة مستخدمة تُرفض');
  const ch3 = await call('POST', '/api/driver/charge', D2.token, { number: '000000000000' }); ok(ch3.s === 404, 'بطاقة غير موجودة تُرفض');
  const ch4 = await call('POST', '/api/driver/charge', D2.token, { number: '1234' }); ok(ch4.s === 400, 'رقم قصير يُرفض');
  const poor = await call('POST', '/api/admin/users', A.token, { role: 'driver', name: 'سائق جديد', phone: '07709990001', password: 'secret1' }); ok(poor.user && poor.user.balance === 0, 'المدير ينشئ سائقاً');
  const P = await login('07709990001', 'secret1'); const open = (await call('GET', '/api/driver/home', P.token)).available[0];
  const noBal = await call('POST', `/api/driver/orders/${open.id}/accept`, P.token); ok(noBal.s === 402, 'رصيد صفر لا يقبل طلباً');

  console.log('المحادثة');
  const msg = await call('POST', `/api/orders/${cr.order.id}/messages`, M.token, { text: 'مرحبا' }); ok(msg.message && msg.message.role === 'merchant', 'التاجر يرسل رسالة');
  const msgs = await call('GET', `/api/orders/${cr.order.id}/messages`, winner.token); ok(msgs.messages.length === 1, 'السائق المسند يقرأ الرسالة');
  const msgBad = await call('GET', `/api/orders/${cr.order.id}/messages`, loser.token); ok(msgBad.s === 403, 'سائق غير مسند لا يقرأ المحادثة');

  console.log('المدير');
  const ov = await call('GET', '/api/admin/overview', A.token); ok(ov.ordersToday >= 2 && ov.days.length === 7 && ov.drivers >= 3, 'نظرة عامة');
  const cards = await call('POST', '/api/admin/cards', A.token, { amount: 10000, count: 3 }); ok(cards.made.length === 3 && cards.made[0].length === 12, 'توليد 3 كروت');
  const del = await call('DELETE', `/api/admin/cards/${cards.made[0]}`, A.token); ok(del.ok, 'حذف كرت غير مستخدم');
  const delUsed = await call('DELETE', '/api/admin/cards/120458736921', A.token); ok(delUsed.s === 409, 'لا يُحذف كرت مستخدم');
  const adj = await call('POST', `/api/admin/users/${P.user.id}/adjust`, A.token, { amount: 2000, label: 'هدية' }); ok(adj.user.balance === 2000, 'شحن يدوي +2000');
  const adj2 = await call('POST', `/api/admin/users/${P.user.id}/adjust`, A.token, { amount: -5000 }); ok(adj2.s === 409, 'لا يهبط الرصيد تحت الصفر');
  const rq = await call('POST', `/api/admin/orders/${cr.order.id}/requeue`, A.token); ok(rq.order.status === 'pending' && !rq.order.driverId, 'إعادة الطلب للسائقين');
  const wAfter = await call('GET', '/api/driver/home', winner.token); ok(wAfter.me.balance === wBefore + (winner === D1 ? 5000 : 0), 'استرجاع الرسوم للسائق');
  const set = await call('PUT', '/api/admin/settings', A.token, { feeSame: 700, bikeSame: 3500, support: '0770 123 4567' }); ok(set.settings.feeSame === 700 && set.settings.support === '07701234567', 'تعديل الأسعار');
  const susp = await call('PUT', `/api/admin/users/${P.user.id}`, A.token, { active: false }); ok(!susp.user.active, 'إيقاف حساب');
  const loginSusp = await login('07709990001', 'secret1'); ok(loginSusp.s === 403, 'الحساب الموقوف لا يدخل');
  const oldTok = await call('GET', '/api/driver/home', P.token); ok(oldTok.s === 401, 'جلسة الحساب الموقوف تسقط');
  await call('PUT', '/api/admin/settings', A.token, { feeSame: 500, bikeSame: 3000, support: '' });

  console.log('الحساب');
  const pw = await call('PUT', '/api/me/password', D2.token, { current: 'wrong', next: '654321' }); ok(pw.s === 403, 'تغيير كلمة المرور بكلمة حالية خاطئة يُرفض');
  const delAcc = await call('POST', '/api/delete-account', null, { phone: '07700000302', password: '123456' }); ok(delAcc.ok, 'حذف الحساب من الويب');
  const afterDel = await login('07700000302', '123456'); ok(afterDel.s === 401, 'لا يمكن الدخول بعد الحذف');
  const adminDel = await call('POST', '/api/me/delete', A.token, { password: 'admin1234' }); ok(adminDel.s === 403, 'حساب المدير لا يُحذف');

  console.log(`\nالنتيجة: ${pass} نجح، ${failN} فشل`);
  process.exit(failN ? 1 : 0);
})();
