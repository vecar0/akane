// 천고 — main game. Depends on data.js (TUTORIAL, CHUNKS) and music.js (Music).
(() => {
"use strict";
const T = 32;
const $ = id => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1, SCALE = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  SCALE = Math.max(0.5, Math.min(W / (T * 13), H / (T * 11)));
  vignette = null;
}
window.addEventListener("resize", resize);

// ---------- persistence ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("chungo." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("chungo." + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem("chungo." + k); } catch (e) {} }
};
const settings = Object.assign({ sound: true, offset: 0 }, store.get("settings", {}));
Music.setVolume(settings.sound ? 1 : 0); Music.setOffset(settings.offset);

// ---------- 마당 definitions & palettes ----------
const ORD = ["첫째", "둘째", "셋째", "넷째", "다섯째"];
const MNAME = ["초입", "연비", "망루", "승천", "결전"];   // 初入 鳶飛 望樓 昇天 決戰
const MADANG = [
  // "w" entries draw from wall chunks (climb / wall-jump), so every 마당 has walls to run
  // "w" entries draw from wall chunks, "m" from multi-floor chunks with ledges
  { jd: "jinyang",   line: "북은 아직 멀리서 울린다.",          tiers: [0, "m1", "w0", 1, "m1", "w1", 1] },
  { jd: "jungmori",  line: "연줄 위로, 바람을 타라.",            tiers: ["m1", "w1", 1, "m1", "w0", 1, "m2"] },
  { jd: "jajinmori", line: "포수의 눈은 장단을 놓치지 않는다.",  tiers: [1, "m2", "w1", 2, "m1", "w2", 2] },
  { jd: "hwimori",   line: "오를수록 장단은 빨라진다.",          tiers: ["w1", "m2", 2, "w2", "m1", 1, "w2"] },
  { jd: "danmori",   line: "천고가 가깝다.",                     tiers: ["m2", 2, "w2", "m2", 2, "w1", 2] }
];
const PAL = [
  { bg: "#e6e2d7", tile: "#1c1b1f", fig: "#141317", foe: "#55525b", text: "#1c1b1f", wash: "23,22,26", farA: .5, midA: .78, rim: null },
  { bg: "#dcd6c8", tile: "#1c1b1f", fig: "#141317", foe: "#55525b", text: "#1c1b1f", wash: "23,22,26", farA: .5, midA: .78, rim: null },
  { bg: "#c9c1b1", tile: "#19181c", fig: "#121115", foe: "#4c4952", text: "#19181c", wash: "23,22,26", farA: .5, midA: .8, rim: null },
  { bg: "#8e887e", tile: "#141316", fig: "#0f0e11", foe: "#3a3840", text: "#141316", wash: "18,17,20", farA: .45, midA: .75, rim: "rgba(236,230,216,.18)" },
  { bg: "#252321", tile: "#0b0a0c", fig: "#ece6d8", foe: "#a49d92", text: "#ece6d8", wash: "236,230,216", farA: .22, midA: .35, rim: "rgba(236,230,216,.5)", night: true }
];
const BODY_FONT = getComputedStyle(document.documentElement).getPropertyValue("--f-body");
const HAT_WEAVE = { "#ece6d8": "rgba(60,56,50,.6)" }; // weave lines on the inverted (night) figure
const SEAL = "#c3161c", JJOK = "#27466a", JJOK_L = "#5f86b5";

// ---------- images (optional; drawn procedurally when missing) ----------
// far/mid: Higgsfield ink-wash panoramas with alpha. tex-*: seamless tiles (seam ratio checked <= 1.3).
const IMG = {}, PAT = {};
for (const k of ["tex-paper", "tex-stone", "tex-giwa"]) { const im = new Image(); im.onload = () => { IMG[k] = im; PAT[k] = null; }; im.src = "assets/" + k + ".webp"; }
function pattern(key, scale) { // world- or screen-anchored repeating pattern, built once per image
  if (!IMG[key]) return null;
  if (!PAT[key]) { PAT[key] = ctx.createPattern(IMG[key], "repeat"); PAT[key].setTransform(new DOMMatrix().scale(scale)); }
  return PAT[key];
}
for (const k of ["far", "mid"]) { const im = new Image(); im.onload = () => { IMG[k] = seamlessStrip(im); }; im.src = "assets/" + k + ".webp"; }
// Make a panorama wrap horizontally: the last 22% is cross-faded into the start, so tiling shows no cut or mirror.
function seamlessStrip(img) {
  const w = img.width, h = img.height, ov = Math.round(w * 0.22), P = w - ov;
  const out = document.createElement("canvas"); out.width = P; out.height = h; const g = out.getContext("2d");
  g.drawImage(img, 0, 0, P, h, 0, 0, P, h);
  const t = document.createElement("canvas"); t.width = ov; t.height = h; const tg = t.getContext("2d");
  tg.drawImage(img, P, 0, ov, h, 0, 0, ov, h);
  const m = tg.createLinearGradient(0, 0, ov, 0); m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
  tg.globalCompositeOperation = "destination-in"; tg.fillStyle = m; tg.fillRect(0, 0, ov, h);
  g.globalCompositeOperation = "destination-out"; const m2 = g.createLinearGradient(0, 0, ov, 0); m2.addColorStop(0, "rgba(0,0,0,1)"); m2.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = m2; g.fillRect(0, 0, ov, h);
  g.globalCompositeOperation = "source-over"; g.drawImage(t, 0, 0);
  return out;
}
{ const im = new Image(); im.onload = () => $("menu").classList.add("art"); im.src = "assets/title.webp"; }

// ---------- sprites: Higgsfield sheets, keyed from white paper and sliced into strip atlases ----------
const SPR = {};
const HERO = { idle: 0, run: [1, 2, 3, 4, 5, 6, 7], rise: 8, wall: 9, slash: 10, dash: 11, fall: 12, up: 13, land: 14, dead: 15 };
const HERO_AX = { 0: .5, 9: .5, 10: .4, 11: .55, 13: .45, 14: .55, 15: .45 };   // body centre as a fraction of frame width
const FOE = { g: [0, 1], s: [2, 3], d: [4, 5], h: [6, 7] };
const FOE_AX = { 0: .5, 1: .3, 2: .45, 3: .3, 6: .45, 7: .45 };
const FX = { slashA: 0, slashARed: 1, slashB: 2, slashBRed: 3, burst: 4, spray: 5, seal: 6, drops: 7, pool: 8 };
const HUD = { bigDrum: 0, struck: 1, drum: 2, aimLine: 3, reticle: 4, rope: 5, spark: 6, smoke: 7, dust: 8 }; // hudsolid for 0-5, hud (soft) for 6-8
// props sheet: geumjul rope, enemy aim stroke, dash reticle, then set dressing
const H2 = { idle: [0, 1, 2], guard: 3, start: 4, skid: 5, takeoff: 6, apex: 7, land: 8, turn: 9, cling: 10, climb: 11 };
const P2 = { plank: 0, ledge: 1, board: 2, rack: 3, haetae: 4, gate: 5, brazier: 6, lanterns: 7, sacks: 8 };
const CAL = { title: 0, death: 1, madang: [2, 3, 4, 5, 6], end: 7, clear: 8 };   // 천고 절명 초입 연비 망루 승천 결전 종국 등천
const PROP = { rope: 0, aim: 1, reticle: 2, pine: 3, stoneLantern: 4, jars: 5, banner: 6, sotdae: 7, palisade: 8 };
const DRESS = [[PROP.pine, 74, 3], [PROP.stoneLantern, 34, 2], [PROP.jars, 26, 1], [PROP.banner, 80, 3], [PROP.sotdae, 84, 3], [PROP.palisade, 28, 1]]; // [frame, world height, headroom tiles]
const OBJ = { lanternOn: 0, lanternOff: 1, kite: 2, thorns: 3, seal: 4, emitter: 5, slash: 6, slashRed: 7, splat: 8 };
for (const n of ["hero", "hero2", "foes", "objects", "ui", "fx", "hud", "hudsolid", "props", "props2", "rocks", "pines"]) {
  Promise.all([
    fetch(`assets/sprites/${n}.json`).then(r => r.json()),
    new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `assets/sprites/${n}.webp`; })
  ]).then(([f, img]) => { SPR[n] = { f, img, inv: ["hero", "hero2", "foes", "objects", "fx", "props", "props2", "rocks", "pines"].includes(n) ? inkInverted(img) : null }; applyUiSprites(); }).catch(() => {});
}
function inkInverted(img) { // night palette: grey ink becomes bone white, coloured accents stay as they are
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx - mn < 70) { const v = 236 - (d[i] + d[i + 1] + d[i + 2]) / 3 * 0.55; d[i] = v; d[i + 1] = v * .98; d[i + 2] = v * .94; }
  }
  g.putImageData(id, 0, 0); return c;
}
// draw frame i of a sheet with its (ax, ay) anchor at (x, y); sc = world units per atlas pixel
function drawSprite(sheet, i, x, y, sc, flip, ax = .5, night = false, ay = 1) {
  const s = SPR[sheet]; if (!s || !s.f[i]) return false;
  const f = s.f[i], w = f.w * sc, h = f.h * sc, img = night && s.inv ? s.inv : s.img;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -w * ax, -h * ay, w, h); ctx.restore(); return true;
}
const HERO_H = 58, FOE_H = 62; // drawn heights in world units (hitboxes stay smaller, which reads as fair)
const kOf = (sheet, ref, worldH) => SPR[sheet] ? worldH / SPR[sheet].f[ref].h : 0;
function uiPatch(i, x, y, w, h, alpha = 1) { const s = SPR.ui; if (!s) return false; const f = s.f[i]; ctx.globalAlpha = alpha; ctx.drawImage(s.img, f.x, f.y, f.w, f.h, x, y, w, h); ctx.globalAlpha = 1; return true; }
function applyUiSprites() { // brush-painted UI pieces become CSS images
  const root = document.documentElement.style;
  const url = (sheet, i) => { const s = SPR[sheet], f = s.f[i], c = document.createElement("canvas"); c.width = f.w; c.height = f.h; c.getContext("2d").drawImage(s.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h); return `url(${c.toDataURL()})`; };
  if (SPR.ui && !document.body.classList.contains("ui-ready")) {
    [["ring", 0], ["disc", 1], ["bar", 2], ["drop", 3], ["drop-o", 4], ["wash", 5], ["up", 6], ["arrow", 7], ["pause", 8]].forEach(([n, i]) => root.setProperty("--ui-" + n, url("ui", i)));
    document.body.classList.add("ui-ready");
  }
  if (SPR.objects && !root.getPropertyValue("--ui-kite")) root.setProperty("--ui-kite", url("objects", OBJ.kite));
  if (SPR.calli && !document.body.classList.contains("ui-cal")) {
    root.setProperty("--cal-title", url("calli", CAL.title)); root.setProperty("--cal-end", url("calli", CAL.end)); root.setProperty("--cal-clear", url("calli", CAL.clear));
    CAL.madang.forEach((i, m) => root.setProperty("--cal-m" + m, url("calli", i)));
    document.body.classList.add("ui-cal");
  }
}

// ---------- painted terrain: cliff sprites laid over the tile blocks, big pines behind and in front ----------
function buildScenery() {
  const R = SPR.rocks, rnd = mulberry(hashStr(LV.grid.length + ":" + LV.w)), skins = [], back = [];
  const tall = [], wide = [];
  R.f.forEach((f, i) => (f.h > f.w * 1.15 ? tall : wide).push(i));
  for (let y = 1; y < LV.h; y++) for (let x = 0; x < LV.w; x++) {
    if (tileAt(x, y) !== 1 || tileAt(x, y - 1) === 1 || (x > 0 && tileAt(x - 1, y) === 1 && tileAt(x - 1, y - 1) !== 1)) continue;
    let n = 0; while (x + n < LV.w && tileAt(x + n, y) === 1 && tileAt(x + n, y - 1) !== 1) n++;
    let d = 0; const mid = x + (n >> 1); while (y + d < LV.h && tileAt(mid, y + d) === 1) d++;
    const W0 = n * T, h = Math.min(d * T, (LV.h - y) * T) + 24;
    // long runs are cut into overlapping pieces close to the art's own proportions, so nothing gets smeared
    const segs = Math.max(1, Math.round(W0 / Math.min(8 * T, Math.max(3 * T, h * 1.3))));
    for (let k = 0; k < segs; k++) {
      const w = W0 / segs, pool = h > w * 1.2 && tall.length ? tall : wide.length ? wide : tall;
      const piece = (bias) => ({ i: pool[(rnd() * pool.length) | 0], flip: rnd() < .5, x: x * T + w * (k + .5) + bias, y: y * T - 4, w, h: h + 8 });
      skins.push(piece(0));
      if (d > 2 && y >= 8 && rnd() < .6) { const b = piece((rnd() - .5) * w * .7); b.y -= 18 + rnd() * 40; b.w *= .8 + rnd() * .5; b.h += 40; back.push(b); }
    }
    x += n - 1;
  }
  const pines = [], P = SPR.pines;
  if (P) for (let wx = 200 + rnd() * 200; wx < LV.w * T + 600; wx += 700 + rnd() * 600) pines.push({ i: (rnd() * P.f.length) | 0, x: wx, h: 260 + rnd() * 120, flip: rnd() < .5, a: .35 + rnd() * .2 });
  const front = []; // big pines rooted on cliff edges (behind the actors), like the reference art
  if (P) for (const c of skins) if (c.w >= 3 * T && rnd() < .2) { const right = rnd() < .5; front.push({ i: (rnd() * P.f.length) | 0, x: c.x + (right ? 1 : -1) * (c.w / 2 - 14), y: c.y - 2, h: 150 + rnd() * 70, flip: right }); }
  LV.scenery = { skins, back, pines, front };
}
function drawCliff(c, img, alpha) {
  const f = SPR.rocks.f[c.i], ov = c.w * .14 + 8, w = c.w + ov * 2;
  ctx.save(); ctx.translate(c.x, 0); if (c.flip) ctx.scale(-1, 1); ctx.globalAlpha = alpha;
  ctx.drawImage(img, f.x, f.y, f.w, f.h, -w / 2, c.y, w, c.h); ctx.restore(); ctx.globalAlpha = 1;
}

