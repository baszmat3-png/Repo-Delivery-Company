/* ريو — الثيمات (تُحمَّل في <head> لتجنّب الوميض). تُحفظ في الجهاز وتُشارَك بين التطبيق ولوحة التحكم. */
(function () {
  'use strict';
  var KEY = 'rio_theme';
  var LIST = [
    { id: 'white', name: 'أبيض', sw: 'linear-gradient(135deg,#ffffff,#e6ecf3)', meta: '#f2f5f8' },
    { id: 'black', name: 'أسود', sw: 'linear-gradient(135deg,#1b1e24,#000000)', meta: '#050607' },
    { id: 'ocean', name: 'أزرق', sw: 'linear-gradient(135deg,#0a2a5e,#0f8fc4)', meta: '#0a2a5e' },
    { id: 'sunset', name: 'غروب', sw: 'linear-gradient(135deg,#3a0f4d,#e8604c)', meta: '#3a0f4d' },
    { id: 'forest', name: 'أخضر', sw: 'linear-gradient(135deg,#052e1f,#1f9d6a)', meta: '#052e1f' }
  ];
  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function valid(id) { return LIST.some(function (t) { return t.id === id; }); }
  function get() {
    var s = stored();
    if (valid(s)) return s;
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'white' : 'black'; } catch (e) { return 'black'; }
  }
  function apply(id) {
    if (!valid(id)) id = get();
    document.documentElement.setAttribute('data-theme', id);
    var t = LIST.filter(function (x) { return x.id === id; })[0];
    var m = document.querySelector('meta[name="theme-color"]');
    if (m && t) m.setAttribute('content', t.meta);
  }
  function set(id) {
    if (!valid(id)) return;
    try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    apply(id);
  }
  /* شبكة اختيار الثيم. attr = اسم السمة التي يلتقطها معالج النقر (data-act في التطبيق، data-a في اللوحة) */
  function picker(attr) {
    var cur = get();
    return '<div class="themes" role="group" aria-label="المظهر">' + LIST.map(function (t) {
      return '<button type="button" class="theme-opt" ' + attr + '="theme" data-t="' + t.id + '" aria-pressed="' + (cur === t.id) + '"><i style="background:' + t.sw + '"></i><span>' + t.name + '</span></button>';
    }).join('') + '</div>';
  }
  window.RioTheme = { list: LIST, get: get, set: set, apply: apply, picker: picker };
  apply(get());
})();
