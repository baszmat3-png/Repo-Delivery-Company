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
  const LOGO = '<img class="rl" src="data:image/jpeg;base64,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" alt="ريو للتوصيل اسرع" style="border-radius:10px">';

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
  const hdr = (title, sub) => '<div class="hd">' + LOGO + '<div class="t"><h1>' + esc(title) + '</h1><small>ريو للتوصيل اسرع' + (sub ? ' · ' + esc(sub) : '') + '</small></div></div>';
  const tbl = (head, rows, foot) => '<table><thead><tr>' + head.map((h) => '<th' + (h[0] === '#' ? ' class="n"' : '') + '>' + esc(h.replace(/^#/, '')) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((c, i) => '<td' + (head[i] && head[i][0] === '#' ? ' class="n"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody>' +
    (foot ? '<tfoot><tr>' + foot.map((c, i) => '<td' + (head[i] && head[i][0] === '#' ? ' class="n"' : '') + '>' + esc(c) + '</td>').join('') + '</tr></tfoot>' : '') + '</table>';

  /* تقرير A4: { title, sub, meta:[[k,v]], kpis:[[l,v,hi]], sections:[{title,head,rows,foot}] } */
  function docA4(o) {
    return hdr(o.title, o.sub) +
      (o.meta ? '<div class="meta">' + o.meta.map(([k, v]) => '<div><b>' + esc(k) + '</b><span>' + esc(v) + '</span></div>').join('') + '</div>' : '') +
      (o.kpis ? '<div class="kp">' + o.kpis.map(([l, v, hi]) => '<div class="' + (hi ? 'hi' : '') + '"><small>' + esc(l) + '</small><b>' + esc(v) + '</b></div>').join('') + '</div>' : '') +
      (o.sections || []).map((s) => (s.title ? '<h2>' + esc(s.title) + '</h2>' : '') + (s.rows.length ? tbl(s.head, s.rows, s.foot) : '<p style="color:#777">لا توجد بيانات</p>')).join('') +
      '<div class="ft"><span>صدر بتاريخ ' + fdt(Date.now()) + '</span><span>ريو للتوصيل اسرع</span></div>';
  }
  /* وصل حراري: { title, no, rows:[[l,v]], boxes:[[l,v]] } */
  function doc80(o) {
    const rw = (l, v) => '<div class="r"><b>' + esc(l) + '</b><span dir="auto">' + esc(v) + '</span></div>';
    return '<div class="hd">' + LOGO + '<div class="t"><h1>ريو للتوصيل اسرع</h1></div></div>' +
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