// ---------- rng ----------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function todayKey() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

// ---------- input ----------
const held = { left: 0, right: 0, up: 0, down: 0, jump: 0, dash: 0, hook: 0 };
const press = { jump: 0, dash: 0, hook: 0 };
const stick = { x: 0, y: 0, id: null, bx: 0, by: 0 };
let slashReq = null;   // {dir|null, ts, dash}
const trail = [];      // swipe ink trail, screen space
function keyAct(code) {
  switch (code) {
    case "ArrowLeft": case "KeyA": return "left";
    case "ArrowRight": case "KeyD": return "right";
    case "ArrowUp": case "KeyW": return "up";
    case "ArrowDown": case "KeyS": return "down";
    case "Space": case "KeyZ": return "jump";
    case "KeyK": case "KeyC": case "ShiftLeft": case "ShiftRight": return "dash";
    case "KeyL": case "KeyV": case "KeyE": return "hook";
  }
  return null;
}
window.addEventListener("keydown", e => {
  if (e.code === "Escape" || e.code === "KeyP") { if (state === "play") pauseGame(); else if (state === "pause") resumeGame(); return; }
  if (e.code === "KeyJ" || e.code === "KeyX") { if (!e.repeat) { Music.unlock(); slashReq = { dir: null, ts: e.timeStamp, dash: false }; } e.preventDefault(); return; }
  const a = keyAct(e.code); if (!a) return;
  e.preventDefault(); Music.unlock();
  if (!held[a] && a in press) press[a] = 1;
  held[a] = 1;
});
window.addEventListener("keyup", e => { const a = keyAct(e.code); if (a) held[a] = 0; });
window.addEventListener("blur", () => { for (const k in held) held[k] = 0; });
function markTouch() { document.body.classList.add("touch"); }
if (matchMedia("(pointer:coarse)").matches || "ontouchstart" in window) markTouch();
window.addEventListener("touchstart", markTouch, { passive: true });
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("gesturestart", e => e.preventDefault());

const zone = $("stickZone"), sBase = $("stickBase"), sKnob = $("stickKnob"), STICK_R = 50;
zone.addEventListener("pointerdown", e => {
  if (stick.id !== null) return;
  Music.unlock(); stick.id = e.pointerId; stick.bx = e.clientX; stick.by = e.clientY;
  try { zone.setPointerCapture(e.pointerId); } catch (_) {}
  const r = zone.getBoundingClientRect();
  sBase.style.left = (e.clientX - r.left) + "px"; sBase.style.top = (e.clientY - r.top) + "px";
  sBase.classList.add("on"); sKnob.style.transform = "";
  e.preventDefault();
});
zone.addEventListener("pointermove", e => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.bx, dy = e.clientY - stick.by; const d = Math.hypot(dx, dy);
  if (d > STICK_R) {
    stick.bx += dx * (1 - STICK_R / d); stick.by += dy * (1 - STICK_R / d);
    const r = zone.getBoundingClientRect();
    sBase.style.left = (stick.bx - r.left) + "px"; sBase.style.top = (stick.by - r.top) + "px";
    dx = e.clientX - stick.bx; dy = e.clientY - stick.by;
  }
  stick.x = dx / STICK_R; stick.y = dy / STICK_R;
  sKnob.style.transform = `translate(${dx}px,${dy}px)`;
});
function stickEnd(e) { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; sBase.classList.remove("on"); }
zone.addEventListener("pointerup", stickEnd); zone.addEventListener("pointercancel", stickEnd);

// swipe to slash: direction = stroke direction; a long fast stroke becomes a dash-slash.
// The 일격 judgement uses the moment the finger landed.
const swipes = new Map(), swipeZone = $("swipeZone");
swipeZone.addEventListener("pointerdown", e => {
  Music.unlock(); e.preventDefault();
  try { swipeZone.setPointerCapture(e.pointerId); } catch (_) {}
  swipes.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: e.timeStamp, fired: false, dashed: false });
  trail.push({ x: e.clientX, y: e.clientY, t: performance.now(), start: true });
});
swipeZone.addEventListener("pointermove", e => {
  const s = swipes.get(e.pointerId); if (!s) return;
  trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  const dx = e.clientX - s.x0, dy = e.clientY - s.y0, d = Math.hypot(dx, dy);
  if (!s.fired && d > 26) { s.fired = true; slashReq = { dir: { x: dx / d, y: dy / d }, ts: s.t0, dash: false }; }
  else if (s.fired && !s.dashed && d > 115 && e.timeStamp - s.t0 < 230) { s.dashed = true; slashReq = { dir: { x: dx / d, y: dy / d }, ts: s.t0, dash: true }; }
});
function swipeEnd(e) {
  const s = swipes.get(e.pointerId); if (!s) return; swipes.delete(e.pointerId);
  if (!s.fired) slashReq = { dir: null, ts: s.t0, dash: false };
}
swipeZone.addEventListener("pointerup", swipeEnd); swipeZone.addEventListener("pointercancel", swipeEnd);

document.querySelectorAll(".tb").forEach(b => {
  const k = b.dataset.k;
  b.addEventListener("pointerdown", e => { e.preventDefault(); Music.unlock(); try { b.setPointerCapture(e.pointerId); } catch (_) {} if (!held[k]) press[k] = 1; held[k] = 1; b.classList.add("down"); });
  const up = () => { held[k] = 0; b.classList.remove("down"); };
  b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
});
function axis() {
  return { x: Math.max(-1, Math.min(1, stick.x + held.right - held.left)), y: Math.max(-1, Math.min(1, stick.y + held.down - held.up)) };
}

// ---------- level building ----------
const START_PIECE = (() => { const r = []; for (let y = 0; y < 16; y++) r.push(y >= 12 ? "########" : y === 11 ? "  P     " : "        "); return r; })();
const END_PIECE = (() => { const r = []; for (let y = 0; y < 16; y++) r.push(y >= 12 ? "########" : y === 11 ? "     E  " : "        "); return r; })();
function buildMadangMap(seed, m) {
  const rng = mulberry(seed ^ Math.imul(m + 1, 0x9E3779B1));
  const rows = START_PIECE.slice();
  const used = new Set();
  for (const tier of MADANG[m].tiers) {
    const kind = typeof tier === "string" ? tier[0] : "", t = kind ? +tier.slice(1) : tier;
    const fits = i => kind === "w" ? CHUNKS[i].wall && CHUNKS[i].tier <= t : kind === "m" ? CHUNKS[i].multi && CHUNKS[i].tier <= t : CHUNKS[i].tier === t && !CHUNKS[i].multi;
    let pool = CHUNKS.map((c, i) => i).filter(i => fits(i) && !used.has(i));
    if (!pool.length) pool = CHUNKS.map((c, i) => i).filter(fits);
    const ci = pool[(rng() * pool.length) | 0]; used.add(ci);
    const c = CHUNKS[ci].map.map(r => r.split(""));
    if (c[11][1] === " ") c[11][1] = "C";
    for (let y = 0; y < 16; y++) for (let x = 0; x < c[y].length; x++) {
      const ch = c[y][x];
      if (ch === "?") {
        const r = rng();
        c[y][x] = m === 0 ? "g" : m === 1 ? (r < .75 ? "g" : "s") : m === 2 ? (r < .5 ? "g" : r < .75 ? "h" : "s") : (r < .4 ? "g" : r < .7 ? "h" : "s");
      } else if (ch === "*") c[y][x] = rng() < .5 + .12 * m ? "d" : " ";
      else if ((ch === "L" || ch === "M") && rng() < .5) c[y][x] = ch === "L" ? "M" : "L";
    }
    for (let y = 0; y < 16; y++) rows[y] += c[y].join("");
  }
  for (let y = 0; y < 16; y++) rows[y] += END_PIECE[y];
  return rows;
}

let LV = null;
function loadMap(map, pal, hints) {
  const h = map.length, w = Math.max(...map.map(r => r.length));
  const grid = new Uint8Array(w * h);
  const lv = { w, h, grid, pal, hints: hints || [], defs: [], points: [], cps: [], lasers: [], start: null, exit: null, stains: [] };
  let id = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = map[y][x] || " ";
    if (ch === "#") grid[y * w + x] = 1;
    else if (ch === "^") grid[y * w + x] = 2;
    else if (ch === "=") grid[y * w + x] = 3;   // ledge: stand on it, jump up through it
    else if (ch === "P") lv.start = { x: x * T + 7, y: (y + 1) * T - 30 };
    else if (ch === "E") lv.exit = { x: x * T + 1, y: (y - 1) * T + 6, w: T - 2, h: 2 * T - 6 };
    else if ("gsdh".includes(ch)) lv.defs.push({ type: ch, tx: x, ty: y, id: id++ });
    else if (ch === "o") lv.points.push({ x: x * T + 16, y: y * T + 16, sway: Math.random() * 6 });
    else if (ch === "C") lv.cps.push({ x: x * T + 16, y: (y + 1) * T, on: false });
    else if (ch === "L" || ch === "M") lv.lasers.push({ tx: x, ty: y, phase: ch === "L" ? 0 : 2 });
  }
  for (const l of lv.lasers) { let yy = l.ty + 1; while (yy < h && grid[yy * w + l.tx] !== 1) yy++; l.x = l.tx * T + 16; l.y0 = l.ty * T + 22; l.y1 = yy * T; }
  lv.ridges = makeRidges(w * T, hashStr(map[11]));
  // set dressing placed where it means something (decor only, never collides)
  lv.dress = []; lv.ledgeStone = false;
  { const rnd = mulberry(hashStr(map.join("").slice(0, 400)) ^ w), used = new Set();
    const tile = (x, y) => x < 0 || x >= w || y < 0 || y >= h ? 0 : grid[y * w + x];
    const surf = (x, y0) => { for (let y = Math.max(1, y0 - 3); y < h; y++) if (tile(x, y) === 1 && tile(x, y - 1) === 0) return y; return -1; }; // top surface at or below y0-3
    const clear = (x, y, n) => { for (let k = 1; k <= n; k++) if (tile(x, y - k) !== 0) return false; return true; };
    const put = (sheet, i, tx, ty, hh, o = {}) => {
      const key = tx + "," + ty; if (tx < 1 || tx >= w - 1 || used.has(key) || ty < 1) return false;
      if (!o.hang && (tile(tx, ty) !== 1 || !clear(tx, ty, Math.ceil(hh / T)))) return false;
      used.add(key); lv.dress.push({ sheet, i, x: tx * T + 16 + (o.dx || 0), y: ty * T + (o.hang ? 0 : 2), h: hh, flip: !!o.flip, ay: o.hang ? 0 : 1 }); return true;
    };
    if (lv.start) { const sx = Math.floor(lv.start.x / T), sy = Math.floor((lv.start.y + 31) / T); put("props", PROP.sotdae, sx - 1, sy, 84); put("props2", P2.haetae, sx + 3, sy, 34); }
    if (lv.exit) { const ex = Math.floor(lv.exit.x / T), ey = Math.floor((lv.exit.y + lv.exit.h) / T); lv.gate = { x: ex * T + 16, y: ey * T + 2 }; put("props", PROP.stoneLantern, ex - 2, ey, 36); put("props", PROP.stoneLantern, ex + 2, ey, 36, { flip: true }); }
    for (const d of lv.defs) {
      const y = d.ty + 1; if (tile(d.tx, y) !== 1) continue;
      if (d.type === "h") { rnd() < .6 && put("props2", P2.rack, d.tx - 2, y, 46); rnd() < .5 && put("props", PROP.banner, d.tx + 1, y, 82); }
      else if (d.type === "g") { rnd() < .55 && put("props", PROP.banner, d.tx + 1, y, 82); rnd() < .45 && put("props", PROP.palisade, d.tx - 2, y, 28); }
      else if (d.type === "s") { rnd() < .5 && put("props2", P2.brazier, d.tx + 1, y, 34); }
    }
    for (const c of lv.cps) { const cx = Math.floor(c.x / T), cy = Math.floor(c.y / T); rnd() < .7 && put(rnd() < .5 ? "props2" : "props", rnd() < .5 ? P2.sacks : PROP.jars, cx + 1, cy, rnd() < .5 ? 30 : 26); }
    for (let x = 2; x < w - 2; x++) {
      const y = surf(x, 3); if (y < 0) continue;
      const edge = (tile(x + 1, y) === 0 && tile(x + 1, y + 1) === 0) || (tile(x - 1, y) === 0 && tile(x - 1, y + 1) === 0);
      if (!edge && y <= 7 && rnd() < .18) put("props2", P2.brazier, x, y, 34);
    }
    for (let y = 2; y < h - 4; y++) for (let x = 2; x < w - 6; x++) { // paper lanterns strung under roofs
      let n = 0; while (x + n < w && tile(x + n, y) === 1 && tile(x + n, y + 1) === 0 && tile(x + n, y + 2) === 0 && tile(x + n, y + 3) === 0) n++;
      if (n >= 4 && rnd() < .5) { lv.dress.push({ sheet: "props2", i: P2.lanterns, x: (x + n / 2) * T, y: (y + 1) * T - 2, h: 40, w: Math.min(n, 6) * T, flip: false, ay: 0 }); }
      x += Math.max(0, n);
    } }
  LV = lv;
}
function tileAt(tx, ty) { if (tx < 0 || tx >= LV.w) return 1; if (ty < 0 || ty >= LV.h) return 0; return LV.grid[ty * LV.w + tx]; }
function rectSolid(x, y, w, h) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.01) / T), y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.01) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileAt(tx, ty) === 1) return true;
  return false;
}
function solidPt(x, y) { return tileAt(Math.floor(x / T), Math.floor(y / T)) === 1; }
function los(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10); for (let i = 1; i < n; i++) { const t = i / n; if (solidPt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; } return true; }
function moveX(o, dx) { o.x += dx; if (!rectSolid(o.x, o.y, o.w, o.h)) return false; o.x = dx > 0 ? Math.floor((o.x + o.w) / T) * T - o.w - 0.001 : (Math.floor(o.x / T) + 1) * T + 0.001; return true; }
function moveY(o, dy) { o.y += dy; if (!rectSolid(o.x, o.y, o.w, o.h)) return false; o.y = dy > 0 ? Math.floor((o.y + o.h) / T) * T - o.h - 0.001 : (Math.floor(o.y / T) + 1) * T + 0.001; return true; }
// ledges (tile 3): only the top edge is solid, and only while falling onto it from above
function ledgeBelow(o, prevBottom) {
  const bottom = o.y + o.h, x0 = Math.floor(o.x / T), x1 = Math.floor((o.x + o.w - .01) / T);
  for (let r = Math.floor(prevBottom / T); r <= Math.floor(bottom / T); r++) {
    const top = r * T; if (top < prevBottom - .5 || top > bottom) continue;
    for (let tx = x0; tx <= x1; tx++) if (tileAt(tx, r) === 3) return top;
  }
  return null;
}
function onLedge(o) { const b = o.y + o.h, r = Math.round(b / T); if (Math.abs(b - r * T) > 1.5) return false; for (let tx = Math.floor(o.x / T); tx <= Math.floor((o.x + o.w - .01) / T); tx++) if (tileAt(tx, r) === 3) return true; return false; }
const groundPt = (x, y) => { const v = tileAt(Math.floor(x / T), Math.floor(y / T)); return v === 1 || v === 3; };
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function makeRidges(worldW, seed) {
  const rnd = mulberry(seed), layers = [];
  for (const [f, amp, base, step] of [[0.08, 120, 0.42, 90], [0.2, 80, 0.6, 60]]) {
    const pts = []; const span = worldW * f + 4000; let y = 0, v = 0;
    for (let x = -400; x < span; x += step) { v += (rnd() - 0.5) * 0.9; v *= 0.8; y = Math.max(-1, Math.min(1, y + v * 0.6)); pts.push([x, y * amp * (0.6 + rnd() * 0.6)]); }
    layers.push({ f, base, pts });
  }
  return layers;
}

