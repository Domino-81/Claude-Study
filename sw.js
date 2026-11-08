/* CCA-F 合格ノート service worker — アプリ本体を端末に保存し、電波がなくても起動できるようにする */
const VERSION = 'ccaf-571b8efcfb';
const FONT_CACHE = 'fonts-ccaf';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ccaf-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ページ本体（アプリのトップと index.html だけ）：保存済みの版をすぐ表示し、裏で最新版を取りに行く
  if (req.mode === 'navigate') {
    const scope = new URL(self.registration.scope).pathname;
    const isShell = url.origin === self.location.origin && (url.pathname === scope || url.pathname === scope + 'index.html');
    if (!isShell) return; // それ以外の画面遷移はネットワークに任せる
    e.respondWith(
      caches.open(VERSION).then(cache => cache.match('./index.html').then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.ok && (res.headers.get('content-type') || '').includes('text/html')) cache.put('./index.html', res.clone());
          return res;
        }).catch(() => cached || Response.error());
        return cached || net;
      }))
    );
    return;
  }

  // 同じサイトの静的ファイル：キャッシュ優先
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(VERSION).then(cache => cache.match(req, { ignoreSearch: true }).then(cached =>
        cached || fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
      ))
    );
    return;
  }

  // Webフォント：使った分だけ保存しておく（なければ端末フォントで表示）
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(cache => cache.match(req).then(cached => {
        const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => cached || Response.error());
        return cached || net;
      }))
    );
  }
});
