/* ══════════════════════════════════════════════════════════════════
   قرب — Service Worker
   هدف: برنامه بعد از اولین بازکردن، کاملاً آفلاین کار کند و آیکنش
   روی صفحهٔ خانه بنشیند.

   سه سیاست متفاوت، چون سه نوع درخواست رفتار متفاوتی لازم دارند:
   ۱. ناوبری (خود صفحه) → اول شبکه، بعد کش. اگر اول کش می‌خواندیم،
      نسخهٔ جدیدی که آپلود می‌کنید هیچ‌وقت دیده نمی‌شد.
   ۲. فونت‌های گوگل → اول کش. این‌ها نسخه‌دار و تغییرناپذیرند و
      همین‌ها بودند که آفلاین‌نبودنشان متن عربی را خراب می‌کرد.
   ۳. بقیهٔ فایل‌های خودمان (آیکن‌ها، منیفست) → اول کش.
   ══════════════════════════════════════════════════════════════════ */
const CACHE = 'qurb-v3';
const PRECACHE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  // allSettled نه addAll: اگر یکی از فایل‌ها ۴۰۴ بدهد، addAll کل نصب را
  // شکست می‌دهد و برنامه بی‌سرویس‌ورکر می‌ماند
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map(u => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isFont = u => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ۱. خود صفحه: اول شبکه تا به‌روزرسانی دیده شود، آفلاین از کش
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./')) || (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // ۲ و ۳: اول کش، و در پس‌زمینه کش را تازه نگه‌دار
  if (isFont(url) || url.origin === location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // پاسخ opaque (بدون CORS) هم ارزش کش‌شدن دارد: فونت‌ها همین‌طورند
        if (res && (res.ok || res.type === 'opaque')) {
          const c = await caches.open(CACHE);
          c.put(req, res.clone());
        }
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});