// ---------- state ----------
let state = "menu";      // menu | interlude | play | dead | pause | result
let mode = null;         // "run" | "daily" | "tutorial"
let run = null;
let P = null, enemies = [], bullets = [], parts = [], ghosts = [], seals = [];
let deadIds = new Set(), cpSave = null, vfx = [];
let lastHitDir = null, deathT = 0, hitstop = 0, shake = 0, songPos = 0, flash = 0;
let cam = { x: 0, y: 0 }, hookCand = null, toastT = 0;

function newPlayer(x, y) {
  return { x, y, w: 18, h: 30, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0, wall: 0, wallLock: 0,
    airDash: 1, dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 }, slashT: 0, slashCd: 0, slashDir: { x: 1, y: 0 }, strike: false, clanged: null,
    hook: null, hookCd: 0, climbT: 0.5, climbing: false, focus: false, focusT: 0, run: 0, scarf: [] };
}
function spawnEnemies() {
  enemies = LV.defs.filter(d => !deadIds.has(d.id)).map(d => {
    if (d.type === "d") return { id: d.id, type: "d", x: d.tx * T + 2, y: d.ty * T + 6, w: 28, h: 20, vx: 0, vy: 0, hx: d.tx * T + 2, hy: d.ty * T + 6, t: Math.random() * 6, alive: true };
    if (d.type === "h") return { id: d.id, type: "h", x: d.tx * T + 4, y: (d.ty + 1) * T - 42, w: 24, h: 42, face: -1, vx: 0, alive: true };
    return { id: d.id, type: d.type, x: d.tx * T + 5, y: (d.ty + 1) * T - 42, w: 22, h: 42, face: -1, fireAt: null, aimFrom: 0, readyAt: songPos + 0.6 + Math.random() * 0.8, tx: 0, ty: 0, alive: true };
  });
}

// ---------- run flow ----------
function newRun(daily) {
  const key = todayKey();
  run = { seed: daily ? hashStr("chungo-" + key) : (Math.random() * 2 ** 32) >>> 0, daily, dateKey: key, m: 0, cp: -1, dead: [],
    breath: 3, time: 0, deaths: 0, kills: 0, strikes: 0, slashes: 0 };
  mode = daily ? "daily" : "run";
  saveRun(); showInterlude();
}
function continueRun() {
  const s = store.get("run", null); if (!s) return;
  run = s; mode = s.daily ? "daily" : "run"; showInterlude();
}
function saveRun() { if (run && mode !== "tutorial") store.set("run", run); }
function showInterlude() {
  state = "interlude";
  const md = MADANG[run.m], jd = Music.JANGDAN[md.jd];
  $("iOrd").textContent = MNAME[run.m];
  $("iLine").textContent = md.line;
  $("iMeta").textContent = ORD[run.m] + " 마당 · " + jd.name + " · " + "●".repeat(run.breath) + "○".repeat(3 - run.breath) + (run.daily ? " · 오늘의 판" : "");
  $("interlude").classList.toggle("night", run.m === 4);
  loadMap(buildMadangMap(run.seed, run.m), PAL[run.m]); LV.ledgeStone = run.m >= 3;
  showScreen("interlude");
  Music.unlock(); Music.stop(); Music.jing();
  setTimeout(() => $("bEnter").focus({ preventScroll: true }), 30);
}
function enterMadang() {
  // map already loaded by showInterlude
  deadIds = new Set(run.dead || []); cpSave = null;
  if (run.cp >= 0 && LV.cps[run.cp]) {
    const c = LV.cps[run.cp]; c.on = true;
    cpSave = { x: c.x - 9, y: c.y - 30.01, dead: new Set(deadIds), idx: run.cp };
  }
  const s = cpSave || LV.start;
  P = newPlayer(s.x, s.y);
  bullets = []; parts = []; ghosts = []; seals = []; vfx = [];
  Music.start(MADANG[run.m].jd, run.seed + run.m);
  songPos = Music.pos(); spawnEnemies();
  cam.x = P.x; cam.y = P.y;
  setHud(); showScreen(null); state = "play";
  Music.bak();
  try { navigator.wakeLock && navigator.wakeLock.request("screen").catch(() => {}); } catch (e) {}
}
function startTutorial() {
  mode = "tutorial";
  run = { m: 0, breath: Infinity, time: 0, deaths: 0, kills: 0, strikes: 0, slashes: 0, cp: -1, dead: [] };
  loadMap(TUTORIAL.map, PAL[0], TUTORIAL.hints);
  deadIds = new Set(); cpSave = null;
  P = newPlayer(LV.start.x, LV.start.y);
  bullets = []; parts = []; ghosts = []; seals = []; vfx = [];
  Music.unlock(); Music.start(TUTORIAL.jd, 7);
  songPos = Music.pos(); spawnEnemies();
  cam.x = P.x; cam.y = P.y;
  setHud(); showScreen(null); state = "play";
}
function respawn() {
  bullets = []; ghosts = [];
  const s = cpSave || { x: LV.start.x, y: LV.start.y, dead: new Set() };
  deadIds = new Set(s.dead);
  P = newPlayer(s.x, s.y);
  spawnEnemies(); state = "play"; setHud();
}
function die() {
  if (state !== "play") return;
  state = "dead"; deathT = 0; run.deaths++;
  if (mode !== "tutorial") { run.breath--; saveRun(); }
  P.focus = false; Music.muffle(false);
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 340; parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: .8, max: .8, c: i % 4 ? LV.pal.fig : SEAL, s: 2 + Math.random() * 4 }); }
  bleed(cx, cy, lastHitDir || { x: -P.face, y: -.3 }, true); lastHitDir = null;
  shake = 12; Music.sfx("die"); buzz(70);
}
function afterDeath() {
  if (mode !== "tutorial" && run.breath <= 0) { endRun(false); return; }
  respawn();
}
function madangClear() {
  Music.sfx("seal");
  if (mode === "tutorial") { toast("수련을 마쳤다"); setTimeout(toMenu, 900); state = "result"; return; }
  if (run.m >= 4) { endRun(true); return; }
  run.m++; run.cp = -1; run.dead = [];
  saveRun();
  state = "result";
  setTimeout(showInterlude, 700);
}
function endRun(won) {
  state = "result"; Music.stop();
  store.del("run");
  const reached = run.m + (won ? 1 : 0);
  const rate = run.slashes ? Math.round(run.strikes / run.slashes * 100) : 0;
  $("rSeal").textContent = won ? "登" : "終";
  $("rTitle").textContent = won ? "등천" : "종국";
  $("rSub").textContent = won ? "천고는 아직 위에서 울린다." : ORD[run.m] + " 마당에서 숨이 다했다.";
  $("rStats").innerHTML = "";
  for (const [k, v] of [["오른 마당", reached + " / 5"], ["시간", fmt(run.time)], ["일격", run.strikes + "회 · " + rate + "%"], ["벤 적", run.kills], ["베인 횟수", run.deaths]]) {
    const a = document.createElement("span"), b = document.createElement("b"); a.textContent = k; b.textContent = v; $("rStats").append(a, b);
  }
  let rec = "";
  if (run.daily) {
    const best = store.get("daily." + run.dateKey, null);
    const better = !best || reached > best.reached || (reached === best.reached && run.time < best.time);
    if (better) { store.set("daily." + run.dateKey, { reached, time: run.time, rate }); rec = best ? "오늘의 판 최고 기록 갱신" : "오늘의 판 첫 기록"; }
  } else {
    const best = store.get("best", null);
    if (!best || reached > best.reached || (reached === best.reached && run.time < best.time)) { store.set("best", { reached, time: run.time }); rec = "최고 기록"; }
  }
  $("rRec").textContent = rec;
  lastResult = { reached, rate, time: run.time, daily: run.daily, dateKey: run.dateKey, won };
  showScreen("result");
}
let lastResult = null;
function shareText() {
  const r = lastResult; if (!r) return "";
  const head = r.daily ? `천고 · 오늘의 판 ${r.dateKey.slice(5).replace("-", ".")}` : "천고";
  return `${head}\n${r.won ? "다섯 마당 돌파" : ORD[Math.max(0, r.reached)] + " 마당에서 끝"} · ${fmt(r.time)} · 일격 ${r.rate}%\n` + "▮".repeat(r.reached) + "▯".repeat(5 - r.reached);
}

