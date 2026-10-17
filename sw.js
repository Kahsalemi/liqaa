/* ============================================================
   لقاء — Service Worker
   استراتيجية:
   - طلبات التنقل (HTML): الشبكة أولاً ثم الكاش (لتظهر أحدث نسخة)
   - الملفات الثابتة: الكاش أولاً مع تحديث في الخلفية
   - التحديثات تُطبّق فوراً عبر skipWaiting + clients.claim
   ============================================================ */

const CACHE_VERSION = 'liqaa-v1.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './about.html',
  './styles.css',
  './pwa.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

/* التثبيت: تخزين هيكل التطبيق */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* التنشيط: حذف الإصدارات القديمة */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* الجلب */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // تجاهل غير GET والطلبات الخارجية (واتساب، خطوط جوجل، إلخ)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // التنقل بين الصفحات: الشبكة أولاً
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // الملفات الثابتة: الكاش أولاً مع تحديث خلفي
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* السماح للصفحة بطلب تفعيل التحديث فوراً */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
