// node tools/build-demo.js  ->  demo.html (ملف واحد مستقل)
const fs = require('fs'), path = require('path');
const r = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const css = r('web/style.css'), app = r('web/app.js'), mock = fs.readFileSync(path.join(__dirname, 'demo-mock.js'), 'utf8');
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ريو للتوصيل أسرع - نسخة تجريبية</title>
<meta name="theme-color" content="#0b1119">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>${css}</style>
</head>
<body>
<div id="app" aria-live="polite"></div>
<div id="sheet-root" hidden></div>
<div id="toast-root" role="status"></div>
<script>${mock}</script>
<script>${app}</script>
</body>
</html>`;
fs.writeFileSync(path.join(__dirname, '..', 'demo.html'), html);
console.log('demo.html', (html.length / 1024).toFixed(0) + 'KB');
