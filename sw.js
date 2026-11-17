// 离线缓存：出牌计算和练习完全本地，没网也能用；AI 功能需要联网。
// 策略：先走网络（保证更新后立刻生效），断网时用缓存。
const CACHE = 'hzmj-v2';
const FILES = ['./', 'index.html', 'practice.html', 'mahjong.js', 'practice.js', 'practice-worker.js', 'ai.js',
               'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // AI 接口请求不缓存
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
