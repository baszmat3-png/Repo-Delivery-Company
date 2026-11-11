/* نوافذ التأكيد بتصميم التطبيق بدل نوافذ المتصفح («يعرض موقع ...») */
(function () {
  var css = '' +
    '.rd-ov{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,12,22,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .18s}' +
    '.rd-ov.on{opacity:1}' +
    '.rd-box{width:100%;max-width:380px;background:var(--card,var(--surface,#fff));color:var(--ink,var(--fg,#0f172a));border:1px solid var(--line,#e4e9f0);border-radius:24px;padding:26px 22px 20px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.35);transform:translateY(14px) scale(.96);transition:transform .2s cubic-bezier(.2,.9,.3,1.2);font-family:inherit}' +
    '.rd-ov.on .rd-box{transform:none}' +
    '.rd-ic{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(220,38,38,.12);color:#dc2626}' +
    '.rd-ic.q{background:var(--ac-soft,var(--accent-soft,rgba(255,210,31,.25)));color:var(--ac-text,var(--accent-text,#7d5f00))}' +
    '.rd-ic svg{width:30px;height:30px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.rd-t{font-size:20px;font-weight:800;margin:0 0 8px}' +
    '.rd-m{font-size:15.5px;line-height:1.75;color:var(--ink2,var(--muted,#475569));white-space:pre-line;margin:0 0 6px;word-break:break-word}' +
    '.rd-in{width:100%;margin-top:12px;min-height:48px;border-radius:14px;border:1.5px solid var(--line,#cbd5e1);background:var(--soft2,var(--input,#f8fafc));color:inherit;text-align:center;font:inherit;font-size:17px;font-weight:700;padding:0 12px}' +
    '.rd-in:focus{outline:none;border-color:var(--ac,var(--accent,#ffd21f));box-shadow:0 0 0 3px var(--ac-soft,var(--accent-soft,rgba(255,210,31,.3)))}' +
    '.rd-b{display:flex;gap:10px;margin-top:18px}' +
    '.rd-b button{flex:1;min-height:50px;border-radius:14px;border:0;font:inherit;font-size:16px;font-weight:800;cursor:pointer;transition:transform .08s,opacity .15s}' +
    '.rd-b button:active{transform:scale(.97)}' +
    '.rd-b button:disabled{opacity:.4;cursor:not-allowed}' +
    '.rd-c{background:var(--soft,var(--surface-2,#eef1f6));color:var(--ink,var(--fg,#0f172a))}' +
    '.rd-o{background:var(--ac-bg,var(--accent-bg,#ffd21f));color:var(--ac-ink,var(--accent-ink,#171200))}' +
    '.rd-o.d{background:#dc2626;color:#fff}' +
    '@media(max-width:520px){.rd-ov{align-items:flex-end;padding:12px}.rd-box{max-width:none;border-radius:26px}}' +
    '@media(prefers-reduced-motion:reduce){.rd-ov,.rd-box{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  var ASK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg>';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function open(msg, o) {
    o = o || {};
    var danger = o.danger !== undefined ? o.danger : /حذف|تصفير|إلغاء الحساب/.test(msg + ' ' + (o.title || ''));
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var ov = document.createElement('div'); ov.className = 'rd-ov'; ov.setAttribute('dir', 'rtl');
      ov.innerHTML = '<div class="rd-box" role="alertdialog" aria-modal="true" aria-labelledby="rd-t" aria-describedby="rd-m">' +
        '<div class="rd-ic ' + (danger ? '' : 'q') + '" aria-hidden="true">' + (danger ? TRASH : ASK) + '</div>' +
        '<h2 class="rd-t" id="rd-t">' + esc(o.title || (danger ? 'تأكيد الحذف' : 'تأكيد')) + '</h2>' +
        '<p class="rd-m" id="rd-m">' + esc(msg) + '</p>' +
        (o.type ? '<input class="rd-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(o.type) + '" aria-label="اكتب ' + esc(o.type) + ' للتأكيد">' : '') +
        '<div class="rd-b"><button type="button" class="rd-c">' + esc(o.cancel || 'إلغاء') + '</button><button type="button" class="rd-o ' + (danger ? 'd' : '') + '"' + (o.type ? ' disabled' : '') + '>' + esc(o.ok || (danger ? 'حذف' : 'تأكيد')) + '</button></div></div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('on'); });
      var bc = ov.querySelector('.rd-c'), bo = ov.querySelector('.rd-o'), inp = ov.querySelector('.rd-in');
      function done(v) {
        document.removeEventListener('keydown', key, true);
        ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 180);
        try { if (prev && prev.focus) prev.focus(); } catch (e) { /* ignore */ }
        resolve(v);
      }
      function ok() { if (inp && inp.value.trim() !== o.type) return; done(true); }
      function key(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (document.activeElement === bc) done(false); else ok(); }
        else if (e.key === 'Tab') {
          var f = [inp, bc, bo].filter(function (x) { return x && !x.disabled; }), i = f.indexOf(document.activeElement);
          e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
      }
      document.addEventListener('keydown', key, true);
      bc.onclick = function () { done(false); }; bo.onclick = ok;
      ov.addEventListener('click', function (e) { if (e.target === ov) done(false); });
      if (inp) { inp.oninput = function () { bo.disabled = inp.value.trim() !== o.type; }; setTimeout(function () { inp.focus(); }, 60); }
      else setTimeout(function () { (danger ? bc : bo).focus(); }, 60);
    });
  }
  window.RioDialog = {
    confirm: function (msg, o) { return open(msg, o); },
    /* تأكيد بكتابة كلمة (للحذف الخطير) */
    typed: function (msg, word, o) { return open(msg, Object.assign({ type: word, danger: true }, o || {})); }
  };
})();
