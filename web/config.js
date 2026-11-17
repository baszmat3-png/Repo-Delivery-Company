// عنوان الخادم. على الموقع نفسه يبقى فارغاً (نفس النطاق)، وداخل تطبيق الجوال (Capacitor) يُستخدم خادم Render.
window.RIO_API = "";
(function () {
  var p = location.protocol, h = location.hostname;
  if (p === 'capacitor:' || p === 'file:' || p === 'ionic:' || (h === 'localhost' && !location.port)) {
    window.RIO_API = "https://repo-delivery-company2.onrender.com";
  }
})();
