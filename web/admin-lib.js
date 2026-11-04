'use strict';
/* ريو — أدوات مشتركة للوحة الويب: تنسيق، شعار، تفقيط، طباعة/PDF، Excel، واتساب */
(function (g) {
  const OFF = 3 * 36e5, DAY = 864e5;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
  const mny = (n) => nf(n) + ' د.ع';
  const p2 = (n) => String(n).padStart(2, '0');
  const fd = (t) => { if (!t) return '—'; const d = new Date(t + OFF); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
  const fdt = (t) => { if (!t) return '—'; const d = new Date(t + OFF); return fd(t) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); };
  const dayStart = (t) => Math.floor((t + OFF) / DAY) * DAY - OFF;
  const ago = (t) => {
    if (!t) return '—';
    const m = Math.floor((Date.now() - t) / 6e4);
    if (m < 1) return 'الآن'; if (m < 60) return 'قبل ' + m + ' د';
    const h = Math.floor(m / 60); if (h < 24) return 'قبل ' + h + ' س';
    return 'قبل ' + Math.floor(h / 24) + ' يوم';
  };
  const ST = {
    pending: 'بانتظار سائق', picking_up: 'قيد الاستلام من التاجر', on_the_way: 'في الطريق للزبون', delivered: 'تم التسليم', no_answer: 'لا يرد', postponed: 'تأجيل', rejected: 'مرفوض من زبون',
    problem: 'مشكلة', other: 'أخرى', returned: 'راجع (استلمه التاجر)', return_sent: 'إرجاع للمتجر — بانتظار تأكيد التاجر', partial: 'راجع جزئي', cancelled: 'ملغي'
  };
  const STC = { pending: 'amber', picking_up: 'blue', on_the_way: 'blue', delivered: 'green', no_answer: 'red', postponed: 'amber', rejected: 'violet', problem: 'red', other: 'red', returned: 'violet', return_sent: 'amber', partial: 'violet', cancelled: 'gray' };
  const fillTpl = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : m));
  const wa = (phone, text) => {
    let d = String(phone || '').replace(/\D/g, '');
    if (d[0] === '0') d = '964' + d.slice(1);
    return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  /* ---- الشعار: كلمة «ريو» واضحة وكبيرة ---- */
  const LOGO = '<svg class="rl" viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ريو للتوصيل أسرع"><rect width="300" height="190" rx="30" fill="#ffd21f"/><g fill="#171200"><rect x="206" y="58" width="72" height="13" rx="6"/><rect x="216" y="86" width="62" height="13" rx="6"/><rect x="206" y="114" width="72" height="13" rx="6"/></g><text x="112" y="122" text-anchor="middle" font-family="Cairo,Tahoma,sans-serif" font-weight="900" font-size="96" fill="#171200" transform="skewX(-6)" style="transform-box:fill-box">ريوو</text><text x="104" y="160" text-anchor="middle" font-family="Cairo,Tahoma,sans-serif" font-weight="700" font-size="22" fill="#5c4d00">للتوصيل أسرع</text></svg>';

  /* ---- تفقيط المبلغ بالعربية ---- */
  const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const HUND = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  function below1000(n) {
    const out = [], h = Math.floor(n / 100), r = n % 100;
    if (h) out.push(HUND[h]);
    if (r) {
      if (r < 20) out.push(ONES[r]);
      else { const u = r % 10, t = Math.floor(r / 10); out.push(u ? ONES[u] + ' و' + TENS[t] : TENS[t]); }
    }
    return out.join(' و');
  }
  function scaleWords(n, one, two, plural, sing) {
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return below1000(n) + ' ' + plural;
    const w = below1000(n).replace(/مائتان$/, 'مائتا');
    return w + ' ' + (n % 100 === 0 ? sing.replace(/اً$/, '') : sing);
  }
  function tafqeet(num) {
    let n = Math.round(Number(num) || 0);
    if (n === 0) return 'صفر دينار عراقي فقط لا غير';
    const parts = [];
    const bil = Math.floor(n / 1e9); n %= 1e9;
    const mil = Math.floor(n / 1e6); n %= 1e6;
    const th = Math.floor(n / 1e3); n %= 1e3;
    if (bil) parts.push(scaleWords(bil, 'مليار', 'ملياران', 'مليارات', 'ملياراً'));
    if (mil) parts.push(scaleWords(mil, 'مليون', 'مليونان', 'ملايين', 'مليوناً'));
    if (th) parts.push(scaleWords(th, 'ألف', 'ألفان', 'آلاف', 'ألفاً'));
    if (n) parts.push(below1000(n));
    return parts.join(' و') + ' دينار عراقي فقط لا غير';
  }

  /* ---- طباعة / PDF (نافذة الطباعة تتيح «حفظ كـ PDF») ---- */
  const DOC_CSS = `
  @page{size:A4;margin:12mm}
  *{box-sizing:border-box}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:Cairo,Tahoma,sans-serif;color:#111;margin:0;font-size:12.5px;line-height:1.6}
  .hd{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #ffd21f;padding-bottom:10px;margin-bottom:12px}
  .hd .rl{width:130px;height:auto;flex:none}
  .hd .t{text-align:left}.hd h1{margin:0;font-size:22px;font-weight:800}.hd small{color:#555;display:block}
  .meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:4px 18px;margin-bottom:10px}
  .meta div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #bbb;padding:2px 0}.meta b{color:#555;font-weight:700}
  .kp{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0 14px}
  .kp div{border:1.5px solid #111;border-radius:10px;padding:6px 10px}.kp small{display:block;color:#555}.kp b{font-size:15px}
  .kp .hi{background:#ffd21f}
  h2{font-size:14px;margin:16px 0 6px;font-weight:800;border-right:5px solid #ffd21f;padding-right:8px}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th{background:#111;color:#fff;font-weight:700;text-align:right;padding:5px 7px;font-size:11.5px}
  td{border-bottom:1px solid #ddd;padding:4px 7px;vertical-align:top}
  tr:nth-child(even) td{background:#f7f7f7}
  td.n,th.n{text-align:left;direction:ltr;white-space:nowrap}
  tfoot td{font-weight:800;background:#fff3b0!important;border-top:2px solid #111}
  .ft{margin-top:18px;border-top:1px dashed #999;padding-top:8px;color:#555;font-size:11px;display:flex;justify-content:space-between}
  .sig{display:flex;justify-content:space-between;gap:30px;margin-top:34px}.sig div{flex:1;border-top:1.5px solid #111;text-align:center;padding-top:4px;font-weight:700}
  /* وصل حراري مصغّر ومختصر */
  body.t80{max-width:76mm;margin:0 auto;font-size:11px;line-height:1.4}
  .t80 .hd{flex-direction:column;gap:2px;border-bottom:1.5px dashed #888;text-align:center;padding-bottom:4px;margin-bottom:5px}.t80 .hd .t{text-align:center}.t80 .hd h1{font-size:12px}.t80 .hd .rl{width:84px;height:auto}
  .t80 .r{display:flex;justify-content:space-between;gap:6px;padding:1px 0}.t80 .r span{text-align:left}
  .t80 hr{border:0;border-top:1px dashed #999;margin:3px 0}
  .t80 .bx{border:1.5px solid #111;border-radius:8px;padding:3px 8px;font-weight:800;font-size:13px;display:flex;justify-content:space-between;margin:4px 0}
  .t80 .ttl{border:1.5px solid #111;border-radius:8px;text-align:center;padding:2px;font-weight:800;font-size:12.5px;margin:4px 0}
  .t80 .no{text-align:center;font-weight:800;font-size:15px;line-height:1.2}
  body.sz58{max-width:54mm;font-size:9.5px}
  .sz58 .hd .rl{width:70px;height:auto}.sz58 .ttl{font-size:11px;padding:2px}.sz58 .bx{font-size:11px;padding:3px 6px}.sz58 .no{font-size:13px}.sz58 .r{gap:3px}
  body.sz80{max-width:76mm}
  body.t80.sza5{max-width:130mm;font-size:13px}body.t80.sza4{max-width:170mm;font-size:14px}
  .t80.sza5 .hd .rl,.t80.sza4 .hd .rl{width:130px;height:auto}
  .words{border:1.5px solid #111;border-radius:10px;padding:8px 12px;margin:10px 0;background:#fff8d6;font-weight:700}
  .big{font-size:26px;font-weight:800;direction:ltr;text-align:center;border:3px solid #111;border-radius:14px;padding:8px;margin:12px 0}
  @media screen{body{padding:14px}}
  `;
  const PAGEBOX = { '58': '58mm auto;margin:2mm', '80': '80mm auto;margin:3mm', a5: 'A5;margin:8mm', a4: 'A4;margin:10mm' };
  const pageCss = (cls) => { const m = /sz(58|80|a5|a4)/.exec(cls || ''); return m ? '@page{size:' + PAGEBOX[m[1]] + '}' : ''; };
  const docPage = (title, body, cls) => '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>' + esc(title) + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800;900&display=swap"><style>' + DOC_CSS + pageCss(cls) + '</style></head><body class="' + (cls || '') + '">' + body + '</body></html>';
  function printDoc(title, body, cls) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open();
    d.write(docPage(title, body, cls));
    d.close();
    const go = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* ignore */ } setTimeout(() => f.remove(), 60000); };
    let done = false;
    const once = () => { if (!done) { done = true; setTimeout(go, 250); } };
    try { d.fonts.ready.then(once); } catch (e) { /* ignore */ }
    setTimeout(once, 1800);
  }
  const SZPX = { '58': 232, '80': 315, a5: 560, a4: 794 };
  const loadH2C = () => (window.html2canvas ? Promise.resolve(window.html2canvas) : new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    sc.onload = () => res(window.html2canvas); sc.onerror = () => rej(new Error('تعذّر تحميل أداة الصور، تحقق من الإنترنت'));
    document.head.appendChild(sc);
  }));
  /* حفظ الوصل كصورة PNG بنفس حجمه المختار */
  async function saveDocImage(title, body, cls, name) {
    const h2c = await loadH2C();
    const m = /sz(58|80|a5|a4)/.exec(cls || ''), w = SZPX[m ? m[1] : '80'];
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-10000px;top:0;height:1400px;border:0;background:#fff;width:' + w + 'px';
    document.body.appendChild(f);
    try {
      const d = f.contentWindow.document;
      d.open(); d.write(docPage(title, body, cls)); d.close();
      try { await d.fonts.ready; } catch (e) { /* ignore */ }
      await new Promise((r) => setTimeout(r, 450));
      const canvas = await h2c(d.body, { scale: 3, backgroundColor: '#ffffff', useCORS: true, width: w, windowWidth: w });
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name || 'rio.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally { f.remove(); }
  }
  const hdr = (title, sub) => '<div class="hd">' + LOGO + '<div class="t"><h1>' + esc(title) + '</h1><small>ريو للتوصيل أسرع' + (sub ? ' · ' + esc(sub) : '') + '</small></div></div>';
  const tbl = (head, rows, foot) => '<table><thead><tr>' + head.map((h) => '<th' + (h[0] === '#' ? ' class="n"' : '') + '>' + esc(h.replace(/^#/, '')) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((c, i) => '<td' + (head[i] && head[i][0] === '#' ? ' class="n"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody>' +
    (foot ? '<tfoot><tr>' + foot.map((c, i) => '<td' + (head[i] && head[i][0] === '#' ? ' class="n"' : '') + '>' + esc(c) + '</td>').join('') + '</tr></tfoot>' : '') + '</table>';

  /* تقرير A4: { title, sub, meta:[[k,v]], kpis:[[l,v,hi]], sections:[{title,head,rows,foot}] } */
  function docA4(o) {
    return hdr(o.title, o.sub) +
      (o.meta ? '<div class="meta">' + o.meta.map(([k, v]) => '<div><b>' + esc(k) + '</b><span>' + esc(v) + '</span></div>').join('') + '</div>' : '') +
      (o.kpis ? '<div class="kp">' + o.kpis.map(([l, v, hi]) => '<div class="' + (hi ? 'hi' : '') + '"><small>' + esc(l) + '</small><b>' + esc(v) + '</b></div>').join('') + '</div>' : '') +
      (o.sections || []).map((s) => (s.title ? '<h2>' + esc(s.title) + '</h2>' : '') + (s.rows.length ? tbl(s.head, s.rows, s.foot) : '<p style="color:#777">لا توجد بيانات</p>')).join('') +
      '<div class="ft"><span>صدر بتاريخ ' + fdt(Date.now()) + '</span><span>ريو للتوصيل أسرع</span></div>';
  }
  /* وصل حراري: { title, no, rows:[[l,v]], boxes:[[l,v]] } */
  function doc80(o) {
    const rw = (l, v) => '<div class="r"><b>' + esc(l) + '</b><span dir="auto">' + esc(v) + '</span></div>';
    return '<div class="hd">' + LOGO + '<div class="t"><h1>ريو للتوصيل أسرع</h1></div></div>' +
      '<div class="ttl">' + esc(o.title) + '</div>' + (o.no ? '<div class="no">#' + esc(o.no) + '</div>' : '') +
      o.groups.map((grp, i) => (i ? '<hr>' : '') + (grp.rows || []).map(([l, v]) => rw(l, v)).join('') + (grp.boxes || []).map(([l, v]) => '<div class="bx"><span>' + esc(l) + '</span><span dir="ltr">' + esc(v) + '</span></div>').join('')).join('') +
      (o.foot ? '<hr><div style="text-align:center;font-size:11px;color:#444">' + esc(o.foot) + '</div>' : '');
  }

  /* ---- Excel (SheetJS بتحميل كسول) مع بديل CSV ---- */
  let xl = null;
  function loadXlsx() {
    if (g.XLSX) return Promise.resolve(g.XLSX);
    if (xl) return xl;
    xl = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = () => res(g.XLSX); s.onerror = () => { xl = null; rej(new Error('xlsx')); };
      document.head.appendChild(s);
    });
    return xl;
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  }
  /* sheets: [{ name, rows:[[...]] }] — الصف الأول عناوين */
  async function exportXlsx(file, sheets) {
    try {
      const X = await loadXlsx();
      const wb = X.utils.book_new();
      sheets.forEach((s) => {
        const ws = X.utils.aoa_to_sheet(s.rows);
        const w = []; s.rows.forEach((r) => r.forEach((c, i) => { w[i] = Math.max(w[i] || 8, Math.min(42, String(c ?? '').length + 3)); }));
        ws['!cols'] = w.map((x) => ({ wch: x }));
        ws['!views'] = [{ rightToLeft: true }];
        X.utils.book_append_sheet(wb, ws, String(s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet');
      });
      wb.Workbook = { Views: [{ RTL: true }] };
      X.writeFile(wb, file + '.xlsx');
    } catch (e) {
      const csv = '﻿' + sheets.map((s) => s.rows.map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n')).join('\r\n\r\n');
      download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), file + '.csv');
    }
  }

  g.RL = { OFF, DAY, esc, nf, mny, fd, fdt, dayStart, ago, ST, STC, wa, LOGO, tafqeet, printDoc, saveDocImage, docPage, docA4, doc80, exportXlsx, tbl, fillTpl };
})(window);
