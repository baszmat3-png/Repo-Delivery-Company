'use strict';
/* تحويل رابط موقع المتجر (قصير أو طويل) إلى إحداثيات دقيقة (lat,lng) لفتحها في تطبيقات الخرائط */
const HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google|(www\.|maps\.)?google\.[a-z.]+|(www\.)?waze\.com)$/i;
const cache = new Map(); // url -> { ll, t }
const okLL = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
const num = '(-?\\d{1,3}\\.\\d{3,})';
const PATS = [
  new RegExp(`!3d${num}!4d${num}`),                       // موضع العلامة (الأدق)
  new RegExp(`[?&](?:destination|daddr|ll|q|query|center|sll)=${num}(?:,|%2C|\\+)\\s*${num}`, 'i'),
  new RegExp(`/@${num},${num}`),
  new RegExp(`/(?:place|search|dir)/[^@?]*?${num},\\+?${num}`),
  new RegExp(`center=${num}%2C${num}`, 'i'),
  new RegExp(`"${num},\\s*${num}"`),
];
function parseLL(text, exactOnly) {
  const s = String(text || '');
  /* PATS[0..1] = موضع العلامة نفسها (دقيق)؛ الباقي مركز الشاشة (@lat,lng) أي تقريبي */
  for (const re of exactOnly ? PATS.slice(0, 2) : PATS) {
    const m = s.match(re);
    if (m) { const a = Number(m[1]), b = Number(m[2]); if (okLL(a, b)) return [a, b]; }
  }
  return null;
}
const dec = (t) => decodeURIComponent(String(t).replace(/%(?![0-9a-f]{2})/gi, '%25'));
const unesc = (b) => b.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
/* يتتبع التحويلات ويفضّل الإحداثيات الدقيقة (!3d!4d أو q=) على مركز الشاشة (@)؛ ولا يقبل التقريبي إلا إن لم يوجد غيره */
async function get(url, hops = 0, approx = null) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !HOSTS.test(u.hostname)) return approx;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Accept-Language': 'ar,en;q=0.8' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location') && hops < 6) {
      const next = new URL(r.headers.get('location'), url).toString();
      let d = null; try { d = dec(next); } catch { /* ignore */ }
      const exact = d && parseLL(d, true); if (exact) return exact;
      return get(next, hops + 1, (d && parseLL(d)) || approx);
    }
    const body = unesc((await r.text()).slice(0, 800000));
    let fin = ''; try { fin = dec(r.url || url); } catch { /* ignore */ }
    return parseLL(fin, true) || parseLL(body, true) || parseLL(fin) || approx || parseLL(body);
  } finally { clearTimeout(tm); }
}
async function resolveLL(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.t < (hit.ll ? 30 * 864e5 : 10 * 6e4)) return hit.ll;
  let ll = null;
  try { const d = dec(raw); ll = parseLL(d, true) || (await get(raw, 0, parseLL(d))); } catch { ll = null; }
  if (cache.size > 2000) cache.clear();
  cache.set(raw, { ll, t: Date.now() });
  return ll;
}
module.exports = { resolveLL, parseLL };
