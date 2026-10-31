/* Offline support: keeps a copy of the trainer on the phone.
   Change VERSION whenever the files change, so phones pick up the new version. */
const VERSION = "imperfectum-v2";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "qr.js",
  "atkinson-400.woff2", "atkinson-400-italic.woff2", "atkinson-700.woff2",
  "literata-500.woff2", "literata-600.woff2",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // The page itself: get the newest version when online (wait at most 3 seconds), else use the saved copy.
  if (req.mode === "navigate") {
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"));
    const net = fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(cache => cache.put(req, copy)); }
      return res;
    });
    event.waitUntil(net.catch(() => {}));
    event.respondWith(
      Promise.race([net, new Promise(resolve => setTimeout(resolve, 3000, null))])
        .then(res => (res && res.ok ? res : fromCache()))
        .catch(fromCache)
    );
    return;
  }

  // Fonts, icons, scripts: show the saved copy right away and quietly fetch a fresh one for next time.
  const fresh = fetch(req)
    .then(res => {
      if (!res || !res.ok) return res;
      const copy = res.clone();
      return caches.open(VERSION).then(cache => cache.put(req, copy)).then(() => res);
    })
    .catch(() => null);
  event.waitUntil(fresh.then(() => {}));
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(saved =>
      saved || fresh.then(res => res || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))
    )
  );
});
