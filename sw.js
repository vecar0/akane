// 천고 service worker: network-first for the game files (so updates land on the next launch),
// cache fallback for offline play, cache-first for Google Fonts.
const CACHE = "chungo-v50";
const CORE = ["./", "index.html", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const OPTIONAL = ["assets/far.webp", "assets/mid.webp", "assets/title.webp", "assets/tex-paper.webp", "assets/audio/bgm.mp3?v=572", "assets/tex-stone.webp", "assets/tex-giwa.webp", "assets/tex-granite.webp", "assets/tex-slab.webp", "assets/sprites/hero.webp", "assets/sprites/hero.json", "assets/sprites/foes.webp", "assets/sprites/foes.json", "assets/sprites/objects.webp", "assets/sprites/objects.json", "assets/sprites/ui.webp", "assets/sprites/ui.json", "assets/sprites/rogue.webp", "assets/sprites/rogue.json", "assets/sprites/rogue2.webp", "assets/sprites/rogue2.json", "assets/sprites/roguea.webp", "assets/sprites/roguea.json", "assets/sprites/rogue3.webp", "assets/sprites/rogue3.json", "assets/sprites/rogue4.webp", "assets/sprites/rogue4.json", "assets/sprites/foes2.webp", "assets/sprites/foes2.json", "assets/sprites/bossA.webp", "assets/sprites/bossA.json", "assets/sprites/bossB.webp", "assets/sprites/bossB.json", "assets/sprites/bossfx.webp", "assets/sprites/bossfx.json", "assets/sprites/bossC.webp", "assets/sprites/bossC.json", "assets/sprites/bossD.webp", "assets/sprites/bossD.json", "assets/sprites/bossE.webp", "assets/sprites/bossE.json", "assets/sprites/bossF.webp", "assets/sprites/bossF.json", "assets/sprites/hero3.webp", "assets/sprites/hero3.json", "assets/sprites/herofx.webp", "assets/sprites/herofx.json", "assets/sprites/slashfx.webp", "assets/sprites/slashfx.json", "assets/sprites/perkfx.webp", "assets/sprites/perkfx.json", "assets/sprites/weapons.webp", "assets/sprites/weapons.json", "assets/sprites/chars.webp", "assets/sprites/chars.json", "assets/sprites/misc.webp", "assets/sprites/misc.json", "assets/sprites/ic0.webp", "assets/sprites/ic0.json", "assets/sprites/ic1.webp", "assets/sprites/ic1.json", "assets/sprites/ic2.webp", "assets/sprites/ic2.json", "assets/sprites/ic3.webp", "assets/sprites/ic3.json", "assets/sprites/ic4.webp", "assets/sprites/ic4.json", "assets/sprites/ic5.webp", "assets/sprites/ic5.json", "assets/sprites/ic6.webp", "assets/sprites/ic6.json", "assets/sprites/ic7.webp", "assets/sprites/ic7.json", "assets/sprites/ic8.webp", "assets/sprites/ic8.json", "assets/sprites/ic9.webp", "assets/sprites/ic9.json", "assets/sprites/ic10.webp", "assets/sprites/ic10.json", "assets/sprites/ic11.webp", "assets/sprites/ic11.json", "assets/sprites/ic12.webp", "assets/sprites/ic12.json", "assets/sprites/ic13.webp", "assets/sprites/ic13.json", "assets/sprites/ic14.webp", "assets/sprites/ic14.json", "assets/sprites/ic15.webp", "assets/sprites/ic15.json", "assets/sprites/mu.webp", "assets/sprites/mu.json", "assets/sprites/po.webp", "assets/sprites/po.json", "assets/sprites/mfx.webp", "assets/sprites/mfx.json", "assets/sprites/pfx.webp", "assets/sprites/pfx.json", "assets/sprites/arms.webp", "assets/sprites/arms.json", "assets/lore.webp"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE);
    await Promise.all(OPTIONAL.map(u => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: "no-cache" }).then(r => { // revalidate so a new deploy shows up immediately
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
