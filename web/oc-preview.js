'use strict';
/* ريو — معاينة تصاميم الوصولات (بطاقة الطلب) داخل لوحة التحكم.
   تعرض نفس تصاميم التطبيق بنفس ملف style.css. إن عُدّل تصميم في app.js يُعدَّل هنا أيضاً. */
(function () {
  var D = [
    ['classic', 'كلاسيكي', 'الشكل الحالي'],
    ['bold', 'أسود وأصفر', 'عريض وواضح'],
    ['green', 'أخضر متدرّج', 'مع شريط تقدّم الطلب'],
    ['ticket', 'تذكرة', 'بشكل قسيمة'],
    ['sun', 'أصفر وبني', 'بطاقات ملوّنة'],
    ['night', 'داكن', 'مسار التوصيل']
  ];
  var P = {
    store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>'
  };
  var ico = function (n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; };
  var num = function (n) { return '<span class="num">' + Number(n).toLocaleString('en-US') + '</span>'; };
  var dinar = function (n) { return num(n) + ' دينار'; };
  var pill = '<span class="pill green">تم التسليم</span>';
  var O = { no: 1069, merchantName: 'متجر الرافدين', productPrice: 1000000, deliveryPrice: 5000, merchantArea: 'الكرادة', customerArea: 'حي اور', status: 'delivered' };
  var cbtn = function (c, t, i) { return '<button class="oc-cb ' + c + '"><span>' + t + '</span>' + i + '</button>'; };
  var corner = cbtn('g', 'محادثة', ico('chat')) + cbtn('r', 'ملاحظة', '<span class="oc-ex">!</span>');
  var row = function (i, l, v) { return '<div class="oc-r"><span class="oc-i">' + ico(i) + '</span><span class="oc-l">' + l + '<i class="oc-c">:</i></span><span class="oc-v">' + v + '</span></div>'; };
  var STEPS = ['قبول', 'استلام', 'تسليم'];

  function classic() {
    return '<article class="oc"><div class="oc-top"><div class="oc-no">رقم الطلب : <bdi>#' + O.no + '</bdi><small>قبل 14 ساعة</small></div><div class="oc-corner">' + corner + '</div></div>' +
      row('store', 'اسم المتجر', O.merchantName) +
      '<div class="oc-r"><span class="oc-i"><span class="oc-d">$</span></span><span class="oc-l">سعر الطلب:</span><span class="oc-v">' + dinar(O.productPrice) + '</span><span class="oc-grp"><span class="oc-plus">+</span><span class="oc-l">التوصيل:</span><span class="oc-v">' + dinar(O.deliveryPrice) + '</span></span></div>' +
      row('pin', 'عنوان المتجر', '<span class="oc-chip">' + O.merchantArea + '</span>') +
      row('pin', 'عنوان الزبون', '<span class="oc-chip">' + O.customerArea + '</span>') +
      '<hr class="oc-sep">' + row('phone', 'الحالة', pill) + '</article>';
  }
  function steps() {
    return '<div class="od-steps">' + STEPS.map(function (t, i) { return (i ? '<span class="od-ln on"></span>' : '') + '<span class="od-s on"><i>' + ico('check') + '</i><small>' + t + '</small></span>'; }).join('') + '</div>';
  }
  function alt(d) {
    var delivery = '<span class="od-dl">+ توصيل ' + num(O.deliveryPrice) + '</span>';
    var head = '<div class="od-hd"><div class="od-no"><span class="od-nol">رقم الطلب</span><bdi>#' + O.no + '</bdi></div><span class="od-ago">قبل 14 ساعة</span></div>';
    var stat = '<div class="od-st"><span class="od-sv">' + pill + '</span><span class="od-sl">الحالة</span></div>';
    var store = '<div class="od-store"><span class="od-av">م</span><span class="od-sn"><small>اسم المتجر</small><b>' + O.merchantName + '</b></span></div>';
    var price = d === 'sun'
      ? '<div class="od-pr"><div class="od-pb"><small>سعر الطلب</small><div><b class="od-big">' + num(O.productPrice) + '</b> <em>دينار</em></div></div><div class="od-db"><small>التوصيل</small><div><b>' + num(O.deliveryPrice) + '</b> <em>دينار</em></div></div></div>'
      : d === 'night'
        ? '<div class="od-pr"><div class="od-pm"><small class="od-pl">سعر الطلب</small><b class="od-big">' + num(O.productPrice) + '</b><em>دينار</em></div>' + delivery + '</div>'
        : '<div class="od-pr"><small class="od-pl">سعر الطلب</small><div class="od-pm"><span class="od-pv"><b class="od-big">' + num(O.productPrice) + '</b><em>دينار</em></span></div>' + delivery + '</div>';
    var addr = '<div class="od-ad"><div class="od-ab"><small>عنوان المتجر</small><b>' + O.merchantArea + '</b></div><span class="od-arrow" aria-hidden="true"></span><div class="od-ab"><small>عنوان الزبون</small><b>' + O.customerArea + '</b></div></div>';
    var tail = '<button type="button" class="od-tg">▾ عرض التفاصيل</button><div class="od-main">' + corner + '</div>';
    var inner;
    if (d === 'green') inner = '<div class="od-top">' + head + store + price + '</div><div class="od-body">' + stat + steps() + addr + tail + '</div>';
    else if (d === 'ticket') inner = '<div class="od-half od-top">' + head + stat + store + '</div><div class="od-half od-bot">' + price + addr + tail + '</div>';
    else if (d === 'sun') inner = '<div class="od-top">' + head + '</div><div class="od-body">' + stat + store + price + addr + tail + '</div>';
    else if (d === 'night') inner = '<div class="od-body">' + head + stat + store + price + addr + tail + '</div>';
    else inner = '<div class="od-top">' + head + '</div>' + stat + '<div class="od-body">' + store + price + addr + tail + '</div>';
    return '<article class="od od-' + d + '" data-st="delivered">' + inner + '</article>';
  }
  /* صفحة مستقلة لعرضها داخل iframe (تستخدم style.css نفسه ومظهر اللوحة الحالي) */
  function doc(k) {
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap">' +
      '<link rel="stylesheet" href="style.css"><script src="theme.js"><\/script>' +
      '<style>html,body{margin:0;background:transparent!important;overflow:hidden;height:100%}.odp-box{height:100%;border-radius:0;background:transparent}.odp-in{top:6px;right:50%;margin-right:-180px;width:360px;transform-origin:top center;transform:scale(.55) translateX(0)}</style>' +
      '</head><body><div class="odp-box"><div class="odp-in">' + (k === 'classic' ? classic() : alt(k)) + '</div></div></body></html>';
  }
  window.RioOC = { list: D, valid: function (k) { return D.some(function (d) { return d[0] === k; }); }, doc: doc };
})();
