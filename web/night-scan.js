/* ماسح QR/باركود للاستلام الليلي: كاميرا (BarcodeDetector) + إدخال رقم الطلب يدوياً. RioScan.open({title, onCode}) */
(function () {
  var st = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function close() {
    if (!st) return;
    st.stop = true;
    try { if (st.stream) st.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* ignore */ }
    if (st.el && st.el.parentNode) st.el.parentNode.removeChild(st.el);
    st = null;
  }
  function msg(text, ok) {
    if (!st) return;
    var m = st.el.querySelector('.rs-msg');
    m.textContent = text; m.style.color = ok ? '#0a7a3c' : '#c0392b';
  }
  async function submit(code) {
    if (!st || st.busy) return;
    code = String(code || '').trim(); if (!code) return;
    var now = Date.now();
    if (code === st.last && now - st.lastAt < 3500) return;
    st.last = code; st.lastAt = now; st.busy = true;
    try { var t = await st.onCode(code); msg(t || 'تم', true); if (navigator.vibrate) navigator.vibrate(60); }
    catch (e) { msg(e && e.message ? e.message : 'تعذّر التنفيذ', false); }
    if (st) st.busy = false;
  }
  async function loop() {
    var det = st && st.det;
    while (st && !st.stop && det) {
      try {
        var v = st.el.querySelector('video');
        if (v && v.readyState >= 2) { var r = await det.detect(v); if (r && r.length) submit(r[0].rawValue); }
      } catch (e) { /* ignore frame */ }
      await new Promise(function (r) { setTimeout(r, 350); });
    }
  }
  async function open(o) {
    close();
    var el = document.createElement('div');
    el.setAttribute('dir', 'rtl');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center;font-family:inherit';
    el.innerHTML = '<div style="background:var(--card,#fff);color:var(--text,#111);width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:16px;display:flex;flex-direction:column;gap:10px;max-height:92vh;overflow:auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:17px">' + esc(o.title || 'مسح الباركود') + '</b><button type="button" class="rs-x" style="border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:inherit" aria-label="إغلاق">×</button></div>' +
      '<div class="rs-cam" style="position:relative;background:#000;border-radius:12px;overflow:hidden;aspect-ratio:1/1;display:none"><video playsinline muted autoplay style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;inset:18%;border:3px solid #ffd21f;border-radius:14px"></div></div>' +
      '<p class="rs-cn" style="margin:0;font-size:13px;opacity:.75"></p>' +
      '<div style="display:flex;gap:8px"><input class="rs-in" inputmode="numeric" placeholder="' + esc(o.placeholder || 'أو اكتب رقم الطلب') + '" style="flex:1;min-height:44px;border:1px solid #ccc;border-radius:10px;padding:0 12px;font-size:16px;background:transparent;color:inherit"><button type="button" class="rs-go" style="min-height:44px;padding:0 18px;border:0;border-radius:10px;background:#ffd21f;color:#171200;font-weight:700;cursor:pointer">استلام</button></div>' +
      '<div class="rs-msg" style="min-height:22px;font-weight:700;font-size:14px" role="status"></div></div>';
    document.body.appendChild(el);
    st = { el: el, onCode: o.onCode, stream: null, det: null, stop: false, busy: false, last: '', lastAt: 0 };
    el.querySelector('.rs-x').onclick = close;
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    var inp = el.querySelector('.rs-in');
    el.querySelector('.rs-go').onclick = function () { var v = inp.value; inp.value = ''; st.last = ''; submit(v); try { inp.focus(); } catch (e) { /* ignore */ } };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') el.querySelector('.rs-go').click(); });
    setTimeout(function () { try { inp.focus(); } catch (e) { /* ignore */ } }, 80);
    var cn = el.querySelector('.rs-cn');
    try {
      if (!('BarcodeDetector' in window)) throw new Error('nodet');
      st.det = new window.BarcodeDetector({ formats: ['qr_code'] });
      st.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      var v = el.querySelector('video'); v.srcObject = st.stream; await v.play();
      el.querySelector('.rs-cam').style.display = 'block';
      cn.textContent = 'وجّه الكاميرا نحو رمز QR الموجود على الطلب';
      loop();
    } catch (e) {
      cn.textContent = 'تعذّر تشغيل الكاميرا على هذا الجهاز، اكتب رقم الطلب يدوياً (الرقم الظاهر على الطلب).';
    }
  }
  window.RioScan = { open: open, close: close };
})();