// ---------- player ----------
const CLIMBV = 270, CLIMB_T = 0.5, GRAV = 1900, JUMPV = 640, MAXV = 300, DASHV = 1000, HOOK_R = 300, STRIKE_WIN = 0.15;
function aimDir() { const a = axis(), m = Math.hypot(a.x, a.y); return m < 0.35 ? { x: P.face, y: 0 } : { x: a.x / m, y: a.y / m }; }
function startDash(dir) {
  if (P.dashCd > 0) return false;
  if (!P.onGround) { if (P.airDash <= 0) return false; P.airDash--; }
  let d = dir || aimDir();
  if (P.onGround && d.y > 0.2) d = { x: d.x === 0 ? P.face : Math.sign(d.x), y: 0 };
  P.dashDir = d; P.dashT = 0.15; P.dashCd = 0.32; P.hook = null;
  if (Math.abs(d.x) > 0.2) P.face = Math.sign(d.x);
  Music.sfx("dash"); return true;
}
function doSlash(req) {
  if (P.hook) return;
  if (P.slashCd > 0 && !req.dash) return;
  let d = req.dir;
  if (!d) { const a = axis(), m = Math.hypot(a.x, a.y); d = m > 0.5 ? { x: a.x / m, y: a.y / m } : { x: P.face, y: 0 }; }
  const off = Music.offBeat(Music.posAt(req.ts));
  const strike = Math.abs(off) < STRIKE_WIN;
  run.slashes++; if (strike) run.strikes++;
  P.slashDir = d; P.slashT = req.dash ? 0.22 : 0.14; P.slashCd = 0.2; P.strike = strike; P.clanged = new Set();
  if (Math.abs(d.x) > 0.2) P.face = Math.sign(d.x);
  if (!P.onGround && P.vy > 60) P.vy = 60;
  if (req.dash) startDash(d);
  Music.sfx(strike ? "strike" : "slash");
  if (strike) flash = 0.12;
}
function findHook() {
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2; let best = null, bs = 1e9;
  for (const p of LV.points) {
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d > HOOK_R || d < 24 || !los(cx, cy, p.x, p.y)) continue;
    const s = d - (dx * P.face > 0 ? 70 : 0) - (dy < 0 ? 40 : 0);
    if (s < bs) { bs = s; best = p; }
  }
  return best;
}
function frameInput(rdt) {
  if (press.jump && P.onGround && axis().y > .5 && onLedge(P)) { P.dropT = .25; P.y += 3; P.onGround = false; press.jump = 0; } // down + jump: drop through a ledge
  if (press.jump) P.jumpBuf = 0.13;
  if (slashReq) { doSlash(slashReq); slashReq = null; }
  if (press.hook && hookCand && P.hookCd <= 0) { P.hook = hookCand; P.dashT = 0; P.focus = false; Music.muffle(false); Music.sfx("hook"); }
  if (press.dash) {
    if (P.onGround || P.hook) startDash();
    else if (P.airDash > 0 && P.dashCd <= 0) { P.focus = true; P.focusT = 0; Music.muffle(true); }
  }
  if (P.focus) { P.focusT += rdt; if (!held.dash || P.focusT > 1.2 || P.onGround) { P.focus = false; Music.muffle(false); startDash(); } }
  press.jump = press.dash = press.hook = 0;
  P.jumpBuf = Math.max(0, P.jumpBuf - rdt);
}
const approach = (v, t, a) => v < t ? Math.min(t, v + a) : Math.max(t, v - a);
function stepPlayer(dt) {
  const a = axis(), ix = a.x > 0.3 ? 1 : a.x < -0.3 ? -1 : 0;
  P.landT = Math.max(0, (P.landT || 0) - dt); P.dropT = Math.max(0, (P.dropT || 0) - dt); P.dashCd = Math.max(0, P.dashCd - dt); P.slashCd = Math.max(0, P.slashCd - dt); P.hookCd = Math.max(0, P.hookCd - dt); P.wallLock = Math.max(0, P.wallLock - dt);
  if (P.hook) {
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2, dx = P.hook.x - cx, dy = P.hook.y - cy, d = Math.hypot(dx, dy);
    if (d < 30) { P.vx = dx / d * 700; P.vy = dy / d * 700 - 260; P.hook = null; P.hookCd = 0.25; P.airDash = 1; if (Math.abs(P.vx) > 40) P.face = Math.sign(P.vx); }
    else {
      P.vx = dx / d * 1050; P.vy = dy / d * 1050;
      if (moveX(P, P.vx * dt) | moveY(P, P.vy * dt)) { P.hook = null; P.vx *= 0.3; P.vy *= 0.3; }
      ghost(0.02); return;
    }
  }
  if (P.dashT > 0) {
    P.dashT -= dt; P.vx = P.dashDir.x * DASHV; P.vy = P.dashDir.y * DASHV;
    const pb = P.y + P.h, hx = moveX(P, P.vx * dt); let hy = moveY(P, P.vy * dt); ghost(0.012);
    if (!hy && P.vy > 0 && !(P.dropT > 0)) { const top = ledgeBelow(P, pb); if (top != null) { P.y = top - P.h - .001; hy = true; } }
    if (P.dashT <= 0 || hx || hy) { P.dashT = 0; P.vx = P.dashDir.x * MAXV * 1.35; P.vy = P.dashDir.y * 380; }
  } else {
    if (P.wallLock <= 0) {
      if (P.onGround) P.vx = (ix && Math.sign(P.vx) === ix && Math.abs(P.vx) > MAXV) ? approach(P.vx, ix * MAXV, 1400 * dt) : approach(P.vx, ix * MAXV, (ix ? 2600 : 2400) * dt);
      else if (ix) P.vx = (Math.sign(P.vx) === ix && Math.abs(P.vx) > MAXV) ? approach(P.vx, ix * MAXV, 450 * dt) : approach(P.vx, ix * MAXV, 1800 * dt);
      else P.vx = approach(P.vx, 0, 320 * dt);
      if (ix) P.face = ix;
    }
    if (P.jumpBuf > 0) {
      if (P.onGround || P.coyote > 0) { P.vy = -JUMPV; P.onGround = false; P.coyote = 0; P.jumpBuf = 0; Music.sfx("jump"); }
      else if (P.wall) { P.vy = -600; P.vx = -P.wall * 380; P.face = -P.wall; P.wallLock = 0.15; P.jumpBuf = 0; P.climbT = Math.max(P.climbT, 0.35); Music.sfx("jump"); puff(P.wall > 0 ? P.x + P.w : P.x, P.y + P.h - 6, 6); }
    }
    let g = GRAV; if (P.vy < 0 && !held.jump && !P.wallLock && !P.climbing) g *= 2.1;
    P.vy = Math.min(1000, P.vy + g * dt);
    if (P.wall && P.vy > 0 && ix === P.wall) P.vy = Math.min(P.vy, 130);
    // wall run: pushing into a wall while airborne carries you up it for a moment
    P.climbing = !!(P.wall && ix === P.wall && P.climbT > 0 && !P.wallLock);
    if (P.climbing) { P.vy = Math.min(P.vy, -CLIMBV); P.climbT -= dt; if (Math.random() < .3) puff(P.wall > 0 ? P.x + P.w : P.x, P.y + P.h - 4, 1); }
    moveX(P, P.vx * dt);
    const pb = P.y + P.h;
    if (moveY(P, P.vy * dt)) P.vy = 0;
    else if (P.vy > 0 && !(P.dropT > 0)) { const top = ledgeBelow(P, pb); if (top != null) { P.y = top - P.h - .001; P.vy = 0; } }
  }
  const was = P.onGround;
  P.onGround = P.vy >= 0 && (rectSolid(P.x, P.y + P.h, P.w, 2) || (!(P.dropT > 0) && onLedge(P)));
  if (P.onGround) { P.airT = 0; P.runT = Math.abs(P.vx) > 40 ? (P.runT || 0) + dt : 0; P.coyote = 0.1; P.airDash = 1; P.climbT = CLIMB_T; if (!was) { addFx("hud", HUD.dust, P.x + P.w / 2, P.y + P.h + 2, 22, { life: .35, ay: 1, a: .8 }); P.landT = 0.1; } } else { P.coyote = Math.max(0, P.coyote - dt); P.airT = (P.airT || 0) + dt; }
  const wl = rectSolid(P.x - 3, P.y + 4, 3, P.h - 8), wr = rectSolid(P.x + P.w, P.y + 4, 3, P.h - 8);
  P.wall = P.onGround ? 0 : wr ? 1 : wl ? -1 : 0;
  if (P.wall) P.airDash = 1;
  if (P.onGround && Math.abs(P.vx) > 20) P.run += dt * Math.abs(P.vx) * 0.045;
}
function ghost(gap) { const l = ghosts[ghosts.length - 1]; if (!l || l.age > gap) ghosts.push({ x: P.x, y: P.y, face: P.face, age: 0, life: 0.22 }); for (const g of ghosts) g.age += 0.004; }
// one-shot painted effects: grow and fade
function addFx(sheet, i, x, y, h, o = {}) { vfx.push({ sheet, i, x, y, h, t: 0, life: o.life || .5, rot: o.rot || 0, grow: o.grow ?? .35, flip: !!o.flip, ay: o.ay ?? .5, a: o.a ?? 1 }); }
function findFloor(x, y) { let ty = Math.floor(y / T); while (ty < LV.h && tileAt(Math.floor(x / T), ty) !== 1) ty++; return ty < LV.h ? ty * T : null; }
function bleed(x, y, dir, big) { // blood burst + spray along the blow + a pool where it lands
  addFx("fx", FX.burst, x, y, big ? 96 : 64, { life: big ? .7 : .45, rot: Math.random() * 6.28, grow: .5 });
  addFx("fx", FX.spray, x, y, big ? 50 : 34, { life: .5, rot: Math.atan2(dir.y, dir.x), ay: .5, grow: .6 });
  addFx("fx", FX.drops, x + dir.x * 20, y - 6, 26, { life: .6, rot: Math.random() * 6.28 });
  const fy = findFloor(x, y); if (fy != null && LV.stains.length < 160) LV.stains.push({ x, y: fy + 2, pool: true, w: big ? 70 : 46, rot: 0 });
}
function puff(x, y, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 80, life: .3, max: .3, c: LV.pal.foe, s: 2 }); }
function stain(x, y, n, col) {
  for (let i = 0; i < n; i++) LV.stains.push({ x: x + (Math.random() - .5) * 40, y: y + (Math.random() - .3) * 30, r: 2 + Math.random() * 6, c: col || LV.pal.tile, rot: Math.random() * 6.28 });
  if (LV.stains.length > 160) LV.stains.splice(0, LV.stains.length - 160);
}
function laserOn(l) { const b = Math.floor(songPos / Music.beatLen); return (((b + l.phase) % 4) + 4) % 4 < 2; }
function laserWarn(l) { const bl = Music.beatLen, b = Math.floor(songPos / bl), frac = songPos / bl - b; return !laserOn(l) && (((b + 1 + l.phase) % 4) + 4) % 4 === 0 && frac > 0.45; }
function playerHazards() {
  const pr = { x: P.x + 2, y: P.y + 2, w: P.w - 4, h: P.h - 4 };
  const x0 = Math.floor(pr.x / T), x1 = Math.floor((pr.x + pr.w) / T), y0 = Math.floor(pr.y / T), y1 = Math.floor((pr.y + pr.h) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
    if (tileAt(tx, ty) === 2 && overlap(pr, { x: tx * T + 4, y: ty * T + 14, w: T - 8, h: T - 14 })) return die();
  if (P.y > LV.h * T + 80) return die();
  for (const l of LV.lasers) if (laserOn(l) && overlap(pr, { x: l.x - 3, y: l.y0, w: 6, h: l.y1 - l.y0 })) return die();
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  LV.cps.forEach((c, i) => {
    if (!c.on && Math.abs(cx - c.x) < 26 && cy < c.y && cy > c.y - 3 * T) {
      for (const o of LV.cps) o.on = false;
      c.on = true; cpSave = { x: c.x - 9, y: c.y - 30.01, dead: new Set(deadIds), idx: i };
      run.cp = i; run.dead = [...deadIds]; saveRun();
      Music.sfx("lantern");
    }
  });
  if (LV.exit && overlap(pr, LV.exit)) madangClear();
}

// ---------- enemies ----------
function killEnemy(e) {
  if (!e.alive) return;
  e.alive = false; deadIds.add(e.id); run.kills++;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 320; parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: .6, max: .6, c: i % 5 ? LV.pal.tile : SEAL, s: 2 + Math.random() * 4 }); }
  bleed(cx, cy, P.slashT > 0 ? P.slashDir : { x: Math.sign(cx - P.x - P.w / 2) || 1, y: -.2 }, false);
  hitstop = 0.07; shake = Math.max(shake, 6); P.airDash = 1; P.dashCd = 0;
  Music.sfx("kill"); buzz(18);
}
function clang(e) {
  P.vx = -Math.sign(e.x + e.w / 2 - (P.x + P.w / 2) || 1) * 300; P.dashT = 0; if (!P.onGround) P.vy = Math.min(P.vy, -150);
  for (let i = 0; i < 8; i++) parts.push({ x: e.x + e.w / 2 + e.face * 10, y: e.y + 12, vx: (Math.random() - .5) * 300, vy: -Math.random() * 200, life: .25, max: .25, c: "#fff", s: 2 });
  Music.sfx("clang"); shake = Math.max(shake, 3);
}
function stepEnemies(dt) {
  const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2, live = state === "play", bl = Music.beatLen;
  for (const e of enemies) {
    if (!e.alive) continue;
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2, dist = Math.hypot(pcx - ecx, pcy - ecy);
    if (e.type === "d") {
      e.t += dt;
      const sees = live && dist < 430 && los(ecx, ecy, pcx, pcy);
      if (sees) { e.vx += (pcx - ecx) / dist * 520 * dt; e.vy += (pcy - ecy) / dist * 520 * dt; }
      else { e.vx += (e.hx - e.x) * 2 * dt; e.vy += (e.hy + Math.sin(e.t * 2) * 10 - e.y) * 2 * dt; }
      const sp = Math.hypot(e.vx, e.vy), cap = sees ? 175 : 80; if (sp > cap) { e.vx *= cap / sp; e.vy *= cap / sp; }
      if (moveX(e, e.vx * dt)) e.vx *= -0.5;
      if (moveY(e, e.vy * dt)) e.vy *= -0.5;
      if (live && overlap(e, P)) { if (P.dashT > 0 || P.slashT > 0) killEnemy(e); else die(); }
      continue;
    }
    if (e.type === "h") {
      const sees = live && dist < 380 && Math.abs(pcy - ecy) < 80 && los(ecx, e.y + 8, pcx, pcy);
      if (sees) e.face = Math.sign(pcx - ecx) || e.face;
      const ahead = e.x + e.w / 2 + e.face * 16;
      const ground = groundPt(ahead, e.y + e.h + 4) && !solidPt(ahead, e.y + 10);
      e.vx = sees && ground && dist > 24 ? e.face * 55 : 0;
      moveX(e, e.vx * dt);
      if (live && overlap(e, P)) { if (P.dashT > 0) clang(e); else die(); }
      continue;
    }
    const sniper = e.type === "s", range = sniper ? 920 : 560, lead = sniper ? 1.0 : 0.45, lock = sniper ? 0.3 : 0.15;
    const sees = live && dist < range && los(ecx, e.y + 8, pcx, pcy);
    if (sees) e.face = Math.sign(pcx - ecx) || e.face;
    if (e.fireAt != null) {
      if (songPos < e.fireAt - lock && sees) { e.tx = pcx; e.ty = pcy; }
      if (!sees && songPos < e.fireAt - lock) { e.fireAt = null; e.readyAt = songPos + 0.3; }
      else if (songPos >= e.fireAt) {
        const [mx, my] = muzzle(e), dx = e.tx - mx, dy = e.ty - my, d = Math.hypot(dx, dy) || 1, sp = sniper ? 1250 : 430;
        bullets.push({ x: mx, y: my, vx: dx / d * sp, vy: dy / d * sp, owner: e, friendly: false, life: 3, sniper });
        addFx("hud", HUD.smoke, mx + e.face * 8, my - 4, 30, { life: .9, grow: .9, a: .8, flip: e.face < 0 }); // powder smoke
        e.fireAt = null; e.readyAt = songPos + (sniper ? 4 : 2) * bl;
        Music.sfx(sniper ? "snipe" : "shoot");
      }
    } else if (sees && songPos >= e.readyAt) {
      let k = Math.ceil((songPos + lead) / bl);
      if (sniper) k = Math.ceil(k / 4) * 4;
      e.fireAt = k * bl; e.aimFrom = songPos; e.tx = pcx; e.ty = pcy;
    }
    if (live && P.dashT > 0 && overlap(e, P)) killEnemy(e);
  }
}
function muzzle(e) { return e.type === "s" ? [e.x + e.w / 2 + e.face * 34, e.y + 17] : [e.x + e.w / 2 + e.face * 32, e.y + 6]; }
function slashHits() {
  if (P.slashT <= 0) return;
  const R = P.strike ? 54 : 40, reach = P.strike ? 30 : 26;
  const cx = P.x + P.w / 2 + P.slashDir.x * reach, cy = P.y + P.h / 2 + P.slashDir.y * reach;
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = Math.max(e.x, Math.min(cx, e.x + e.w)), ey = Math.max(e.y, Math.min(cy, e.y + e.h));
    if (Math.hypot(ex - cx, ey - cy) >= R) continue;
    if (e.type === "h" && !P.strike) { if (!P.clanged.has(e.id)) { P.clanged.add(e.id); clang(e); } continue; }
    if (P.strike) seals.push({ x: e.x + e.w / 2, y: e.y + 6, t: 0, rot: (Math.random() - .5) * 0.4 });
    killEnemy(e);
  }
  for (const b of bullets) {
    if (b.friendly || Math.hypot(b.x - cx, b.y - cy) >= R + 8) continue;
    b.friendly = true; b.pierce = P.strike; b.life = 3;
    const sp = Math.max(700, Math.hypot(b.vx, b.vy) * 1.1), o = b.owner;
    if (o && o.alive) { const dx = o.x + o.w / 2 - b.x, dy = o.y + o.h / 2 - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * sp; b.vy = dy / d * sp; }
    else { b.vx = P.slashDir.x * sp; b.vy = P.slashDir.y * sp; }
    Music.sfx("reflect"); hitstop = Math.max(hitstop, 0.04);
    for (let i = 0; i < 6; i++) parts.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300, life: .25, max: .25, c: JJOK, s: 2 });
  }
}
function stepBullets(dt) {
  const pr = { x: P.x + 3, y: P.y + 3, w: P.w - 6, h: P.h - 6 };
  for (const b of bullets) {
    const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 8);
    for (let i = 0; i < n && b.life > 0; i++) {
      b.x += b.vx * dt / n; b.y += b.vy * dt / n;
      if (solidPt(b.x, b.y)) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 22, { life: .25, rot: Math.random() * 6.28 }); break; }
      if (b.friendly) {
        for (const e of enemies) if (e.alive && b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          if (e.type === "h" && Math.sign(b.vx) === -e.face && !b.pierce) { b.life = 0; Music.sfx("clang"); break; }
          killEnemy(e); if (!b.pierce) b.life = 0;
        }
      } else if (state === "play" && P.dashT <= 0 && b.x > pr.x - 3 && b.x < pr.x + pr.w + 3 && b.y > pr.y - 3 && b.y < pr.y + pr.h + 3) { const sp = Math.hypot(b.vx, b.vy) || 1; lastHitDir = { x: b.vx / sp, y: b.vy / sp }; die(); b.life = 0; }
    }
    b.life -= dt;
  }
  bullets = bullets.filter(b => b.life > 0);
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === "play" || state === "dead") {
    songPos = Music.pos();
    if (state === "play") frameInput(rdt);
    let ts = 1;
    if (hitstop > 0) { hitstop -= rdt; ts = 0.06; } else if (state === "play" && P.focus) ts = 0.12;
    if (state === "dead") ts = 0.3;
    const wdt = rdt * ts, n = Math.max(1, Math.ceil(wdt / (1 / 120))), sdt = wdt / n;
    for (let i = 0; i < n; i++) {
      if (state === "play") { stepPlayer(sdt); P.slashT = Math.max(0, P.slashT - sdt); slashHits(); playerHazards(); }
      if (state === "play" || state === "dead") { stepEnemies(sdt); stepBullets(sdt); }
      if (state !== "play" && state !== "dead") break;
    }
    if (state === "play") run.time += rdt;
    if (state === "dead") { deathT += rdt; if (deathT > 0.75) afterDeath(); }
    hookCand = state === "play" && !P.hook ? findHook() : null;
    updateHud();
  } else slashReq = null;
  for (const p of parts) { p.x += p.vx * rdt; p.y += p.vy * rdt; p.vy += 600 * rdt; p.life -= rdt; }
  parts = parts.filter(p => p.life > 0);
  for (const g of ghosts) g.age += rdt; ghosts = ghosts.filter(g => g.age < g.life);
  for (const s of seals) s.t += rdt; seals = seals.filter(s => s.t < 0.7);
  for (const v of vfx) v.t += rdt; vfx = vfx.filter(v => v.t < v.life);
  shake = Math.max(0, shake - rdt * 40); flash = Math.max(0, flash - rdt);
  if (toastT > 0) { toastT -= rdt; if (toastT <= 0) $("toast").classList.remove("on"); }
  render(rdt);
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); }
function setHud() {
  document.body.classList.toggle("night", !!(LV && LV.pal.night));
  if (mode === "tutorial") { $("hMadang").textContent = "수련터"; $("hJang").textContent = Music.JANGDAN[TUTORIAL.jd].name; }
  else { $("hMadang").textContent = ORD[run.m] + " 마당"; $("hJang").textContent = Music.JANGDAN[MADANG[run.m].jd].name; }
  const hb = $("hBreath"); hb.innerHTML = ""; hb.classList.toggle("inf", mode === "tutorial");
  if (mode !== "tutorial") for (let i = 0; i < 3; i++) { const d = document.createElement("i"); if (i >= run.breath) d.className = "lost"; hb.appendChild(d); }
  hudCache = "";
}
let hudCache = "";
function updateHud() {
  const t = fmt(run.time), pip = (P.onGround || P.airDash > 0) && P.dashCd <= 0, hk = !!hookCand, key = t + pip + hk;
  if (key === hudCache) return; hudCache = key;
  $("hTime").textContent = t; $("pip").classList.toggle("on", pip); $("bHook").classList.toggle("ready", hk);
}
function toast(msg) { const el = $("toast"); el.textContent = msg; el.classList.add("on"); toastT = 1.6; }
function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }

