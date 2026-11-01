'use strict';
/**
 * طبقة قاعدة بيانات صغيرة تدعم:
 *  - PostgreSQL (الإنتاج على Render) عند وجود DATABASE_URL
 *  - SQLite المدمج في Node (للتطوير المحلي) بدون أي تثبيت
 * كل الاستعلامات تُكتب بصيغة $1, $2 وتُحوَّل تلقائياً لـ SQLite.
 */
const fs = require('fs');
const path = require('path');

const isPg = !!process.env.DATABASE_URL;
let pool = null;
let sqlite = null;

function ddl() {
  const pk = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  return [
    `CREATE TABLE IF NOT EXISTS users(
      id ${pk}, role TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE,
      pass_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, area TEXT NOT NULL DEFAULT '',
      vehicle TEXT NOT NULL DEFAULT 'bike', balance INTEGER NOT NULL DEFAULT 0,
      receiving INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS orders(
      id ${pk}, num INTEGER NOT NULL, merchant_id INTEGER NOT NULL, merchant_name TEXT NOT NULL,
      merchant_area TEXT NOT NULL DEFAULT '', merchant_phone TEXT NOT NULL DEFAULT '',
      customer_area TEXT NOT NULL, customer_phone TEXT NOT NULL, product TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1, vehicle TEXT NOT NULL DEFAULT 'bike', same_area INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '', product_price INTEGER NOT NULL, delivery_price INTEGER NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL, driver_id INTEGER, driver_name TEXT NOT NULL DEFAULT '', fee INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, accepted_at BIGINT, delivered_at BIGINT,
      log TEXT NOT NULL DEFAULT '[]')`,
    `CREATE UNIQUE INDEX IF NOT EXISTS orders_num_idx ON orders(num)`,
    `CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status)`,
    `CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders(driver_id)`,
    `CREATE INDEX IF NOT EXISTS orders_merchant_idx ON orders(merchant_id)`,
    `CREATE TABLE IF NOT EXISTS cards(
      number TEXT PRIMARY KEY, amount INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0,
      used_by TEXT NOT NULL DEFAULT '', used_at BIGINT, created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS txs(
      id ${pk}, driver_id INTEGER NOT NULL, amount INTEGER NOT NULL, kind TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '', order_num INTEGER, at BIGINT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS txs_driver_idx ON txs(driver_id)`,
    `CREATE TABLE IF NOT EXISTS messages(
      id ${pk}, order_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL,
      name TEXT NOT NULL, text TEXT NOT NULL, at BIGINT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS messages_order_idx ON messages(order_id)`,
    `CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS expenses(
      id ${pk}, amount BIGINT NOT NULL, category TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
      at BIGINT NOT NULL, created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS vouchers(
      id ${pk}, num INTEGER NOT NULL, kind TEXT NOT NULL, party_type TEXT NOT NULL DEFAULT 'other',
      party_id INTEGER, party_name TEXT NOT NULL DEFAULT '', amount BIGINT NOT NULL,
      note TEXT NOT NULL DEFAULT '', ref TEXT NOT NULL DEFAULT '', at BIGINT NOT NULL, created_at BIGINT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS vouchers_num_idx ON vouchers(num)`,
    `CREATE INDEX IF NOT EXISTS vouchers_at_idx ON vouchers(at)`,
    `CREATE INDEX IF NOT EXISTS vouchers_party_idx ON vouchers(party_type, party_id)`
  ];
}

async function init() {
  if (isPg) {
    const { Pool, types } = require('pg');
    types.setTypeParser(20, (v) => Number(v));
    types.setTypeParser(1700, (v) => Number(v));
    const url = process.env.DATABASE_URL;
    const local = /localhost|127\.0\.0\.1/.test(url);
    const ssl = process.env.PGSSL === 'disable' || local ? false : { rejectUnauthorized: false };
    pool = new Pool({ connectionString: url, ssl, max: 8 });
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const file = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'rio.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    sqlite = new DatabaseSync(file);
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  }
  for (const s of ddl()) await query(s);
  // ترقية قواعد البيانات القديمة (آمنة عند التكرار)
  await addColumn('users', 'discount', 'INTEGER NOT NULL DEFAULT 0');
  await addColumn('orders', 'discount', 'INTEGER NOT NULL DEFAULT 0');
  for (const s of [
    'CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at)',
    'CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders(customer_phone)',
    'CREATE INDEX IF NOT EXISTS expenses_at_idx ON expenses(at)'
  ]) await query(s);
}

async function addColumn(table, col, def) {
  try { await query(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); }
  catch (e) { if (!/duplicate|already exists/i.test(String(e.message))) throw e; }
}

function toSqlite(sql, params) {
  const out = [];
  const text = sql.replace(/\$(\d+)/g, (_, n) => {
    const v = params[Number(n) - 1];
    out.push(v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
    return '?';
  });
  return { text, out };
}

async function query(sql, params = []) {
  if (isPg) {
    const r = await pool.query(sql, params);
    return { rows: r.rows, count: r.rowCount };
  }
  const { text, out } = toSqlite(sql, params);
  const stmt = sqlite.prepare(text);
  if (/^\s*(select|with)\b/i.test(text) || /\breturning\b/i.test(text)) {
    const rows = stmt.all(...out).map((r) => ({ ...r }));
    return { rows, count: rows.length };
  }
  const info = stmt.run(...out);
  return { rows: [], count: Number(info.changes) };
}

async function insert(table, obj) {
  const keys = Object.keys(obj);
  const r = await query(
    `INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
    keys.map((k) => obj[k])
  );
  return r.rows[0];
}

async function update(table, where, whereVal, obj) {
  const keys = Object.keys(obj);
  const r = await query(
    `UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE ${where}=$${keys.length + 1} RETURNING *`,
    [...keys.map((k) => obj[k]), whereVal]
  );
  return r.rows[0];
}

module.exports = { init, query, insert, update, isPg };
