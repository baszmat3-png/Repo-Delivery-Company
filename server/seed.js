'use strict';
const db = require('./db');
const { hashPassword } = require('./auth');

const q = db.query;

async function seedAdmin() {
  const r = await q(`SELECT id FROM users WHERE role='admin' LIMIT 1`);
  if (r.rows.length) return;
  const phone = (process.env.ADMIN_PHONE || '07700000000').replace(/\D/g, '');
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  if (!process.env.ADMIN_PASSWORD) console.warn('[تنبيه] ADMIN_PASSWORD غير مضبوط. تم استخدام كلمة المرور الافتراضية (admin1234) — غيّرها فوراً.');
  await db.insert('users', {
    role: 'admin', name: 'مدير النظام', phone, pass_hash: await hashPassword(password),
    active: 1, area: '', vehicle: 'bike', balance: 0, receiving: 0, created_at: Date.now()
  });
  console.log(`تم إنشاء حساب المدير: ${phone}`);
}

// بيانات تجريبية لتجربة النظام فقط (كلمة مرور الجميع 123456)
async function seedDemo() {
  const n = await q(`SELECT COUNT(*) AS n FROM users WHERE role<>'admin'`);
  if (n.rows[0].n > 0) return;
  const now = Date.now();
  const MIN = 60000, HR = 3600000, DAY = 86400000;
  const hash = await hashPassword('123456');
  const mk = (role, name, phone, area, vehicle, balance) => db.insert('users', {
    role, name, phone, pass_hash: hash, active: 1, area, vehicle, balance, receiving: 1, created_at: now - 5 * DAY
  });
  const m = {
    rafidain: await mk('merchant', 'متجر الرافدين', '07700000201', 'الكرادة', 'bike', 0),
    anaqa: await mk('merchant', 'بيت الأناقة', '07700000202', 'المنصور', 'bike', 0),
    karkh: await mk('merchant', 'سوق الكرخ', '07700000203', 'الكرخ', 'bike', 0)
  };
  const d = {
    ali: await mk('driver', 'علي كريم', '07700000301', '', 'bike', 5000),
    hasan: await mk('driver', 'حسن جاسم', '07700000302', '', 'car', 12000)
  };
  const price = { bike: { same: 3000, other: 5000 }, car: { same: 5000, other: 8000 } };
  async function order(num, merchant, area, phone, product, qty, vehicle, prod, status, driver, createdAgo, doneAgo, note) {
    const same = merchant.area === area;
    const dp = price[vehicle][same ? 'same' : 'other'];
    const created = now - createdAgo;
    const fee = driver ? (same ? 500 : 1000) : 0;
    const log = [{ s: 'pending', at: created }];
    let updated = created, accepted = null, delivered = null;
    if (driver) {
      accepted = created + 4 * MIN; updated = accepted; log.push({ s: 'picking_up', at: accepted });
      await db.insert('txs', { driver_id: driver.id, amount: -fee, kind: 'fee', label: 'رسوم التطبيق', order_num: num, at: accepted });
    }
    if (doneAgo != null) {
      updated = now - doneAgo; log.push({ s: status, at: updated });
      if (status === 'delivered' || status === 'partial') delivered = updated;
    }
    await db.insert('orders', {
      num, merchant_id: merchant.id, merchant_name: merchant.name, merchant_area: merchant.area, merchant_phone: merchant.phone,
      customer_area: area, customer_phone: phone, product, qty, vehicle, same_area: same ? 1 : 0, note: note || '',
      product_price: prod, delivery_price: dp, total: prod + dp, status, driver_id: driver ? driver.id : null,
      driver_name: driver ? driver.name : '', fee, created_at: created, updated_at: updated, accepted_at: accepted,
      delivered_at: delivered, log: JSON.stringify(log)
    });
  }
  await order(1034, m.rafidain, 'المنصور', '07700000113', 'ملابس', 5, 'bike', 70000, 'partial', d.hasan, 3 * DAY, 3 * DAY - 2 * HR);
  await order(1035, m.rafidain, 'الكرادة', '07700000112', 'إلكترونيات', 1, 'bike', 55000, 'returned', d.hasan, 2 * DAY + 2 * HR, 2 * DAY + HR);
  await order(1036, m.rafidain, 'الجامعة', '07700000111', 'أغذية', 2, 'bike', 9000, 'other', d.hasan, 2 * DAY, 2 * DAY - HR);
  await order(1037, m.rafidain, 'الشعلة', '07700000110', 'ملابس', 3, 'bike', 40000, 'problem', d.hasan, DAY + 5 * HR, DAY + 4 * HR);
  await order(1038, m.rafidain, 'الدورة', '07700000109', 'أحذية', 1, 'bike', 32000, 'no_answer', d.hasan, DAY + 3 * HR, DAY + 2 * HR);
  await order(1039, m.rafidain, 'المنصور', '07700000108', 'إكسسوارات', 4, 'bike', 16000, 'delivered', d.ali, 170 * MIN, 140 * MIN);
  await order(1040, m.rafidain, 'الكرادة', '07700000107', 'أغذية', 1, 'bike', 12000, 'delivered', d.ali, 150 * MIN, 100 * MIN);
  await order(1041, m.rafidain, 'الشعلة', '07700000106', 'ملابس', 2, 'bike', 25000, 'delivered', d.ali, 130 * MIN, 70 * MIN);
  await order(1042, m.rafidain, 'الكرادة', '07700000105', 'عطور', 1, 'bike', 18000, 'delivered', d.ali, 100 * MIN, 35 * MIN);
  await order(1043, m.rafidain, 'الجامعة', '07700000104', 'أغذية', 3, 'bike', 21000, 'on_the_way', d.ali, 55 * MIN, null);
  await order(1044, m.karkh, 'الأعظمية', '07700000103', 'أجهزة منزلية', 1, 'bike', 60000, 'pending', null, 22 * MIN, null, 'يحتاج سلة كبيرة');
  await order(1045, m.anaqa, 'المنصور', '07700000102', 'أدوات منزلية', 1, 'bike', 45000, 'pending', null, 14 * MIN, null);
  await order(1046, m.rafidain, 'الشعلة', '07700000101', 'ملابس', 2, 'bike', 30000, 'pending', null, 6 * MIN, null);
  await order(1047, m.rafidain, 'المنصور', '07772223366', 'إلكترونيات', 1, 'bike', 5000, 'pending', null, 1 * MIN, null, 'اتصل قبل الوصول');
  const cards = [['482915307261', 5000], ['715340928846', 10000], ['239061547730', 10000], ['908273416652', 25000], ['560147298034', 25000], ['371825960417', 50000]];
  for (const [number, amount] of cards) await db.insert('cards', { number, amount, used: 0, used_by: '', used_at: null, created_at: now - 2 * DAY });
  await db.insert('cards', { number: '120458736921', amount: 5000, used: 1, used_by: 'علي كريم', used_at: now - 3 * HR, created_at: now - 2 * DAY });
  await db.insert('txs', { driver_id: d.ali.id, amount: 5000, kind: 'charge', label: 'شحن بطاقة', order_num: null, at: now - 3 * HR });
  console.log('تم تحميل بيانات تجريبية (كلمة مرور الجميع 123456). التجار: 07700000201-203 — السائقون: 07700000301-302');
}

module.exports = { seedAdmin, seedDemo };