// ---------- render ----------
let paperPat = null, vignette = null;
function makePaper() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const id = g.createImageData(256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = Math.random(); id.data[i] = id.data[i + 1] = id.data[i + 2] = v < 0.5 ? 0 : 255; id.data[i + 3] = Math.random() * 14; }
  g.putImageData(id, 0, 0);
  g.strokeStyle = "rgba(0,0,0,.05)"; g.lineWidth = 0.6;
  for (let i = 0; i < 40; i++) { g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y + Math.random() * 10, x + 20 + Math.random() * 30, y + (Math.random() - .5) * 8); g.stroke(); }
  paperPat = ctx.createPattern(c, "repeat");
}
function render(rdt) {
  if (!paperPat) makePaper();
  const pal = LV ? LV.pal : PAL[0], k = SCALE * DPR, vw = W / SCALE, vh = H / SCALE;
  if (P && LV) {
    const tx = P.x + P.w / 2 + Math.max(-110, Math.min(110, P.vx * 0.22)) + P.face * 24, ty = P.y + P.h / 2 - 24, f = Math.min(1, rdt * 7);
    cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f;
    const lw = LV.w * T, lh = LV.h * T;
    cam.x = lw <= vw ? lw / 2 : Math.max(vw / 2, Math.min(lw - vw / 2, cam.x));
    const maxY = lh - vh / 2 + 8; cam.y = Math.min(maxY, Math.max(Math.min(maxY, vh / 2 - 96), cam.y));
  }
  const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, cv.width, cv.height);
  drawBackdrop(pal);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const paperTex = pattern("tex-paper", DPR * 0.9);
  if (paperTex) { ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = pal.rim ? .35 : .9; ctx.fillStyle = paperTex; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
  else { ctx.fillStyle = paperPat; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (!LV || state === "menu") return;

  // rain
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.strokeStyle = `rgba(${pal.wash},.13)`; ctx.lineWidth = 1; ctx.beginPath();
  const tt = performance.now() / 1000;
  for (let i = 0; i < 60; i++) {
    const rx = ((i * 137.5 + tt * 50 - cam.x * 0.6) % (W + 40) + W + 40) % (W + 40) - 20, ry = ((i * 89.3 + tt * 650) % (H + 40)) - 20;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 13);
  }
  ctx.stroke();

  ctx.setTransform(k, 0, 0, k, Math.round((W / 2 + sx) * DPR - cam.x * k), Math.round((H / 2 + sy) * DPR - cam.y * k));
  const x0 = Math.max(0, Math.floor((cam.x - vw / 2) / T) - 1), x1 = Math.min(LV.w - 1, Math.ceil((cam.x + vw / 2) / T) + 1);
  const y0 = Math.max(0, Math.floor((cam.y - vh / 2) / T) - 1), y1 = Math.min(LV.h - 1, Math.ceil((cam.y + vh / 2) / T) + 1);
  const visible = x => x > cam.x - vw / 2 - 60 && x < cam.x + vw / 2 + 60;

  if (SPR.rocks && LV && !LV.scenery) buildScenery();
  const SC = LV.scenery;
  if (SC && SPR.pines) for (const p of SC.pines) { // far pines drift slower than the ground (parallax .75)
    const f = SPR.pines.f[p.i], px = p.x + cam.x * .25, gy = (LV.h - 4) * T + 20 + cam.y * .12;
    if (px < cam.x - vw / 2 - 300 || px > cam.x + vw / 2 + 300) continue;
    ctx.save(); ctx.translate(px, gy); if (p.flip) ctx.scale(-1, 1); ctx.globalAlpha = pal.night ? p.a * .5 : p.a;
    const k = p.h / f.h; ctx.drawImage(pal.night ? SPR.pines.inv : SPR.pines.img, f.x, f.y, f.w, f.h, -f.w * k / 2, -p.h, f.w * k, p.h); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (SC) for (const c of SC.back) if (Math.abs(c.x - cam.x) < vw / 2 + c.w + 200) drawCliff(c, pal.night ? SPR.rocks.inv : SPR.rocks.img, pal.night ? .25 : .45);
  // hints
  ctx.font = `600 11px ${BODY_FONT}`; ctx.textBaseline = "top";
  for (const [hx, hy, text] of LV.hints) {
    const px = hx * T, py = hy * T + 8; if (!visible(px) && !visible(px + 300)) continue;
    const tw = ctx.measureText(text).width;
    if (!uiPatch(5, px - 16, py - 9, tw + 32, 30, pal.night ? .35 : .9)) { ctx.fillStyle = pal.text; ctx.globalAlpha = 0.85; ctx.fillRect(px - 8, py - 2, 2, 15); }
    ctx.globalAlpha = 1; ctx.fillStyle = pal.text; ctx.fillText(text, px, py);
  }
  // 금줄
  for (const l of LV.lasers) {
    if (!visible(l.x)) continue;
    if (!drawSprite("objects", OBJ.emitter, l.x, l.ty * T + 26, kOf("objects", OBJ.emitter, 28), false, .5, pal.night)) { ctx.fillStyle = pal.tile; ctx.fillRect(l.x - 8, l.ty * T + 8, 16, 14); }
    if (SPR.props) { // 금줄: one straw rope hung the full height; charged (deadly) when it glows
      const f = SPR.props.f[PROP.rope], on = laserOn(l), len = l.y1 - l.y0, sw = Math.sin(tt * 1.7 + l.x) * (on ? .8 : 2);
      if (on) { const gl = ctx.createLinearGradient(l.x - 16, 0, l.x + 16, 0); gl.addColorStop(0, "rgba(195,22,28,0)"); gl.addColorStop(.5, `rgba(195,22,28,${.22 + .08 * Math.sin(tt * 9)})`); gl.addColorStop(1, "rgba(195,22,28,0)"); ctx.fillStyle = gl; ctx.fillRect(l.x - 16, l.y0, 32, len); }
      ctx.save(); ctx.translate(l.x, l.y0); ctx.rotate(sw * .01); ctx.globalAlpha = on ? 1 : laserWarn(l) ? .65 : .3;
      ctx.drawImage(SPR.props.img, f.x, f.y, f.w, f.h, -11, -4, 22, len + 4);
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (laserOn(l)) {
      ctx.fillStyle = "rgba(195,22,28,.08)"; ctx.fillRect(l.x - 12, l.y0, 24, l.y1 - l.y0);
      ctx.fillStyle = "rgba(195,22,28,.18)"; ctx.fillRect(l.x - 6, l.y0, 12, l.y1 - l.y0);
      ctx.fillStyle = SEAL; ctx.fillRect(l.x - 1.8, l.y0, 3.6, l.y1 - l.y0);
      // twisted straw-rope marks
      ctx.fillStyle = pal.tile; for (let yy = l.y0 + 10; yy < l.y1; yy += 24) { ctx.beginPath(); ctx.moveTo(l.x - 5, yy); ctx.lineTo(l.x + 5, yy + 5); ctx.lineTo(l.x - 5, yy + 9); ctx.lineTo(l.x - 3, yy + 5); ctx.fill(); }
    } else if (laserWarn(l) && Math.floor(performance.now() / 60) % 2) { ctx.fillStyle = "rgba(195,22,28,.55)"; ctx.fillRect(l.x - .6, l.y0, 1.2, l.y1 - l.y0); }
  }
  // tiles: all visible rock in one path, filled once with the stone texture
  const stone = pattern("tex-stone", 0.5), giwa = pattern("tex-giwa", 0.094), rock = new Path2D();
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (LV.grid[ty * LV.w + tx] === 1) rock.rect(tx * T - .3, ty * T - .3, T + .6, T + .6);
  ctx.fillStyle = pal.tile; ctx.fill(rock);
  if (stone) { ctx.globalAlpha = pal.rim ? .8 : 1; ctx.fillStyle = stone; ctx.fill(rock); ctx.globalAlpha = 1; }
  if (SC && !pal.night) { ctx.fillStyle = "rgba(168,160,146,.42)"; ctx.fill(rock); }   // lift the base toward the granite of the painted cliffs
  if (SC) for (const c of SC.skins) if (Math.abs(c.x - cam.x) < vw / 2 + c.w + 120) drawCliff(c, pal.night ? SPR.rocks.inv : SPR.rocks.img, pal.night ? .55 : 1);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const v = LV.grid[ty * LV.w + tx], px = tx * T, py = ty * T;
    if (v === 1) {
      if (tileAt(tx, ty - 1) !== 1 && giwa) {
        // giwa eave band along exposed tops, overhanging open ends a little
        const l = tileAt(tx - 1, ty) !== 1 || tileAt(tx - 1, ty - 1) === 1 ? 3 : 0, r = tileAt(tx + 1, ty) !== 1 || tileAt(tx + 1, ty - 1) === 1 ? 3 : 0;
        ctx.fillStyle = pal.tile; ctx.fillRect(px - l, py - 4, T + l + r, 12);
        ctx.save(); ctx.translate(0, py - .8); ctx.fillStyle = giwa; ctx.fillRect(px - l, -3.2, T + l + r, 9); ctx.restore(); // align a cap row to the eave
        ctx.fillStyle = pal.tile; ctx.fillRect(px - l, py + 5, T + l + r, 2.5);
        if (pal.rim) { ctx.fillStyle = pal.rim; ctx.fillRect(px - l, py - 4.5, T + l + r, 1); }
      } else if (tileAt(tx, ty - 1) !== 1) {
        const s = (tx * 73 + ty * 31) % 7;
        ctx.beginPath(); ctx.moveTo(px - .5, py + 2); ctx.lineTo(px + 6 + s, py - 1.5); ctx.lineTo(px + 18, py + .5 - s * .2); ctx.lineTo(px + T + .5, py - 1); ctx.lineTo(px + T + .5, py + 3); ctx.closePath(); ctx.fill();
        if (pal.rim) { ctx.fillStyle = pal.rim; ctx.fillRect(px, py - 1, T, 1.2); }
      }
      if (pal.rim && (tileAt(tx - 1, ty) !== 1 || tileAt(tx + 1, ty) !== 1)) { // stone-rubbing speckle on exposed sides
        ctx.fillStyle = pal.rim; const sx = tileAt(tx - 1, ty) !== 1 ? px : px + T - 1.5;
        for (let i = 0; i < 4; i++) ctx.fillRect(sx, py + ((tx * 13 + ty * 7 + i * 9) % T), 1.5, 2 + (i % 2) * 2);
      }
    } else if (v === 3 && tileAt(tx - 1, ty) !== 3) { // one painted ledge per run of '=' tiles
      let n = 1; while (tileAt(tx + n, ty) === 3) n++;
      const i = LV.ledgeStone ? P2.ledge : P2.plank, f = SPR.props2 && SPR.props2.f[i];
      if (f) { const segN = Math.max(1, Math.round(n / 4)), segW = n * T / segN, hh = segW * f.h / f.w;
        for (let k = 0; k < segN; k++) ctx.drawImage(LV.pal.night ? SPR.props2.inv : SPR.props2.img, f.x, f.y, f.w, f.h, px + k * segW - 2, py - 3, segW + 4, Math.min(hh, LV.ledgeStone ? 30 : 26)); }
      else { ctx.fillStyle = pal.tile; ctx.fillRect(px, py, n * T, 6); }
    } else if (v === 2 && SPR.objects) {
      const f = SPR.objects.f[OBJ.thorns];
      drawSprite("objects", OBJ.thorns, px + T / 2 + ((tx * 7) % 5) - 2, py + T + 3, (T + 10) / f.w, tx % 2 === 1, .5, pal.night);
    } else if (v === 2) {
      ctx.fillStyle = pal.tile; ctx.beginPath();
      for (let i = 0; i < 4; i++) { ctx.moveTo(px + i * 8, py + T); ctx.lineTo(px + i * 8 + 3 + (i % 2), py + 11); ctx.lineTo(px + i * 8 + 8, py + T); }
      ctx.fill(); ctx.fillStyle = SEAL; for (let i = 0; i < 4; i++) ctx.fillRect(px + i * 8 + 2.5 + (i % 2), py + 11, 1.5, 3);
    }
  }
  if (SC && SPR.pines) for (const p of SC.front) if (visible(p.x)) drawSprite("pines", p.i, p.x, p.y, p.h / SPR.pines.f[p.i].h, p.flip, .5, pal.night);
  if (LV.gate && SPR.props2 && visible(LV.gate.x)) drawSprite("props2", P2.gate, LV.gate.x, LV.gate.y, 78 / SPR.props2.f[P2.gate].h, false, .5, pal.night);
  for (const d of LV.dress) {
    if (!visible(d.x) || !SPR[d.sheet]) continue;
    const f = SPR[d.sheet].f[d.i];
    if (d.w) { ctx.drawImage(pal.night ? SPR[d.sheet].inv : SPR[d.sheet].img, f.x, f.y, f.w, f.h, d.x - d.w / 2, d.y, d.w, d.h); continue; }
    drawSprite(d.sheet, d.i, d.x, d.y, d.h / f.h, d.flip, .5, pal.night, d.ay);
  }
  // ink stains
  for (const s of LV.stains) {
    if (!visible(s.x)) continue;
    ctx.globalAlpha = 0.75;
    if (s.pool && SPR.fx) { const f = SPR.fx.f[FX.pool]; drawSprite("fx", FX.pool, s.x, s.y, s.w / f.w, false, .5, false, 1); continue; }
    if (s.c !== SEAL && SPR.objects) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot || 0); drawSprite("objects", OBJ.splat, 0, 0, s.r * 3.4 / SPR.objects.f[OBJ.splat].h, false, .5, pal.night, .5); ctx.restore(); }
    else { ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // 청사초롱 (checkpoints)
  for (const c of LV.cps) {
    if (!visible(c.x)) continue;
    ctx.fillStyle = pal.tile; ctx.fillRect(c.x - 1, c.y - 44, 2, 44); ctx.fillRect(c.x - 1, c.y - 44, 10, 2);
    const lx = c.x + 8, ly = c.y - 40;
    if (SPR.objects) {
      if (c.on) { const gl = ctx.createRadialGradient(lx, ly + 16, 2, lx, ly + 16, 30); gl.addColorStop(0, "rgba(255,170,90,.45)"); gl.addColorStop(1, "rgba(255,170,90,0)"); ctx.fillStyle = gl; ctx.fillRect(lx - 30, ly - 14, 60, 60); }
      drawSprite("objects", c.on ? OBJ.lanternOn : OBJ.lanternOff, lx, ly - 2, kOf("objects", OBJ.lanternOff, 38), false, .5, false, 0);
      continue;
    }
    ctx.strokeStyle = pal.tile; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, ly - 2); ctx.lineTo(lx, ly + 2); ctx.stroke();
    if (c.on) { ctx.fillStyle = "rgba(255,190,90,.25)"; ctx.beginPath(); ctx.arc(lx, ly + 11, 16, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = c.on ? JJOK : pal.foe; ctx.fillRect(lx - 6, ly + 2, 12, 9);
    ctx.fillStyle = c.on ? SEAL : pal.foe; ctx.fillRect(lx - 6, ly + 11, 12, 9);
    ctx.fillStyle = pal.tile; ctx.fillRect(lx - 7, ly + 2, 14, 1.5); ctx.fillRect(lx - 7, ly + 19, 14, 1.5);
  }
  // 낙관 (exit)
  if (LV.exit && visible(LV.exit.x)) {
    const e = LV.exit, cx = e.x + e.w / 2, cy = e.y + e.h / 2, beat = 1 - (songPos / Music.beatLen % 1);
    const s = 26 + Math.max(0, beat - 0.7) * 10;
    if (SPR.objects && drawSprite("objects", OBJ.seal, cx, cy, s / SPR.objects.f[OBJ.seal].h, false, .5, false, .5)) { /* painted seal */ } else {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.06);
    ctx.fillStyle = SEAL; ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = pal.bg; ctx.lineWidth = 2; ctx.strokeRect(-s / 2 + 4, -s / 2 + 4, s - 8, s - 8);
    ctx.fillStyle = pal.bg; ctx.fillRect(-1.5, -s / 2 + 7, 3, s - 14); ctx.fillRect(-s / 2 + 7, -1.5, s - 14, 3);
    ctx.restore(); }
  }
  // 연 (grapple kites)
  for (const p of LV.points) {
    if (!visible(p.x)) continue;
    const on = p === hookCand, sw = Math.sin(tt * 1.3 + p.sway) * 2.5;
    ctx.save(); ctx.translate(p.x + sw, p.y); ctx.rotate(sw * 0.03);
    if (drawSprite("objects", OBJ.kite, 0, -20, kOf("objects", OBJ.kite, 52), false, .5, false, 0)) { ctx.restore(); }
    else {
    ctx.strokeStyle = pal.tile; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 13); ctx.quadraticCurveTo(6, 40, -4, 70); ctx.stroke();
    ctx.fillStyle = on ? JJOK : (pal.rim ? "#3a3833" : "#f1ede4"); ctx.fillRect(-10, -13, 20, 26);
    ctx.strokeStyle = on ? JJOK_L : pal.tile; ctx.lineWidth = 1.6; ctx.strokeRect(-10, -13, 20, 26);
    ctx.beginPath(); ctx.moveTo(-10, -13); ctx.lineTo(10, 13); ctx.moveTo(10, -13); ctx.lineTo(-10, 13); ctx.lineWidth = .8; ctx.stroke();
    ctx.fillStyle = pal.bg; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SEAL; ctx.fillRect(-10, -13, 20, 3);
    ctx.restore(); }
    if (on) { ctx.strokeStyle = JJOK; ctx.globalAlpha = .4 + .3 * Math.sin(tt * 12); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x + sw, p.y, 22, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  if (P && P.hook) { ctx.strokeStyle = pal.fig; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(P.x + P.w / 2, P.y + 12); ctx.lineTo(P.hook.x, P.hook.y); ctx.stroke(); }

  for (const e of enemies) if (e.alive && visible(e.x)) drawEnemy(e, pal);
  for (const b of bullets) {
    const sp = Math.hypot(b.vx, b.vy), tl = b.sniper ? 34 : 18;
    const tr = ctx.createLinearGradient(b.x, b.y, b.x - b.vx / sp * tl, b.y - b.vy / sp * tl);
    tr.addColorStop(0, b.friendly ? "rgba(39,70,106,.8)" : "rgba(195,22,28,.75)"); tr.addColorStop(1, "rgba(140,134,126,0)");
    ctx.strokeStyle = tr; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / sp * tl, b.y - b.vy / sp * tl); ctx.stroke();
    ctx.fillStyle = pal.night ? "#d8d1c4" : "#141317"; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.friendly ? JJOK_L : "#ff6a3d"; ctx.beginPath(); ctx.arc(b.x, b.y, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
  for (const g of ghosts) { ctx.globalAlpha = .3 * (1 - g.age / g.life); if (!drawSprite("hero", HERO.dash, g.x + 9, g.y + 31, kOf("hero", 0, HERO_H), g.face < 0, .55, pal.night)) drawRunner(g.x, g.y, g.face, JJOK, null); }
  ctx.globalAlpha = 1;
  if (P && (state === "play" || state === "pause" || state === "result" || state === "dead")) drawPlayer(pal);
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  ctx.globalAlpha = 1;
  // painted one-shot effects
  for (const v of vfx) {
    const k = v.t / v.life, s = SPR[v.sheet]; if (!s) continue; const f = s.f[v.i], sc = v.h / f.h * (1 - v.grow * .5 + v.grow * k);
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.rot); ctx.globalAlpha = v.a * Math.min(1, (1 - k) * 2.2);
    drawSprite(v.sheet, v.i, 0, 0, sc, v.flip, .5, pal.night && v.sheet === "hud" && v.i !== HUD.spark, v.ay);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // 일격 seals
  for (const s of seals) {
    if (SPR.fx) {
      const a = s.t < .08 ? s.t / .08 : 1 - Math.max(0, s.t - .35) / .35, sc = s.t < .08 ? 1.7 - s.t / .08 * .7 : 1;
      ctx.save(); ctx.translate(s.x, s.y - 22); ctx.rotate(s.rot); ctx.globalAlpha = Math.max(0, a);
      drawSprite("fx", FX.seal, 0, 0, 30 * sc / SPR.fx.f[FX.seal].h, false, .5, false, .5);
      ctx.restore(); continue;
    }
    const a = s.t < .08 ? s.t / .08 : 1 - Math.max(0, s.t - .35) / .35, sc = s.t < .08 ? 1.6 - s.t / .08 * .6 : 1;
    ctx.save(); ctx.translate(s.x, s.y - 18); ctx.rotate(s.rot); ctx.scale(sc, sc); ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = SEAL; ctx.fillRect(-13, -13, 26, 26);
    ctx.fillStyle = "#f4efe4"; ctx.font = `700 15px "Song Myung", serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("擊", 0, 1);
    ctx.restore(); ctx.textAlign = "left";
  }
  ctx.globalAlpha = 1;

  if (P && P.focus && state === "play") {
    const d = aimDir(), cx = P.x + P.w / 2, cy = P.y + P.h / 2;
    ctx.fillStyle = JJOK;
    for (let t = 18; t < 136; t += 14) { const r = 2.6 - t / 136 * 1.2; ctx.globalAlpha = .75 - t / 400; ctx.beginPath(); ctx.ellipse(cx + d.x * t, cy + d.y * t, r * 1.8, r, Math.atan2(d.y, d.x), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const rs = 1 + Math.sin(performance.now() / 90) * .06;
    if (!drawSprite("props", PROP.reticle, cx + d.x * 152, cy + d.y * 152, 38 * rs / (SPR.props ? SPR.props.f[PROP.reticle].h : 1), false, .5, false, .5)) { ctx.beginPath(); ctx.arc(cx + d.x * 152, cy + d.y * 152, 10, 0, 6.28); ctx.stroke(); }
  }

  // screen space overlays
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!vignette) { vignette = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .75); vignette.addColorStop(0, "rgba(20,18,16,0)"); vignette.addColorStop(1, "rgba(20,18,16,.32)"); }
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, cv.width, cv.height);
  if (P && P.focus && state === "play") { ctx.fillStyle = "rgba(39,70,106,.14)"; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (flash > 0) { ctx.strokeStyle = `rgba(195,22,28,${flash * 3})`; ctx.lineWidth = 10 * DPR; ctx.strokeRect(0, 0, cv.width, cv.height); }
  drawTrail();
  if (state === "play" || state === "dead" || state === "pause") drawBeatBar(pal);
  if (state === "dead") {
    const a = Math.max(0, 1 - deathT / 0.75);
    ctx.fillStyle = `rgba(20,18,20,${0.55 * a})`; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = Math.min(1, a * 2);
    ctx.fillStyle = "#f1ede4"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `400 ${Math.min(72, W / 8)}px "Song Myung", serif`; ctx.fillText("절명", W / 2, H / 2 - 12);
    if (mode !== "tutorial") { ctx.font = `600 13px ${BODY_FONT}`; ctx.fillText(run.breath > 0 ? `남은 숨 ${run.breath}` : "숨이 다했다", W / 2, H / 2 + Math.min(70, H / 5.5)); }
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }
}
function drawBackdrop(pal) {
  const camX = cam.x || 0, camY = cam.y || 0;
  const lh = LV ? LV.h * T : 512;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const layers = [["far", .08, pal.farA, .58, .66], ["mid", .22, pal.midA, .8, .78]];
  layers.forEach(([key, f, alpha, bottom, hFrac], li) => {
    const yoff = (lh - camY) * f * .5 * SCALE;
    const by = H * bottom + yoff;
    const img = IMG[key];
    ctx.globalAlpha = alpha;
    if (img) {
      const h = H * hFrac, w = h * img.width / img.height, off = ((camX * f * SCALE) % w + w) % w;
      for (let x = -off; x < W; x += w) ctx.drawImage(img, x, by - h, w, h);
    } else if (LV) {
      const r = LV.ridges[li], off = camX * r.f * SCALE;
      const g = ctx.createLinearGradient(0, by - 140, 0, by + 120);
      g.addColorStop(0, `rgba(${pal.wash},${li ? .55 : .35})`); g.addColorStop(1, `rgba(${pal.wash},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, H + 10);
      let prev = null;
      for (const [x, y] of r.pts) {
        const px = x * SCALE * .6 - off + W * .2, py = by - 60 + y * (li ? .9 : 1.3);
        if (px < -300 || px > W + 300) continue;
        if (!prev) ctx.lineTo(px, py); else ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + px) / 2, (prev[1] + py) / 2);
        prev = [px, py];
      }
      ctx.lineTo(W + 10, H + 10); ctx.closePath(); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  if (LV) { // mist band in front of the city, as in the reference art
    const my = H * .8 + (lh - camY) * .11 * SCALE, mg = ctx.createLinearGradient(0, my - 90, 0, my + 70);
    const fog = pal.rim ? "37,35,33" : "236,232,223";
    mg.addColorStop(0, `rgba(${fog},0)`); mg.addColorStop(.55, `rgba(${fog},${pal.rim ? .55 : .7})`); mg.addColorStop(1, `rgba(${fog},0)`);
    ctx.fillStyle = mg; ctx.fillRect(0, my - 90, W, 160);
  }
}
function drawTrail() {
  const now = performance.now();
  while (trail.length && now - trail[0].t > 260) trail.shift();
  if (trail.length < 2) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.lineCap = "round"; ctx.strokeStyle = LV ? LV.pal.fig : "#141317";
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i]; if (b.start) continue;
    const life = 1 - (now - b.t) / 260; ctx.globalAlpha = Math.max(0, life) * .55; ctx.lineWidth = 2 + life * 7;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = "butt";
}
function drawBeatBar(pal) {
  // drums slide in at an even spacing and are struck as they reach the ring on the left: that moment is the 일격 window
  const def = Music.def; if (!def) return;
  const bl = Music.beatLen, pos = Music.pos(), gap = 64, mx = W / 2 - 96, y = H - 30, ahead = 4;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bf = SPR.props2 && SPR.props2.f[P2.board];
  if (bf) ctx.drawImage(SPR.props2.img, bf.x, bf.y, bf.w, bf.h, mx - 52, y - 30, gap * ahead + 104, 62);   // lacquered board the drums sit on
  else uiPatch(5, mx - 46, y - 30, gap * ahead + 92, 60, pal.night ? .5 : .9);
  const near = Math.abs(Music.offBeat(pos)) < STRIKE_WIN;
  uiPatch(0, mx - 25, y - 25, 50, 50, near ? 1 : .55);                      // judgement ring
  const k0 = Math.floor(pos / bl) - 1;
  for (let k = k0 + ahead + 1; k >= k0; k--) {
    const dt = k * bl - pos, x = mx + dt / bl * gap;
    if (x < mx - 40 || x > mx + gap * ahead + 30) continue;
    const strong = ((k % def.beats) + def.beats) % def.beats === 0, hit = Math.abs(dt) < STRIKE_WIN, past = dt < -STRIKE_WIN;
    const size = (strong ? 38 : 28) * (hit ? 1.18 : 1), i = hit ? HUD.struck : strong ? HUD.bigDrum : HUD.drum;
    ctx.globalAlpha = past ? Math.max(0, 1 + dt / bl * 3) : Math.min(1, 1.15 - Math.max(0, dt / bl - 2.5));
    if (!SPR.hudsolid || !drawSprite("hudsolid", i, x, y, size / SPR.hudsolid.f[i].h, false, .5, false, .5)) {
      ctx.fillStyle = hit ? SEAL : pal.text; ctx.beginPath(); ctx.arc(x, y, size / 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawRunner(x, y, face, col, pl) {
  const cx = x + 9, lean = pl ? Math.max(-4, Math.min(4, pl.vx * 0.012)) : face * 2;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = "round";
  // head under a 삿갓 (conical bamboo hat) - the silhouette that sets 무명 apart from the 갓-wearing guards
  const hx = cx + lean, tilt = lean * 0.04;
  ctx.beginPath(); ctx.arc(hx, y + 7.5, 4, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(hx, y + 4); ctx.rotate(tilt);
  ctx.beginPath(); ctx.moveTo(-12, 2.2); ctx.quadraticCurveTo(-6, -1, face * 1.2, -7.5); ctx.quadraticCurveTo(6, -1, 12, 2.2); ctx.quadraticCurveTo(0, 3.6, -12, 2.2); ctx.fill();
  ctx.strokeStyle = HAT_WEAVE[col] || "rgba(128,120,110,.55)"; ctx.lineWidth = .7;
  ctx.beginPath(); ctx.moveTo(-7, .9); ctx.lineTo(face * 1.2, -7); ctx.lineTo(7, .9); ctx.moveTo(-3.5, 1.4); ctx.lineTo(face * 1.2, -7); ctx.lineTo(3.5, 1.4); ctx.stroke();
  ctx.restore(); ctx.strokeStyle = col;
  // coat
  ctx.beginPath(); ctx.moveTo(cx + lean - 4, y + 10); ctx.lineTo(cx + lean + 4, y + 10); ctx.lineTo(cx + 5 - face * 2, y + 22); ctx.lineTo(cx - 5 - face * 4, y + 23); ctx.closePath(); ctx.fill();
  let a1 = .35, a2 = -.35;
  if (pl) {
    if (pl.onGround && Math.abs(pl.vx) > 20) { const s = Math.sin(pl.run); a1 = s * .9; a2 = -s * .9; }
    else if (!pl.onGround) { a1 = .9 * face; a2 = -.2 * face; if (pl.wall) { a1 = -.6 * pl.wall; a2 = -.2 * pl.wall; } }
  }
  ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.moveTo(cx, y + 20); ctx.lineTo(cx + Math.sin(a1) * 10, y + 20 + Math.cos(a1) * 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, y + 20); ctx.lineTo(cx + Math.sin(a2) * 10, y + 20 + Math.cos(a2) * 10); ctx.stroke();
  ctx.lineCap = "butt";
}
function heroPose() { // [sheet, frame]
  if (state === "dead") return ["hero", HERO.dead];
  if (P.slashT > 0) return ["hero", P.slashDir.y < -0.5 ? HERO.up : (P.slashDir.y > 0.5 && !P.onGround ? HERO.fall : HERO.slash)];
  if (P.dashT > 0 || P.hook) return ["hero", HERO.dash];
  if (!P.onGround) {
    if (P.wall) return ["hero2", P.climbing ? H2.climb : H2.cling];
    if (P.airT < .12 && P.vy < 0) return ["hero2", H2.takeoff];
    if (Math.abs(P.vy) < 150) return ["hero2", H2.apex];
    return ["hero", P.vy < 0 ? HERO.rise : HERO.fall];
  }
  if (P.landT > 0) return ["hero2", H2.land];
  const a = axis().x, ix = a > .3 ? 1 : a < -.3 ? -1 : 0;
  if (Math.abs(P.vx) > 40) {
    if (ix && Math.sign(P.vx) !== ix) return ["hero2", H2.turn];
    if (!ix && Math.abs(P.vx) > 110) return ["hero2", H2.skid];
    if ((P.runT || 0) < .12) return ["hero2", H2.start];
    return ["hero", HERO.run[Math.floor(P.run / 1.05) % HERO.run.length]];
  }
  if (P.slashCd > 0) return ["hero2", H2.guard];
  return ["hero2", H2.idle[Math.floor(performance.now() / 420) % 3]];
}
function drawPlayer(pal) {
  if (!SPR.hero) { if (state !== "dead") legacyPlayer(pal); return; }
  let [sheet, fr] = heroPose(); if (sheet === "hero2" && !SPR.hero2) { sheet = "hero"; fr = HERO.idle; }
  const cx = P.x + P.w / 2, wallPose = sheet === "hero2" && (fr === H2.cling || fr === H2.climb), face = wallPose ? P.wall : P.face;
  // hero2 is scaled so its first running step matches the original running frames
  const k = sheet === "hero" ? kOf("hero", 0, HERO_H) : kOf("hero", 0, HERO_H) * SPR.hero.f[1].h / SPR.hero2.f[H2.start].h;
  if (state === "dead") ctx.globalAlpha = Math.max(0, 1 - deathT / 0.75);
  drawSprite(sheet, fr, cx, P.y + P.h + 1, k, face < 0, sheet === "hero" ? (HERO_AX[fr] ?? .55) : (wallPose ? .62 : .5), pal.night);
  ctx.globalAlpha = 1;
  if (P.slashT > 0 && state !== "dead" && SPR.fx) { // two painted frames: the edge, then the full stroke breaking into ink
    const d = P.slashDir, prog = 1 - Math.min(1, P.slashT / 0.14), ang = Math.atan2(d.y, d.x);
    const first = prog < .38, i = first ? (P.strike ? FX.slashARed : FX.slashA) : (P.strike ? FX.slashBRed : FX.slashB);
    const f = SPR.fx.f[i], H2 = (P.strike ? 84 : 68) * (first ? .8 : 1), sc = H2 / f.h * (0.92 + prog * 0.14);
    ctx.save(); ctx.translate(cx + d.x * (first ? 14 : 24), P.y + P.h / 2 - 4 + d.y * 22); ctx.rotate(ang + Math.PI); if (d.x < -.2) ctx.scale(1, -1);
    ctx.globalAlpha = first ? 1 : Math.min(1, (1 - prog) * 2.4);
    for (let n = P.strike ? 2 : 1; n > 0; n--) drawSprite("fx", i, 0, 0, sc, false, first ? .3 : .45, pal.night && !P.strike, .5); // vermilion keyed thin; double it
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
function legacyPlayer(pal) {
  const cx = P.x + P.w / 2;
  P.scarf.unshift({ x: cx - P.face * 1, y: P.y + 11 }); if (P.scarf.length > 10) P.scarf.length = 10;
  ctx.strokeStyle = SEAL; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath();
  P.scarf.forEach((s, i) => { const wob = Math.sin(performance.now() / 70 + i) * i * .4, px = s.x - P.face * i * 1.7, py = s.y + wob + i * .6; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.stroke();
  drawRunner(P.x, P.y, P.face, pal.fig, P);
  const d = P.slashDir;
  if (P.slashT > 0) {
    const dur = 0.14, prog = 1 - Math.min(1, P.slashT / dur), ang = Math.atan2(d.y, d.x), sweep = 2.4;
    const a0 = ang - sweep / 2 + sweep * Math.max(0, prog - .45), a1 = ang - sweep / 2 + sweep * Math.min(1, prog * 1.6);
    const ox = cx, oy = P.y + P.h / 2, R = P.strike ? 56 : 44;
    ctx.fillStyle = P.strike ? "rgba(195,22,28,.55)" : `rgba(${pal.wash},.55)`;
    ctx.beginPath(); ctx.arc(ox, oy, R, a0, a1); ctx.arc(ox, oy, R * .45, a1, a0, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pal.fig; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ox, oy, R - 2, a0, a1); ctx.stroke();
  } else {
    ctx.strokeStyle = pal.fig; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx - P.face * 8, P.y + 23); ctx.lineTo(cx + P.face * 5, P.y + 6); ctx.stroke();
  }
  ctx.lineCap = "butt";
}
function drawEnemy(e, pal) {
  const cx = e.x + e.w / 2;
  if (SPR.foes) {
    const fr = FOE[e.type], now = performance.now();
    if (e.type === "d") { drawSprite("foes", fr[Math.sin(now / 90 + e.id) > 0 ? 0 : 1], cx, e.y + e.h + 12, kOf("foes", 0, FOE_H) * .6, e.vx < 0, .5, pal.night); return; }
    if (e.fireAt != null) { // aim line from the musket muzzle
      const [mx, my] = muzzle(e), sniper = e.type === "s", locked = songPos >= e.fireAt - (sniper ? .3 : .15);
      let dx = e.tx - mx, dy = e.ty - my; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const prog = Math.min(1, (songPos - e.aimFrom) / Math.max(.01, e.fireAt - e.aimFrom)), len = sniper ? 1000 : Math.min(d, 200);
      if (SPR.props) { // one brush stroke from the muzzle, thickening as the shot locks
        const f = SPR.props.f[PROP.aim], th = locked ? 10 : 4 + prog * 4;
        ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.atan2(dy, dx)); ctx.globalAlpha = locked ? 1 : .3 + prog * .5;
        ctx.drawImage(SPR.props.img, f.x, f.y, f.w, f.h, 0, -th / 2, len * (locked ? 1 : .35 + prog * .65), th);
        ctx.restore(); ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = SEAL; ctx.globalAlpha = locked ? .95 : .2 + prog * .5; ctx.lineWidth = locked ? 2.2 : 1;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + dx * len, my + dy * len); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    const i = e.type === "h" ? fr[e.vx ? Math.floor(now / 260) % 2 : 0] : fr[e.fireAt != null ? 1 : 0];
    drawSprite("foes", i, cx, e.y + e.h + 1, kOf("foes", 0, FOE_H), e.face < 0, FOE_AX[i] ?? .5, pal.night);
    return;
  }
  if (e.type === "d") { // 매
    const cy = e.y + e.h / 2, fl = Math.sin(performance.now() / 60 + e.id) * 5;
    ctx.fillStyle = pal.foe; ctx.beginPath(); ctx.moveTo(cx - 16, cy - fl); ctx.quadraticCurveTo(cx - 6, cy - 4, cx, cy + 2); ctx.quadraticCurveTo(cx + 6, cy - 4, cx + 16, cy - fl); ctx.lineTo(cx, cy + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SEAL; ctx.beginPath(); ctx.arc(cx + (e.vx > 0 ? 2 : -2), cy - 1, 1.6, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (e.type === "h") { // 등패수: round rattan shield
    ctx.fillStyle = pal.foe; ctx.fillRect(e.x + 6, e.y + 8, 12, 22); ctx.beginPath(); ctx.arc(cx, e.y + 6, 5, 0, Math.PI * 2); ctx.fill();
    const sx = cx + e.face * 10;
    ctx.fillStyle = pal.tile; ctx.beginPath(); ctx.ellipse(sx, e.y + 16, 6, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pal.rim || "rgba(230,226,215,.35)"; ctx.lineWidth = 1; for (let r = 3; r < 13; r += 4) { ctx.beginPath(); ctx.ellipse(sx, e.y + 16, r * .45, r, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = SEAL; ctx.fillRect(sx - 1.5, e.y + 14, 3, 4);
    return;
  }
  const sniper = e.type === "s";
  if (e.fireAt != null) {
    const mx = cx + e.face * 12, my = e.y + 9, locked = songPos >= e.fireAt - (sniper ? .3 : .15);
    let dx = e.tx - mx, dy = e.ty - my; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const prog = Math.min(1, (songPos - e.aimFrom) / Math.max(.01, e.fireAt - e.aimFrom)), len = sniper ? 1000 : Math.min(d, 200);
    ctx.strokeStyle = SEAL; ctx.globalAlpha = locked ? .95 : .2 + prog * .5; ctx.lineWidth = locked ? 2.4 : 1; if (!sniper && !locked) ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + dx * len, my + dy * len); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // 순라 / 포수: wide-brimmed hat silhouette
  ctx.fillStyle = pal.foe;
  ctx.beginPath(); ctx.moveTo(e.x + 3, e.y + 30); ctx.lineTo(e.x + 6, e.y + 10); ctx.lineTo(e.x + e.w - 6, e.y + 10); ctx.lineTo(e.x + e.w - 3, e.y + 30); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, e.y + 7, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.tile; ctx.fillRect(cx - (sniper ? 9 : 12), e.y + 1.5, sniper ? 18 : 24, 2.2); ctx.fillRect(cx - 3, e.y - 2, 6, 4);
  ctx.strokeStyle = pal.tile; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, e.y + 14); ctx.lineTo(cx + e.face * (sniper ? 22 : 14), e.y + 12); ctx.stroke();
  ctx.fillStyle = SEAL; ctx.fillRect(cx + e.face * 2 - 1, e.y + 6, 2, 2);
}

// ---------- screens ----------
function showScreen(id) {
  for (const s of ["menu", "settings", "interlude", "pause", "result"]) $(s).hidden = s !== id;
  const inGame = id === null;
  $("hud").hidden = !(inGame || id === "pause");
  $("pad").hidden = !inGame;
}
let settingsBack = "menu";
function openSettings(back) { settingsBack = back; showScreen("settings"); refreshSettings(); }
function refreshSettings() { $("bSound").textContent = settings.sound ? "켜짐" : "꺼짐"; $("offVal").textContent = (settings.offset > 0 ? "+" : "") + settings.offset + "ms"; }
function saveSettings() { store.set("settings", settings); Music.setVolume(settings.sound ? 1 : 0); Music.setOffset(settings.offset); refreshSettings(); }
function buildMenu() {
  const s = store.get("run", null);
  $("bContinue").hidden = !s;
  if (s) $("bContinue").innerHTML = `<span>이어하기</span><small style="color:inherit">${ORD[s.m]} 마당 · 숨 ${s.breath}${s.daily ? " · 오늘의 판" : ""}</small>`;
  const d = store.get("daily." + todayKey(), null), dt = new Date();
  $("dailyInfo").textContent = `${dt.getMonth() + 1}월 ${dt.getDate()}일` + (d ? ` · ${d.reached >= 5 ? "돌파" : ORD[Math.min(4, d.reached)] + " 마당"} ${fmt(d.time)}` : "");
}
function toMenu() {
  document.body.classList.remove("night");
  Music.stop(); state = "menu"; buildMenu(); showScreen("menu");
  if (!LV) loadMap(START_PIECE.map((r, y) => r + r + r + r), PAL[0]);
}
function pauseGame() {
  if (state !== "play") return;
  state = "pause"; for (const k in held) held[k] = 0; Music.pause(); Music.muffle(false); if (P) P.focus = false;
  $("pTitle").textContent = mode === "tutorial" ? "수련터" : ORD[run.m] + " 마당";
  const st = $("pStats"); st.innerHTML = "";
  const rows = [["시간", fmt(run.time)], ["베인 횟수", run.deaths], ["일격", run.strikes + " / " + run.slashes]];
  if (mode !== "tutorial") rows.splice(1, 0, ["남은 숨", run.breath]);
  for (const [k, v] of rows) { const a = document.createElement("span"), b = document.createElement("b"); a.textContent = k; b.textContent = v; st.append(a, b); }
  $("bGiveUp").hidden = mode === "tutorial";
  showScreen("pause");
}
function resumeGame() { if (state !== "pause") return; showScreen(null); Music.resume(); state = "play"; last = performance.now(); }

$("bNew").addEventListener("click", () => newRun(false));
$("bDaily").addEventListener("click", () => newRun(true));
$("bContinue").addEventListener("click", continueRun);
$("bTut").addEventListener("click", startTutorial);
$("bEnter").addEventListener("click", enterMadang);
$("bPause").addEventListener("click", pauseGame);
$("bResume").addEventListener("click", resumeGame);
$("bGiveUp").addEventListener("click", () => { state = "play"; endRun(false); });
$("bToMenu").addEventListener("click", () => { saveRun(); toMenu(); });
$("bPauseSet").addEventListener("click", () => openSettings("pause"));
$("bSettings").addEventListener("click", () => openSettings("menu"));
$("bSetClose").addEventListener("click", () => { if (settingsBack === "pause") showScreen("pause"); else showScreen("menu"); });
$("bSound").addEventListener("click", () => { settings.sound = !settings.sound; saveSettings(); });
$("bOffDn").addEventListener("click", () => { settings.offset = Math.max(-200, settings.offset - 10); saveSettings(); });
$("bOffUp").addEventListener("click", () => { settings.offset = Math.min(200, settings.offset + 10); saveSettings(); });
$("bAgain").addEventListener("click", () => newRun(lastResult && lastResult.daily));
$("bResMenu").addEventListener("click", toMenu);
$("bShare").addEventListener("click", async () => {
  const text = shareText();
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("결과를 복사했어요"); } catch (e) { toast("복사하지 못했어요"); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });

// install (Android/desktop Chrome); iOS gets a hint instead
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("bInstall").hidden = false; });
$("bInstall").addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; $("bInstall").hidden = true; });
const standalone = matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone;
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) $("installNote").hidden = false;

if (location.hash === "#debug") window.__dbg = { tp(tx, ty) { P.x = tx * T + 7; P.y = (ty + 1) * T - 30; P.vx = P.vy = 0; }, get state() { return state; }, get P() { return P; } };
resize();
toMenu();
P = null; cam.x = 600; cam.y = 300;
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
})();
