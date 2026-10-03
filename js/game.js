// 천고 — main game. Depends on data.js (TUTORIAL, CHUNKS) and music.js (Music).
(() => {
"use strict";
const T = 32;
const $ = id => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d", { alpha: false });   // opaque canvas: cheaper to composite on phones
let W = 0, H = 0, DPR = 1, SCALE = 1;
const MOBILE = matchMedia("(pointer:coarse)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const LITE = () => localStorage.getItem("chungo.lite") === "1";
let dprCap = LITE() ? 1 : MOBILE ? 1.5 : 2;   // phones: 1.5x is sharp enough and much lighter on the GPU; lowered further if frames run long
function resize() {
  DPR = Math.min(dprCap, window.devicePixelRatio || 1);
  for (const k in PAT) delete PAT[k];   // patterns carry the old pixel scale
  const r = cv.getBoundingClientRect(); W = Math.round(r.width) || window.innerWidth; H = Math.round(r.height) || window.innerHeight;   // the canvas's real laid-out box, not the (often stale) window size
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  SCALE = Math.max(0.5, Math.min(W / (T * 13), H / (T * 11)));
  vignette = null;
}
window.addEventListener("resize", resize);
// phones change the visible area without a clean resize (address bar, rotation, coming back from the background): follow the canvas box itself
window.addEventListener("orientationchange", () => { setTimeout(resize, 150); setTimeout(resize, 500); });
if (window.visualViewport) visualViewport.addEventListener("resize", resize);
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv);
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(resize, 100); });
setInterval(() => { const r = cv.getBoundingClientRect(); if (Math.abs(Math.round(r.width) - W) > 1 || Math.abs(Math.round(r.height) - H) > 1) resize(); }, 700);

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
// a turn of the tower is three 마당; each draws on one of the five tiers below (진양조 → 자진모리 → 단모리)
const LAST_M = 2, MD = m => [0, 2, 4][Math.min(LAST_M, m)];
// the three 관문 of a turn, named in hanja: into the mountain, up the cloud ladder, the terrace of 천고 itself
const STAGE = [{ han: "破曉關", ko: "파효관" }, { han: "雲梯", ko: "운제" }, { han: "天鼓臺", ko: "천고대" }];
// the last 관문 is named for the guardian waiting in it
const LAIR = { sumun: ["鐵門關", "철문관"], gumiho: ["狐月谷", "호월곡"], dokkaebi: ["鬼火林", "귀화림"], imugi: ["潛龍淵", "잠룡연"], wongwi: ["冤魂閣", "원혼각"],
  jangseung: ["大將壇", "대장단"], cheongo: ["天鼓殿", "천고전"], shadow: ["影門", "영문"], haetae: ["鎭火臺", "진화대"], bulgasari: ["食鐵窟", "식철굴"], baekho: ["白虎嶺", "백호령"], talchum: ["假面臺", "가면대"] };
// which guardian waits: in 천고탑, a 그림자 every tenth floor and the drum's own lord at the thirtieth once the name is whole
function bossKindOf(r = run, m = r && r.m) {
  if (r && r.tower) { if (r.floor === 30 && META.mem.length >= 9) return "cheongo"; if (r.floor % 10 === 0 && META.books.length > 1) return "shadow"; }
  return bossFor(r.seed, r.cycle || 0, m);
}
function stageOf(m, r = run) {
  m = Math.min(LAST_M, m);
  if (m === LAST_M && r && r.seed != null) { const l = LAIR[bossKindOf(r, m)]; if (l) return { han: l[0], ko: l[1] }; }
  return STAGE[m];
}
const stageName = (m, r) => { const s = stageOf(m, r); return `${s.ko} ${s.han}`; };
const MNAME = ["초입", "연비", "망루", "승천", "결전"];   // 初入 鳶飛 望樓 昇天 決戰
const MADANG = [
  // "w" entries draw from wall chunks (climb / wall-jump), so every 마당 has walls to run
  // "w" entries draw from wall chunks, "m" from multi-floor chunks with ledges
  { jd: "jinyang",   line: "북은 아직 멀리서 울린다.",          tiers: [0, "m1", "w0", 1, "m1", "w1", 1, "m1", 1] },
  { jd: "jungmori",  line: "연줄 위로, 바람을 타라.",            tiers: ["m1", "w1", 1, "m1", "w0", 1, "m2", "w1", "m1"] },
  { jd: "jajinmori", line: "포수의 눈은 장단을 놓치지 않는다.",  tiers: [1, "m2", "w1", 2, "m1", "w2", 2, "m2", 2] },
  { jd: "hwimori",   line: "오를수록 장단은 빨라진다.",          tiers: ["w1", "m2", 2, "w2", "m1", 1, "w2", "m2", "w2"] },
  { jd: "danmori",   line: "천고가 가깝다.",                     tiers: ["m2", 2, "w2", "m2", 2, "w1", 2, 2, "m2"] }
];
const PAL = [
  { bg: "#e6e2d7", tile: "#1c1b1f", fig: "#141317", foe: "#55525b", text: "#1c1b1f", wash: "23,22,26", farA: .36, midA: .5, rim: null },
  { bg: "#dcd6c8", tile: "#1c1b1f", fig: "#141317", foe: "#55525b", text: "#1c1b1f", wash: "23,22,26", farA: .36, midA: .5, rim: null },
  { bg: "#c9c1b1", tile: "#19181c", fig: "#121115", foe: "#4c4952", text: "#19181c", wash: "23,22,26", farA: .36, midA: .52, rim: null },
  { bg: "#8e887e", tile: "#141316", fig: "#0f0e11", foe: "#3a3840", text: "#141316", wash: "18,17,20", farA: .32, midA: .48, rim: "rgba(236,230,216,.18)" },
  { bg: "#b9b1a4", tile: "#141316", fig: "#0f0e11", foe: "#3a3840", text: "#141316", wash: "18,17,20", farA: .3, midA: .46, rim: null }
];
const BODY_FONT = getComputedStyle(document.documentElement).getPropertyValue("--f-body");
const HAT_WEAVE = { "#ece6d8": "rgba(60,56,50,.6)" }; // weave lines on the inverted (night) figure
// slow-mo aim switches to this stone-rubbing palette: dark paper, bone-white ink
const NIGHT = { bg: "#252321", tile: "#0b0a0c", fig: "#ece6d8", foe: "#a49d92", text: "#ece6d8", wash: "236,230,216", farA: .22, midA: .35, rim: "rgba(236,230,216,.5)", night: true };
const SEAL = "#c3161c", JJOK = "#27466a", JJOK_L = "#5f86b5";

// ---------- images (optional; drawn procedurally when missing) ----------
// far/mid: Higgsfield ink-wash panoramas with alpha. tex-*: seamless tiles (seam ratio checked <= 1.3).
// A canvas we touched with getImageData lives in CPU memory, and on Android Chrome drawing it uploads the whole
// texture to the GPU every frame. Each processed picture is turned into an ImageBitmap (GPU-resident) once ready.
function gpuize(c, put) { if (window.createImageBitmap && c && c.getContext) createImageBitmap(c).then(put).catch(() => {}); return c; }
const IMG = {}, PAT = {};
let perfT = 0, perfN = 0, perfSlow = 0;   // frame-time watch for the automatic quality drop
for (const k of ["tex-paper", "tex-stone", "tex-giwa", "tex-granite", "tex-slab"]) { const im = new Image(); im.onload = () => { IMG[k] = im; PAT[k] = null; }; im.src = "assets/" + k + ".webp"; }
function tintedPaper(ssn) { // paper texture with the season's colour multiplied in once
  const key = "tex-paper-" + ssn; if (PAT[key]) return PAT[key]; const im = IMG["tex-paper"]; if (!im) return null;
  if (!IMG[key]) { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0); g.globalCompositeOperation = "multiply"; g.fillStyle = SEASON_TINT[ssn]; g.fillRect(0, 0, c.width, c.height); IMG[key] = c; }
  return pattern(key, DPR * 0.9);
}
function pattern(key, scale) { // world- or screen-anchored repeating pattern, built once per image
  if (!IMG[key]) return null;
  if (!PAT[key]) { PAT[key] = ctx.createPattern(IMG[key], "repeat"); PAT[key].setTransform(new DOMMatrix().scale(scale)); }
  return PAT[key];
}
for (const k of ["far", "mid"]) { const im = new Image(); im.onload = () => { IMG[k] = gpuize(softened(seamlessStrip(im), k === "far" ? 3 : 2), bm => { IMG[k] = bm; }); }; im.src = "assets/" + k + ".webp"; }
// Make a panorama wrap horizontally: the last 22% is cross-faded into the start, so tiling shows no cut or mirror.
function softened(c, px) { // blur once at load, so the backdrop recedes behind the sharp pines and actors
  const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const g = o.getContext("2d");
  g.filter = `blur(${px}px)`; g.drawImage(c, 0, 0); return o;
}
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
// hero3: the painted-with-effects swordsman. 0 idle, 1-6 sprint, 7 take-off, 8 somersault, 9 fall, 10 wall, 11 dash, 12-14 slashes (fwd/up/down), 15 landing
const H3 = { idle: 0, run: [1, 2, 3, 4, 5, 6], rise: 7, flip: 8, fall: 9, wall: 10, dash: 11, slash: 12, up: 13, down: 14, land: 15 };
const H3_AX = [.48, .58, .64, .63, .65, .58, .62, .59, .58, .54, .62, .46, .32, .42, .52, .49];
const SF = { fwd: 0, up: 1, down: 2, arc: 3, arcRed: 4, bolt: 5, sword: 6, guard: 7, moon: 8 };          // slashfx sheet
const PF = { fire: 0, clone: 1, spin: 2, bloom: 3, wind: 4, dragon: 5, thunder: 6, spark: 7, splash: 8 }; // perkfx sheet
const WF = { ssIdle: 0, ssA: 1, ssB: 2, wdIdle: 3, wdSweep: 4, wdSlam: 5, bdStance: 6, bdCut: 7, bdSheathe: 8 }, WF_AX = [.46, .46, .52, .35, .24, .46, .55, .38, .56];   // weapons sheet
const SF_AX = [.44, .55, .6], SLASH_K = 1.18;   // measured on the sliced poses: the lunge reads at ~80% of standing height
const HFX = { dash: 0, jump: 1, land: 2, air: 3, wall: 4, strike: 5, arc: 6, wind: 7, ribbon: 8 };
const HERO_AX = { 0: .5, 9: .5, 10: .4, 11: .55, 13: .45, 14: .55, 15: .45 };   // body centre as a fraction of frame width
const FOE = { g: [0, 1], s: [2, 3], d: [4, 5], h: [6, 7] };
const FOE_AX = { 0: .5, 1: .3, 2: .45, 3: .3, 6: .45, 7: .45 };
const F2 = { mudang: 0, mudangCast: 1, reaper: 2, reaperSmoke: 3, boss: 4, bossUp: 5, bossSlam: 6, bossKneel: 7, ward: 8 };   // foes2 sheet
const FX = { slashA: 0, slashARed: 1, slashB: 2, slashBRed: 3, burst: 4, spray: 5, seal: 6, drops: 7, pool: 8 };
const HUD = { bigDrum: 0, struck: 1, drum: 2, aimLine: 3, reticle: 4, rope: 5, spark: 6, smoke: 7, dust: 8 }; // hudsolid for 0-5, hud (soft) for 6-8
// props sheet: geumjul rope, enemy aim stroke, dash reticle, then set dressing
const H2 = { idle: [0, 1, 2], guard: 3, start: 4, skid: 5, takeoff: 6, apex: 7, land: 8, turn: 9, cling: 10, climb: 11 };
// 비급 (secret techniques): picked after each 마당; icons are frames of the rogue sheet (0 is 絶命, 1 the card paper)
// 비급: three kinds, held in four slots — one 조준 (changes how the aimed dash works), one 방어, two 이동.
// Nothing adds damage or makes you untouchable; every attack lives in the aimed dash (hold dash in the air → time slows → release).
const CHOSIK = [
  { id: "sum", name: "숨", han: "息", kind: "생존", desc: "숨 하나를 되찾는다", icon: 8, repeat: true },
  // 조준 — pick one: what the aimed dash becomes
  { id: "d_far", name: "원섬", han: "遠閃", kind: "일섬", desc: "일섬이 1.8배 멀리 날아가고, 베는 폭이 두 배 넓어진다", icon: 201 },
  { id: "d_sunbo", name: "순보", han: "瞬步", kind: "일섬", desc: "무아경을 풀 때 겨눈 쪽 가까이(7칸) 적이 있으면 그 등 뒤로 순간이동하며 벤다 — 우두머리에겐 온전한 일격이 아니고, 뒤에 잠깐 대시를 못 쓴다", icon: 850 },
  { id: "d_sun", name: "연환", han: "連環", kind: "일섬", desc: "일섬으로 적을 베면 공중 대시가 하나 더 쌓이고, 곧바로 다시 무아경에 든다 (대시를 누르면 날아간다)", icon: 4 },
  { id: "d_jeong", name: "정중동", han: "靜中動", kind: "일섬", desc: "무아경이 두 배 오래, 더 느리게 흐르고, 겨눈 쪽의 적에게 겨냥이 저절로 붙는다", icon: 106 },
  { id: "d_beat", name: "간섬", han: "看閃", kind: "일섬", desc: "간파에 성공하면 공중 대시가 하나 더 쌓이고, 천고 기운이 두 배로 찬다", icon: 208 },
  { id: "d_hover", name: "부동", han: "不動", kind: "일섬", desc: "공중에서 무아경에 든 동안 그 자리에 멈춰 선다 — 떨어지지 않고 느긋하게 겨눈다", icon: 6 },
  { id: "d_charge", name: "축기", han: "蓄氣", kind: "일섬", desc: "0.8초를 꽉 채워 놓으면 대시가 멈춘 자리에서 참격파가 겨눈 쪽으로 멀리 날아가 일격으로 벤다. 너무 일찍 놓으면 대시가 짧다", icon: 506 },
  { id: "d_bounce", name: "반섬", han: "反閃", kind: "일섬", desc: "일섬이 벽이나 바닥에 부딪히면 한 번 튕겨 나가며 계속 벤다", icon: 508 },
  { id: "d_return", name: "회선", han: "回旋", kind: "일섬", desc: "일섬으로 적을 베었다면, 0.6초 안에 대시를 눌러 처음 자리로 되돌아가며 한 번 더 벤다 (대시를 쓰지 않는다)", icon: 602 },
  { id: "d_chain", name: "뇌인", han: "雷引", kind: "일섬", desc: "일섬으로 적을 쓰러뜨리면 번개가 가장 가까운 적 하나에게 튀어 함께 벤다", icon: 606 },
  { id: "d_reflect", name: "역탄", han: "逆彈", kind: "일섬", desc: "일섬이 스친 적 탄은 방향을 틀어 쏜 적에게 되날아간다", icon: 507 },
  // 무녀 조준 — her aimed dash already turns back every shot it brushes
  { id: "m_wind", name: "회오리 길", han: "旋風路", kind: "일섬", only: "munyeo", desc: "일섬이 지나간 길에 회오리가 0.8초 남아, 닿는 적을 베고 탄을 지운다", icon: 604 },
  { id: "m_talis", name: "부적 세 장", han: "三符", kind: "일섬", only: "munyeo", desc: "무아경을 풀면 겨눈 쪽으로 부적 세 장을 부채꼴로 날려 일격으로 벤다 (대시는 짧아진다)", icon: 705 },
  { id: "m_bell", name: "방울 굿", han: "鈴굿", kind: "일섬", only: "munyeo", desc: "일섬이 멈춘 자리에서 방울이 울려 둘레의 적을 1초 굳힌다", icon: 707 },
  { id: "m_moon", name: "달맞이", han: "迎月", kind: "일섬", only: "munyeo", desc: "일섬이 멈춘 자리에 달빛 고리가 퍼져 둘레의 적을 베고 탄을 지운다", icon: 708 },
  { id: "m_float", name: "강신", han: "降神", kind: "일섬", only: "munyeo", desc: "일섬이 끝나면 0.7초 동안 떠 있는다 — 그 사이 다시 겨눌 수 있다", icon: 710 },
  { id: "m_soul", name: "넋 분신", han: "分魂", kind: "일섬", only: "munyeo", desc: "일섬 0.35초 뒤, 넋이 같은 길을 한 번 더 지나며 벤다", icon: 712 },
  // 포수 조준 — releasing the aim fires the matchlock and the recoil throws him the other way (reloading: a bayonet lunge instead)
  { id: "p_slug", name: "대구경", han: "大口徑", kind: "일섬", only: "posu", desc: "일발이 굵어져 넓은 줄을 꿰뚫고, 반동이 1.4배 세진다", icon: 753 },
  { id: "p_scatter", name: "산탄", han: "散彈", kind: "일섬", only: "posu", desc: "일발이 다섯 갈래로 퍼진다 (멀리 가지 못한다)", icon: 754 },
  { id: "p_burst", name: "작렬탄", han: "炸裂彈", kind: "일섬", only: "posu", desc: "일발이 처음 닿은 곳에서 터져 둘레까지 벤다", icon: 758 },
  { id: "p_ricochet", name: "도탄", han: "跳彈", kind: "일섬", only: "posu", desc: "일발이 벽에 한 번 튕겨 꺾여 나간다", icon: 824 },
  { id: "p_quick", name: "속사", han: "速射", kind: "일섬", only: "posu", desc: "장전이 한 박자로 줄고, 일발로 적을 쓰러뜨리면 곧바로 장전된다", icon: 794 },
  { id: "p_charge", name: "착검 돌격", han: "着劍突擊", kind: "일섬", only: "posu", desc: "쏜 뒤 반동으로 물러나는 대신, 총검을 앞세워 쏜 쪽으로 돌진하며 벤다", icon: 767 },
  // 방어 — pick one
  { id: "d_tan", name: "탄베기", han: "斬彈", kind: "방어", desc: "일섬이 지나가는 길의 적 탄을 모두 베어 없앤다", icon: 102 },
  { id: "d_freeze", name: "정지", han: "停止", kind: "방어", desc: "무아경에 든 동안 날아오던 적 탄이 그 자리에 멈춘다", icon: 302 },
  { id: "d_myeong", name: "명경지수", han: "明鏡止水", kind: "방어", desc: "무아경에 드는 순간, 가까운 적들이 잠깐 굳는다 (우두머리는 아주 잠깐)", icon: 842 },
  { id: "d_ward", name: "검막", han: "劍幕", kind: "방어", desc: "일섬이 끝난 뒤 1초 동안, 몸 둘레로 날아드는 탄을 베어 낸다", icon: 848 },
  { id: "d_breath", name: "혈로", han: "血路", kind: "방어", desc: "일섬으로 적 넷을 벨 때마다 숨 하나를 되찾는다", icon: 104 },
  { id: "d_calm", name: "평정", han: "平靜", kind: "방어", desc: "숨이 하나만 남으면 무아경이 세 배 오래 이어지고, 무아경에 든 동안 적 탄이 멈춘다", icon: 303 },
  // 이동 — pick two
  { id: "d_air", name: "비연", han: "飛燕", kind: "이동", desc: "공중 대시가 하나 더 생긴다 — 공중에서 일섬을 두 번 쓸 수 있다", icon: 207 },
  { id: "d_jump", name: "허공답보", han: "虛空踏步", kind: "이동", desc: "공중에서 한 번 더 뛴다", icon: 101 },
  { id: "d_wall", name: "벽호공", han: "壁虎功", kind: "이동", desc: "벽을 두 배 오래 타고, 벽에 붙어서도 무아경에 들 수 있다", icon: 206 },
  { id: "d_bisang", name: "비상", han: "飛上", kind: "이동", desc: "벽을 차고 뛰면 공중 대시가 다시 차고, 하나 더 쌓인다", icon: 844 },
  { id: "d_kite", name: "연 입경", han: "鳶入境", kind: "이동", desc: "연으로 솟구치면 곧바로 무아경에 든다 (대시를 누르면 날아간다)", icon: 300 },
  { id: "d_glide", name: "활공", han: "滑空", kind: "이동", desc: "떨어질 때 점프를 누르고 있으면 천천히 미끄러진다", icon: 205 },
  { id: "p_rocket", name: "포 반동", han: "砲反動", kind: "이동", only: "posu", desc: "반동이 1.4배 세다 — 땅에서 아래로 쏘면 높이 솟구친다", icon: 771 },
  { id: "m_cloud", name: "구름 걸음", han: "雲步", kind: "이동", only: "munyeo", desc: "공중 도약을 할 때마다 무아경이 0.3초 더 이어진다 (다음 무아경 한 번)", icon: 721 },
  { id: "d_sasl", name: "연사슬", han: "鳶鎖", kind: "이동", desc: "연을 적에게도 걸어 끌어당기고 잠깐 굳힌다", icon: 845 }
];
for (const id of ["d_far", "d_sunbo", "d_sun", "d_jeong", "d_beat", "d_hover", "d_charge", "d_bounce", "d_return", "d_chain", "d_reflect"]) CHOSIK.find(c => c.id === id).only = "mumyeong";   // the swordsman's aimed dash
const SLOT = { 일섬: 1, 방어: 1, 이동: 2 }, SLOT_ORDER = ["일섬", "방어", "이동"];
const kindOf = id => (CHOSIK.find(c => c.id === id) || {}).kind;
const fitPerks = list => { const n = {}; return list.filter(id => { const k = kindOf(id); if (!SLOT[k]) return false; n[k] = (n[k] || 0) + 1; return n[k] <= SLOT[k]; }); };   // keeps what fits the slots, first come first kept

// 징조: one rule chosen for each new turn of the tower, harder ones pay back
const OMENS = [
  { id: "angae", name: "안개", han: "霧", desc: "앞이 잘 보이지 않는다", gift: "비급 하나 더", bonus: true },
  { id: "geupbak", name: "급박", han: "急拍", desc: "장단이 한층 빨라진다", gift: "숨 하나" },
  { id: "yeokpung", name: "역풍", han: "逆風", desc: "앞에서 바람이 밀어낸다", gift: "비급 하나 더", bonus: true },
  { id: "hyeolmaeng", name: "피의 맹세", han: "血盟", desc: "적은 일격으로만 쓰러진다", gift: "다섯을 벨 때마다 숨 하나" },
  { id: "gyeopjul", name: "겹금줄", han: "重繩", desc: "금줄이 훨씬 많아진다", gift: "비급 하나 더", bonus: true },
  { id: "gunse", name: "군세", han: "軍勢", desc: "적이 더 많이 나온다", gift: "비급 하나 더", bonus: true },
  { id: "goyo", name: "고요", han: "靜", desc: "장단판의 북이 보이지 않는다", gift: "비급 하나 더", bonus: true },
  { id: "pyeong", name: "평온", han: "平", desc: "아무 일도 일어나지 않는다", gift: "보상 없음", calm: true }
];
const SEASON = [{ name: "여름", line: "장맛비가 그치지 않는다." }, { name: "가을", line: "단풍이 진다. 천고가 다시 울린다." }, { name: "겨울", line: "눈이 내린다. 장단이 얼어붙듯 빠르다." }, { name: "봄", line: "꽃잎이 날린다. 탑은 다시 처음이다." }];
const has = id => !!(run && run.perks && run.perks.includes(id));
// 무녀·포수: the same 비급 read through their own hands — new names, and for many a different working
const PV = {
  munyeo: {
    ssang: ["쌍선", "雙扇", "부채를 두 손에 쥔다 — 흔드는 범위가 넓어진다"], ilseom: ["긴 소매", "長袖", "소매 바람이 더 멀리 닿는다"], yeongyeok: ["잦은 장단", "促拍", "더 빠르게 이어 흔든다"],
    gangta: ["큰 굿", "大굿", "일격의 범위가 넓어진다"], gwigeom: ["신령의 손", "神手", "일격 때 둘레에서 신령의 손이 솟아 적을 붙들어 굳힌다"],
    geompung: ["부적 바람", "符風", "흔든 자리에 부적이 붙어 머물며, 닿는 적을 베고 잠시 굳힌다"], bigeom: ["호신부진", "護符陣", "일격 때 부적들이 몸 둘레를 돌며 닿는 적을 베고 탄을 태운다"],
    noejeon: ["뇌성 방울", "雷聲鈴", "일격 순간 방울 소리가 번개가 되어 둘레의 적을 모두 치고 굳힌다"], wolgwang: ["달맞이 굿", "迎月굿", "일격이 둥근 달빛 고리로 퍼져 둘레를 모두 베고, 베인 적은 굳는다"],
    hoeseon: ["무무", "巫舞", "공중에서 흔들면 몸을 돌려 둘레를 모두 벤다"], hyeolhwa: ["꽃굿", "꽃굿", "적을 쓰러뜨리면 종이꽃이 피어 둘레를 벤다"], bungwang: ["넋", "魂", "대시 끝에 넋이 남아 한 번 더 벤다"],
    suhoryeong: ["몸주신", "主神", "일격 세 번마다 몸주신이 탄 하나를 막아 준다"], heukryong: ["용신 띠", "龍神", "연을 놓으면 용신의 띠가 몸을 휘감아 닿는 적을 벤다"],
    cheohyeong: ["결박", "結縛", "일격이 적을 부적으로 묶고, 묶인 적은 어떤 흔들기에도 쓰러진다"], geommak: ["부채 막", "扇幕", "흔드는 동안 몸 둘레의 탄이 모두 사라진다 (조금 느려짐)"],
    heup: ["넋 거두기", "收魂", "부채를 접어 길고 좁게 찌르고, 여덟 번 맞힐 때마다 숨 하나"], bangyeok: ["되돌이", "還", "일격 순간 둘레의 탄을 지우고, 쏜 적에게 되돌려 준다"],
    cheol: ["방패 풀이", "解牌", "등패수를 일격 없이도 벤다"], nakhwa: ["내림굿", "降神", "공중에서 내려치며 적을 베면 다시 솟구친다"], bantan: ["되받이", "返彈", "되받아친 탄이 더 빠르고 적을 꿰뚫는다"],
    ssangryong: ["쌍방울", "雙鈴", "보통 흔들기도 두 번 친다"], gwisin: ["신장 부적", "神將符", "일격 때 붙는 부적은 일격처럼 벤다"], mancheon: ["만신", "萬神", "부적이 세 갈래로 흩어져 붙는다"],
    mangeom: ["만부", "萬符", "도는 부적이 세 장이 된다"], hwanyeong: ["넋풀이", "解魂", "넋이 더 넓게, 일격처럼 벤다"], geomu: ["부적비", "符雨", "부적이 두 배 오래 머문다"],
    yuseong: ["나는 부적", "飛符", "도는 부적이 적을 베면 공중 대시가 찬다"], noegeom: ["벼락 부적", "雷符", "도는 부적이 적을 칠 때마다 번개가 튄다"], manwol: ["보름굿", "望月", "달빛 고리가 더 크고, 더 오래 굳힌다"],
    ssangwol: ["겹달", "重月", "달빛 고리가 두 번 퍼진다"], noesin: ["뇌신", "雷神", "방울 번개가 일격처럼 친다"], noejeong: ["뇌정", "雷霆", "방울 번개가 더 멀리 닿는다"], cheonroe: ["천뢰", "天雷", "신령의 손이 두 배 넓게 솟는다"],
    talhon: ["탈혼", "奪魂", "신령의 손이 일격처럼 벤다"], seomil: ["바람 가르기", "風切", "돌진하며 흔들면 범위가 크게 넓어진다"], samyeon: ["삼채", "三綵", "일격 직후 잠깐은 모든 흔들기가 일격이 된다"],
    pilsal: ["부정 씻기", "除厄", "일격 때 둘레의 탄이 모두 흩어진다"], wolryeong: ["달 신령", "月靈", "몸주신이 막으면 둘레를 달빛 고리로 벤다"], hwangol: ["환생", "還生", "되살아날 때 숨 셋으로 일어난다"],
    cheonra: ["부적 그물", "符網", "무아경에 든 동안 날아든 탄은 부적 그물에 걸려 쏜 자에게 돌아간다"], nakhwayusu: ["꽃비 내림", "花降", "빠르게 내려앉으면 꽃잎이 흩날리며 둘레의 적을 벤다"],
    eunggyeok: ["매 쫓기", "逐鷹", "매는 한 번만 흔들어도 떨어진다"], pacheon: ["장군 누르기", "鎭將", "우두머리에게 일격 피해가 하나 더 들어간다"], yeokryu: ["세 갈래 바람", "三風", "되받아친 탄이 세 갈래로 갈라진다"],
    suhosin: ["쌍신", "雙神", "몸주신이 일격 두 번마다 깃든다"], yeongmak: ["신령 장막", "靈幕", "몸주신이 막을 때 둘레의 탄이 모두 사라진다"], cheonyeong: ["넋 둘", "雙魂", "대시를 시작한 자리에도 넋이 남는다"],
    yeongseom: ["넋 번개", "魂閃", "넋이 곧바로 벤다"], seonpung: ["회오리 무무", "旋舞", "공중에서 몸을 돌려 적을 베면 다시 솟구친다"], nakcheon: ["큰 무무", "大舞", "공중 회전 흔들기의 범위가 크게 넓어진다"],
    hyeolu: ["꽃비", "花雨", "종이꽃이 두 배 넓게 핀다"], hyeolhyang: ["꽃향", "花香", "종이꽃이 필 때 잠깐 무적"], ssangryong2: ["쌍용신", "雙龍神", "용신 띠 두 줄이 더 넓게, 더 오래 휘감는다"],
    biryong: ["나는 용신", "飛龍神", "용신 띠가 적을 베면 공중 대시가 찬다"], noego: ["뇌성 북", "雷鼓", "번개 돌진에 베인 적은 잠시 굳는다"], yeomryong2: ["불띠", "火帶", "용신 띠가 휘감는 동안 발자국마다 불길이 남는다"] },
  posu: {
    d_tan: ["탄막 사격", "斬彈", "일발이 지나간 줄의 적 탄을 모두 지운다 (총검 돌진도 길의 탄을 벤다)"], d_ward: ["연막", "煙幕", "일발이나 대시 뒤 1초 동안, 몸 둘레로 날아드는 탄이 연기에 사라진다"],
    ssang: ["쌍발", "雙發", "찌르기가 넓어지고, 일격 때 두 발을 쏜다"], ilseom: ["긴 총검", "長銃劍", "찌르기가 더 멀리 닿는다"], yeongyeok: ["빠른 손", "疾手", "더 빠르게 이어 찌른다"],
    gangta: ["대구경", "大口徑", "일격 탄이 굵어져 더 넓은 줄을 꿰뚫는다"], gwigeom: ["산탄", "散彈", "일격 때 앞으로 산탄이 부채꼴로 퍼져 가까운 적을 벤다"],
    geompung: ["화약 연기", "火藥煙", "찌른 자리에 불붙은 화약 연기가 남아 닿는 적을 태운다"], bigeom: ["탄띠", "彈帶", "일격 때 탄환들이 몸 둘레를 돌며 닿는 적을 벤다"],
    noejeon: ["뇌관", "雷管", "일격 탄에 번개가 실려, 맞은 적에게서 옆의 적에게 튄다"], wolgwang: ["대포", "大砲", "일격이 포탄이 되어 처음 닿은 자리에서 크게 터진다"],
    hoeseon: ["회전 찌르기", "回刺", "공중에서 찌르면 몸을 돌려 둘레를 모두 찌른다"], hyeolhwa: ["유폭", "誘爆", "적을 쓰러뜨리면 화약이 터져 둘레를 벤다"], bungwang: ["잔연", "殘煙", "대시 끝에 연기 분신이 남아 한 번 더 찌른다"],
    suhoryeong: ["철갑", "鐵甲", "일격 세 번마다 철갑이 탄 하나를 막아 준다"], heukryong: ["화약 용", "火藥龍", "연을 놓으면 화약 연기 용이 몸을 휘감아 닿는 적을 벤다"],
    cheohyeong: ["저격", "狙擊", "일격 탄에 맞은 적은 굳고, 굳은 적은 어떤 찌르기에도 쓰러진다"], geommak: ["연막", "煙幕", "찌르는 동안 몸 둘레의 탄이 연기에 사라진다 (조금 느려짐)"],
    heup: ["착검 돌격", "着劍", "더 길고 좁게 찌르고, 여덟 번 맞힐 때마다 숨 하나"], bangyeok: ["응사", "應射", "일격 순간 둘레의 탄을 지우고, 쏜 적에게 되쏜다"],
    cheol: ["철갑탄", "鐵甲彈", "등패수를 일격 없이도 꿰뚫는다"], nakhwa: ["낙하 찌르기", "落刺", "공중에서 내려찌르며 적을 베면 다시 솟구친다"], bantan: ["되쏘기", "返射", "튕겨낸 탄이 더 빠르고 적을 꿰뚫는다"],
    ssangryong: ["이연격", "二連", "보통 찌르기도 두 번 찌른다"], gwisin: ["소이 연기", "燒夷", "일격 때 남는 연기는 일격처럼 태운다"], mancheon: ["연기 장막", "煙帳", "화약 연기가 세 갈래로 퍼진다"],
    mangeom: ["삼중 탄띠", "三彈帶", "도는 탄환이 세 개가 된다"], hwanyeong: ["짙은 연기", "濃煙", "연기 분신이 더 넓게, 일격처럼 찌른다"], geomu: ["오래 타는 연기", "長煙", "화약 연기가 두 배 오래 머문다"],
    yuseong: ["탄환 비행", "飛彈", "도는 탄환이 적을 베면 공중 대시가 찬다"], noegeom: ["번개 탄띠", "雷彈帶", "도는 탄환이 적을 칠 때마다 번개가 튄다"], manwol: ["홍이포", "紅夷砲", "포탄 폭발이 더 크고, 더 오래 굳힌다"],
    ssangwol: ["작렬탄", "炸裂彈", "포탄이 더 넓게 터진다"], noesin: ["뇌신", "雷神", "뇌관 번개가 일격처럼 친다"], noejeong: ["뇌정", "雷霆", "뇌관 번개가 더 멀리 튄다"], cheonroe: ["대산탄", "大散彈", "산탄이 두 배 멀리 퍼진다"],
    talhon: ["철환", "鐵丸", "산탄이 일격처럼 벤다"], seomil: ["돌격 찌르기", "突刺", "돌진하며 찌르면 범위가 크게 넓어진다"], samyeon: ["연속 사격", "連射", "일격 직후 잠깐은 모든 찌르기가 일격이 된다"],
    pilsal: ["일제 사격", "齊射", "일격 때 둘레의 탄이 모두 흩어진다"], wolryeong: ["철갑 포", "鐵甲砲", "철갑이 막으면 둘레에서 화약이 터진다"], hwangol: ["불사조", "不死鳥", "되살아날 때 숨 셋으로 일어난다"],
    cheonra: ["연막 반사", "煙返", "무아경에 든 동안 날아든 탄은 연막을 지나 쏜 자에게 돌아간다"], nakhwayusu: ["낙하 충격", "落衝", "빠르게 떨어져 내려앉으면 충격파가 둘레의 적을 벤다"],
    eunggyeok: ["매 쏘기", "射鷹", "매는 한 번만 찔러도 떨어진다"], pacheon: ["철퇴탄", "鐵槌彈", "우두머리에게 일격 피해가 하나 더 들어간다"], yeokryu: ["도탄", "跳彈", "튕겨낸 탄이 세 갈래로 갈라진다"],
    suhosin: ["이중 철갑", "重甲", "철갑이 일격 두 번마다 덧대진다"], yeongmak: ["연기 장막", "煙幕", "철갑이 막을 때 둘레의 탄이 모두 사라진다"], cheonyeong: ["연기 둘", "雙煙", "대시를 시작한 자리에도 연기 분신이 남는다"],
    yeongseom: ["연기 번개", "煙閃", "연기 분신이 곧바로 찌른다"], seonpung: ["회전 도약", "旋躍", "공중 회전 찌르기로 적을 베면 다시 솟구친다"], nakcheon: ["큰 회전", "大旋", "공중 회전 찌르기의 범위가 크게 넓어진다"],
    hyeolu: ["불똥비", "火雨", "유폭이 두 배 넓게 터진다"], hyeolhyang: ["방폭", "防爆", "유폭이 터질 때 잠깐 무적"], ssangryong2: ["쌍화룡", "雙火龍", "화약 용 두 마리가 더 넓게, 더 오래 휘감는다"],
    biryong: ["나는 화약 용", "飛火龍", "화약 용이 적을 베면 공중 대시가 찬다"], noego: ["뇌고", "雷鼓", "번개 돌진에 베인 적은 잠시 굳는다"], yeomryong2: ["불꽃 용", "炎龍", "화약 용이 휘감는 동안 발자국마다 불길이 남는다"] } };
const ICON_ORDER = {
  munyeo: "ssang ilseom yeongyeok gangta gwigeom geompung bigeom noejeon wolgwang hoeseon hyeolhwa bungwang suhoryeong heukryong cheohyeong geommak heup bangyeok cheol nakhwa bantan ssangryong gwisin mancheon mangeom hwanyeong geomu yuseong noegeom manwol ssangwol noesin noejeong cheonroe talhon seomil samyeon pilsal wolryeong hwangol sinnaerim neokpuri",
  posu: "ssang ilseom yeongyeok gangta gwigeom geompung bigeom noejeon wolgwang hoeseon hyeolhwa bungwang suhoryeong heukryong cheohyeong geommak heup bangyeok cheol nakhwa bantan ssangryong gwisin mancheon mangeom hwanyeong geomu yuseong noegeom manwol ssangwol noesin noejeong cheonroe talhon seomil samyeon pilsal wolryeong hwangol soksa hwayak" };
const PV_ICON = {};
for (const [ch, ids] of Object.entries(ICON_ORDER)) { PV_ICON[ch] = {}; ids.split(" ").forEach((id, i) => { PV_ICON[ch][id] = (ch === "munyeo" ? 700 : 750) + Math.floor(i / 9) * 10 + i % 9; }); }
{ const cmb = "cheonra nakhwayusu eunggyeok pacheon yeokryu suhosin yeongmak cheonyeong yeongseom seonpung nakcheon hyeolu hyeolhyang ssangryong2 biryong noego yeomryong2".split(" ");
  cmb.forEach((id, i) => { PV_ICON.munyeo[id] = 800 + Math.floor(i / 9) * 10 + i % 9; PV_ICON.posu[id] = 820 + Math.floor(i / 9) * 10 + i % 9; }); }
{ const tf = "yeonbal heup cheohyeong hwalgong bisang2 yeonsasl bangyeok dolgyeok geommak".split(" "); for (const c of CHOSIK) { const i = tf.indexOf(c.id); if (i >= 0) c.icon = 840 + i; if (c.id === "sunbo") c.icon = 850; } }   // the swordsman's transforms get their own pictures
{ const ic = { ohaeng: 748, ilgi: 796, gidung: 797 }; for (const c of CHOSIK) if (ic[c.id]) { c.icon = ic[c.id]; c.icon2 = null; } }
const pv = c => { const o = run && PV[run.char] && PV[run.char][c.id], ic = run && PV_ICON[run.char] && PV_ICON[run.char][c.id];
  return o && !c.skill ? { ...c, name: o[0], han: o[1], desc: o[2], icon: ic || c.icon, icon2: ic ? null : c.icon2 } : c; };
const TF_NAME = { dash: "대시", jump: "점프", hook: "연", strike: "일격", slash: "베기" };
// 계열(流派): every 비급 belongs to one school; two, four and six of a school wake its 공명
const SCHOOLS = {
  noe: { name: "뇌", han: "雷", col: "#3a64a8", tiers: ["일격 판정이 넓어진다", "일격으로 벤 적에게서 번개가 튀어 가까운 적을 굳힌다", "일격 세 번마다 다음 대시가 번개 돌진이 된다"] },
  hwa: { name: "화", han: "火", col: "#c8461a", tiers: ["대시가 더 빨리 찬다", "대시가 끝나면 불꽃이 터진다", "대시로 벤 적은 일격을 맞고, 불꽃이 크게 터진다"] },
  pung: { name: "풍", han: "風", col: "#2f8a78", tiers: ["연을 더 멀리서 잡는다", "공중에서 적을 베면 공중 도약과 대시가 되살아난다", "공중에서의 베기는 모두 일격"] },
  hyeol: { name: "혈", han: "血", col: "#9a1424", tiers: ["적 열다섯을 벨 때마다 숨 하나", "벤 적의 피가 가시가 되어 가까운 적에게 날아간다", "적을 벨 때마다 잠깐 무적, 피 가시가 세 갈래"] },
  yeong: { name: "영", han: "影", col: "#544a66", tiers: ["대시가 끝나도 잠깐 무적이 이어진다", "대시 끝에 그림자 분신이 남아 한 번 더 벤다", "관문마다 한 번, 치명상을 그림자로 흘려보낸다"] } };
const TIER_SHORT = { noe: ["일격 판정 확장", "일격이 번개를 튀김", "세 일격마다 번개 대시"], hwa: ["대시 빨리 참", "대시 끝 불꽃", "대시 일격 · 큰 불꽃"],
  pung: ["연 거리 확장", "공중 베기로 도약 회복", "공중 베기 모두 일격"], hyeol: ["열다섯 처치마다 숨", "처치 시 피 가시", "처치 시 무적 · 가시 셋"], yeong: ["대시 뒤 무적", "그림자 분신", "치명상 한 번 흘림"] };
const SCHOOL_OF = {};
for (const [k, ids] of Object.entries({
  noe: "eot gangta noejeon nakroe gwigeom ilseom yeongyeok jeong ssang cheol wolgwang",
  hwa: "jilpung chukji hwaryong seomgwang janyeong",
  pung: "idan biyeon baram pungsin heukryong gyeonggong byeokho yeonsa cheongeun hoeseon geompung",
  hyeol: "hyeol heuphon hyeolhwa yeon nakhwa josik",
  yeong: "hosin jangmak suhoryeong bungwang bulsa bantan gwian danhwa bigeom neokpuri",
  noe2: "sinnaerim soksa", hwa2: "hwayak" })) for (const id of ids.split(" ")) SCHOOL_OF[id] = k.replace("2", "");
for (const c of CHOSIK) if (c.combo && !SCHOOL_OF[c.id]) SCHOOL_OF[c.id] = SCHOOL_OF[c.combo[0]];
const schoolN = k => !run ? 0 : (run.perks || []).filter(id => SCHOOL_OF[id] === k).length + (run.simbeop === k ? 1 : 0) + (has("manryu") ? 1 : 0);
const res = () => false;   // 공명 is gone
// 심법(心法): chosen at the start of a run — a school's first 비급 and a gift of its own
const SIMBEOP = [
  { id: "noe", name: "뇌심법", han: "雷", start: "d_jeong", desc: "일격 판정이 넓어진다" },
  { id: "hwa", name: "화심법", han: "火", start: "d_far", desc: "대시를 잇따라 두 번 쓸 수 있다" },
  { id: "pung", name: "풍심법", han: "風", start: "d_glide", desc: "공중 대시가 하나 더", hon: 120 },
  { id: "hyeol", name: "혈심법", han: "血", start: "d_breath", desc: "숨이 둘 이하일 때 무아경이 두 배 오래 이어진다", hon: 120 },
  { id: "yeong", name: "영심법", han: "影", start: "d_tan", desc: "무아경에 든 동안 적 탄이 절반 속도로 난다", hon: 120 }]
const simb = k => !!(run && run.simbeop === k);
// 무기: chosen when a run starts; each changes how the basic cut works
const WEAPONS = {
  hwando: { name: "환도", han: "環刀", desc: "연격 — 공중에서 보통 베기로 적이나 과녁을 베면 공중 대시가 다시 찬다 (땅에 닿기 전 한 번, 과녁은 언제나)", R: 1, reach: 0, cd: .2, dur: .14 },
  ssang: { name: "쌍검", han: "雙劍", desc: "기세 — 잇따라 벨수록 기세가 쌓이고(최대 다섯), 셋 이상이면 다음 일섬이 넓게 휘몰아치며 대시를 쓰지 않는다. 다섯 번째 베기는 일격", R: .82, reach: -2, cd: .09, dur: .1 },
  woldo: { name: "월도", han: "月刀", desc: "내려베기 — 공중에서 아래로 베어 적·과녁·탄을 치면 튕겨 오르고 공중 대시가 다시 찬다. 방패를 무시하고 밀쳐낸다", R: 1.55, reach: 16, cd: .4, dur: .22 },
  baldo: { name: "발도", han: "拔刀", desc: "거합 — 베기를 누르고 있으면 원이 차오르고(0.3초), 다 찬 뒤 떼면 앞으로 돌진하며 벤다. 더 오래(0.75초) 모아 떼면 붉은 일격이 되고 공중 대시가 다시 찬다", R: .72, reach: 0, cd: .25, dur: .14 },
  // 무녀의 무구 — her own hand, her own reach (kind: which sword's rules it borrows)
  buchae: { ch: "munyeo", name: "부채", han: "扇", desc: "연격 — 펼친 부채로 넓게 쓸어 탄을 두 배로 되받아치고, 공중에서 적이나 과녁을 치면 공중 대시가 찬다 (땅에 닿기 전 한 번)", R: 1.12, reach: -4, cd: .2, dur: .16, fx: "fan" },
  bangul: { ch: "munyeo", kind: "ssang", ring: true, name: "방울", han: "鈴", desc: "기세 — 흔들 때마다 몸 둘레로 방울 소리가 퍼져 베고 기세가 쌓인다, 셋 이상이면 일섬이 넓게 휘몰아친다", R: 1.05, reach: 0, cd: .11, dur: .14, fx: "bell", cost: 150 },
  singal: { ch: "munyeo", kind: "woldo", name: "신칼", han: "神刀", desc: "내려베기 — 오방색 띠를 단 무구 칼, 공중에서 아래로 내려치면 튕겨 오르며 공중 대시가 찬다", R: 1.5, reach: 14, cd: .38, dur: .22, fx: "streamer", cost: 180 },
  // 포수의 병기
  chonggeom: { ch: "posu", name: "총검", han: "銃劍", desc: "연격 — 총 끝의 칼로 길게 찌른다, 공중에서 적이나 과녁을 찌르면 공중 대시가 찬다 (땅에 닿기 전 한 번)", R: 1, reach: 0, cd: .2, dur: .13, fx: "thrust" },
  gakgung: { ch: "posu", kind: "baldo", bow: true, name: "각궁", han: "角弓", desc: "거합 — 누르고 있다가 원이 다 차면 놓아 끝까지 꿰뚫는 화살을 쏜다. 더 오래(0.75초) 모아 놓으면 일격이 되고 공중 대시가 찬다", R: .8, reach: 0, cd: .22, dur: .13, fx: "thrust", cost: 150 },
  chang: { ch: "posu", kind: "woldo", name: "창", han: "槍", desc: "내려베기 — 멀리 닿는 긴 찌르기, 공중에서 아래로 찌르면 튕겨 오르며 공중 대시가 찬다", R: .85, reach: 44, cd: .32, dur: .18, fx: "spear", cost: 180 }
};
const wpn = () => (run && run.weapon && WEAPONS[run.weapon]) ? run.weapon : "hwando";
const wk = () => WEAPONS[wpn()].kind || wpn();   // the rules a weapon plays by
const wrule = () => { const w = WEAPONS[wpn()]; return w.kind || (w.ch ? "hwando" : wpn()); };   // 장단 · 기세 · 내려베기 · 거합
function regainAir() { P.airDash = Math.max(P.airDash, baseAir()); P.dashCd = 0; P.djN = 0; }
function pogo() { // 내려베기: the downward cut springs off whatever it struck
  if (P.pogoed) return; P.pogoed = true; P.vy = -640; regainAir();
  addFx("perkfx", PF.wind, P.x + P.w / 2, P.y + P.h, 64, { life: .3, ay: 1 }); hitstop = Math.max(hitstop, .05); Music.sfx("jump");
}
const BASE_W = { mumyeong: "hwando", munyeo: "buchae", posu: "chonggeom" };
// 서약: a big trade made at the start of a run
const OATHS = [
  { id: "gonggung", name: "공중의 서약", han: "空中誓", desc: "공중에서 무아경이 두 배 오래 이어진다", cost: "땅에서 베이면 숨 둘을 잃는다" },
  { id: "goyo2", name: "고요의 서약", han: "靜寂誓", desc: "일섬이 두 배 멀리 간다", cost: "일격이 아닌 베기는 피해를 주지 못한다" },
  { id: "jangdan", name: "장단의 서약", han: "長短誓", desc: "천고 기운이 두 배 빨리 찬다", cost: "숨은 셋을 넘지 못한다" },
  { id: "pi", name: "피의 서약", han: "血誓", desc: "어떤 베기로 적을 쓰러뜨려도 공중 대시가 다시 찬다", cost: "숨은 둘을 넘지 못한다" },
  { id: "hyeon", name: "현의 서약", han: "玄誓", desc: "더 높이 뛰고, 두 배 빠르게 넓게 벤다", cost: "대시를 쓸 수 없다" },
  { id: "jilpung2", name: "질풍의 서약", han: "疾風誓", desc: "더 빨리 달린다", cost: "베기 범위가 30% 줄어든다" },
  { id: "geommu", name: "칼춤의 서약", han: "劍舞誓", desc: "쉬지 않고 이어 벨수록 베기가 커진다 (최대 두 배)", cost: "한 박자 넘게 쉬면 베기가 반으로 줄어든다" },
  { id: "godok", name: "고독의 서약", han: "孤獨誓", desc: "비급 카드가 한 장 더 나온다", cost: "숨 비급이 나오지 않고, 관문을 넘어도 숨이 차지 않는다" }
]
const oath = id => !!(run && run.oath === id);
const breathCap = () => oath("pi") ? 2 : oath("jangdan") ? 3 : 5;   // never more than five breaths
// 영구 기록: currencies, unlocks, sealed books, story, codex (one save, survives runs)
const META = Object.assign({ hon: 0, shard: 0, bld: { seogo: 0, daejang: 0, bigeup: 0, sadang: 0, uibang: 0 }, tfs: ["sunbo", "hwalgong", "yeonbal", "bangyeok", "heup"], oaths: ["gonggung", "goyo2", "jangdan", "jilpung2", "geommu"],
  weapons: ["hwando"], chars: ["mumyeong"], books: [], strokes: 0, mem: [], ended: false, upBest: 0, towerBest: 0, codex: {}, titles: [], title: null, mastery: {}, quests: null, sash: "red", firsts: {} }, store.get("meta", {}));
for (const o of ["jilpung2", "geommu"]) if (!META.oaths.includes(o)) META.oaths.push(o);   // oaths added after a save was made
if (META.bld.seogo >= 1 && !META.oaths.includes("godok")) META.oaths.push("godok");
if (!META.simbeop) META.simbeop = ["noe", "hwa"];
META.chars = META.chars.filter(c => c !== "shadowc");   // 그림자 무명 is no longer a hand you can play
for (const bk of META.books) { if (bk.char === "shadowc") bk.char = "mumyeong"; bk.perks = fitPerks(bk.perks.filter(id => CHOSIK.some(c => c.id === id))); }
function saveMeta() { store.set("meta", META); }
const baseAir = () => (has("d_air") ? 2 : 1) + (simb("pung") ? 1 : 0);
const cyc = () => (run && mode !== "tutorial" ? (run.tower ? Math.floor((run.floor - 1) / 3) : run.cycle || 0) : 0);   // how many times 천고 has been cut
const omen = id => !!(run && mode !== "tutorial" && (run.omen === id || (run.omens && run.omens.includes(id))));
const upOn = id => !!(run && run.up && run.up.includes(id));
const isFinal = () => !!(run && (run.tower || run.m === LAST_M));   // a stage that ends at 천고 with its guardian
const season = () => { const c = cyc(); return c ? ((c - 1) % 3) + 1 : 0; };   // 여름 비, then 가을 · 겨울 · 봄 in turn
const ghostly = e => (e.type === "r" && e.ph === "gone") || !!e.hidden;
const bossAlive = () => enemies.some(e => e.alive && e.type === "b");
const F3 = { orb: 8 }, FXB = { coin: 0, fire: 1, claw: 2, hair: 3, pillar: 4, beam: 5, fan: 6, water: 7, scrap: 8 };   // bossB extra frame; bossfx sheet
const maxv = () => MAXV * (has("jilpung") ? 1.18 : 1) * (oath("jilpung2") ? 1.25 : 1);
const strikeWin = () => STRIKE_WIN * (upOn("narrow") ? .7 : 1) * (simb("noe") ? 1.25 : 1) * (res("noe", 2) ? 1.2 : 1);
const PINE_N = 5, DEATH_SEAL = 5;   // pines sheet: five misty pines, then the 絶命 seal
const P2 = { plank: 0, ledge: 1, board: 2, rack: 3, haetae: 4, gate: 5, brazier: 6, lanterns: 7, sacks: 8 };
const CAL = { title: 0, death: 1, madang: [2, 3, 4, 5, 6], end: 7, clear: 8 };   // 천고 절명 초입 연비 망루 승천 결전 종국 등천
const PROP = { rope: 0, aim: 1, reticle: 2, pine: 3, stoneLantern: 4, jars: 5, banner: 6, sotdae: 7, palisade: 8 };
const DRESS = [[PROP.pine, 74, 3], [PROP.stoneLantern, 34, 2], [PROP.jars, 26, 1], [PROP.banner, 80, 3], [PROP.sotdae, 84, 3], [PROP.palisade, 28, 1]]; // [frame, world height, headroom tiles]
const OBJ = { lanternOn: 0, lanternOff: 1, kite: 2, thorns: 3, seal: 4, emitter: 5, slash: 6, slashRed: 7, splat: 8 };
const LAZY_SHEETS = new Set(["mv0", "mvrun", "weapons", "mu", "mv1", "mfx", "po", "mv2", "pfx", "arms", "bossA", "bossB", "bossC", "bossD", "bossE", "bossF", "bossfx", "bname"]);
const CHAR_SHEETS = { mumyeong: ["mv0", "mvrun", "weapons"], munyeo: ["mu", "mv1", "mfx", "arms"], posu: ["po", "mv2", "pfx", "arms"] };
const sheetLoading = new Set();
function loadSheet(n) { // one atlas: frames JSON + image (ink-inverted copy for the night palette where needed)
  if (SPR[n] || sheetLoading.has(n)) return; sheetLoading.add(n);
  Promise.all([
    fetch(`assets/sprites/${n}.json`).then(r => r.json()),
    new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `assets/sprites/${n}.webp`; })
  ]).then(([f, img]) => { SPR[n] = { f, img, inv: ["hero", "hero2", "foes", "objects", "fx", "props", "props2", "rocks", "pines", "slabs", "pillars", "guide", "bname", "foes3"].includes(n) ? inkInverted(img) : null };
    if (SPR[n].inv) gpuize(SPR[n].inv, bm => { SPR[n].inv = bm; }); applyUiSprites(); }).catch(() => { sheetLoading.delete(n); });
}
function bossSheets(kind) { const B = BOSSES[kind]; if (!B) return []; const out = ["bossfx", "bcal", "bvfx", "bname", B.sheet];
  for (const v of Object.values(BOSS_POSE[kind] || {})) out.push(v[0]); for (const a of BOSS_ANIM[kind] || []) out.push(a[0]); return out; }
function needSheets(list) { for (const n of list) loadSheet(n); }   // phones: only the hand being played and the guardian being fought are held in memory
for (const n of ["hero", "hero2", "foes", "objects", "ui", "fx", "hud", "hudsolid", "props", "props2", "rocks", "pines", "slabs", "pillars", "rogue", "roguea", "rogue2", "rogue3", "rogue4", "foes2", "bossA", "bossB", "bossfx", "bossC", "bossD", "bossE", "bossF", "hero3", "herofx", "slashfx", "perkfx", "weapons", "chars", "misc", "arms", "ic0", "ic1", "ic2", "ic3", "ic4", "ic5", "ic6", "ic7", "ic8", "ic9", "ic10", "ic11", "ic12", "ic13", "ic14", "ic15", "mu", "po", "mfx", "pfx", "vis", "guide", "mv0", "mv1", "mv2", "bcal", "bvfx", "bname", "mvrun", "mech", "foes3", "kfx"]) if (!LAZY_SHEETS.has(n)) loadSheet(n);
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
  // icons come from the colour-keyed sheet: the flood-keyed one left paper-white patches inside the art
  if (SPR.roguea && !root.getPropertyValue("--chosik-2")) for (let i = 2; i < 9; i++) root.setProperty("--chosik-" + i, url("roguea", i));
  if (SPR.rogue && !root.getPropertyValue("--card")) {
    const s = SPR.rogue, f = s.f[1], cx = Math.round(f.w * .4), c = document.createElement("canvas"); c.width = f.w - cx; c.height = f.h;
    c.getContext("2d").drawImage(s.img, f.x + cx, f.y, f.w - cx, f.h, 0, 0, f.w - cx, f.h); root.setProperty("--card", `url(${c.toDataURL()})`); document.body.classList.add("card-ready");
  }
  if (SPR.rogue2 && !root.getPropertyValue("--chosik-100")) {
    for (let i = 0; i < 9; i++) root.setProperty("--chosik-" + (100 + i), url("rogue2", i));
  }
  if (META.sash && META.sash !== "red" && SASH_SHEETS.some(n => SPR[n] && !SPR[n].orig)) recolorSash();   // every sheet the sash appears on, as each one arrives
  if (SPR.vis && !root.getPropertyValue("--vis-seal")) root.setProperty("--vis-seal", url("vis", VIS.seal));   // the carved stamp frame for the result seal
  if (SPR.misc && !root.getPropertyValue("--ui-hon")) { root.setProperty("--ui-hon", url("misc", 8)); for (let i = 0; i < 9; i++) root.setProperty("--misc-" + i, url("misc", i)); }
  for (const k in BOSSES) { const B = BOSSES[k]; if (B.sheet !== "hero3" && SPR[B.sheet] && !root.getPropertyValue("--boss-" + k)) root.setProperty("--boss-" + k, url(B.sheet, B.idle)); }   // 도감 portraits
  if (SPR.slashfx && !root.getPropertyValue("--chosik-505")) for (let i = 5; i < 9; i++) root.setProperty("--chosik-50" + i, url("slashfx", i));
  if (SPR.perkfx && !root.getPropertyValue("--chosik-600")) for (let i = 0; i < 7; i++) root.setProperty("--chosik-60" + i, url("perkfx", i));
  if (SPR.rogue3 && !root.getPropertyValue("--chosik-200")) for (let i = 0; i < 9; i++) root.setProperty("--chosik-" + (200 + i), url("rogue3", i));
  for (let k = 0; k < 16; k++) if (SPR["ic" + k] && !root.getPropertyValue("--chosik-" + (700 + k * 10))) for (let i = 0; i < 9; i++) root.setProperty("--chosik-" + (700 + k * 10 + i), url("ic" + k, i));   // 무녀·포수 and the new 비급
  if (SPR.rogue4 && !root.getPropertyValue("--chosik-300")) for (let i = 0; i < 9; i++) root.setProperty("--chosik-" + (300 + i), url("rogue4", i));
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
      if (false) { const b = piece((rnd() - .5) * w * .7); b.y -= 18 + rnd() * 40; b.w *= .8 + rnd() * .5; b.h += 40; back.push(b); }
    }
    x += n - 1;
  }
  // upper floors: runs whose block has open air below get a painted slab with a jagged underside (aspect kept)
  const slabs = []; LV.slabTiles = new Set();
  if (SPR.slabs) for (let y = 1; y < LV.h - 1; y++) for (let x = 0; x < LV.w; x++) {
    if (tileAt(x, y) !== 1 || tileAt(x, y - 1) === 1 || (x > 0 && tileAt(x - 1, y) === 1 && tileAt(x - 1, y - 1) !== 1)) continue;
    let n = 0; while (x + n < LV.w && tileAt(x + n, y) === 1 && tileAt(x + n, y - 1) !== 1) n++;
    const mid = x + (n >> 1); let d = 0; while (y + d < LV.h && tileAt(mid, y + d) === 1) d++;
    if (y + d < LV.h && d <= 3) { // floating: air below within a few tiles
      for (let yy = y; yy < y + d; yy++) for (let xx = x; xx < x + n; xx++) LV.slabTiles.add(yy * LV.w + xx);
      const segs = Math.max(1, Math.round(n / 6)), w = n * T / segs;
      for (let k = 0; k < segs; k++) slabs.push({ i: (rnd() * SPR.slabs.f.length) | 0, x: x * T + w * (k + .5), y: y * T - 2, w: w + (segs > 1 ? 6 : 0), minH: d * T + 10, flip: rnd() < .5 });
    }
    x += n - 1;
  }
  const pillars = [];
  if (SPR.pillars) {
    const spans = new Map();
    for (let y = 0; y < LV.h; y++) for (let x = 0; x < LV.w; x++) {
      if (tileAt(x, y) !== 1 || tileAt(x - 1, y) === 1) continue;
      let n = 0; while (tileAt(x + n, y) === 1 && x + n < LV.w) n++;
      if (n <= 3 && x > 0 && tileAt(x - 1, y) !== 1 && tileAt(x + n, y) !== 1) { const k = x + "," + n; (spans.get(k) || spans.set(k, []).get(k)).push(y); }
      x += n - 1;
    }
    for (const [k, ys] of spans) {
      const [x, n] = k.split(",").map(Number);
      for (let a = 0; a < ys.length;) { let b = a; while (b + 1 < ys.length && ys[b + 1] === ys[b] + 1) b++;
        const grounded = ys[b] + 1 >= LV.h || [...Array(n).keys()].some(k => tileAt(x + k, ys[b] + 1) === 1) || tileAt(x - 1, ys[b] + 1) === 1 || tileAt(x + n, ys[b] + 1) === 1;
        if (b - a + 1 >= 3) { for (let y = ys[a]; y <= ys[b]; y++) for (let xx = x; xx < x + n; xx++) LV.slabTiles.add(y * LV.w + xx);
          pillars.push({ i: (rnd() * 3) | 0, x: x * T + n * T / 2, y0: ys[a] * T - 2, y1: ys[b] + 1 >= LV.h ? LV.h * T + 200 : (ys[b] + 1) * T, g: grounded && ys[b] + 1 < LV.h ? (ys[b] + 1) * T : 0, w: n * T + 10, flip: rnd() < .5 }); }
        a = b + 1; }
    }
  }
  const pines = [], P = SPR.pines;
  // pines grow from the ground in world space (no parallax, so they never slide), only where the air above is clear
  if (P) for (let x = 4, last = -99; x < LV.w - 4; x++) {
    if (x - last < 14 || rnd() > .35) continue;
    let y = 1; while (y < LV.h && tileAt(x, y) === 0) y++;
    if (y >= LV.h || tileAt(x, y) !== 1 || y < 8) continue;
    const h = 220 + rnd() * 110, rows = Math.ceil(h / T * .85);
    let clear = true;
    for (let dx = -3; dx <= 3 && clear; dx++) for (let dy = 1; dy <= rows; dy++) if (tileAt(x + dx, y - dy) !== 0) { clear = false; break; }
    if (!clear) continue;
    pines.push({ i: (rnd() * Math.min(PINE_N, P.f.length)) | 0, x: x * T + 16, gy: y * T + 14, h, flip: rnd() < .5, a: .55 }); last = x;
  }
  const front = []; // big pines rooted on cliff edges (behind the actors), like the reference art
  if (P) for (const c of skins) if (c.w >= 3 * T && rnd() < .2 && !pillars.some(q => Math.abs(q.x - c.x) < c.w / 2 + 160)) { const right = rnd() < .5; front.push({ i: (rnd() * Math.min(PINE_N, P.f.length)) | 0, x: c.x + (right ? 1 : -1) * (c.w / 2 - 14), y: c.y - 2, h: 150 + rnd() * 70, flip: right }); }
  LV.scenery = { skins, back, pines, front, slabs, pillars };
}
const baked = new Map();   // brightness/contrast done once per image, never with ctx.filter in the frame loop (slow on Android)
function bake(img, br, ct) {
  if (!img) return img; const key = img; let m = baked.get(key); if (!m) baked.set(key, m = {});
  const id = br + "/" + ct; if (m[id]) return m[id];
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  try { const d = g.getImageData(0, 0, c.width, c.height), a = d.data; for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) a[i + k] = Math.max(0, Math.min(255, ((a[i + k] * br / 255) - .5) * ct * 255 + 127.5)); g.putImageData(d, 0, 0); } catch (_) {}
  m[id] = c; gpuize(c, bm => { m[id] = bm; }); return c;
}
function drawPillar(c, pal) { // stacked rock segments; a grounded pillar fades into the ground over its last 56px
  const f = SPR.pillars.f[c.i], segH = c.w * f.h / f.w, img = bake(pal.night ? SPR.pillars.inv : SPR.pillars.img, .72, 1.15), base = pal.night ? .45 : .88;
  const solidEnd = c.g ? c.g : c.y1, fade = c.g ? 56 : 0;
  const bands = [[c.y0, c.g ? solidEnd : solidEnd + 4, base]];
  for (let k = 1; k <= 7 && fade; k++) bands.push([solidEnd, solidEnd + k * 8, .26]);   // nested translucent layers sum to a smooth fade with no band edges
  for (const [a, b, al] of bands) {
    ctx.save(); ctx.beginPath(); ctx.rect(c.x - c.w, a, c.w * 2, b - a); ctx.clip(); ctx.globalAlpha = al;
    for (let y = c.y0, k = 0; y < b; y += segH - 10, k++) { if (y + segH < a) continue; ctx.save(); ctx.translate(c.x, y); if ((k + (c.flip ? 1 : 0)) % 2) ctx.scale(-1, 1); ctx.drawImage(img, f.x, f.y, f.w, f.h, -c.w / 2, 0, c.w, segH); ctx.restore(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawCliff(c, img, alpha) {
  const f = SPR.rocks.f[c.i], w = f.w * c.h / f.h;   // height fixed, width follows the art

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
  if (e.code === "KeyJ" || e.code === "KeyX") { if (!e.repeat) { Music.unlock(); if (wk() === "baldo" && state === "play") { iaiFrom = e.timeStamp; if (P) { P.iaiHold = true; P.iaiAt = performance.now(); } } else slashReq = { dir: null, ts: e.timeStamp, dash: false }; } e.preventDefault(); return; }
  const a = keyAct(e.code); if (!a) return;
  e.preventDefault(); Music.unlock();
  if (!held[a] && a in press) press[a] = 1;
  held[a] = 1;
});
window.addEventListener("keyup", e => {
  if ((e.code === "KeyJ" || e.code === "KeyX") && iaiFrom != null) { slashReq = { dir: null, ts: e.timeStamp, dash: false, iai: (e.timeStamp - iaiFrom) / 1000 }; iaiFrom = null; if (P) P.iaiHold = false; return; }
  const a = keyAct(e.code); if (a) held[a] = 0; });
let iaiFrom = null;
const IAI_FULL = .32, IAI_MASTER = .75;   // seconds of holding before the 발도 / 각궁 draw is full   // 발도: when the hand went to the hilt
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
  if (wk() === "baldo" && P) { P.iaiHold = true; P.iaiAt = performance.now(); }
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
  if (!s.fired) slashReq = wk() === "baldo" ? { dir: null, ts: e.timeStamp, dash: false, iai: (e.timeStamp - s.t0) / 1000 } : { dir: null, ts: s.t0, dash: false };
  if (P) P.iaiHold = false;
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
// procedural piece: flat ground with a random run of features, each kept within jump reach
// (gaps <= 5 tiles, steps <= 2 up, pillars 3 tall); edges stay flat ground so pieces always join
function genPiece(rng, m, ropes) {
  const W = 16 + ((rng() * 11) | 0), c = [];
  for (let y = 0; y < 16; y++) c.push(Array.from({ length: W }, () => (y >= 12 ? "#" : " ")));
  const put = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < 16) c[y][x] = ch; };
  let x = 3 + ((rng() * 2) | 0);
  while (x < W - 5) {
    let r = rng(); const room = W - 3 - x;
    if (ropes && r > .62 && room >= 4) r = .8;                   // 겹금줄: rock and open ground give way to more ropes
    if (r < .24 && room >= 5) {                                   // gap over thorns, kite above the wide ones
      const gw = Math.min(room - 2, 2 + ((rng() * (m >= 2 ? 4 : 3)) | 0));
      for (let k = 0; k < gw; k++) { for (let y = 12; y < 16; y++) put(x + k, y, " "); put(x + k, 15, "^"); }
      if (gw >= 4 && rng() < .55) put(x + (gw >> 1), 5 + ((rng() * 2) | 0), "o");
      x += gw + 2;
    } else if (r < .44 && room >= 4) {                            // raised step with a guard on it
      const sw = Math.min(room - 1, 3 + ((rng() * 4) | 0)), sh = 1 + ((rng() * 2) | 0);
      for (let k = 0; k < sw; k++) for (let y = 12 - sh; y < 12; y++) put(x + k, y, "#");
      if (rng() < .55) put(x + (sw >> 1), 11 - sh, "?");
      x += sw + 1 + ((rng() * 2) | 0);
    } else if (r < .62 && room >= 4) {                            // floating ledge (stand on it, jump up through it)
      const lw = Math.min(room, 3 + ((rng() * 3) | 0)), ly = 8 + ((rng() * 2) | 0);
      for (let k = 0; k < lw; k++) put(x + k, ly, "=");
      if (rng() < .45) put(x + (lw >> 1), ly - 1, "?"); else if (rng() < .5) put(x + (lw >> 1), ly - 3, "*");
      x += lw + 1;
    } else if (r < .74 && room >= 3) {                            // short rock pillar
      for (let y = 9; y < 12; y++) { put(x, y, "#"); put(x + 1, y, "#"); }
      if (rng() < .4) put(x, 8, "?");
      x += 3 + ((rng() * 2) | 0);
    } else if (r < .84 && (m >= 1 || ropes) && room >= 4) {                  // 금줄 hung from a short roof
      for (let k = -1; k <= 1; k++) put(x + 1 + k, 3, "#");
      put(x + 1, 4, rng() < .5 ? "L" : "M");
      x += 4;
    } else if (r < .92 && m >= 1 && room >= 11) {                // 과녁 다리: a pit only an aimed dash crosses — cut the targets to keep the air dash
      const gw = Math.min(room - 2, 8 + ((rng() * 3) | 0));
      for (let k = 0; k < gw; k++) { for (let y = 12; y < 16; y++) put(x + k, y, " "); put(x + k, 15, "^"); }
      const n = gw >= 10 ? 2 : 1; for (let i = 1; i <= n; i++) put(x + Math.round(gw * i / (n + 1)) - 1, 7 + ((rng() * 2) | 0), "T");
      if (rng() < .5) put(x + gw - 2, 5, "*");
      x += gw + 2;
    } else {                                                      // open ground, maybe a guard or a hawk
      if (rng() < .5) put(x + 1, 11, "?"); else if (rng() < .4) put(x + 1, 6, "*");
      x += 3 + ((rng() * 3) | 0);
    }
  }
  return c;
}
// boss arena before the last drum: a long floor with two ledges to dodge the 수문장's ground waves
const ARENA_PIECE = (() => { const r = []; for (let y = 0; y < 16; y++) r.push(y >= 12 ? "#".repeat(26) : y === 11 ? " C" + " ".repeat(16) + "b" + " ".repeat(7) : y === 9 ? "     ====      ====       " : y === 5 ? "       T          T       " : " ".repeat(26)); return r; })();   // two 과녁 above: a loop of aimed dashes down onto the guardian
function buildMadangMap(seed, m, cy = 0, omIn = null, arena = m === 4, crowd = 0) {
  const omList = Array.isArray(omIn) ? omIn : [omIn], om = omList.includes("gyeopjul") ? "gyeopjul" : omList.includes("gunse") || crowd ? "gunse" : omIn;
  const rng = mulberry(seed ^ Math.imul(m + 1, 0x9E3779B1) ^ Math.imul(cy, 0x85EBCA6B));   // each turn of the tower lays out fresh
  const rows = START_PIECE.slice();
  const used = new Set();
  const tiers = MADANG[m].tiers.slice();
  for (let i = tiers.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [tiers[i], tiers[j]] = [tiers[j], tiers[i]]; }   // fresh order every run
  for (const tier of tiers) {
    const kind = typeof tier === "string" ? tier[0] : "", t = kind ? +tier.slice(1) : tier;
    const fits = i => kind === "w" ? CHUNKS[i].wall && CHUNKS[i].tier <= t : kind === "m" ? CHUNKS[i].multi && CHUNKS[i].tier <= t : CHUNKS[i].tier === t && !CHUNKS[i].multi;
    let pool = CHUNKS.map((c, i) => i).filter(i => fits(i) && !used.has(i));
    if (!pool.length) pool = CHUNKS.map((c, i) => i).filter(fits);
    const ci = pool[(rng() * pool.length) | 0];
    let c;
    if (rng() < (om === "gyeopjul" ? .7 : .4)) c = genPiece(rng, m, om === "gyeopjul");                          // about 40% of pieces are generated fresh
    else { used.add(ci); c = CHUNKS[ci].map.map(r => r.split("")); if (rng() < .5) c.forEach(row => row.reverse()); }   // handmade, sometimes mirrored
    if (c[11][1] === " ") c[11][1] = "C";
    for (let y = 0; y < 16; y++) for (let x = 0; x < c[y].length; x++) {
      const ch = c[y][x];
      if (ch === "?") {
        const r = rng();
        c[y][x] = m === 0 ? (r < .55 ? "p" : "g") : m === 1 ? (r < .35 ? "p" : r < .62 ? "g" : r < .82 ? "s" : "a") : (r < .2 ? "p" : r < .36 ? "g" : r < .52 ? "h" : r < .66 ? "s" : r < .84 ? "a" : "k");   // 순라 in front, then 포수·저격수, 등패수, 자객, 북잡이
        if (cy >= 1) { const r2 = rng(); if (r2 < .14) c[y][x] = "m"; else if (cy >= 2 && r2 < .28) c[y][x] = "r"; }   // 무당 from the second turn, 저승사자 from the third
      } else if (ch === "*") c[y][x] = rng() < .5 + .12 * m ? "d" : " ";
      else if ((ch === "L" || ch === "M") && rng() < .5) c[y][x] = ch === "L" ? "M" : "L";
    }
    // extra guard on open ground in about half the pieces
    for (let extra = (om === "gunse" ? 2 : 1) + crowd; extra > 0; extra--) if (rng() < .45 + .08 * m + (om === "gunse" ? .35 : 0)) for (let tries = 0; tries < 8; tries++) {
      const x = 3 + ((rng() * (c[0].length - 6)) | 0);
      let y = 2; while (y < 15 && c[y][x] === " ") y++;
      if (y < 15 && c[y][x] === "#" && c[y - 1][x] === " " && c[y - 2][x] === " " && !c[y - 1].some(ch => "gshdmrpak".includes(ch))) { c[y - 1][x] = m >= 2 && rng() < .35 ? "h" : rng() < .5 ? "p" : "g"; break; }
    }
    for (let y = 0; y < 16; y++) rows[y] += c[y].join("");
  }
  if (arena) for (let y = 0; y < 16; y++) rows[y] += ARENA_PIECE[y];   // only 天鼓臺 (tier 4) has a guardian, 천고 right behind it
  for (let y = 0; y < 16; y++) rows[y] += END_PIECE[y];
  // scatter extra kites through open sky so the 연 line can carry you across most of the 마당
  const W = rows[0].length, grid = rows.map(r => r.split(""));
  for (let x = 0; x < W; x++) {   // wide pits: a 과녁 over the middle so a missed dash is not the only way over
    if (grid[12][x] === "#" || grid[12][x] === "=") continue; let e = x; while (e < W && grid[12][e] !== "#" && grid[12][e] !== "=") e++;
    const gw = e - x, cover = grid.slice(3, 11).some(r => r.slice(x - 1, e + 1).some(ch => ch === "o" || ch === "T"));
    if (gw >= 6 && !cover) { const mx = x + (gw >> 1); if (grid[7][mx] === " " && grid[8][mx] === " ") grid[7][mx] = "T"; }
    x = e; }
  for (let x = 10, last = -99; x < W - 10; x++) {
    if (x - last < 18 || rng() > .12) continue;
    const y = 4 + ((rng() * 3) | 0);
    let ok = true;
    for (let dy = -2; dy <= 3 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (grid[y + dy] && grid[y + dy][x + dx] !== " ") { ok = false; break; }
    if (!ok || grid.some((r, yy) => r.slice(Math.max(0, x - 6), x + 7).includes("o") && Math.abs(yy - y) < 6)) continue;
    grid[y][x] = "o"; last = x;
  }
  return grid.map(r => r.join(""));
}

let LV = null;
function loadMap(map, pal, hints) {
  const h = map.length, w = Math.max(...map.map(r => r.length));
  const grid = new Uint8Array(w * h);
  const lv = { w, h, grid, pal, hints: hints || [], defs: [], points: [], targets: [], cps: [], lasers: [], start: null, exit: null, stains: [] };
  let id = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = map[y][x] || " ";
    if (ch === "#") grid[y * w + x] = 1;
    else if (ch === "^") grid[y * w + x] = 2;
    else if (ch === "=") grid[y * w + x] = 3;   // ledge: stand on it, jump up through it
    else if (ch === "P") lv.start = { x: x * T + 7, y: (y + 1) * T - 30 };
    else if (ch === "E") lv.exit = { x: x * T + 1, y: (y - 1) * T + 6, w: T - 2, h: 2 * T - 6 };
    else if ("gsdhmrbpak".includes(ch)) lv.defs.push({ type: ch, tx: x, ty: y, id: id++ });
    else if (ch === "o") lv.points.push({ x: x * T + 16, y: y * T + 16, sway: Math.random() * 6 });
    else if (ch === "T") lv.targets.push({ x: x * T + 16, y: y * T + 16, t: 0, sway: Math.random() * 6 });   // 과녁: cut it with a dash and the air dash comes back
    else if (ch === "C") lv.cps.push({ x: x * T + 16, y: (y + 1) * T, on: false });
    else if (ch === "L" || ch === "M") lv.lasers.push({ tx: x, ty: y, phase: ch === "L" ? 0 : 2 });
  }
  for (const l of lv.lasers) { let yy = l.ty + 1; while (yy < h && grid[yy * w + l.tx] !== 1) yy++; l.x = l.tx * T + 16; l.y0 = l.ty * T + 22; l.y1 = yy * T; }
  lv.ridges = makeRidges(w * T, hashStr(map[11]));
  lv.drums = [];
  for (const frac of []) { // (retired) mid-마당 drums
    const spot = () => {
      for (let dx = 0; dx < 40; dx++) for (const x of [Math.floor(w * frac) + dx, Math.floor(w * frac) - dx]) {
        if (x < 3 || x >= w - 3 || lv.defs.some(d => Math.abs(d.tx - x) < 2)) continue;
        for (let y = 3; y < h; y++) if (grid[y * w + x] === 1 && grid[(y - 1) * w + x] === 0 && grid[(y - 2) * w + x] === 0) return { x, y };
      }
      return null;
    };
    const p = spot(); if (p) lv.drums.push({ id: lv.drums.length, x: p.x * T + 16, y: p.y * T, w: 34, h: 40 });
  }

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
      if (false) { lv.dress.push({ sheet: "props2", i: P2.lanterns, x: (x + n / 2) * T, y: (y + 1) * T - 2, h: 40, w: Math.min(n, 6) * T, flip: false, ay: 0 }); }
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
let mode = null;         // "run" | "tower" | "tutorial"
let run = null;
let P = null, enemies = [], bullets = [], parts = [], ghosts = [], seals = [];
let deadIds = new Set(), cpSave = null, vfx = [], beams = [], clones = [], inBloom = false;
let lastHitDir = null, deathT = 0, hitstop = 0, shake = 0, songPos = 0, flash = 0;
let cam = { x: 0, y: 0 }, hookCand = null, toastT = 0;

function newPlayer(x, y) {
  return { x, y, w: 18, h: 30, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0, wall: 0, wallLock: 0,
    airDash: 1, dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 }, slashT: 0, slashCd: 0, slashDir: { x: 1, y: 0 }, strike: false, clanged: null, dashHit: new Set(), hitSet: new Set(),
    hook: null, hookCd: 0, ki: 1, chain: 0, climbT: 0.5, climbing: false, focus: false, focusT: 0, run: 0, scarf: [] };
}
function spawnEnemies() {
  needSheets(CHAR_SHEETS[(run && run.char) || "mumyeong"] || []);
  const hp = 1 + cyc() + (upOn("hp") ? 1 : 0);
  enemies = LV.defs.filter(d => !deadIds.has(d.id)).map(d => {
    if (d.type === "d") return { hp, maxHp: hp, id: d.id, type: "d", x: d.tx * T + 2, y: d.ty * T + 6, w: 28, h: 20, vx: 0, vy: 0, hx: d.tx * T + 2, hy: d.ty * T + 6, t: Math.random() * 6, alive: true };
    if (d.type === "h") return { hp, maxHp: hp, id: d.id, type: "h", x: d.tx * T + 4, y: (d.ty + 1) * T - 42, w: 24, h: 42, face: -1, vx: 0, alive: true };
    if (d.type === "m") return { hp, maxHp: hp, id: d.id, type: "m", x: d.tx * T + 5, y: (d.ty + 1) * T - 44, w: 22, h: 44, face: -1, castAt: songPos + 1 + Math.random(), castT: 0, alive: true };
    if (d.type === "r") return { hp, maxHp: hp, id: d.id, type: "r", x: d.tx * T + 5, y: (d.ty + 1) * T - 46, w: 22, h: 46, face: -1, ph: "idle", nextAt: songPos + 1.5 + Math.random(), fade: 1, alive: true };
    if (d.type === "p") return { hp, maxHp: hp, id: d.id, type: "p", x: d.tx * T + 5, y: (d.ty + 1) * T - 44, w: 22, h: 44, face: -1, vx: 0, swingAt: null, nextSwing: 0, alive: true };   // 순라: a patrol saber
    if (d.type === "a") return { hp, maxHp: hp, id: d.id, type: "a", x: d.tx * T + 5, y: (d.ty + 1) * T - 40, w: 22, h: 40, face: -1, vx: 0, dashAt: null, lungeT: 0, nextLunge: 1, counter: false, alive: true };   // 자객: reads your 무아경
    if (d.type === "k") return { hp: hp + 1, maxHp: hp + 1, id: d.id, type: "k", x: d.tx * T + 1, y: (d.ty + 1) * T - 46, w: 30, h: 46, face: -1, drumAt: null, nextDrum: songPos + 2 + Math.random(), beatT: 0, alive: true };   // 북잡이: his drum sets the others striking together
    if (d.type === "b") {
      const kind = window.__forceBoss || (run && mode !== "tutorial" ? bossKindOf(run) : "sumun"), B = BOSSES[kind]; needSheets(bossSheets(kind)); const bh = Math.round((Math.round(B.hp * 1.6) + 4 * cyc()) * (upOn("bosshp") ? 1.5 : 1)), floor = (d.ty + 1) * T;
      return { hp: bh, maxHp: bh, id: d.id, type: "b", kind, x: d.tx * T + 16 - B.w / 2, y: (B.fly ? floor - 95 - B.h / 2 : floor - B.h), w: B.w, h: B.h, floor, face: -1, vx: 0, vy: 0, act: null, nextAt: 0, n: (run && run.seed || 0) % 4, mask: 0, raged: upOn("rage"), alive: true, book: kind === "shadow" ? shadowBook() : null };
    }
    return { hp, maxHp: hp, id: d.id, type: d.type, x: d.tx * T + 5, y: (d.ty + 1) * T - 42, w: 22, h: 42, face: -1, fireAt: null, aimFrom: 0, readyAt: songPos + 0.6 + Math.random() * 0.8, tx: 0, ty: 0, alive: true };
  });
}

// ---------- run flow ----------
function newRun() {
  const key = todayKey();
  run = { seed: (Math.random() * 2 ** 32) >>> 0, dateKey: key, m: 0, cp: -1, dead: [],
    breath: 3 + (META.bld.sadang >= 1 ? 1 : 0), time: 0, deaths: 0, kills: 0, strikes: 0, slashes: 0, perks: [], weapon: "hwando", oath: null, char: "mumyeong", picking: true };
  mode = "run";
  saveRun(); startPicks();
}
// a row of cards for one decision; items: { name, han, desc, cost?, glyph? }
function pickScreen(title, sub, items, onPick) {
  $("chTitle").textContent = title; $("chMadang").textContent = sub;
  const box = $("cards"); box.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button"); b.className = "card omen" + (it.calm ? " calm" : "");
    b.innerHTML = `<i class="ic"></i><b class="nm"></b><span class="ds"></span><span class="cost"></span>`;
    b.querySelector(".ic").textContent = it.glyph || it.han; if ((it.glyph || it.han).length > 2) b.querySelector(".ic").style.fontSize = "30px"; b.querySelector(".nm").textContent = it.name; b.querySelector(".ds").textContent = it.desc || ""; b.querySelector(".cost").textContent = it.cost ? "대가 · " + it.cost : "";
    b.addEventListener("click", () => { Music.sfx("lantern"); onPick(it); });
    box.appendChild(b);
  }
  state = "choice"; Music.pause(); for (const k in held) held[k] = 0; showScreen("choice");
}
// what a run starts with: character, weapon, oath (and 업 once the tale is told)
function startPicks(step = 0) {
  const next = () => startPicks(step + 1);
  if (step === 0) { const cs = (typeof CHARS !== "undefined" ? CHARS : []).filter(c => META.chars.includes(c.id)); if (cs.length < 2) return next();
    return pickScreen("검객을 골라라", "누구로 오를 것인가", cs, c => { run.char = c.id; run.breath = Math.min(run.breath, breathCap()); saveRun(); next(); }); }
  if (step === 1) { const own = run.char === "munyeo" || run.char === "posu" ? run.char : undefined;   // 무녀 and 포수 have their own arms
    const ws = Object.entries(WEAPONS).filter(([id, w]) => w.ch === own && (META.weapons.includes(id) || id === BASE_W[run.char])).map(([id, w]) => ({ id, ...w }));
    run.weapon = BASE_W[run.char] || "hwando"; if (ws.length < 2) return next();
    return pickScreen("무기를 골라라", "손에 쥘 것", ws, w => { run.weapon = w.id; saveRun(); next(); }); }
  if (step === 2 && !run.simbeop) { const pool = SIMBEOP.filter(m => META.simbeop.includes(m.id)), rs = mulberry(run.seed ^ 0x51B), drawn = [];
    while (drawn.length < 3 && pool.length) drawn.push(pool.splice((rs() * pool.length) | 0, 1)[0]);   // three at random, like the oaths
    const ms = drawn.map(m => ({ ...m, desc: `${m.desc} · 시작 비급 ${CHOSIK.find(c => c.id === startOf(m, run.char)).name}` }));
    return pickScreen("심법을 골라라", "어느 계열로 오를 것인가", ms, m => { run.simbeop = m.id; if (!run.perks.includes(startOf(m, run.char))) run.perks.push(startOf(m, run.char)); saveRun(); startPicks(2.5); }); }
  if (step === 2.5) step = 2;
  if (step === 2) { const rnd = mulberry(run.seed ^ 0x0A7), pool = OATHS.filter(o => META.oaths.includes(o.id)), picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
    picks.push({ id: null, name: "서약 없음", han: "無", desc: "아무것도 걸지 않는다", calm: true });
    return pickScreen("서약을 하라", "무엇을 걸고 오를 것인가", picks, o => { run.oath = o.id; if (o.id === "pi") run.breath = Math.min(run.breath, 2); saveRun(); next(); }); }
  if (step === 3 && META.ended && typeof upPicks === "function") return upPicks(next);
  run.picking = false; saveRun(); Music.stop(); showInterlude();
}
function continueRun() {
  const s = store.get("run", null); if (!s) return;
  run = s; mode = s.tower ? "tower" : "run"; delete s.daily; if (run.char === "shadowc") run.char = "mumyeong"; run.perks = fitPerks((run.perks || []).filter(id => CHOSIK.some(c => c.id === id)));   // older saves may hold more than the slots allow
  if (s.m > LAST_M) s.m = LAST_M;   // a run saved under the old five-마당 tower
  if (s.picking) { startPicks(); return; }
  if (s.choosing === "omen") showOmen(); else if (s.choosing) showChoice(s.choosing); else showInterlude();
}
function saveRun() { if (run && mode !== "tutorial") store.set("run", run); }
function showInterlude() {
  state = "interlude";
  const md = MADANG[MD(run.m)], jd = Music.JANGDAN[md.jd];
  const sg = stageOf(run.m); $("iOrd").textContent = sg.ko; $("iOrd").dataset.han = sg.han;   // the reading large in the brush face, the hanja small beneath
  const om = OMENS.find(o => o.id === run.omen);
  const bk = isFinal() && BOSSES[bossKindOf(run)];
  $("iLine").textContent = run.m === 0 && run.cycle ? SEASON[season()].line : bk ? `${bk.line} ${josa(bk.name, "을", "를")} 베면 그 뒤에 천고가 있다.` : md.line;
  $("iMeta").textContent = ((run.cycle || 0) ? `${run.cycle + 1}번째 판 · ${SEASON[season()].name} · ` : "") + `${sg.ko} (${ORD[run.m]} 관문) · ` + jd.name + " · " + "●".repeat(run.breath) + "○".repeat(Math.max(0, 3 - run.breath)) + (om && !om.calm ? " · 징조 " + om.name : "");
  $("interlude").classList.remove("night");
  if (run.tower) { // 천고탑: every floor is a guardian's stage, crowded, with all the omens gathered so far
    const tier = [0, 2, 4][(run.floor - 1) % 3];
    $("iMeta").textContent = `천고탑 ${run.floor}층 · ${SEASON[season()].name} · ` + Music.JANGDAN[MADANG[tier].jd].name + " · " + "●".repeat(run.breath) + (run.omens.length ? " · 징조 " + run.omens.map(id => OMENS.find(o => o.id === id).name).join("·") : "");
    loadMap(buildMadangMap(run.seed + run.floor * 7919, tier, run.cycle || 0, run.omens, true, Math.min(4, 1 + (run.floor >> 2))), PAL[tier]); LV.ledgeStone = tier >= 3;
  } else
  loadMap(buildMadangMap(run.seed, MD(run.m), run.cycle || 0, run.omen), PAL[MD(run.m)]); LV.ledgeStone = MD(run.m) >= 3;
  if (isFinal() && LV.exit) { // the last 마당 ends at 천고 itself instead of a seal
    LV.drums = [{ id: 0, big: true, x: LV.exit.x + LV.exit.w / 2, y: LV.exit.y + LV.exit.h, w: 60, h: 80 }]; LV.exit = null; LV.gate = null;
  }
  showScreen("interlude");
  Music.unlock(); Music.stop(); Music.jing();
  setTimeout(() => $("bEnter").focus({ preventScroll: true }), 30);
}
function enterMadang() {
  Music.menuBgm(false);
  // map already loaded by showInterlude
  deadIds = new Set(run.dead || []); cpSave = null;
  if (run.cp >= 0 && LV.cps[run.cp]) {
    const c = LV.cps[run.cp]; c.on = true;
    cpSave = { x: c.x - 9, y: c.y - 30.01, dead: new Set(deadIds), idx: run.cp };
  }
  const s = cpSave || LV.start;
  P = newPlayer(s.x, s.y); run.hosinUsed = 0; run.shadeUsed = false; run.cutDrums = run.cutDrums || []; 
  bullets = []; parts = []; ghosts = []; seals = []; vfx = []; haz = []; beams = []; bolts = []; kegs = []; rings = []; cutLines = []; killCam = 0; clones = []; bossIntro = bossOut = bossBanner = null; sealArena(null, false);
  Music.start(MADANG[run.tower ? [0, 2, 4][(run.floor - 1) % 3] : MD(run.m)].jd, run.seed + run.m, (1 + .08 * (run.cycle || 0)) * (omen("geupbak") ? 1.15 : 1) * (upOn("fast") ? 1.15 : 1));
  songPos = Music.pos(); spawnEnemies();
  cam.x = P.x; cam.y = P.y;
  setHud(); showScreen(null); state = "play";
  Music.bak();
  try { navigator.wakeLock && navigator.wakeLock.request("screen").catch(() => {}); } catch (e) {}
}
function startTutorial() {
  Music.menuBgm(false);
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
  bullets = []; ghosts = []; haz = []; beams = []; bolts = []; kegs = []; rings = []; cutLines = []; killCam = 0; clones = []; bossIntro = bossOut = bossBanner = null; sealArena(null, false);
  const s = cpSave || { x: LV.start.x, y: LV.start.y, dead: new Set() };
  deadIds = new Set(s.dead);
  P = newPlayer(s.x, s.y); clones = [];
  spawnEnemies(); state = "play"; setHud();
}
function die(kind, dmg = 1) {
  if (state !== "play" || (P.invT || 0) > 0) return;
  if (has("hosin") && (run.hosinUsed || 0) < (has("bulmyeol") ? 2 : 1) && P.y < LV.h * T) { // talisman burns instead of the swordsman
    run.hosinUsed = (run.hosinUsed || 0) + 1; P.invT = has("geumgang") ? 2 : 1.2;
    if (has("geumgang")) for (const b of bullets) if (!b.friendly && Math.hypot(b.x - P.x, b.y - P.y) < 320) b.life = 0; flash = .3; shake = 8; Music.sfx("clang"); toast("호신부가 타올랐다");
    addFx("fx", FX.burst, P.x + P.w / 2, P.y + P.h / 2, 70, { life: .5 }); return;
  }
  if (res("yeong", 6) && !run.shadeUsed && P.y < LV.h * T) { // 영 공명: the blow passes through a shadow left behind
    run.shadeUsed = true; P.invT = 1.3; clones.push({ x: P.x + P.w / 2, y: P.y + P.h, face: P.face, t: .25 }); shadeFx(P.x + P.w / 2, P.y + P.h / 2, 26); flash = .2; shake = 6; Music.sfx("clang"); toast("영 공명 · 그림자가 대신 베였다"); return; }
  if (kind !== "fall") { const loss = dmg + (oath("gonggung") && P.onGround ? 1 : 0);
    if (mode === "tutorial" || run.breath - loss > 0) { if (mode !== "tutorial") { run.breath -= loss; saveRun(); setHud(); }
      const d = lastHitDir || { x: -P.face, y: -.3 }; lastHitDir = null; P.invT = .8; P.vx = (Math.sign(d.x) || -P.face) * 340; P.vy = -300; P.onGround = false; P.dashT = 0; P.hook = null;
      P.focus = false; Music.muffle(false); P.chain = 0; bleed(P.x + P.w / 2, P.y + P.h / 2, d, false); shake = 9; flash = .3; hitstop = Math.max(hitstop, .08); Music.sfx("die"); buzz(40); return; } }
  state = "dead"; deathT = 0; run.deaths++;
  if (mode !== "tutorial") { run.breath -= oath("gonggung") && P.onGround ? 2 : 1; if (run.breath <= 0 && has("bulsa") && !run.bulsaUsed) { run.bulsaUsed = true; run.breath = has("hwangol") ? 3 : 1; toast("불사 · 숨이 다시 이어졌다"); } saveRun(); }
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
  if (run.m >= LAST_M) { endRun(true); return; }
  run.m++; run.cp = -1; run.dead = []; run.cutDrums = []; if (!upOn("noheal") && !oath("godok")) run.breath = Math.min(breathCap(), has("saenggi") ? breathCap() : Math.max(run.breath, 3) + (has("josik") ? 1 : 0));   // breath refills each 마당
  run.choosing = "madang"; saveRun();   // every cleared 마당 grants a 초식
  state = "result";
  setTimeout(() => showChoice("madang"), 700);
}
function showChoice(kind) {   // kind: "madang" after a cleared 마당, "cycle" after cutting 천고, "bonus" as an omen's gift
  const done = () => {
    run.choosing = null;
    if (kind === "cycle") { // a new turn of the tower: next, its omen
      run.cycle = (run.cycle || 0) + 1; run.m = 0; run.breath = Math.max(run.breath, 3); run.cp = -1; run.dead = []; run.cutDrums = []; run.omen = null;
      run.choosing = "omen"; saveRun(); showOmen(); return;
    }
    if (kind === "tower") { saveRun(); towerRest(); return; }
    saveRun(); Music.stop(); showInterlude();
  };
  const owned = id => (run.perks || []).includes(id);
  const rnd = mulberry((run.seed ^ (run.m * 7919) ^ ((run.cycle || 0) * 104729) ^ ((run.perks || []).length * 31337)) >>> 0), pool = CHOSIK.filter(c => !c.combo && (!c.only || c.only === run.char) && (c.repeat ? run.breath < breathCap() && !oath("godok") : !owned(c.id)) && !c.tf);
  const combos = CHOSIK.filter(c => c.combo && !owned(c.id) && c.combo.every(owned));
  const picks = []; if (combos.length) picks.push(combos[(rnd() * combos.length) | 0]);   // a ready combination always shows up first
  const nCards = (META.bld.sadang >= 3 ? 4 : 3) + (oath("godok") ? 1 : 0);
  for (let r = 0; r < (run.reroll || 0); r++) rnd();   // a reroll shifts the draw
  const wt = () => 1;
  while (picks.length < nCards && pool.length) { let r = rnd() * pool.reduce((t, c) => t + wt(c), 0), i = 0; while (i < pool.length - 1 && (r -= wt(pool[i])) > 0) i++; picks.push(pool.splice(i, 1)[0]); }
  if (!picks.length) { toast("익힐 비급이 더 없다"); done(); return; }   // every 비급 learned and breath full
  $("chTitle").textContent = "비급을 골라라";
  { const held = heldPerks(), line = document.createElement("div"); line.className = "ch-held";   // what is already held, so each card can be weighed against it
    line.innerHTML = SLOT_ORDER.map(k => { const ids = held.filter(id => kindOf(id) === k);
      return `<b>${k} ${ids.length}/${SLOT[k]}</b>` + (ids.length ? ids.map(id => { const c = CHOSIK.find(o => o.id === id); return `<span title="${c.desc}">${c.name}</span>`; }).join("") : "<span>비어 있음</span>"); }).join("")
      + "<small>일섬 하나 · 방어 하나 · 이동 둘 — 칸이 차 있으면 같은 종류 하나를 내려놓는다</small>";
    document.querySelectorAll(".ch-held").forEach(o => o.remove()); $("cards").before(line); }
  const box = $("cards"); box.innerHTML = "";
  for (const c of picks) {
    const b = document.createElement("button"); b.className = "card" + (c.combo ? " combo" : "");
    const vi = pv(c);
    b.innerHTML = (c.combo ? (vi.icon2 ? `<i class="ic duo" style="--ic:var(--chosik-${vi.icon});--ic2:var(--chosik-${vi.icon2})"></i>` : `<i class="ic" style="--ic:var(--chosik-${vi.icon})"></i>`) + `<em class="tag">조합 · ${c.combo.map(id => pv(CHOSIK.find(o => o.id === id)).name).join(" + ")}</em>` : `<i class="ic" style="--ic:var(--chosik-${vi.icon})"></i>` + "") + `<b class="nm"></b><span class="han"></span><span class="ds"></span>`;
    if (c.kind) { const t = document.createElement("em"); t.className = "tag kind"; t.textContent = c.kind + (slotFull(c.kind) ? " · 교체" : ""); b.insertBefore(t, b.querySelector(".nm")); }
    const v = pv(c); b.querySelector(".nm").textContent = v.name; b.querySelector(".han").textContent = v.han; b.querySelector(".ds").textContent = v.desc;
    b.addEventListener("click", () => {
      run.perks = run.perks || [];
      run.rerolled = false;
      run.rerollN = 0; run.discarded = false;
      if (!(META.seen = META.seen || []).includes(c.id)) { META.seen.push(c.id); saveMeta(); }
      if (c.id === "sum") run.breath = Math.min(breathCap(), run.breath + 1);
      else if (slotFull(c.kind)) { replaceScreen(c, done); return; }   // that kind's slots are full: one of the same kind has to make room
      else run.perks.push(c.id);
      Music.sfx("lantern"); done();
    });
    box.appendChild(b);
  }
  const tools = document.createElement("div"); tools.className = "ch-tools";
  const left = (META.bld.sadang >= 2 ? 2 : 1) - (run.rerollN || 0);   // every 관문 gives one reroll (two with the 사당)
  if (left > 0) { const rb = document.createElement("button"); rb.className = "btn ghost"; rb.textContent = `다시 뽑기 · ${left}`;
    rb.addEventListener("click", () => { run.rerollN = (run.rerollN || 0) + 1; run.reroll = (run.reroll || 0) + 3; saveRun(); showChoice(kind); }); tools.appendChild(rb); }
  const mine = heldPerks().filter(id => id !== SIMBEOP_START());
  if (!run.discarded && mine.length && run.breath < breathCap() && !oath("godok")) { const db = document.createElement("button"); db.className = "btn ghost"; db.textContent = "비급 버리고 숨 +1";
    db.addEventListener("click", () => discardScreen(kind)); tools.appendChild(db); }
  if (tools.children.length) box.appendChild(tools);
  $("chMadang").textContent = kind === "tower" ? `천고탑 ${run.floor - 1}층을 넘었다` : kind === "cycle" ? `천고를 베었다 · ${(run.cycle || 0) + 1}번째` : kind === "bonus" ? "징조의 대가" : `${josa(stageOf(run.m - 1).ko, "을", "를")} 넘었다 · ${stageOf(run.m - 1).han}`;
  state = "choice"; Music.pause(); if (P) P.focus = false; for (const k in held) held[k] = 0; showScreen("choice");
}
const PERK_MAX = 4;
const heldPerks = () => (run.perks || []).filter(id => id !== "sum" && SLOT[kindOf(id)]);
const slotFull = k => !!SLOT[k] && heldPerks().filter(id => kindOf(id) === k).length >= SLOT[k];
function replaceScreen(nc, done) { // the slot is taken: the new one takes the place of one of the same kind
  const rows = heldPerks().filter(id => kindOf(id) === nc.kind).map(id => { const c = CHOSIK.find(o => o.id === id);
    return bdRow(c.name, c.desc, null, "내려놓기", () => { run.perks = run.perks.filter(x => x !== id); run.perks.push(nc.id); saveRun(); Music.sfx("lantern"); toast(`${josa(c.name, "을", "를")} 내려놓고 ${josa(nc.name, "을", "를")} 익혔다`); done(); }); });
  rows.unshift(bdRow(`새 ${nc.kind} · ${nc.name}`, nc.desc));
  board(`${nc.kind} 비급은 ${SLOT[nc.kind] === 1 ? "하나" : "둘"}까지`, "같은 종류 하나를 내려놓아야 새 비급을 익힌다", rows, [["새 비급 포기", () => done()]]);
}
const START_ALT = { munyeo: { d_jeong: "m_float", d_far: "m_wind" }, posu: { d_jeong: "p_quick", d_far: "p_slug" } };
const startOf = (m, ch) => ((START_ALT[ch] || {})[m.start]) || m.start;
const SIMBEOP_START = () => { const m = SIMBEOP.find(m => m.id === run.simbeop); return m && startOf(m, run.char); };
function discardScreen(kind) { // trade a 비급 that no longer fits the build for one breath
  const rows = heldPerks().filter(id => id !== SIMBEOP_START()).map(id => { const c = CHOSIK.find(o => o.id === id);
    return bdRow(c.name, c.desc, null, "버리기", () => { run.perks = run.perks.filter(x => x !== id); run.breath = Math.min(breathCap(), run.breath + 1); run.discarded = true; saveRun(); toast(`${josa(c.name, "을", "를")} 버리고 숨을 얻었다`); showChoice(kind); }); });
  board("비급 버리기", "하나를 버리면 숨 하나를 되찾는다", rows, [["그만두기", () => showChoice(kind)]]);
}
function showOmen() {   // the rule for the coming turn: two omens drawn at random, or a calm one
  const rnd = mulberry((run.seed ^ ((run.cycle || 0) * 7477)) >>> 0), pool = OMENS.filter(o => !o.calm), picks = [];
  while (picks.length < 2) picks.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
  picks.push(OMENS.find(o => o.calm));
  $("chTitle").textContent = "징조를 골라라";
  $("chMadang").textContent = `${(run.cycle || 0) + 1}번째 판 · ${SEASON[season()].name}`;
  const box = $("cards"); box.innerHTML = "";
  for (const o of picks) {
    const b = document.createElement("button"); b.className = "card omen" + (o.calm ? " calm" : "");
    b.innerHTML = `<i class="ic"></i><b class="nm"></b><span class="ds"></span><span class="gift"></span>`;
    b.querySelector(".ic").textContent = o.han; if (o.han.length > 2) b.querySelector(".ic").style.fontSize = "30px"; b.querySelector(".nm").textContent = o.name; b.querySelector(".ds").textContent = o.desc; b.querySelector(".gift").textContent = "대가 · " + o.gift;
    b.addEventListener("click", () => {
      run.omen = o.calm ? null : o.id; Music.sfx("lantern");
      if (o.id === "geupbak") run.breath = Math.min(breathCap(), run.breath + 1);
      if (o.bonus) { run.choosing = "bonus"; saveRun(); showChoice("bonus"); return; }
      run.choosing = null; saveRun(); Music.stop(); showInterlude();
    });
    box.appendChild(b);
  }
  state = "choice"; Music.pause(); if (P) P.focus = false; for (const k in held) held[k] = 0; showScreen("choice");
}
function endRun(won) {
  state = "result"; Music.stop();
  store.del("run");
  const reached = run.tower ? run.floor - (won ? 0 : 1) : (run.cycle || 0) * (LAST_M + 1) + run.m + (won ? 1 : 0);
  const rate = run.slashes ? Math.round(run.strikes / run.slashes * 100) : 0;
  $("rSeal").textContent = won ? "登" : "終";
  $("rTitle").textContent = won ? "등천" : "절명";
  $("rSub").textContent = run.tower ? (won ? "천고가 다시 울렸다." : `천고탑 ${run.floor}층에서 숨이 다했다.`) : won ? "천고는 아직 위에서 울린다." : stageName(run.m) + "에서 숨이 다했다.";
  $("rStats").innerHTML = "";
  const gain = runRewards(reached);
  for (const [k, v] of [[run.tower ? "오른 층" : "넘은 관문", reached + (!run.tower && (run.cycle || 0) ? ` · ${run.cycle}번 천고를 벰` : "")], ["시간", fmt(run.time)], ["일격", run.strikes + "회 · " + rate + "%"], ["벤 적", run.kills], ["얻은 혼", "+" + gain.hon + (gain.shard ? ` · 천고 조각 +${gain.shard}` : "")]]) {
    const a = document.createElement("span"), b = document.createElement("b"); a.textContent = k; b.textContent = v; $("rStats").append(a, b);
  }
  let rec = "";
  sealable = ((!run.tower && (run.cycle || 0) >= 1) || (run.fresh && run.floor > 3)) ? JSON.parse(JSON.stringify(run)) : null; $("bSeal").hidden = !sealable;
  if (run.tower) {
    const bk = META.books.find(b => b.id === run.book); if (bk && reached > (bk.best || 0)) { bk.best = reached; rec = "이 비급첩의 최고 층"; }
    if (reached > META.towerBest) { META.towerBest = reached; rec = "천고탑 최고 기록"; } saveMeta();
  } else {
    const best = store.get("best", null);
    if (!best || reached > best.reached || (reached === best.reached && run.time < best.time)) { store.set("best", { reached, time: run.time }); rec = "최고 기록"; }
  }
  $("rRec").textContent = rec;
  lastResult = { reached, rate, time: run.time, won };
  if (mode !== "tutorial") { const w = wpn(); META.mastery[w] = (META.mastery[w] || 0) + run.kills; if ((run.aimK || 0) >= 40) META.firsts.beat = true; saveMeta(); checkTitles(); }
  showScreen("result");
}
let lastResult = null, sealable = null;
// 혼 for everything done, 천고 조각 for the rare things (cutting 천고, every tenth floor); 업 multiplies both
function runRewards(reached) {
  const mult = 1 + .15 * (run.upPts || 0) + (run.honDouble || 0);
  const hon = Math.round(((run.tower ? reached * 9 : reached * 5) + Math.floor(run.strikes / 4) + Math.floor(run.kills / 3) + (run.bossKills || 0) * 12) * mult);
  const shard = (run.tower ? Math.floor(reached / 10) : (run.cycle || 0)) + (run.firstBoss || 0);
  META.hon += hon; META.shard += shard; saveMeta(); if (typeof questEvent === "function") questEvent("runEnd", { reached });
  return { hon, shard };
}
function shareText() {
  const r = lastResult; if (!r) return "";
  const head = "천고";
  const n = LAST_M + 1, cyc = Math.floor(r.reached / n), m = r.reached % n;
  return `${head}\n관문 ${r.reached}개 넘음${cyc ? ` · 천고 ${cyc}번 벰` : ""} · ${fmt(r.time)} · 일격 ${r.rate}%\n` + "●".repeat(cyc) + "▮".repeat(m) + "▯".repeat(n - m);
}

// ---------- player ----------
const CLIMBV = 270, CLIMB_T = 0.5, GRAV = 1900, JUMPV = 640, MAXV = 300, DASHV = 1000, HOOK_R = 300, STRIKE_WIN = 0.15;
function aimDir() { const a = axis(), m = Math.hypot(a.x, a.y); let d = m < 0.35 ? { x: P.face, y: 0 } : { x: a.x / m, y: a.y / m };
  if (P.focus && has("d_jeong")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; let best = null, bs = 1e9;   // 응시: the aim settles on the nearest foe in that direction
    for (const e of enemies) { if (!e.alive || ghostly(e)) continue; const dx = e.x + e.w / 2 - cx, dy = e.y + e.h / 2 - cy, L = Math.hypot(dx, dy); if (L > 300 || L < 10) continue; const c = (dx * d.x + dy * d.y) / L; if (c < .8) continue; if (L < bs) { bs = L; best = { x: dx / L, y: dy / L }; } }
    if (best) d = best; }
  return d; }
const TAP_T = .12;   // released sooner than this, the dash button is a tap
const focusLen = () => (upOn("narrow") ? .5 : 1) * ((P && P.cloudT ? P.cloudT : 0) + 1.2 * (has("d_jeong") ? 2 : 1) * (oath("gonggung") && !P.onGround ? 2 : 1) * (simb("hyeol") && run && run.breath <= 2 && mode !== "tutorial" ? 2 : 1) * (has("d_calm") && run && run.breath <= 1 && mode !== "tutorial" ? 3 : 1));
function talismans(d) { // 부적 세 장: a fan of paper charms thrown along the aim
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  for (const t of [-.22, 0, .22]) { const vx = d.x * Math.cos(t) - d.y * Math.sin(t), vy = d.x * Math.sin(t) + d.y * Math.cos(t);
    bullets.push({ x: cx + vx * 16, y: cy + vy * 16, vx: vx * 720, vy: vy * 720, ang: Math.atan2(vy, vx), friendly: true, talisman: true, wind: true, strike: true, r: 14, life: .5, owner: null }); }
}
function posuShot() { // 포수: the aimed release is a shot, and the recoil is his dash — while the match is relit it stays a bayonet lunge
  if ((P.reloadAt || 0) > songPos) return false;
  let d = aimDir(); const k = (has("p_slug") ? 1.4 : 1) * (has("p_rocket") ? 1.4 : 1);
  { const cx = P.x + P.w / 2, cy = P.y + P.h / 2 - 4; let bs = .9;   // a marksman's eye: a foe within a hair of the aim draws the barrel onto it
    for (const e of enemies) { if (!e.alive || ghostly(e)) continue; const dx = e.x + e.w / 2 - cx, dy = e.y + e.h / 2 - cy, L = Math.hypot(dx, dy); if (L > 560 || L < 10) continue; const c = (dx * d.x + dy * d.y) / L; if (c > bs) { bs = c; d = { x: dx / L, y: dy / L }; } } }
  P.reloadAt = songPos + (has("p_quick") ? 1 : 2) * Music.beatLen;
  const rot = t => ({ x: d.x * Math.cos(t) - d.y * Math.sin(t), y: d.x * Math.sin(t) + d.y * Math.cos(t) });
  for (const t of has("p_scatter") ? [-.3, -.15, 0, .15, .3] : [0]) aimRay(rot(t), has("p_scatter") ? 230 : 560, has("p_slug") ? 26 : 10, has("p_ricochet") ? 1 : 0);
  const cx = P.x + P.w / 2 + d.x * 20, cy = P.y + P.h / 2 - 4 + d.y * 18;
  if (SPR.pfx) addFx("pfx", 1, cx + d.x * 30, cy + d.y * 26, 52, { life: .22, grow: .3, ay: .5, ...dirFx(d) });
  for (let i = 0; i < 14; i++) parts.push({ x: cx + d.x * 14, y: cy + d.y * 14, vx: d.x * 60 + (Math.random() - .5) * 90, vy: d.y * 60 - 30 - Math.random() * 60, life: .7, max: .7, c: "rgba(90,86,94,.75)", s: 4 + Math.random() * 5 });
  shake = Math.max(shake, 6); Music.sfx("clang"); if (has("d_ward")) P.wardT = 1;
  if (has("p_charge")) { P.aimDash = true; if (!startDash(d, true)) P.aimDash = false; return true; }   // 착검 돌격: in behind the shot
  if (!P.onGround) P.airDash = Math.max(0, P.airDash - 1);
  P.vx = -d.x * 560 * k; P.vy = -d.y * 560 * k - 140 * k; P.onGround = false; P.coyote = 0; if (Math.abs(d.x) > .2) P.face = Math.sign(d.x);
  heroFx("dash", P.x + P.w / 2 + d.x * 20, P.y + P.h / 2 + d.y * 20, -Math.sign(d.x) || P.face, 0);
  return true;
}
function aimRay(d, L0, wide, bounce, ox, oy) { // one aimed shot: a line that stops at walls; bosses take a full 일격
  const cx = ox ?? P.x + P.w / 2 + d.x * 20, cy = oy ?? P.y + P.h / 2 - 4 + d.y * 18; let L = L0, wall = false;
  for (let t = 10; t < L0; t += 8) if (solidPt(cx + d.x * t, cy + d.y * t)) { L = t; wall = true; break; }
  let hit = enemies.filter(e => { if (!e.alive || ghostly(e)) return false; const ex = e.x + e.w / 2 - cx, ey = e.y + e.h / 2 - cy, t = ex * d.x + ey * d.y; return t > 0 && t < L && Math.abs(ex * d.y - ey * d.x) < Math.max(e.w, e.h) / 2 + wide; })
    .sort((a, b) => ((a.x - cx) * d.x + (a.y - cy) * d.y) - ((b.x - cx) * d.x + (b.y - cy) * d.y));
  const burst = has("p_burst") && (hit.length || wall);
  if (burst && hit.length) { const e = hit[0]; L = (e.x + e.w / 2 - cx) * d.x + (e.y + e.h / 2 - cy) * d.y; hit = [e]; }   // 작렬탄: the ball stops at the first body
  if (has("d_tan")) for (const b of bullets) if (!b.friendly) { const ex = b.x - cx, ey = b.y - cy, t = ex * d.x + ey * d.y; if (t > 0 && t < L && Math.abs(ex * d.y - ey * d.x) < wide + 14) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 18, { life: .2 }); } }
  for (const g of LV.targets) { const ex = g.x - cx, ey = g.y - cy, t = ex * d.x + ey * d.y; if (g.t <= 0 && t > 0 && t < L && Math.abs(ex * d.y - ey * d.x) < wide + 14) breakTarget(g); }
  for (const e of hit) { hurtEnemy(e, false, "il"); addFx("perkfx", PF.splash, e.x + e.w / 2, e.y + e.h / 2, 36, { life: .22 }); }
  beams.push({ x0: cx, y0: cy, x1: cx + d.x * L, y1: cy + d.y * L, t: 0, life: .28, red: true, w: wide > 20 ? 2.4 : 1.2 });
  const x = cx + d.x * L, y = cy + d.y * L;
  if (burst) { fireFx(x, y, 64); if (SPR.pfx) addFx("pfx", 2, x, y, 120, { life: .5, grow: .35, ay: .5 }); ringFx(x, y, 80, "rgba(60,52,48,.7)", .35);
    for (const e of nearestFoes(x, y, 9, 80)) if (!hit.includes(e)) hurtEnemy(e, false); return; }
  if (bounce && wall) { const bx = x - d.x * 6, by = y - d.y * 6, vert = solidPt(bx + d.x * 10, by);   // 도탄: off the wall once
    aimRay(vert ? { x: -d.x, y: d.y } : { x: d.x, y: -d.y }, L0 - L, wide, 0, bx, by); }
}
function sunbo() { // 순보: the aimed release steps through to the back of the foe it points at, and cuts
  const d = aimDir(), cx = P.x + P.w / 2, cy = P.y + P.h / 2; let t = null, bs = 1e9;
  for (const e of enemies) { if (!e.alive || ghostly(e)) continue; const dx = e.x + e.w / 2 - cx, dy = e.y + e.h / 2 - cy, L = Math.hypot(dx, dy); if (L > 230 || L < 8) continue;
    if ((dx * d.x + dy * d.y) / L < .88 || !los(cx, cy, e.x + e.w / 2, e.y + e.h / 2)) continue; if (L < bs) { bs = L; t = e; } }
  if (!t) return false;
  const side = Math.sign(t.x + t.w / 2 - cx) || P.face, nx = t.x + t.w / 2 + side * (t.w / 2 + 16) - P.w / 2, ny = t.y + t.h - P.h - .01;
  if (rectSolid(nx, ny, P.w, P.h)) return false;
  addFx("perkfx", PF.clone, cx, P.y + P.h, 60, { life: .3, ay: 1, flip: P.face < 0, a: .6 });
  beams.push({ x0: cx, y0: cy, x1: nx + P.w / 2, y1: ny + P.h / 2, t: 0, life: .25 });
  P.x = nx; P.y = ny; P.vx = 0; P.vy = -120; P.face = -side; if (!P.onGround) P.airDash = Math.max(0, P.airDash - 1);
  P.aimedUntil = songPos + .45; P.aimDash = true; hurtEnemy(t, false, "il"); P.aimDash = false; P.dashCd = .55;   // a bodily step: it lands a cut, not the full 일격, and the feet need a moment
  addFx("perkfx", PF.splash, t.x + t.w / 2, t.y + t.h / 2, 40, { life: .25 }); Music.sfx("dash"); return true;
}
function startDash(dir, forced) {
  if (oath("hyeon") && !forced) return false;
  if (P.dashCd > 0 && !forced) { if (!(simb("hwa") && P.spare)) return false; P.spare = false; }   // 화심법: a second dash held in reserve
  if (has("sunbo") && !forced) { const t = nearestFoes(P.x + P.w / 2, P.y + P.h / 2, 1, 270)[0];   // 순보: step through to the far side of the nearest foe
    if (t) { const side = Math.sign(t.x + t.w / 2 - P.x - P.w / 2) || P.face, nx = t.x + t.w / 2 + side * (t.w / 2 + 16) - P.w / 2, ny = t.y + t.h - P.h - .01;
      if (!rectSolid(nx, ny, P.w, P.h)) { addFx("perkfx", PF.clone, P.x + P.w / 2, P.y + P.h, 60, { life: .3, ay: 1, flip: P.face < 0, a: .6 }); P.x = nx; P.y = ny; P.vx = 0; P.vy = 0; P.face = -side; P.invT = Math.max(P.invT || 0, .25);
        P.dashCd = (has("seomgwang") ? .1 : .32) * (res("hwa", 2) ? .65 : 1); if (!P.onGround) P.airDash = Math.max(0, P.airDash - 1); hurtEnemy(t, false); addFx("perkfx", PF.splash, t.x + t.w / 2, t.y + t.h / 2, 40, { life: .25 }); Music.sfx("dash"); return true; } } }
  if (!P.onGround) { if (P.airDash <= 0) return false; P.airDash--; if (has("bicheon")) P.djN = 0; }
  let d = dir || aimDir();
  if (P.onGround && d.y > 0.2) d = { x: d.x === 0 ? P.face : Math.sign(d.x), y: 0 };
  if (!forced) { if (P.flowReady && has("gidung")) { P.flowReady = false; P.flowN = 0; P.flowDash = true; ringFx(P.x + P.w / 2, P.y + P.h / 2, 60, "rgba(195,22,28,.9)", .3); } else flow("dash"); }
  if (!forced && (has("nakroe") || P.boltDash)) { // 뇌섬: the dash becomes a bolt that is already there
    P.boltDash = false; P.dashCd = .4 * (res("hwa", 2) ? .75 : 1); P.hook = null;   // a bolt needs a breath between: 섬광 does not hurry it
    boltLunge(d, 250 * (has("noejeong") ? 1.3 : 1), true);
    if (has("byeokryeokbo")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; for (const e of nearestFoes(cx, cy, 8, 95)) { hurtEnemy(e, has("noesin") && e.type !== "b"); boltFx(cx, cy, e.x + e.w / 2, e.y + e.h / 2, .22, 10); }
      addFx("perkfx", PF.thunder, cx, P.y + P.h + 4, 120, { life: .3, ay: 1, grow: 0 }); }
    return true; }
  { const ang = Math.atan2(d.y, Math.abs(d.x)), dx = Math.abs(d.x) > .2 ? Math.sign(d.x) : P.face; heroFx("dash", P.x + P.w / 2 - d.x * 26, P.y + P.h / 2 - d.y * 26, dx, ang); }
  P.dashFrom = { x: P.x + P.w / 2, y: P.y + P.h }; P.ram = has("dolgyeok") && P.onGround;
  P.bounced = false; P.dashDir = d; const fromGround = P.onGround; P.dashT = 0.15 * (P.aimDash ? (has("d_far") ? 1.8 : 1) * (oath("goyo2") ? 2 : 1) * (P.chargeK || 1) * (has("m_talis") ? .6 : 1) * (P.giseDash ? 1 + .08 * P.giseDash : 1) : 1) * (P.ram ? 1.7 : 1); P.dashCd = (has("seomgwang") ? 0.1 : 0.32) * (res("hwa", 2) ? .65 : 1); P.dashHit = new Set(); P.hook = null;
  if (fromGround) P.dashCd = Math.max(P.dashCd, .45);   // on the ground the dash is free of the air count, so it cools a little longer
  if (Math.abs(d.x) > 0.2) P.face = Math.sign(d.x);
  Music.sfx("dash"); return true;
}
function musket(d, arrow) { // 포수: the 일격 is a matchlock shot (or a loosed arrow) — then the match must be relit
  if (!arrow) { if ((P.reloadAt || 0) > songPos) return; P.reloadAt = songPos + (has("soksa") ? 1 : 2) * Music.beatLen; }   // still reloading: the 일격 stays a thrust
  const rot = (v, t) => ({ x: v.x * Math.cos(t) - v.y * Math.sin(t), y: v.x * Math.sin(t) + v.y * Math.cos(t) });
  for (const t of has("ssang") ? [-.07, .07] : [0]) shot(rot(d, t), arrow);   // 쌍발
  if (arrow) { Music.sfx("slash"); return; }
  const cx = P.x + P.w / 2 + d.x * 20, cy = P.y + P.h / 2 - 4 + d.y * 18;
  if (SPR.pfx) addFx("pfx", 1, cx + d.x * 30, cy + d.y * 26, 46, { life: .22, grow: .3, ay: .5, ...dirFx(d) });   // the muzzle flash
  for (let i = 0; i < 12; i++) parts.push({ x: cx + d.x * 14, y: cy + d.y * 14, vx: d.x * 60 + (Math.random() - .5) * 90, vy: d.y * 60 - 30 - Math.random() * 60, life: .7, max: .7, c: "rgba(90,86,94,.75)", s: 4 + Math.random() * 5 });
  P.vx -= d.x * 160; shake = Math.max(shake, 4);
}
function shot(d, arrow) {
  const cx = P.x + P.w / 2 + d.x * 20, cy = P.y + P.h / 2 - 4 + d.y * 18, cannon = !arrow && has("wolgwang"), wide = has("gangta") ? 22 : 8; let L = arrow ? 640 : 360;
  for (let t = 10; t < L; t += 8) if (solidPt(cx + d.x * t, cy + d.y * t)) { L = t; break; }
  const hit = enemies.filter(e => { if (!e.alive || ghostly(e)) return false; const ex = e.x + e.w / 2 - cx, ey = e.y + e.h / 2 - cy, t = ex * d.x + ey * d.y; return t > 0 && t < L && Math.abs(ex * d.y - ey * d.x) < Math.max(e.w, e.h) / 2 + wide; })
    .sort((a, b) => ((a.x - cx) * d.x + (a.y - cy) * d.y) - ((b.x - cx) * d.x + (b.y - cy) * d.y));
  if (cannon && hit.length) { const e = hit[0]; L = (e.x + e.w / 2 - cx) * d.x + (e.y + e.h / 2 - cy) * d.y; hit.length = 1; }   // 대포: the ball stops at the first body and bursts
  for (const e of hit) { hurtEnemy(e, e.type !== "b"); addFx("perkfx", PF.splash, e.x + e.w / 2, e.y + e.h / 2, 36, { life: .22 });
    if (has("cheohyeong")) e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .3 : .9);
    if (has("noejeon") && SPR.pfx) addFx("pfx", 6, e.x + e.w / 2, e.y + e.h / 2, 44, { life: .3, ay: .5, rot: Math.random() * 6.28 });
    if (has("noejeon")) { const n = nearestFoes(e.x + e.w / 2, e.y + e.h / 2, 3, has("noejeong") ? 230 : 150).find(o => o !== e && !hit.includes(o));   // 뇌관: the spark jumps on
      if (n) { boltFx(e.x + e.w / 2, e.y + e.h / 2, n.x + n.w / 2, n.y + n.h / 2, .3, 16); n.stunT = Math.max(n.stunT || 0, .4); hurtEnemy(n, has("noesin") && n.type !== "b"); } } }
  beams.push({ x0: cx, y0: cy, x1: cx + d.x * L, y1: cy + d.y * L, t: 0, life: arrow ? .4 : .26, red: true, arrow, w: cannon ? 2.4 : has("gangta") ? 1.8 : 1 });
  if (cannon) { const x = cx + d.x * L, y = cy + d.y * L, r = (has("manwol") ? 130 : 90) * (has("ssangwol") ? 1.3 : 1); fireFx(x, y, r * .8); if (SPR.pfx) addFx("pfx", 2, x, y, r * 1.5, { life: .55, grow: .35, ay: .5 }); ringFx(x, y, r, "rgba(60,52,48,.7)", .4); shake = Math.max(shake, 8); Music.sfx("kill");
    for (const e of enemies) if (e.alive && !ghostly(e) && !hit.includes(e) && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r + Math.max(e.w, e.h) / 2) { hurtEnemy(e, false); e.stunT = Math.max(e.stunT || 0, has("manwol") ? .9 : .45); } }
}function doSlash(req) {
  if (P.hook) return; P.pogoed = false;
  if (P.slashCd > 0 && !req.dash) return;
  if ((P.offBal || 0) > 0 && !req.dash) return;
  let d = req.dir;
  if (!d) { const a = axis(), m = Math.hypot(a.x, a.y); d = m > 0.5 ? { x: a.x / m, y: a.y / m } : { x: P.face, y: 0 }; }
  const off = Music.offBeat(Music.posAt(req.ts));
  const WP = WEAPONS[wpn()], onBeat = !!window.__forceStrike;   // the drum no longer judges the hand: an 일격 comes from 일섬, a full 거합 or a run of cuts
  let strike = onBeat;
  if (onBeat && has("samyeon")) P.chainT = .45;
  P.whiff = false;
  if (oath("geommu")) { const gap = songPos - (P.danceAt ?? -9); P.dance = gap < .7 ? Math.min(5, (P.dance || 0) + 1) : 0; P.danceAt = songPos; P.danceRest = gap > 1; }
  if (wk() === "ssang") { P.combo = songPos - (P.lastCut || -9) < .5 ? (P.combo || 0) + 1 : 1; P.lastCut = songPos; if (P.combo >= 5) { strike = true; P.combo = 0; } }
  const full = wk() === "baldo" && req.iai != null && req.iai >= IAI_FULL, master = full && req.iai >= IAI_MASTER;   // 모아베기: a full draw always comes out; held to the second ring it is the 일격
  if (full && WP.bow) {   // 각궁: a full draw always flies; drawn to the second ring it is an 일격 and the air comes back
    P.arrow = true; if (master) { strike = true; regainAir(); }
  } else if (full) {   // 발도: a full draw lunges forward cutting; drawn to the second ring it is the 일격 and the air comes back
    const onBeat = master; P.iaiCut = onBeat; if (onBeat) { strike = true; regainAir(); } P.dashCd = 0; P.slashDir = d; P.tapDash = !onBeat;
    startDash({ x: Math.abs(d.x) > .2 ? Math.sign(d.x) : P.face, y: Math.abs(d.x) > .2 ? 0 : 0 }, true); P.dashT = onBeat ? .22 : .16;
    ringFx(P.x + P.w / 2, P.y + P.h / 2, onBeat ? 70 : 46, onBeat ? "rgba(195,22,28,.9)" : "rgba(23,22,26,.5)", .3); if (onBeat) shake = Math.max(shake, 6);
  }
  run.slashes++; if (strike) run.strikes++;
  P.windBack = false; P.slashDir = d; P.slashT = P.slashDur = (req.dash ? 0.22 : WP.dur); P.slashCd = (has("yeongyeok") ? Math.min(.08, WP.cd) : WP.cd) * (oath("hyeon") ? .5 : 1) + (has("geommak") ? .1 : 0); P.strike = strike; P.clanged = new Set(); P.hitSet = new Set();
  if (strike && has("bangyeok")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2;   // 반격: the shots around you die and their shooters answer for them
    for (const b of bullets) if (!b.friendly && Math.hypot(b.x - cx, b.y - cy) < 110) { b.life = 0; const o = b.owner; if (o && o.alive) { beams.push({ x0: cx, y0: cy, x1: o.x + o.w / 2, y1: o.y + o.h / 2, t: 0, life: .2 }); hurtEnemy(o, o.type !== "b"); } }
    for (const e of enemies) if (e.alive && e.fireAt != null && Math.abs(e.fireAt - songPos) < .3 && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 240) { e.fireAt = null; hurtEnemy(e, true); }
    addFx("slashfx", SF.guard, cx, cy, 80, { life: .3, grow: .5 }); }
  if (has("geompung")) { const gs = strike && has("gwisin"); for (const t of has("mancheon") ? [-.55, 0, .55] : [0]) { const c = Math.cos(t), sn = Math.sin(t), vx = d.x * c - d.y * sn, vy = d.x * sn + d.y * c;   // a blade of wind stays where the cut ended
    const x = P.x + P.w / 2 + vx * 62, y = P.y + P.h / 2 + vy * 52, life = has("geomu") ? .7 : .35;
    if (chr("munyeo")) bullets.push({ x, y, vx: 0, vy: 0, ang: Math.atan2(vy, vx) + (Math.random() - .5) * .6, friendly: true, wind: true, talisman: true, r: 22, strike: gs, pierce: true, life: life * 1.6, owner: null });   // 부적 바람: a talisman sticks in the air
    else if (chr("posu")) bullets.push({ x, y, vx: vx * 40, vy: vy * 40 - 20, friendly: true, fire: true, smoke: true, big: true, r: 20, strike: gs, pierce: true, life: life * 2.4, owner: null });   // 화약 연기: burning smoke hangs there
    else bullets.push({ x, y, vx: 0, vy: 0, ang: Math.atan2(vy, vx), friendly: true, wind: true, blade: true, r: 22, strike: gs, pierce: true, life, owner: null }); } }
  if (strike && has("pilsal")) for (const b of bullets) if (!b.friendly && Math.hypot(b.x - P.x - P.w / 2, b.y - P.y - P.h / 2) < 280) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 22, { life: .25 }); }
  if (strike && has("gwigeom") && chr("posu")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2 - 4, L = has("cheonroe") ? 260 : 170;   // 산탄: a cone of shot
    for (const t of [-.32, -.16, 0, .16, .32]) { const v = { x: d.x * Math.cos(t) - d.y * Math.sin(t), y: d.x * Math.sin(t) + d.y * Math.cos(t) };
      for (const e of foesInLine(cx, cy, v, L)) if (!(P.hitSet && P.hitSet.has("g" + e.id))) { P.hitSet && P.hitSet.add("g" + e.id); hurtEnemy(e, has("talhon") && e.type !== "b"); }
      beams.push({ x0: cx + v.x * 16, y0: cy + v.y * 16, x1: cx + v.x * L, y1: cy + v.y * L, t: 0, life: .18, red: true, w: .5 }); }
    if (SPR.pfx) addFx("pfx", 5, cx + d.x * (L * .45), cy + d.y * (L * .45), L * .55, { life: .25, grow: .3, ay: .5, ...dirFx(d) });   // 산탄: the spray of shot
    for (let i = 0; i < 14; i++) { const a = Math.atan2(d.y, d.x) + (Math.random() - .5) * .7, v = 300 + Math.random() * 400; parts.push({ x: cx + d.x * 20, y: cy + d.y * 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .25, max: .25, c: i % 3 ? "#5a565e" : "#e8b84a", s: 2 }); } }
  else if (strike && has("gwigeom") && chr("munyeo")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2, gr = has("cheonroe") ? 240 : 140;   // 신령의 손: hands rise from the ground and hold fast
    for (const e of enemies) if (e.alive && !ghostly(e) && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < gr) { hurtEnemy(e, has("talhon") && e.type !== "b"); e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .25 : .8);
      if (SPR.mfx) addFx("mfx", 3, e.x + e.w / 2, e.y + e.h + 4, Math.max(56, e.h * 1.1), { life: .5, grow: .2, ay: 1 });   // 신령의 손
      for (let i = 0; i < 6; i++) parts.push({ x: e.x + e.w / 2 + (Math.random() - .5) * e.w, y: e.y + e.h, vx: (Math.random() - .5) * 30, vy: -120 - Math.random() * 120, life: .5, max: .5, c: i % 2 ? "rgba(217,165,32,.8)" : "rgba(242,239,230,.9)", s: 3 }); }
    ringFx(cx, cy, gr, "rgba(217,165,32,.75)", .45); ringFx(cx, cy, gr * .6, "rgba(195,22,28,.6)", .35); }
  else if (strike && has("gwigeom")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; const gr = has("cheonroe") ? 240 : 140; for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < gr) hurtEnemy(e, has("talhon") && e.type !== "b"); addFx("hud", HUD.spark, cx, cy, gr * .85, { life: .35 }); }
  if (Math.abs(d.x) > 0.2) P.face = Math.sign(d.x);
  if (has("hoeseon") && !P.onGround) addFx("perkfx", PF.spin, P.x + P.w / 2, P.y + P.h / 2, 110, { life: .3, grow: .2, a: .9 });
  if (strike) shintong(d);
  P.boltArc = false;
  if (strike && has("sinnaerim") && !((P.possessUntil || 0) > songPos) && (P.sinN = (P.sinN || 0) + 1) % 5 === 0) { P.possessUntil = songPos + 2 * Music.beatLen; ringFx(P.x + P.w / 2, P.y + P.h / 2, 90, "rgba(217,165,32,.9)", .5); Music.sfx("lantern"); }   // 신내림
  if (strike && res("noe", 6) && (P.noeN = (P.noeN || 0) + 1) % 3 === 0 && !P.boltDash) { P.boltDash = true; resFx("noe", "다음 대시가 번개가 된다"); }
  if (!P.onGround && res("pung", 4)) for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28; parts.push({ x: P.x + P.w / 2 + Math.cos(a) * 30, y: P.y + P.h / 2 + Math.sin(a) * 26, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, life: .3, max: .3, c: "rgba(47,138,120,.7)", s: 2 }); }
  if ((strike && chr("posu") && wpn() !== "gakgung") || P.arrow) musket(d, P.arrow); P.arrow = false;
  if (!P.onGround && P.vy > 60) P.vy = 60;
  if (req.dash) { P.tapDash = true; startDash(d); }
  Music.sfx(strike ? "strike" : "slash");
  if (strike) { flash = 0.06; if (onBeat) beatHitAt = performance.now(); }
  { const tx = P.x + P.w / 2 + d.x * 40, ty = P.y + P.h / 2 + d.y * 34, n = strike ? 12 : 8, gild = masteryLv(wpn()) >= 5;   // ink (and gold for 일격) thrown off the blade's path
    for (let i = 0; i < n; i++) { const a = Math.atan2(d.y, d.x) + (Math.random() - .5) * 1.6, v = 120 + Math.random() * 260; parts.push({ x: tx, y: ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: .35, max: .35, c: strike ? (i % 3 ? SEAL : "#e8b84a") : gild && i % 3 === 0 ? "#e8b84a" : (i % 4 ? LV.pal.fig : "#6b6670"), s: 1.5 + Math.random() * 2.5 }); }
    if (strike) addFx("perkfx", PF.spark, tx, ty, 40, { life: .2, rot: Math.random() * 6.28, grow: .6 }); }
}
let kegs = [], rings = [], killCam = 0, cutLines = [];
// 보스전 연출: the entrance card, the sealed arena, big brush words (격노 · 간파), the fall
let bossIntro = null, bossOut = null, bossBanner = null;
const ACT_NAME = { slam: "내려찍기", charge: "돌진", volley: "연사", summon: "매 부르기", pounce: "덮치기", foxfire: "여우불", illusion: "환영", club: "방망이", coins: "엽전 비", gamtu: "감투",
  burst: "솟구침", burst2: "연이은 솟구침", spit: "독물", scream: "곡성", blink: "덮쳐 오기", hair: "머리카락", low: "아래 베기", high: "위 베기", lowhigh: "아래 · 위", highlow: "위 · 아래", spirits: "장승 정령",
  breath: "불길", leap: "도약", stomp: "짓밟기", inhale: "들이마시기", scrap: "쇳조각", claw: "할퀴기", roar: "포효", fan: "부채", fan2: "쌍부채", dance: "탈춤", mask: "탈 바꾸기", drum: "천고",
  shblink: "그림자 걸음", shcut: "그림자 베기", shstrike: "그림자 일격", shdash: "그림자 돌진" };
const RAGE_ADD = { sumun: ["volley", "summon"], gumiho: ["illusion", "foxfire"], dokkaebi: ["coins", "gamtu"], imugi: ["burst2"], wongwi: ["hair", "scream"], jangseung: ["lowhigh", "highlow"],
  haetae: ["breath", "leap"], bulgasari: ["scrap", "stomp"], baekho: ["roar", "claw"], talchum: ["fan2", "dance"] };
// painted boss-fight sheets: stamps and words (bcal), effects (bvfx), each guardian's name in brush (bname)
const BC = { gyeoljeon: 0, tobeol: 1, gyeoknu: 2, ganpa: 3, stroke: 4, redBurst: 5, inkBurst: 6, talisman: 7, enso: 8 };
const BV = { rage: 0, quake: 1, curtain: 2, dizzy: 3, impact: 4, warn: 5, crescent: 6, dissolve: 7, ring: 8 };
const KF = { bead: 0, cross: 1, star: 2, xcut: 3, guide: 4, aura: 5, fizzle: 6, flakes: 7, ring: 8 };   // 간파 sheet: the gathering bead, the cross flash, the crossed cut, the guide, the aura, the fizzle
let flashDim = 0;
const MECH = { glint: 0, chungo: 1, drum: 2, slash: 3, n1: 4, deflect: 9, fire: 10, bar: 11 };   // 간파 glint, 天鼓, the drum, the cut, 一~五, the parry spark, the red shot, the gauge stroke
const BNAME = { sumun: 0, gumiho: 1, dokkaebi: 2, imugi: 3, wongwi: 4, jangseung: 5, haetae: 6, bulgasari: 7, baekho: 8, talchum: 9, cheongo: 10, shadow: 11 };
function spr(sheet, i, x, y, h, flip = false) { const S = SPR[sheet]; if (!S || !S.f[i]) return false; return drawSprite(sheet, i, x, y, h / S.f[i].h, flip, .5, sheet === "bname" && nightNow(), .5); }   // a name in black ink turns bone-white on the inverted night
function sprW(sheet, i, h) { const S = SPR[sheet]; return S && S.f[i] ? S.f[i].w * h / S.f[i].h : 0; }
function banner(text, col, sub) { bossBanner = { text, col, sub, t: 0 }; }
function sealArena(e, on) { // a talisman barrier closes both sides of the arena while the guardian lives
  if (!on) { if (LV && LV.seal) { for (const x of [LV.seal.x0, LV.seal.x1]) for (let y = 0; y <= LV.seal.y1; y++) LV.grid[y * LV.w + x] = 0; LV.seal = null; } return; }
  const d = LV.defs.find(o => o.id === e.id); if (!d || LV.seal) return;
  const x0 = d.tx - 18, x1 = d.tx + 7, px = Math.floor((P.x + P.w / 2) / T);
  if (x0 < 1 || x1 >= LV.w - 1 || px <= x0 || px >= x1) return;
  for (const x of [x0, x1]) for (let y = 0; y <= d.ty; y++) if (LV.grid[y * LV.w + x] !== 0) return;   // only where the arena is open sky
  for (const x of [x0, x1]) for (let y = 0; y <= d.ty; y++) LV.grid[y * LV.w + x] = 1;
  LV.seal = { x0, x1, y1: d.ty, t: 0 };
}
function killCamOn(e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2, d = P.dashDir || { x: P.face, y: 0 };
  killCam = Math.max(killCam, .35); hitstop = Math.max(hitstop, .05); shake = Math.max(shake, 6); Music.sfx("strike");
  cutLines.push({ x, y, a: Math.atan2(d.y, d.x), t: 0, life: .7 });
  seals.push({ x, y: e.y + 6, t: 0, rot: (Math.random() - .5) * .3 });

}
function drawCutLines() { // a short wet cut of blood across the body, drawn in one stroke
  for (const c of cutLines) { const k = c.t / c.life, grow = Math.min(1, c.t / .07), w = 1 - Math.max(0, k - .4) / .6;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.globalAlpha = w;
    { const L = 70 * grow, th = 2.2 * w + .6; ctx.fillStyle = "#a3121a"; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -th, L, 0); ctx.quadraticCurveTo(0, th, -L, 0); ctx.fill(); }   // a thin line of blood, nothing more
    ctx.restore(); }
  ctx.globalAlpha = 1;
}
function ringFx(x, y, r, col, life) { rings.push({ x, y, r, col, t: 0, life }); }
function stepKegs() { // 화약통: each keg bursts a beat after it was set down
  for (const k of kegs) if (songPos >= k.at) { k.done = true; const r = 100; fireFx(k.x, k.y - 12, r * .8); if (SPR.pfx) addFx("pfx", 2, k.x, k.y - 14, r * 1.5, { life: .55, grow: .35, ay: .5 }); ringFx(k.x, k.y - 12, r, "rgba(60,52,48,.7)", .4); shake = Math.max(shake, 7); Music.sfx("kill");
    for (const e of enemies) if (e.alive && !ghostly(e) && Math.hypot(e.x + e.w / 2 - k.x, e.y + e.h / 2 - k.y + 12) < r + Math.max(e.w, e.h) / 2) { hurtEnemy(e, false); e.stunT = Math.max(e.stunT || 0, .5); } }
  kegs = kegs.filter(k => !k.done);
}
function drawFlame(b) { // a painted flame that flickers, sways and gutters out — each one a little different, glowing on the ground
  if (b.max == null) { b.max = b.life; b.sd = Math.random() * 6.28; b.fl = Math.random() < .5; b.sz = .75 + Math.random() * .5; }
  const k = 1 - b.life / b.max, t = performance.now() / 1000, big = b.big ? 1.5 : 1;
  const life = k < .1 ? k / .1 : 1 - Math.pow((k - .1) / .9, 1.6), h = 30 * big * b.sz * life;
  if (h <= 1) return;
  ctx.save(); ctx.translate(b.x, b.y);
  const g = ctx.createRadialGradient(0, -h * .2, 0, 0, -h * .2, h * .9); g.addColorStop(0, `rgba(240,120,40,${.28 * life})`); g.addColorStop(1, "rgba(240,120,40,0)");   // warm light around it
  ctx.fillStyle = g; ctx.fillRect(-h, -h * 1.1, h * 2, h * 1.4);
  if (b.ground) { ctx.fillStyle = `rgba(30,22,18,${.2 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(0, 0, h * .5, h * .09, 0, 0, 6.283); ctx.fill(); }   // scorch
  ctx.globalAlpha = Math.min(1, b.life * 3) * .95;
  if (SPR.perkfx) { const f = SPR.perkfx.f[PF.fire];
    for (let j = 0; j < 2; j++) { const ph = b.sd + j * 2.1, sy = 1 + Math.sin(t * 17 + ph) * .14, sx = 1 - Math.sin(t * 17 + ph) * .07;
      ctx.save(); ctx.translate((j ? .28 : -.12) * h, 0); ctx.rotate(Math.sin(t * 6 + ph) * .13); ctx.scale(sx * (j ? .7 : 1), sy * (j ? .7 : 1));
      drawSprite("perkfx", PF.fire, 0, 2, h / f.h, b.fl !== !!j, .5, false, 1); ctx.restore(); } }
  ctx.restore(); ctx.globalAlpha = 1;
  if (Math.random() < .1) parts.push({ x: b.x + (Math.random() - .5) * h * .5, y: b.y - h * .8, vx: (Math.random() - .5) * 30, vy: -50 - Math.random() * 60, life: .45, max: .45, c: Math.random() < .5 ? "#ffd27a" : "#e8752a", s: 1.5 });   // embers
}
function drawKegsRings() {
  for (const k of kegs) { ctx.fillStyle = "#5a3a22"; ctx.fillRect(k.x - 7, k.y - 16, 14, 16); ctx.strokeStyle = "#17161a"; ctx.lineWidth = 1.4; ctx.strokeRect(k.x - 7, k.y - 16, 14, 16); ctx.beginPath(); ctx.moveTo(k.x - 7, k.y - 11); ctx.lineTo(k.x + 7, k.y - 11); ctx.moveTo(k.x - 7, k.y - 5); ctx.lineTo(k.x + 7, k.y - 5); ctx.stroke();
    ctx.fillStyle = Math.random() < .5 ? "#ffd27a" : SEAL; ctx.beginPath(); ctx.arc(k.x + 3, k.y - 20 - Math.random() * 3, 2.5, 0, 6.283); ctx.fill(); }   // a lit fuse
  for (const r of rings) { const k = r.t / r.life, rr = r.r * (.35 + .65 * Math.sqrt(k)); ctx.globalAlpha = Math.min(1, (1 - k) * 1.5);
    ctx.strokeStyle = LV.pal.night ? "rgba(236,230,216,.35)" : "rgba(23,22,26,.35)"; ctx.lineWidth = 9 * (1 - k) + 3; ctx.beginPath(); ctx.arc(r.x, r.y, rr, 0, 6.283); ctx.stroke();   // an ink shadow so pale rings read on paper
    ctx.strokeStyle = r.col; ctx.lineWidth = 6 * (1 - k) + 1.5; ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function stepGuards(dt) { // 비검's orbiting swords and 흑룡's coil: both cut only what comes close
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  if (P.orbit) { const o = P.orbit; o.t -= dt; o.a += dt * 9; if (o.t <= 0) P.orbit = null; else for (let i = 0; i < o.n; i++) {
    const a = o.a + i * Math.PI * 2 / o.n, sx = cx + Math.cos(a) * 46, sy = cy + Math.sin(a) * 40;
    if (chr("munyeo")) for (const b of bullets) if (!b.friendly && Math.hypot(b.x - sx, b.y - sy) < 24) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 20, { life: .2 }); }
    for (const e of enemies) if (e.alive && !ghostly(e) && sx > e.x - 10 && sx < e.x + e.w + 10 && sy > e.y - 10 && sy < e.y + e.h + 10 && !(o.hit.get(e.id) > songPos)) {
      o.hit.set(e.id, songPos + .35); hurtEnemy(e, false); addFx("perkfx", PF.splash, sx, sy, 26, { life: .2 });
      if (has("yuseong")) P.airDash = Math.max(P.airDash, baseAir());
      if (has("noegeom")) { const n = nearestFoes(sx, sy, 2, 150).find(q => q !== e); if (n) { beams.push({ x0: sx, y0: sy, x1: n.x + n.w / 2, y1: n.y + n.h / 2, t: 0, life: .2 }); hurtEnemy(n, false); } } } } }
  if (P.coil) { const c = P.coil; c.t -= dt; c.a += dt * 11; if (c.t <= 0) P.coil = null; else {
    for (const e of enemies) if (e.alive && !ghostly(e) && !(c.hit.get(e.id) > songPos) && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < c.r + Math.max(e.w, e.h) / 2) { c.hit.set(e.id, songPos + .3); hurtEnemy(e, false); addFx("perkfx", PF.splash, e.x + e.w / 2, e.y + e.h / 2, 34, { life: .2 }); if (has("biryong")) P.airDash = Math.max(P.airDash, baseAir()); }
    for (const b of bullets) if (!b.friendly && Math.hypot(b.x - cx, b.y - cy) < c.r) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 18, { life: .2 }); }   // shots break on its coils
    if (Math.random() < dt * 40) { const a = c.a + (Math.random() - .5) * .6, rr = c.r * (.7 + Math.random() * .3); parts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * .8, vx: -Math.sin(a) * 90, vy: Math.cos(a) * 90 - 20, life: .45, max: .45, c: Math.random() < .2 ? SEAL : LV.pal.fig, s: 2 + Math.random() * 3 }); }
    if (has("yeomryong2") && (c.fd = (c.fd || 0) + Math.hypot(P.vx, P.vy) * dt) > 46) { c.fd = 0; bullets.push({ x: cx, y: P.y + P.h - 8, vx: 0, vy: 0, friendly: true, fire: true, pierce: true, r: 8, life: .8, owner: null }); } } }
}
function nearestFoes(x, y, n, r) { return enemies.filter(e => e.alive && !ghostly(e) && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r).sort((a, b) => Math.hypot(a.x + a.w / 2 - x, a.y + a.h / 2 - y) - Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y)).slice(0, n); }
function shintong(d) { // what an 일격 sets loose
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  const tipx = cx + d.x * 30, tipy = cy + d.y * 26;
  if (has("noejeon") && chr("munyeo")) { // 뇌성 방울: the bell's peal turns to lightning around her
    for (const e of nearestFoes(cx, cy, 6, has("noejeong") ? 210 : 150)) { boltFx(cx, cy - 10, e.x + e.w / 2, e.y + e.h / 2, .3, 16); e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .2 : .6); hurtEnemy(e, has("noesin") && e.type !== "b"); }
    ringFx(cx, cy, has("noejeong") ? 210 : 150, "rgba(42,84,180,.6)", .3); if (SPR.mfx) addFx("mfx", 7, cx, cy - 6, 120, { life: .38, grow: .3, ay: .5 }); }
  else if (has("noejeon") && !chr("posu")) { // the blade turns to lightning and runs through everyone standing in its line
    const hd = Math.abs(d.x) < .25 && P.onGround ? { x: P.face, y: 0 } : d, L = 190 * (has("noejeong") ? 1.4 : 1);
    if (foesInLine(cx, cy, hd, L).length) boltLunge(hd, L, false);
    else addFx("slashfx", SF.bolt, tipx, tipy, 30, { life: .2, rot: Math.random() * 6.28, grow: .3 }); }
  if (has("bigeom")) P.orbit = { t: 2.2, n: has("mangeom") ? 3 : 1, a: Math.atan2(d.y, d.x), hit: new Map() };   // guardian swords circle the swordsman
  if (has("wolgwang") && chr("munyeo")) { const r = has("manwol") ? 150 : 110;   // 달맞이 굿: a ring of moonlight spreads from her
    for (const e of enemies) if (e.alive && !ghostly(e) && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < r + Math.max(e.w, e.h) / 2) { hurtEnemy(e, false); e.stunT = Math.max(e.stunT || 0, (has("manwol") ? 1 : .55) * (e.type === "b" ? .35 : 1)); }
    ringFx(cx, cy, r, "rgba(242,239,230,.95)", .45); ringFx(cx, cy, r * .85, "rgba(217,165,32,.7)", .4); if (SPR.mfx) addFx("mfx", 6, cx, cy, r * 2.1, { life: .5, grow: .45, ay: .5 }); if (has("ssangwol")) ringFx(cx, cy, r * 1.25, "rgba(242,239,230,.7)", .6); }
  else if (has("wolgwang") && !chr("posu")) { const sc = has("manwol") ? 1.5 : 1, left = d.x < -.2, ang = Math.atan2(d.y, Math.abs(d.x) < .2 ? .001 : Math.abs(d.x));
    addFx("slashfx", SF.moon, cx + d.x * 40, cy + d.y * 34, 92 * sc, { life: .32, flip: left, rot: left ? -ang : ang, grow: .25 });
    if (has("ssangwol")) addFx("slashfx", SF.moon, cx - d.x * 40, cy - d.y * 34, 92 * sc, { life: .32, flip: !left, rot: left ? -ang : ang, grow: .25 }); }
  if (has("suhoryeong") && (P.strikeN = (P.strikeN || 0) + 1) % (has("suhosin") ? 2 : 3) === 0 && !P.ward) { P.ward = true; Music.sfx("lantern"); }
}
// ---------- 번개 돌진 · 공명 effects ----------
function foesInLine(x, y, d, L) { // who stands within reach of a straight line
  return enemies.filter(e => { if (!e.alive || ghostly(e)) return false; const ex = e.x + e.w / 2 - x, ey = e.y + e.h / 2 - y, t = ex * d.x + ey * d.y;
    return t > -10 && t < L && Math.abs(ex * d.y - ey * d.x) < Math.max(e.w, e.h) / 2 + 16; });
}
function boltLunge(d, L, isDash) { // 뇌전검·뇌섬: gone in a flash to the far end of the line, cutting all between
  const m = Math.hypot(d.x, d.y) || 1; d = { x: d.x / m, y: d.y / m };
  const x0 = P.x + P.w / 2, y0 = P.y + P.h / 2; let go = 0;
  for (let t = 6; t <= L; t += 6) { if (rectSolid(P.x + d.x * t, P.y + d.y * t, P.w, P.h)) break; go = t; }
  const hit = foesInLine(x0, y0, d, go + 20);
  if (!isDash && hit.length) { const far = Math.max(...hit.map(e => (e.x + e.w / 2 - x0) * d.x + (e.y + e.h / 2 - y0) * d.y)); go = Math.min(go, far + 46); }   // the blade stops just past the last one
  for (let t = 0; t < go; t += 26) ghosts.push({ x: P.x + d.x * t, y: P.y + d.y * t, face: d.x < 0 ? -1 : 1, age: t / go * .1, life: .3 });
  P.x += d.x * go; P.y += d.y * go; if (Math.abs(d.x) > .2) P.face = Math.sign(d.x);
  P.vx = d.x * maxv() * 1.2; P.vy = Math.min(P.vy, d.y * 300); P.invT = Math.max(P.invT || 0, .28); P.dashHit = new Set();
  const x1 = P.x + P.w / 2, y1 = P.y + P.h / 2;
  boltFx(x0, y0, x1, y1, .45, 24); boltFx(x0, y0 - 6, x1, y1 + 4, .3, 12);
  for (const e of hit) { hurtEnemy(e, has("noesin") && e.type !== "b"); if (has("noego")) e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .25 : .9);
    addFx("perkfx", PF.spark, e.x + e.w / 2, e.y + e.h / 2, 54, { life: .25, rot: Math.random() * 6.28, grow: .6 });
    boltFx(e.x + e.w / 2, e.y - 40, e.x + e.w / 2, e.y + e.h / 2, .2, 8); }
  for (let i = 0; i < 18; i++) { const t = Math.random(), a = Math.random() * 6.28, v = 60 + Math.random() * 220; parts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .3, max: .3, c: i % 3 ? "#2a54b4" : "#9fc0ff", s: 1.5 + Math.random() * 2.5 }); }
  flash = Math.max(flash, .07); shake = Math.max(shake, 6); hitstop = Math.max(hitstop, hit.length ? .06 : 0); Music.sfx("strike");
}
let bolts = [];
function boltFx(x0, y0, x1, y1, life, w) { // a jagged lightning stroke, re-forked every frame it lives
  bolts.push({ x0, y0, x1, y1, t: 0, life, w });
}
// painted guide strokes (guide sheet): 0-2 indigo dash/line/ring, 3-5 vermilion, 6 wash, 7 black line, 8 black ring
const nightNow = () => !!(LV && LV.pal.night) || !!(P && (P.focus || killCam > 0) && state === "play");
const GSET = col => col === SEAL ? [3, 4, 5, false] : col === JJOK ? [0, 1, 2, nightNow()] : [7, 7, 8, nightNow()];   // on the inverted night the indigo and black strokes turn pale
function guideSprite(i, x, y, ang, w, h, inv) { const S = SPR.guide, f = S.f[i]; ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(inv && S.inv ? S.inv : S.img, f.x, f.y, f.w, f.h, -w / 2, -h / 2, w, h); ctx.restore(); }
// ---------- brush strokes for guide lines: ink dabs, dry-brush lines and rings instead of clean vector marks ----------
const hrnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };   // stable noise, so strokes do not shimmer
function inkDab(x, y, ang, len, w, col) { // one press of a dry brush: a wet core and bristle hairs that split and run out at different lengths
  const sd = (x * 13.7 + y * 7.1) | 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-len * .45, 0); ctx.quadraticCurveTo(-len * .1, -w * .38, len * .3, -w * .08); ctx.quadraticCurveTo(-len * .05, w * .32, -len * .45, 0); ctx.fill();   // the wet heart of the stroke
  const a0 = ctx.globalAlpha;
  for (let k = 0; k < 5; k++) { const o = (k - 2) * w * .2 + (hrnd(sd, k) - .5) * w * .1, st = -len * (.5 - hrnd(sd, k + 9) * .25), en = len * (.15 + hrnd(sd, k + 3) * .4);
    ctx.globalAlpha = a0 * (.45 + hrnd(sd, k + 6) * .5); ctx.lineWidth = w * (.12 + hrnd(sd, k + 2) * .12); ctx.beginPath(); ctx.moveTo(st, o * .7); ctx.quadraticCurveTo((st + en) / 2, o, en, o * 1.25); ctx.stroke(); }   // bristles
  ctx.restore(); ctx.globalAlpha = a0;
}
function brushLine(x0, y0, x1, y1, col, w, dashed, seed = 0) { // dashed: a trail of separate dabs; solid: overlapping dabs with dry gaps at the tail
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 2) return;
  if (SPR.guide) { const [di, li, , inv] = GSET(col), a = Math.atan2(dy, dx);   // the painted strokes
    if (dashed) { const f = SPR.guide.f[di], len = w * 6.5, n = Math.max(1, Math.floor(L / (len * 1.3))); for (let i = 0; i < n; i++) { const t = (i + .5) / n, k = .85 + hrnd(seed + i, 2) * .3; guideSprite(di, x0 + dx * t, y0 + dy * t, a + (hrnd(seed + i, 1) - .5) * .1, len * k, len * k * f.h / f.w, inv); } }
    else guideSprite(li, (x0 + x1) / 2, (y0 + y1) / 2, a, L, w * 2.8, inv);
    return; } const a = Math.atan2(dy, dx), step = dashed ? 19 : 8, n = Math.max(2, Math.floor(L / step)), a0 = ctx.globalAlpha;
  for (let i = 0; i <= n; i++) { const t = i / n, r1 = hrnd(seed + i, 1), r2 = hrnd(seed + i, 2); if (!dashed && t > .75 && r1 < (t - .75) * 2.4) continue;   // the brush runs dry toward the end
    const taper = dashed ? 1 - t * .45 : Math.min(1, t * 6, (1 - t) * 3 + .35), off = (r2 - .5) * w * .5;
    ctx.globalAlpha = a0 * (dashed ? (.75 + r1 * .25) : (.55 + r1 * .35));
    inkDab(x0 + dx * t - Math.sin(a) * off, y0 + dy * t + Math.cos(a) * off, a + (r2 - .5) * .18, (dashed ? 15 : 14) * (.8 + r1 * .5), w * taper * (.85 + r2 * .5), col); }
  ctx.globalAlpha = a0;
}
function brushRing(x, y, r, col, w, seed = 0) { // a circle swept by a dry brush: parallel hairs that start and stop raggedly, never quite closing
  if (SPR.guide) { const [, , ri, inv] = GSET(col); guideSprite(ri, x, y, hrnd(seed, 1) * 6.28, r * 2.3, r * 2.3, inv); return; }
  const a0 = ctx.globalAlpha; ctx.strokeStyle = col; ctx.lineCap = "round";
  const st = hrnd(seed, 1) * 6.28, span = 5.3 + hrnd(seed, 2) * .6;
  for (let k = 0; k < 6; k++) { const rr = r + (k - 2.5) * w * .32, s0 = st + hrnd(seed + k, 3) * .5, s1 = st + span - hrnd(seed + k, 4) * 1.1;
    ctx.globalAlpha = a0 * (.4 + hrnd(seed + k, 5) * .55); ctx.lineWidth = w * (.22 + hrnd(seed + k, 6) * .2); ctx.beginPath(); ctx.arc(x, y, rr, s0, s1); ctx.stroke(); }
  ctx.globalAlpha = a0 * .85; ctx.lineWidth = w * .55; ctx.beginPath(); ctx.arc(x, y, r, st + .2, st + span * .55); ctx.stroke();   // the loaded first half of the sweep
  ctx.globalAlpha = a0; ctx.lineCap = "butt";
}
function inkWash(x, y, w, h, col, seed = 0) { // a zone washed in with horizontal dry strokes, ragged at the edges
  if (SPR.guide) { guideSprite(6, x + w / 2, y + h / 2, 0, w * 1.08, h * 1.15, false); return; }
  const n = Math.max(2, Math.round(h / 9)), a0 = ctx.globalAlpha; ctx.fillStyle = col;
  for (let i = 0; i < n; i++) { const yy = y + (i + .5) * h / n, l = x + hrnd(seed + i, 1) * w * .08, r = x + w - hrnd(seed + i, 2) * w * .1, th = h / n * (1.1 + hrnd(seed + i, 3) * .5);
    ctx.globalAlpha = a0 * (.7 + hrnd(seed + i, 4) * .3); ctx.beginPath(); ctx.moveTo(l, yy - th * .3); ctx.quadraticCurveTo((l + r) / 2, yy - th * .62, r, yy - th * .15); ctx.quadraticCurveTo(r - w * .05, yy + th * .5, l + w * .04, yy + th * .45); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha = a0;
}
function drawBolts() {
  if (!bolts.length) return;
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const b of bolts) { const k = 1 - b.t / b.life, len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0), n = Math.max(3, Math.round(len / 18)), nx = -(b.y1 - b.y0) / (len || 1), ny = (b.x1 - b.x0) / (len || 1);
    const pts = [[b.x0, b.y0]]; for (let i = 1; i < n; i++) { const t = i / n, j = (Math.random() - .5) * b.w; pts.push([b.x0 + (b.x1 - b.x0) * t + nx * j, b.y0 + (b.y1 - b.y0) * t + ny * j]); } pts.push([b.x1, b.y1]);
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); };
    const dark = LV && LV.pal.night;   // on paper the bolt is ink-blue with a white core; at night it glows
    path(); ctx.strokeStyle = dark ? `rgba(120,160,255,${.35 * k})` : `rgba(20,36,90,${.28 * k})`; ctx.lineWidth = 14 * k + 3; ctx.stroke();
    path(); ctx.strokeStyle = dark ? `rgba(170,200,255,${.9 * k})` : `rgba(42,84,180,${.95 * k})`; ctx.lineWidth = 5 * k + 1.5; ctx.stroke();
    path(); ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1.8 * k + .6; ctx.stroke();
    if (Math.random() < .5) { const q = pts[(Math.random() * pts.length) | 0], a = Math.random() * 6.28, r = 14 + Math.random() * 18; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r); ctx.strokeStyle = `rgba(42,84,180,${.8 * k})`; ctx.lineWidth = 1.6; ctx.stroke(); } }   // stray forks
  ctx.restore();
}
function fireFx(x, y, r) { // 화 공명: a ring of flame thrown out from where the dash stopped
  addFx("perkfx", PF.bloom, x, y, r * 1.6, { life: .4, grow: .6, a: .55 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; bullets.push({ x: x + Math.cos(a) * r * .35, y: y + Math.sin(a) * r * .25, vx: Math.cos(a) * r * 2.2, vy: Math.sin(a) * r * 1.4 - 40, friendly: true, fire: true, pierce: true, r: 10, life: .38, noHit: true, owner: null }); }
  for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 260; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: .5, max: .5, c: i % 3 ? "#e8752a" : "#ffd27a", s: 2 + Math.random() * 3 }); }
}
function shadeFx(x, y, n) { // 영 공명: smoke of ink drifting off a shadow
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 30 + Math.random() * 120; parts.push({ x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 18, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: .6, max: .6, c: i % 4 ? "rgba(40,34,52,.55)" : "rgba(120,100,150,.6)", s: 4 + Math.random() * 6 }); }
}
function resDashEnd() {
  const x = P.x + P.w / 2, y = P.y + P.h / 2;
  if (has("hwayak")) kegs.push({ x, y: P.y + P.h, at: songPos + Music.beatLen });
  if (res("hwa", 4)) { const r = res("hwa", 6) ? 120 : 75; fireFx(x, y, r); shake = Math.max(shake, 4); Music.sfx("kill");
    for (const e of enemies) if (e.alive && !ghostly(e) && Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) < r + Math.max(e.w, e.h) / 2) hurtEnemy(e, res("hwa", 6) && e.type !== "b"); }
  if (res("yeong", 2)) P.invT = Math.max(P.invT || 0, .3);
  if (res("yeong", 4)) { clones.push({ x, y: P.y + P.h, face: P.face, t: .3 }); shadeFx(x, y, 10); }
}
function resKill(e) {
  const x = e.x + e.w / 2, y = e.y + e.h / 2;
  if (res("hyeol", 2) && (run.hk = (run.hk || 0) + 1) % 15 === 0 && run.breath < breathCap()) { run.breath++; setHud(); toast("혈 공명 · 숨 하나를 되찾았다"); }
  if (res("hyeol", 4)) { const ts = nearestFoes(x, y, res("hyeol", 6) ? 3 : 1, 300).filter(o => o !== e);   // the blood flies on as thorns
    for (const t of ts) { const dx = t.x + t.w / 2 - x, dy = t.y + t.h / 2 - y, dd = Math.hypot(dx, dy) || 1; bullets.push({ x, y, vx: dx / dd * 950, vy: dy / dd * 950, friendly: true, thorn: true, r: 6, life: .5, owner: null }); } }
  if (res("hyeol", 6)) P.invT = Math.max(P.invT || 0, .3);
}
function resFx(k, line) { const S = SCHOOLS[k]; addFx("hud", HUD.spark, P.x + P.w / 2, P.y + P.h / 2, 90, { life: .4 }); toast(`${S.name} 공명 · ${line}`); }
function flow(kind) { // 기세: different moves chained close together build up momentum
  if (!has("gise") || P.flowReady) return;
  const gap = songPos - (P.flowAt ?? -9);
  if (gap > 1.5) P.flowN = 0;   // a pause of more than a breath breaks the chain
  if (kind !== P.flowKind) P.flowN = (P.flowN || 0) + 1;
  P.flowKind = kind; P.flowAt = songPos;
  if (P.flowN >= (has("ilgi") ? 3 : 4)) { P.flowReady = true; ringFx(P.x + P.w / 2, P.y + P.h / 2, 70, "rgba(195,22,28,.85)", .4); Music.sfx("lantern"); }
}
function findHook() {
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2; let best = null, bs = 1e9;
  if (has("d_sasl")) for (const e of enemies) { if (!e.alive || ghostly(e)) continue; const ex = e.x + e.w / 2, ey = e.y + e.h / 2, d = Math.hypot(ex - cx, ey - cy);
    if (d > HOOK_R || d < 40 || !los(cx, cy, ex, ey)) continue; const sc = d - 120; if (sc < bs) { bs = sc; best = { x: ex, y: ey, enemy: e }; } }
  for (const p of LV.points) {
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d > HOOK_R * (has("cheollyeon") ? 2 : has("baram") ? 1.4 : 1) * (res("pung", 2) ? 1.25 : 1) || d < 24 || !los(cx, cy, p.x, p.y)) continue;
    const s = d - (dx * P.face > 0 ? 70 : 0) - (dy < 0 ? 40 : 0);
    if (s < bs) { bs = s; best = p; }
  }
  return best;
}
function frameInput(rdt) {
  if (bossIntro) { press.jump = press.dash = press.hook = 0; slashReq = null; return; }   // the entrance card holds the hands
  if (press.jump && P.onGround && axis().y > .5 && onLedge(P)) { P.dropT = .25; P.y += 3; P.onGround = false; press.jump = 0; } // down + jump: drop through a ledge
  if (press.jump) P.jumpBuf = 0.18;
  if (slashReq) { doSlash(slashReq); slashReq = null; }
  if (press.hook && hookCand && P.hookCd <= 0 && hookCand.enemy) { // 연사슬: the line hooks a foe and drags it in
    const e = hookCand.enemy, dx = Math.sign(e.x + e.w / 2 - P.x - P.w / 2) || 1; moveX(e, -dx * Math.min(Math.abs(e.x + e.w / 2 - P.x - P.w / 2) - 30, 260)); e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .3 : 1);
    hurtEnemy(e, false); beams.push({ x0: P.x + P.w / 2, y0: P.y + 12, x1: e.x + e.w / 2, y1: e.y + e.h / 2, t: 0, life: .2 }); P.hookCd = .45; Music.sfx("hook"); press.hook = 0; }
  if (press.hook && hookCand && P.hookCd <= 0 && has("yeonbal")) { // 연발판: the kite is a springboard
    P.vy = -940; P.vx *= .6; P.airDash = Math.max(P.airDash, baseAir()); P.djN = 0; P.hookCd = .3; heroFx("wind", hookCand.x, hookCand.y, 1); Music.sfx("hook"); press.hook = 0; }
  if (press.hook && hookCand && P.hookCd <= 0) { // 연: a sharp kick toward the kite and up — then the swordsman is free again
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2, dx = hookCand.x - cx, dy = hookCand.y - cy, d = Math.hypot(dx, dy) || 1, lb = (has("baram") ? 1.2 : 1) * (has("deungun") ? 1.15 : 1);
    P.dashT = 0; run.hooked = true; flow("hook"); P.focus = false; Music.muffle(false); Music.sfx("hook"); heroFx("wind", hookCand.x, hookCand.y, 1);
    P.vx = dx / d * 620 * lb; P.vy = Math.min(dy / d * 620, 0) * lb - 560 * lb; P.onGround = false; P.coyote = 0; P.jumpBuf = 0;
    P.kiteFlash = { x0: cx, y0: cy, x1: hookCand.x, y1: hookCand.y, t: .18 };   // the string snaps taut for a blink
    if (has("d_kite")) P.kiteAim = .12;
    if (has("deungun")) P.djN = 0; P.hookCd = .35; P.airDash = has("yeonsa") ? 2 : baseAir(); if (has("yeonbi")) { P.invT = Math.max(P.invT || 0, .5); P.dashCd = 0; }
    if (has("heukryong")) { const big = has("ssangryong2");
      P.coil = { t: big ? 2 : 1.3, max: big ? 2 : 1.3, n: big ? 2 : 1, r: big ? 118 : 88, a: 0, hit: new Map() };
      addFx("perkfx", PF.spin, cx, cy, P.coil.r * 2.2, { life: .4, grow: .4, a: .8 }); shake = Math.max(shake, 5);
      for (const e of nearestFoes(cx, cy, 9, P.coil.r * 1.3)) { hurtEnemy(e, false); e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .15 : .5); addFx("perkfx", PF.splash, e.x + e.w / 2, e.y + e.h / 2, 44, { life: .25 }); } }
    if (Math.abs(P.vx) > 40) P.face = Math.sign(P.vx);
    if (has("yeoncham")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 120) hurtEnemy(e, false); addFx("fx", FX.slashB, cx, cy, 80, { life: .3 }); } }
  if (press.dash && P.returnT > 0 && !P.focus) {   // 회선: back along the line, cutting again
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2, dx = P.returnTo.x - cx, dy = P.returnTo.y - cy, L = Math.hypot(dx, dy);
    if (L > 20) { P.returnT = 0; P.airDash++; P.aimDash = true; P.retDash = true; P.aimedUntil = songPos + .45;
      if (startDash({ x: dx / L, y: dy / L }, true)) { P.dashT = Math.min(.3, L / DASHV); ringFx(cx, cy, 50, "rgba(195,22,28,.8)", .25); } else { P.aimDash = false; P.retDash = false; }
      press.dash = 0; } }
  if (press.dash && !oath("hyeon") && !P.focus) {
    if (P.dashCd <= 0 && (P.onGround || P.hook || P.airDash > 0 || (P.wall && has("d_wall"))) && ((P.ki || 0) > .06 || mode === "tutorial")) { P.focus = true; P.focusT = 0; P.focusGround = P.onGround || !!P.wall; Music.muffle(true); }   // tap: dash now · hold: slow and aim
    press.dash = 0;
  }
  if (P.kiteFlash && (P.kiteFlash.t -= rdt) <= 0) P.kiteFlash = null;
  if (P.kiteAim > 0 && (P.kiteAim -= rdt) <= 0 && !P.onGround && !P.focus) { P.focus = true; P.focusTap = true; P.focusT = 0; Music.muffle(true); }   // 연 조준
  if (P.focus && P.focusT < TAP_T && P.focusT + rdt >= TAP_T && has("d_myeong")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2;   // 명경지수: the ones nearby stop with the aim
    for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 300) e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .2 : .8);
    ringFx(cx, cy, 120, "rgba(39,70,106,.7)", .4); }
  if (!P.focus && P.onGround) P.ki = Math.min(1, (P.ki || 0) + rdt * .9);   // 기력 comes back with the feet on the ground
  if (P.focus && mode !== "tutorial" && P.focusT > TAP_T) P.ki = Math.max(0, (P.ki || 0) - rdt / (has("d_jeong") ? 2.4 : 1.6));   // and drains while time is held
  if (P.focus) { P.focusT += rdt;
    const release = P.focusTap ? press.dash : !held.dash, grounded = P.onGround && !P.focusGround;
    if (release || P.focusT > focusLen() || grounded || (P.ki <= 0 && mode !== "tutorial")) { const tap = !P.focusTap && P.focusT < TAP_T;   // a tap is a plain quick dash: no slow, no 일격, shots still hit
      P.focus = false; P.focusTap = false; P.focusGround = false; Music.muffle(false); P.tapDash = tap; if (!tap) P.aimedUntil = songPos + .45;
      P.beatDash = false; P.cloudT = 0; if (!tap && !P.onGround) P.aimChain = (P.aimChain || 0) + 1;   // shorter next time, until the feet touch ground
      if (!tap && wrule() === "ssang" && (P.gise || 0) >= 3 && songPos - (P.giseAt ?? -9) < 3) { P.giseDash = P.gise; P.gise = 0; if (!P.onGround) P.airDash++; ringFx(P.x + P.w / 2, P.y + P.h / 2, 60, "rgba(195,22,28,.9)", .3); }   // 기세: the built-up momentum rides the dash
      P.chargeK = has("d_charge") && P.focusT < .35 ? .6 : 1; P.chargeFull = has("d_charge") && P.focusT >= .8;   // 축기: full → a wave flies on; too early → a short dash
      if (P.chargeFull) { ringFx(P.x + P.w / 2, P.y + P.h / 2, 70, "rgba(195,22,28,.9)", .3); shake = Math.max(shake, 5); }
      if (!tap && (run.qi || 0) >= 100 && mode !== "tutorial" && chungo()) {} else {
      if (chr("munyeo") && has("m_talis")) talismans(aimDir());
      if (chr("posu") && posuShot()) {}
      else if (!(!tap && has("d_sunbo") && sunbo())) { P.aimDash = true; if (!startDash(null, true)) P.aimDash = false; } } } }
  press.jump = press.dash = press.hook = 0;
  P.jumpBuf = Math.max(0, P.jumpBuf - rdt);
}
const approach = (v, t, a) => v < t ? Math.min(t, v + a) : Math.max(t, v - a);
function stepPlayer(dt) {
  const a = axis(), ix = a.x > 0.3 ? 1 : a.x < -0.3 ? -1 : 0;
  P.invT = Math.max(0, (P.invT || 0) - dt); P.dashInvT = 0; P.offBal = Math.max(0, (P.offBal || 0) - dt); P.returnT = Math.max(0, (P.returnT || 0) - dt); P.floatT = Math.max(0, (P.floatT || 0) - dt); for (const g of LV.targets) { if (g.t > 0) g.t -= dt;
    else if (!META.firsts.target && mode !== "tutorial" && Math.hypot(g.x - P.x, g.y - P.y) < 260) { META.firsts.target = 1; saveMeta(); toast("과녁 · 대시로 베면 공중 대시가 다시 찬다"); } }
  if (P.echo && (P.echo.t -= dt) <= 0) { const o = P.echo, dx = o.x1 - o.x0, dy = o.y1 - o.y0, L = Math.hypot(dx, dy) || 1, d = { x: dx / L, y: dy / L }; P.echo = null;   // the soul runs the same line
    for (const e of foesInLine(o.x0, o.y0, d, L)) hurtEnemy(e, e.type !== "b"); beams.push({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, t: 0, life: .3, red: true, w: 1.6 });
    if (SPR.mfx) addFx("mfx", 8, o.x0, o.y0, 60, { life: .3, ay: .5, a: .7 }); }
  if (P.wardT > 0) { P.wardT -= dt; const cx = P.x + P.w / 2, cy = P.y + P.h / 2;   // 검막: shots that come near are cut out of the air
    for (const b of bullets) if (!b.friendly && b.life > 0 && Math.hypot(b.x - cx, b.y - cy) < 95) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 18, { life: .2 }); }
    if ((P.wardFx = (P.wardFx || 0) - dt) <= 0) { P.wardFx = .3; addFx("slashfx", SF.guard, cx, cy, 120, { life: .3, grow: .2, a: .55 }); } }
  stepGuards(dt); stepKegs();
  if (P.dashT > 0 && !bossAlive()) for (const d of drumsInPlay()) if (Math.abs(P.x + P.w / 2 - d.x) < 24 && P.y + P.h > d.y - d.h && P.y < d.y) cutDrum(d); P.landT = Math.max(0, (P.landT || 0) - dt); P.dropT = Math.max(0, (P.dropT || 0) - dt); P.dashCd = Math.max(0, P.dashCd - dt); if (P.dashCd <= 0) P.spare = true; P.slashCd = Math.max(0, P.slashCd - dt); P.hookCd = Math.max(0, P.hookCd - dt); P.wallLock = Math.max(0, P.wallLock - dt);
  if (P.hook) {
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2, dx = P.hook.x - cx, dy = P.hook.y - cy, d = Math.hypot(dx, dy);
    if (d < 30) { const lb = (has("baram") ? 1.25 : 1) * (has("deungun") ? 1.2 : 1); if (has("deungun")) P.djN = 0; P.vx = dx / d * 700 * lb; P.vy = dy / d * 700 * lb - 260 * lb; P.hook = null; P.hookCd = 0.25; P.airDash = has("yeonsa") ? 2 : baseAir(); if (has("yeonbi")) { P.invT = Math.max(P.invT || 0, .5); P.dashCd = 0; }
      if (has("heukryong")) { const big = has("ssangryong2");   // 흑룡 bursts out as the kite lets go, then coils
        P.coil = { t: big ? 2 : 1.3, max: big ? 2 : 1.3, n: big ? 2 : 1, r: big ? 118 : 88, a: 0, hit: new Map() };
        addFx("perkfx", PF.spin, P.x + P.w / 2, P.y + P.h / 2, P.coil.r * 2.2, { life: .4, grow: .4, a: .8 }); shake = Math.max(shake, 5);
        for (const e of nearestFoes(P.x + P.w / 2, P.y + P.h / 2, 9, P.coil.r * 1.3)) { hurtEnemy(e, false); e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .15 : .5); addFx("perkfx", PF.splash, e.x + e.w / 2, e.y + e.h / 2, 44, { life: .25 }); } } if (Math.abs(P.vx) > 40) P.face = Math.sign(P.vx); }
    else {
      P.vx = dx / d * 1050; P.vy = dy / d * 1050;
      if (moveX(P, P.vx * dt) | moveY(P, P.vy * dt)) { P.hook = null; P.vx *= 0.3; P.vy *= 0.3; }
      ghost(0.02); return;
    }
  }
  if (P.focus && (has("d_hover") || P.focusGround)) { P.vx = 0; P.vy = 0; }   // 체공
  if (P.dashT > 0) {
    P.dashT -= dt; P.vx = P.dashDir.x * DASHV; P.vy = P.dashDir.y * DASHV;
    P.trailD = (P.trailD || 0) + DASHV * dt;
    if (P.trailD > (has("hwaryong") ? 26 : 44)) { P.trailD = 0; const tx = P.x + P.w / 2, ty = P.y + P.h / 2;
      if (has("hwaryong")) bullets.push({ x: tx + (Math.random() - .5) * 8, y: (P.onGround ? P.y + P.h - 2 : P.y + P.h * .6), vx: 0, vy: P.onGround ? 0 : -20, friendly: true, fire: true, flame: true, ground: P.onGround, big: has("yeomryong"), r: has("yeomryong") ? 18 : 10, pierce: true, life: (has("yeomryong") ? 1.8 : .9) * (.85 + Math.random() * .3), owner: null });
      if (has("pungsin")) bullets.push({ x: tx, y: ty, vx: 0, vy: 0, friendly: true, tornado: true, big: has("daepung"), r: has("daepung") ? 26 : 12, pierce: true, noHit: !has("hwapung"), life: has("daepung") ? 1.4 : .7, owner: null });
      if (has("mupung")) for (const o of bullets) if (!o.friendly && !o.slowed && Math.hypot(o.x - tx, o.y - ty) < 300) { o.slowed = true; o.vx *= .5; o.vy *= .5; } }
    for (const g of LV.targets) if (g.t <= 0 && Math.hypot(g.x - P.x - P.w / 2, g.y - P.y - P.h / 2) < 30) breakTarget(g);
    if (P.aimDash && has("m_wind") && (P.windD = (P.windD || 0) + DASHV * dt) > 36) { P.windD = 0;   // 회오리 길
      bullets.push({ x: P.x + P.w / 2, y: P.y + P.h / 2, vx: 0, vy: 0, friendly: true, tornado: true, r: 16, pierce: true, life: .8, owner: null }); }
    if (P.aimDash) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2, wide = P.beatDash ? 90 : P.giseDash ? 75 : has("d_far") ? 60 : 30;
      for (const e of enemies) if (e.alive && !ghostly(e) && !P.dashHit.has(e.id) && Math.abs(e.x + e.w / 2 - cx) < wide + e.w / 2 && Math.abs(e.y + e.h / 2 - cy) < wide + e.h / 2) { P.dashHit.add(e.id); dashHurt(e); }   // 관통: a wider cut
      if (has("d_reflect") || chr("munyeo")) for (const b of bullets) if (!b.friendly && !b.noReflect && b.life > 0 && Math.hypot(b.x - cx, b.y - cy) < 44) {   // 역탄: the shot turns on its shooter
        const o = b.owner, sp = Math.max(420, Math.hypot(b.vx, b.vy) * 1.4); b.friendly = true; b.pierce = true; b.life = 3; b.g = 0; b.home = 0; b.boom = 0;
        if (o && o.alive) { const dx = o.x + o.w / 2 - b.x, dy = o.y + o.h / 2 - b.y, L = Math.hypot(dx, dy) || 1; b.vx = dx / L * sp; b.vy = dy / L * sp; } else { const L = Math.hypot(b.vx, b.vy) || 1; b.vx = -b.vx / L * sp; b.vy = -b.vy / L * sp; }
        addFx("hud", HUD.spark, b.x, b.y, 22, { life: .2 }); }
      if (has("d_tan")) for (const b of bullets) if (!b.friendly && Math.hypot(b.x - cx, b.y - cy) < 40) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 20, { life: .2 }); } }   // 탄베기
    const pb = P.y + P.h; let hx = moveX(P, P.vx * dt), hy = moveY(P, P.vy * dt); ghost(0.012);
    if (!hy && P.vy > 0 && !(P.dropT > 0)) { const top = ledgeBelow(P, pb); if (top != null) { P.y = top - P.h - .001; hy = true; } }
    if (has("dansung")) for (let i = LV.lasers.length - 1; i >= 0; i--) { const l = LV.lasers[i]; if (Math.abs(P.x + P.w / 2 - l.x) < 16 && P.y + P.h > l.y0 && P.y < l.y1) { LV.lasers.splice(i, 1); addFx("hud", HUD.spark, l.x, P.y + P.h / 2, 50, { life: .4 }); Music.sfx("clang"); } }
    if ((hx || hy) && P.aimDash && has("d_bounce") && !P.bounced && P.dashT > 0) {   // 반섬: one ricochet off the wall, the blade still out
      P.bounced = true; P.dashDir = { x: hx ? -P.dashDir.x : P.dashDir.x, y: hy ? -P.dashDir.y : P.dashDir.y }; P.dashT = Math.max(P.dashT, .1); if (Math.abs(P.dashDir.x) > .2) P.face = Math.sign(P.dashDir.x);
      addFx("hud", HUD.spark, P.x + P.w / 2, P.y + P.h / 2, 40, { life: .25 }); Music.sfx("clang"); shake = Math.max(shake, 3); hx = hy = false; }
    if (P.dashT <= 0 || hx || hy) { P.dashT = 0; P.vx = P.dashDir.x * maxv() * 1.35; P.vy = P.dashDir.y * 380; if (P.aimDash && has("d_ward")) P.wardT = 1;   // 검막
      if (P.aimDash && chr("munyeo")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
        if (has("m_bell")) { for (const e of nearestFoes(cx, cy, 9, 110)) e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .25 : 1); ringFx(cx, cy, 110, "rgba(217,165,32,.85)", .4); Music.sfx("lantern"); }   // 방울 굿
        if (has("m_moon")) { for (const e of nearestFoes(cx, cy, 9, 90)) hurtEnemy(e, false); for (const b of bullets) if (!b.friendly && Math.hypot(b.x - cx, b.y - cy) < 90) b.life = 0;   // 달맞이
          addFx("slashfx", SF.moon, cx, cy, 180, { life: .35, grow: .3, a: .8 }); }
        if (has("m_float")) P.floatT = .7;   // 강신
        if (has("m_soul") && P.dashFrom) P.echo = { x0: P.dashFrom.x, y0: P.dashFrom.y - P.h / 2, x1: cx, y1: cy, t: .35 }; }   // 넋 분신
      if (P.aimDash && P.chargeFull) { const d = P.dashDir, a = Math.atan2(d.y, d.x);   // 축기: the stored breath leaves the blade as a crescent
        bullets.push({ x: P.x + P.w / 2 + d.x * 20, y: P.y + P.h / 2 + d.y * 20, vx: d.x * 900, vy: d.y * 900, ang: a, friendly: true, moon: true, strike: true, pierce: true, r: 22, life: .38, owner: null }); Music.sfx("slash"); }
      P.chargeFull = false;
      if (P.aimDash && has("d_return") && !P.retDash && P.dashHit.size && P.dashFrom) { P.returnT = .6; P.returnTo = { x: P.dashFrom.x, y: P.dashFrom.y - P.h / 2 }; } P.retDash = false; P.chargeK = 1;
      P.iaiCut = false; P.ram = false; P.flowDash = false; P.aimDash = false; P.beatDash = false; P.tapDash = false; P.giseDash = 0; resDashEnd();
      if (P.reAim && !P.onGround && P.airDash > 0) { P.focus = true; P.focusTap = true; P.focusT = 0; Music.muffle(true); } P.reAim = false;   // 순환
      if (has("bungwang")) { const ct = has("yeongseom") ? .12 : .4; clones.push({ x: P.x + P.w / 2, y: P.y + P.h, face: P.face, t: ct }); if (has("cheonyeong") && P.dashFrom) clones.push({ x: P.dashFrom.x, y: P.dashFrom.y, face: P.face, t: ct }); }
      if (has("bunsin")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 75) hurtEnemy(e, false); addFx("fx", FX.slashB, cx, cy, 90, { life: .3 }); } }
  } else {
    if (P.wallLock <= 0) {
      if (P.onGround) P.vx = (ix && Math.sign(P.vx) === ix && Math.abs(P.vx) > maxv()) ? approach(P.vx, ix * maxv(), 1400 * dt) : approach(P.vx, ix * maxv(), (ix ? 2600 : 2400) * dt);
      else if (ix) P.vx = (Math.sign(P.vx) === ix && Math.abs(P.vx) > maxv()) ? approach(P.vx, ix * maxv(), 450 * dt) : approach(P.vx, ix * maxv(), 1800 * dt);
      else P.vx = approach(P.vx, 0, 320 * dt);
      if (ix) P.face = ix;
    }
    const jb = P.jumpBuf > 0;
    if (P.jumpBuf > 0) {
      if (P.onGround || P.coyote > 0) { P.vy = -JUMPV * (has("gyeonggong") ? 1.12 : 1) * (has("bisang2") ? 1.45 : 1) * (oath("hyeon") ? 1.3 : 1); if (has("bisang") && Math.abs(P.vx) > maxv() * .8) P.vx *= 1.3; heroFx("jump", P.x + P.w / 2, P.y + P.h + 2, P.face); P.onGround = false; P.coyote = 0; P.jumpBuf = 0; Music.sfx("jump"); }
      else if (P.wall || P.wallT > 0) { const wd = P.wall || P.wallMem; P.wallT = 0; P.vy = -600; P.vx = -wd * 380; P.face = -wd; P.wallLock = 0.15; P.jumpBuf = 0; P.wallBonus = 1; P.climbT = Math.max(P.climbT, 0.35); if (has("d_bisang")) { P.airDash = Math.max(P.airDash, baseAir() + 1); P.dashCd = 0; } Music.sfx("jump"); puff(wd > 0 ? P.x + P.w : P.x, P.y + P.h - 6, 6); heroFx("wall", P.x + P.w / 2 + wd * 10, P.y + P.h / 2, wd); }
      else if (P.wallBonus > 0) { P.wallBonus = 0; P.vy = -JUMPV * .92; P.jumpBuf = 0; Music.sfx("jump"); heroFx("air", P.x + P.w / 2, P.y + P.h + 4, P.face); }   // a wall kick buys one more jump
      else if ((has("d_jump") || chr("munyeo")) && (P.djN || 0) < 1 + (has("d_jump") && chr("munyeo") ? 1 : 0)) { P.vy = -JUMPV * .9; P.djN = (P.djN || 0) + 1; if (has("m_cloud")) P.cloudT = .3; heroFx("air", P.x + P.w / 2, P.y + P.h + 4, P.face); P.jumpBuf = 0; Music.sfx("jump"); addFx("hud", HUD.dust, P.x + P.w / 2, P.y + P.h, 26, { life: .35, a: .7 }); }
    }
    if (jb && P.jumpBuf === 0) flow("jump");
    let g = GRAV; if (P.vy < 0 && !held.jump && !P.wallLock && !P.climbing) g *= 2.1;
    if (P.floatT > 0 && !P.onGround) { g = 0; P.vy *= .85; }   // 강신: held up in the air
    if (has("cheongeun") && axis().y > .5 && !P.wall) g *= 2.2;
    if (has("d_glide") && held.jump && P.vy > 0 && !P.wall) { g *= .25; if (P.vy > 110) P.vy = 110; }   // 활공: hold jump to glide
    P.vy = Math.min(has("cheongeun") && axis().y > .5 ? 1400 : 1000, P.vy + g * dt);
    if (P.wall && P.vy > 0 && ix === P.wall) P.vy = Math.min(P.vy, 130);
    // wall run: pushing into a wall while airborne carries you up it for a moment
    P.climbing = !!(P.wall && ix === P.wall && P.climbT > 0 && !P.wallLock);
    if (P.climbing) { P.vy = Math.min(P.vy, -CLIMBV); P.climbT -= dt; if (Math.random() < .3) puff(P.wall > 0 ? P.x + P.w : P.x, P.y + P.h - 4, 1); }
    moveX(P, P.vx * dt);
    if (omen("yeokpung")) moveX(P, -(P.onGround ? 45 : 85) * dt);   // 역풍 blows back toward the start
    const pb = P.y + P.h; P.lastVy = P.vy;
    if (moveY(P, P.vy * dt)) P.vy = 0;
    else if (P.vy > 0 && !(P.dropT > 0)) { const top = ledgeBelow(P, pb); if (top != null) { P.y = top - P.h - .001; P.vy = 0; } }
  }
  const was = P.onGround;
  P.onGround = P.vy >= 0 && (rectSolid(P.x, P.y + P.h, P.w, 2) || (!(P.dropT > 0) && onLedge(P)));
  if (P.onGround) { P.airT = 0; P.aimChain = 0; P.airCutUsed = false; if (P.chain && (P.landG = (P.landG || 0) + dt) > .3) P.chain = 0; P.runT = Math.abs(P.vx) > 40 ? (P.runT || 0) + dt : 0; P.coyote = 0.14; P.airDash = baseAir(); P.climbT = CLIMB_T * (has("d_wall") ? 2 : 1); if (!was) { addFx("hud", HUD.dust, P.x + P.w / 2, P.y + P.h + 2, 22, { life: .35, ay: 1, a: .8 }); P.landT = 0.1; if ((P.lastVy || 0) > 650) heroFx("land", P.x + P.w / 2, P.y + P.h + 3, P.face);
      if (has("nakhwayusu") && (P.lastVy || 0) > 900) { const cx = P.x + P.w / 2; for (const e of enemies) if (e.alive && Math.abs(e.x + e.w / 2 - cx) < 100 && Math.abs(e.y + e.h - P.y - P.h) < 50) hurtEnemy(e, false); addFx("hud", HUD.dust, cx, P.y + P.h, 90, { life: .45, ay: 1 }); shake = Math.max(shake, 6); Music.sfx("kill"); } } } else { P.coyote = Math.max(0, P.coyote - dt); P.airT = (P.airT || 0) + dt; P.landG = 0; }
  const wl = rectSolid(P.x - 3, P.y + 4, 3, P.h - 8), wr = rectSolid(P.x + P.w, P.y + 4, 3, P.h - 8);
  P.wall = P.onGround ? 0 : wr ? 1 : wl ? -1 : 0;
  if (P.wall) { P.wallMem = P.wall; P.wallT = .12; } else P.wallT = Math.max(0, (P.wallT || 0) - dt);   // wall jump still works a moment after slipping off
  if (P.onGround || P.wall) P.djN = 0;
  if (P.onGround) P.wallBonus = 0;
  P.chainT = Math.max(0, (P.chainT || 0) - dt);
  if (P.wall) P.airDash = Math.max(P.airDash, baseAir());
  if (P.onGround && Math.abs(P.vx) > 20) P.run += dt * Math.abs(P.vx) * 0.045;
  if (has("hwaryun") && P.onGround && Math.abs(P.vx) > maxv() * .85 && (P.fireD = (P.fireD || 0) + Math.abs(P.vx) * dt) > 60) { P.fireD = 0; bullets.push({ x: P.x + P.w / 2, y: P.y + P.h - 8, vx: 0, vy: 0, friendly: true, fire: true, pierce: true, life: .7, owner: null }); }
}
function ghost(gap) { const l = ghosts[ghosts.length - 1]; if (!l || l.age > gap) ghosts.push({ x: P.x, y: P.y, face: P.face, age: 0, life: 0.22 }); for (const g of ghosts) g.age += 0.004; }
// one-shot painted effects: grow and fade
function addFx(sheet, i, x, y, h, o = {}) { if (vfx.length > (MOBILE ? 60 : 120)) vfx.shift(); vfx.push({ sheet, i, x, y, h, t: 0, life: o.life || .5, rot: o.rot || 0, grow: o.grow ?? .35, flip: !!o.flip, ay: o.ay ?? .5, a: o.a ?? 1 }); }
// the hero's painted effects; dir/angle orient the ones that point somewhere
function heroFx(kind, x, y, dir = 1, ang = 0) {
  if (!SPR.herofx) return;
  const o = { dash: [70, .32, .5, .9], jump: [46, .4, 1, .85], land: [58, .4, 1, .8], air: [44, .4, .5, .85], wall: [52, .35, .5, .85], strike: [96, .3, .5, 1], arc: [80, .25, .5, .8], wind: [56, .45, .5, .8], ribbon: [40, .35, .5, .7] }[kind];
  const arc = kind === "strike" || kind === "arc", flip = arc ? dir > 0 : dir < 0, rot = (dir < 0 ? -ang : ang);   // the crescents are painted bulging left, the rest pointing right
  addFx("herofx", HFX[kind], x, y, o[0], { life: o[1], ay: o[2], a: o[3], flip, rot, grow: kind === "strike" || kind === "arc" ? .15 : .35 });
}
function findFloor(x, y) { let ty = Math.floor(y / T); while (ty < LV.h && tileAt(Math.floor(x / T), ty) !== 1) ty++; return ty < LV.h ? ty * T : null; }
function bleed(x, y, dir, big) { // blood burst + spray along the blow + a pool where it lands
  addFx("fx", FX.burst, x, y, big ? 96 : 64, { life: big ? .7 : .45, rot: Math.random() * 6.28, grow: .5 });
  addFx("fx", FX.spray, x, y, big ? 50 : 34, { life: .5, rot: Math.atan2(dir.y, dir.x), ay: .5, grow: .6 });
  addFx("fx", FX.drops, x + dir.x * 20, y - 6, 26, { life: .6, rot: Math.random() * 6.28 });
  if (SPR.vis) { addFx("vis", VIS.splat, x, y, big ? 48 : 34, { life: .45, grow: .3, ay: .5, rot: Math.random() * 6.28, a: .85 }); addFx("vis", VIS.drops, x + dir.x * 20, y + 4, big ? 24 : 18, { life: .55, grow: .1, ay: .5, rot: Math.atan2(dir.y, dir.x), a: .85 }); }
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
    if (tileAt(tx, ty) === 2 && overlap(pr, { x: tx * T + 4, y: ty * T + 14, w: T - 8, h: T - 14 })) return die("fall");
  if (P.y > LV.h * T + 80) return die("fall");
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
  if (LV.exit && overlap(pr, LV.exit) && !bossAlive()) madangClear();
}

// ---------- enemies ----------
// one hit point per cut 천고 beyond the first; a plain cut removes one, an 일격 kills outright
function hurtEnemy(e, strike, kind) {
  if (!e.alive || ghostly(e)) return;
  const kan = isFlashing(e); if (kan) { strike = true; e.kanpa = true; e.kanMua = viaMua();
    const x = e.x + e.w / 2, y = e.y + e.h / 2, big = e.type === "b";   // 간파: the crossed cut, gold flakes, the world holds a beat
    addFx("kfx", KF.xcut, x, y, big ? 150 : 90, { life: .4, grow: .15, rot: Math.random() * .6 - .3 }); addFx("kfx", KF.flakes, x, y, big ? 170 : 110, { life: .5, grow: .5 });
    hitstop = Math.max(hitstop, .1); shake = Math.max(shake, 7); }
  else if (e.lastBlow != null && songPos - e.lastBlow < .3) { addFx("kfx", KF.fizzle, e.x + e.w / 2, e.y + e.h * .35, 46, { life: .45, grow: .2, ay: .5 }); e.lastBlow = null; }   // just too late: a grey fizzle
  if (e.type === "a" && e.counter && kind === "il" && !kan && Math.sign(P.x + P.w / 2 - (e.x + e.w / 2)) === e.face) {   // 자객 받아치기: an 일섬 straight into his stance is turned on you
    addFx("mech", MECH.deflect, e.x + e.w / 2 + e.face * 14, e.y + 14, 60, { life: .3 }); Music.sfx("clang"); P.dashT = 0; lastHitDir = { x: e.face, y: -.4 }; die(); return; }   // 간파: any blow that lands on the glint
  if (e.ward && !strike) { // 무당's talisman takes the cut instead
    e.ward = false; addFx("hud", HUD.spark, e.x + e.w / 2, e.y + 6, 40, { life: .3 }); Music.sfx("clang"); return;
  }
  if (e.type === "b") { // a plain cut takes one, an 일격 three (four with 파천) and staggers it out of its wind-up
    const il = kind === "il", heavy = strike === 2;
    if (!strike && !il && (BOSSES[e.kind].armored || (e.kind === "talchum" && e.mask === 0))) { e.hitT = .1; Music.sfx("clang"); addFx("hud", HUD.spark, e.x + e.w / 2, e.y + 20, 34, { life: .25 }); return; }
    if (oath("goyo2") && !strike) { e.hitT = .1; return; }
    if (!strike && !il) { e.softHits = (e.softHits || 0) + 1;   // a flurry of plain cuts: the guardian sets its guard for a moment
      if ((e.guardT || 0) > songPos) { e.hitT = .1; Music.sfx("clang"); addFx("hud", HUD.spark, e.x + e.w / 2, e.y + e.h * .4, 40, { life: .25 }); return; }
      e.softN = songPos - (e.softAt ?? -9) < 1.6 ? (e.softN || 0) + 1 : 1; e.softAt = songPos;
      if (e.softN >= 4) { e.softN = 0; e.guardT = songPos + 1.3; toast("막아 낸다 · 일섬으로 뚫어라"); } }
    const aimed = kan || heavy, read = kan, mua = kan && e.kanMua; e.kanpa = false;   // 간파 breaks the blow; 천고일섬 cuts deep; 일섬 bites harder than a plain cut
    e.hp -= kan ? 4 : heavy ? 3 : strike ? 2 : il ? 2 : 1; e.hitT = .22;
    addFx("bvfx", BV.impact, e.x + e.w / 2 + (Math.random() - .5) * e.w * .4, e.y + e.h * (.3 + Math.random() * .3), aimed ? 120 : strike ? 80 : 54, { life: .28, grow: .25, rot: Math.random() * 6.28, a: .9 });
    if (il) addQi(4);
    if (read) { regainAir(); addQi((has("d_beat") ? 2 : 1) * (mua ? 2 : 1) * 15); if (has("d_beat")) P.airDash++; P.ki = Math.min(1, (P.ki || 0) + .5); chainAdd(mua ? 2 : 1); if (mua) killCam = Math.max(killCam, .3); banner("看破", JJOK, "간파 — 기술을 끊었다"); addFx("bvfx", BV.impact, e.x + e.w / 2, e.y + e.h / 2, 150, { life: .4, grow: .3 }); hitstop = Math.max(hitstop, .12); shake = Math.max(shake, 9); haz = haz.filter(z => z.kind === "ring"); }
    if (aimed) { e.stagT = read ? 1.1 : .4; e.act = null; e.suck = false; e.chargeT = 0; e.danceT = 0; e.swoopT = 0; e.nextAt = songPos + 2 * Music.beatLen; if (e.hidden) { e.hidden = false; e.x = e.tx - e.w / 2; } }
    addFx("fx", FX.drops, e.x + e.w / 2, e.y + 30, 30, { life: .4, rot: Math.random() * 6.28 });
    hitstop = Math.max(hitstop, .05); Music.sfx("clang"); shake = Math.max(shake, 4);
    if (e.hp <= 0) killEnemy(e); return;
  }
  if (has("cheohyeong") && e.stunT > 0 && e.type !== "b") strike = true;   // 처형: the frozen fall to any cut
  if (oath("goyo2") && !strike && e.type !== "b") { e.hitT = .12; addFx("hud", HUD.spark, e.x + e.w / 2, e.y + 12, 22, { life: .2 }); return; }
  if (omen("hyeolmaeng") && !strike) { e.hitT = .12; Music.sfx("clang"); addFx("hud", HUD.spark, e.x + e.w / 2, e.y + 12, 26, { life: .25 }); return; }   // 피의 맹세: only an 일격 draws blood
  if (!strike && has("ssangryong")) e.hp--;
  if (e.type === "d" && has("eunggyeok")) strike = true;
  if (strike || (e.hp || 1) <= 1) { killEnemy(e); return; }
  e.hp--; e.hitT = .22;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  addFx("fx", FX.drops, cx, cy - 4, 22, { life: .4, rot: Math.random() * 6.28 });
  if (e.type !== "d") { const k = Math.sign(cx - (P.x + P.w / 2)) || 1; moveX(e, k * 10); }
  else { e.vx += (Math.sign(cx - (P.x + P.w / 2)) || 1) * 160; }
  hitstop = Math.max(hitstop, .04); Music.sfx("clang"); shake = Math.max(shake, 3);
}
function killEnemy(e) {
  if (!e.alive) return;
  e.alive = false; deadIds.add(e.id); run.kills++;
  if (e.type === "m") for (const o of enemies) if (o.wardBy === e.id) o.ward = false;
  if (has("hyeolhwa") && !inBloom) { inBloom = true; const bx = e.x + e.w / 2, by = e.y + e.h / 2; const br = has("hyeolu") ? 140 : 80; { const cf = CF("bloom"); if (cf && SPR[cf[0]]) addFx(cf[0], cf[1], bx, by, br * 1.3, { life: .5, grow: .4, ay: .5 }); else addFx("perkfx", PF.bloom, bx, by, br, { life: .45, grow: .5 }); } if (has("hyeolhyang")) P.invT = Math.max(P.invT || 0, .3);
    for (const o of enemies) if (o !== e && o.alive && Math.hypot(o.x + o.w / 2 - bx, o.y + o.h / 2 - by) < br) hurtEnemy(o, false); inBloom = false; }
  if (mode !== "tutorial") resKill(e);
  addQi(3); if (P && state === "play") chainAdd(1);
  if (P && e.kanpa && e.type !== "b" && state === "play") { const mua = e.kanMua;   // 간파: cut down on the glint — its shot dies with it
    addQi((has("d_beat") ? 2 : 1) * (mua ? 2 : 1) * 15); if (has("d_beat")) P.airDash++; regainAir(); P.ki = Math.min(1, (P.ki || 0) + .5); if (mua) chainAdd(1);
    for (const b of bullets) if (b.owner === e && !b.friendly) b.life = 0;
    if (e.type === "k") { for (const o of enemies) if (o.alive && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 320) { o.stunT = Math.max(o.stunT || 0, 1.2); o.fireAt = null; o.swingAt = null; o.thrustAt = null; o.dashAt = null; }   // the drum falls silent: everyone near falters
      ringFx(e.x + e.w / 2, e.y + e.h / 2, 160, "rgba(39,70,106,.7)", .45); addQi(15); }
    addFx("bcal", BC.ganpa, e.x + e.w / 2, e.y - 18, mua ? 46 : 34, { life: .6, grow: .2, ay: .5 }); hitstop = Math.max(hitstop, .06);
    if (mua) killCamOn(e); }
  if (P && ((P.aimDash && !P.tapDash) || (P.aimedUntil || 0) > songPos) && state === "play") {
    addQi(9); run.aimK = (run.aimK || 0) + 1; P.ki = Math.min(1, (P.ki || 0) + .3); // what an aimed-dash kill gives back
    P.airDash = Math.max(P.airDash, baseAir() + (has("d_sun") ? 1 : 0)); P.dashCd = 0;   // only an aimed kill gives the air dash back (연환: one more)
    if (has("d_sun")) P.reAim = true;
    if (has("p_quick")) P.reloadAt = 0;
    if (has("d_chain") && !inChain) { const x = e.x + e.w / 2, y = e.y + e.h / 2, n = nearestFoes(x, y, 2, 170).find(o => o !== e);   // 뇌인: one hop, never a chain of chains
      if (n) { inChain = true; boltFx(x, y, n.x + n.w / 2, n.y + n.h / 2, .3, 14); hurtEnemy(n, n.type !== "b"); inChain = false; } }
    if (has("d_breath") && mode !== "tutorial" && run.aimK % 4 === 0 && run.breath < breathCap()) { run.breath++; setHud(); toast("혈로 · 숨 하나를 되찾았다"); } }
  if (oath("pi") && P) { P.dashCd = 0; P.airDash = Math.max(P.airDash, baseAir()); }

  if (e.type === "b" && e.kind === "cheongo") { run.endingDue = true; toast("북의 주인이 쓰러졌다 · 천고를 쳐라"); }
  if (e.type === "b" && mode !== "tutorial") { run.bossKills = (run.bossKills || 0) + 1; (run.bossSeen = run.bossSeen || []).push(e.kind); codexBoss(e); }
  if (e.type === "b") { const x = e.x + e.w / 2, y = e.y + e.h / 2;   // ink and blood thrown wide, the body going up as wisps
    addFx("bcal", BC.inkBurst, x, y, e.h * 2.2, { life: .7, grow: .5, rot: Math.random() * 6.28, a: .9 }); addFx("bcal", BC.redBurst, x, y, e.h * 1.6, { life: .8, grow: .45, rot: Math.random() * 6.28, a: .85 });
    addFx("bvfx", BV.dissolve, x, e.y + e.h * .4, e.h * 1.8, { life: 1.4, grow: .3, ay: .7, a: .9 }); }
  if (e.type === "b" && e.kind !== "cheongo") { bossOut = { t: 0, x: e.x + e.w / 2, y: e.y + e.h / 2, kind: e.kind, name: BOSSES[e.kind].name, han: BOSSES[e.kind].han }; killCam = Math.max(killCam, .9); sealArena(null, false); }
  if (e.type === "b") { haz = []; for (const o of enemies) if (o.type === "i") o.alive = false; toast(`${josa(BOSSES[e.kind].name, "이", "가")} 쓰러졌다 · ${run.m === LAST_M ? "천고를 베어라" : "길이 열렸다"}`); Music.jing(); shake = 14; for (let k = 0; k < 3; k++) bleed(e.x + e.w / 2 + (k - 1) * 20, e.y + 20 + k * 18, { x: k - 1, y: -.4 }, true); }
  if (omen("hyeolmaeng") && mode !== "tutorial") { run.hmN = (run.hmN || 0) + 1; if (run.hmN % 5 === 0 && run.breath < breathCap()) { run.breath++; setHud(); toast("피의 맹세 · 숨 하나를 되찾았다"); } }
  if (has("hyeol") && run.kills % (has("hyeolpung") ? 5 : 10) === 0 && run.breath < breathCap()) { run.breath++; setHud(); toast("혈로 · 숨 하나를 되찾았다"); }
  if (has("heuphon") && P.slashT > 0 && P.strike) { P.invT = Math.max(P.invT || 0, .5); P.airDash = Math.max(P.airDash, baseAir()); }
  if (has("nakhwa") && P.slashT > 0 && P.slashDir.y > .5 && !P.onGround) { P.vy = -560; P.airDash = Math.max(P.airDash, 1); }
  else if (has("seonpung") && P.slashT > 0 && !P.onGround) { P.vy = -520; P.airDash = Math.max(P.airDash, 1); }
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 320; parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: .6, max: .6, c: i % 5 ? LV.pal.tile : SEAL, s: 2 + Math.random() * 4 }); }
  bleed(cx, cy, P.slashT > 0 ? P.slashDir : { x: Math.sign(cx - P.x - P.w / 2) || 1, y: -.2 }, false);
  hitstop = 0.07; shake = Math.max(shake, 6); P.dashCd = 0; if (mode === "tutorial") P.airDash = Math.max(P.airDash, baseAir());
  if (has("hyeolseon")) P.invT = Math.max(P.invT || 0, .25);

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
    if (e.hitT > 0) e.hitT -= dt;
    if (e.stunT > 0) { e.stunT -= dt; dashThrough(e); continue; }   // 월광 / 뇌전: frozen for a moment
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2, dist = Math.hypot(pcx - ecx, pcy - ecy);
    if (e.type === "d") {
      e.t += dt;
      const sees = live && dist < 430 && los(ecx, ecy, pcx, pcy);
      if (e.diveT > 0) { e.diveT -= dt; e.vx = e.dvx; e.vy = e.dvy; }   // 매: the dive itself
      else if (e.diveAt != null) { e.vx *= .85; e.vy *= .85; if (songPos >= e.diveAt) { const L = Math.hypot(pcx - ecx, pcy - ecy) || 1; e.dvx = (pcx - ecx) / L * 560; e.dvy = (pcy - ecy) / L * 560; e.diveT = .45; e.diveAt = null; e.diveReady = songPos + 3 * bl; Music.sfx("dash"); } }
      else if (sees && dist < 300 && songPos >= (e.diveReady || 1)) { e.diveAt = (Math.floor(songPos / bl) + 1) * bl; if (e.diveAt - songPos < .5) e.diveAt += bl; }
      else if (sees) { e.vx += (pcx - ecx) / dist * 520 * dt; e.vy += (pcy - ecy) / dist * 520 * dt; }
      else { e.vx += (e.hx - e.x) * 2 * dt; e.vy += (e.hy + Math.sin(e.t * 2) * 10 - e.y) * 2 * dt; }
      const sp = Math.hypot(e.vx, e.vy), cap = e.diveT > 0 ? 600 : (sees ? 175 : 80); if (sp > cap) { e.vx *= cap / sp; e.vy *= cap / sp; }
      if (moveX(e, e.vx * dt)) e.vx *= -0.5;
      if (moveY(e, e.vy * dt)) e.vy *= -0.5;
      if (live && overlap(e, P)) { if (P.dashT > 0 || P.slashT > 0) { if (P.dashT > 0 ? !P.dashHit.has(e.id) : !(P.hitSet && P.hitSet.has(e.id))) { (P.dashT > 0 ? P.dashHit : P.hitSet).add(e.id); if (P.dashT > 0) dashHurt(e); else hurtEnemy(e, P.strike && P.slashT > 0); } } else if (!(e.hitT > 0)) die(); }
      continue;
    }
    if (e.type === "m") { stepMudang(e, dt, pcx, dist, live); continue; }
    if (e.type === "r") { stepReaper(e, dt, pcx, pcy, dist, live); continue; }
    if (e.type === "b") { stepBoss(e, dt, pcx, pcy, dist, live); continue; }
    if (e.type === "i") { stepIllusion(e, dt, pcx, live); continue; }
    if (e.type === "p" || e.type === "a" || e.type === "k") { stepFoe3(e, dt, pcx, pcy, dist, live, bl); continue; }
    if (e.type === "h") {
      const sees = live && dist < 380 && Math.abs(pcy - ecy) < 80 && los(ecx, e.y + 8, pcx, pcy);
      if (sees) e.face = Math.sign(pcx - ecx) || e.face;
      const ahead = e.x + e.w / 2 + e.face * 16;
      const ground = groundPt(ahead, e.y + e.h + 4) && !solidPt(ahead, e.y + 10);
      e.vx = sees && ground && dist > 24 && e.thrustAt == null ? e.face * 55 : 0;
      moveX(e, e.vx * dt);
      if (live && sees && e.thrustAt == null && dist < 90 && songPos >= (e.nextThrust || 0)) { e.thrustAt = (Math.floor(songPos / bl) + 1) * bl; if (e.thrustAt - songPos < .5) e.thrustAt += bl; }   // 등패수: the shield drops for a thrust — the one opening
      if (e.thrustAt != null && songPos >= e.thrustAt) { const zone = { x: e.face > 0 ? ecx : ecx - 64, y: e.y + 6, w: 64, h: e.h - 10 };
        addFx("fx", FX.slashA, ecx + e.face * 34, e.y + e.h / 2, 54, { life: .25, rot: e.face > 0 ? 0 : Math.PI }); Music.sfx("slash");
        if (live && hurtsPlayer() && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.3 }; die(); } e.thrustAt = null; e.nextThrust = songPos + 3 * bl; }
      if (live && overlap(e, P)) { if (P.dashT > 0) clang(e); else die(); }
      continue;
    }
    const fast = (1 + .22 * cyc()) / (has("danhwa") ? 1.4 : 1);
    const sniper = e.type === "s", range = sniper ? 920 : 560, lead = (sniper ? 1.0 : 0.45) / fast, lock = (sniper ? 0.3 : 0.15) / Math.max(1, fast * .8);
    const sees = live && dist < range && los(ecx, e.y + 8, pcx, pcy);
    if (sees) e.face = Math.sign(pcx - ecx) || e.face;
    if (e.fireAt != null) {
      if (songPos < e.fireAt - lock && sees) { e.tx = pcx; e.ty = pcy; }
      if (!sees && songPos < e.fireAt - lock) { e.fireAt = null; e.readyAt = songPos + 0.3; }
      else if (songPos >= e.fireAt) {
        const [mx, my] = muzzle(e), dx = e.tx - mx, dy = e.ty - my, d = Math.hypot(dx, dy) || 1, sp = (sniper ? 1250 : 430) * (1 + .1 * cyc()) * slowShot();
        const red = sniper && cyc() >= 1;   // 붉은 탄: it cannot be cut or turned — dodge it, or 간파 the hand before it fires
        bullets.push({ x: mx, y: my, vx: dx / d * sp, vy: dy / d * sp, owner: e, friendly: false, life: 3, sniper, red, noReflect: red });
        addFx("hud", HUD.smoke, mx + e.face * 8, my - 4, 30, { life: .9, grow: .9, a: .8, flip: e.face < 0 }); // powder smoke
        e.fireAt = null; e.readyAt = songPos + Math.max(1, Math.round((sniper ? 4 : 2) / fast * (has("jeokmak") ? 1.5 : 1))) * bl;
        Music.sfx(sniper ? "snipe" : "shoot");
      }
    } else if (sees && songPos >= e.readyAt) {
      let k = Math.ceil((songPos + lead) / bl);
      if (sniper) { const m4 = Math.max(1, Math.round(4 / fast)); k = Math.ceil(k / m4) * m4; }
      e.fireAt = k * bl; e.aimFrom = songPos; e.tx = pcx; e.ty = pcy;
    }
    if (live && P.dashT > 0 && overlap(e, P) && !P.dashHit.has(e.id)) { P.dashHit.add(e.id); dashHurt(e); }
  }
}
function stepFoe3(e, dt, pcx, pcy, dist, live, bl) { // 순라 · 자객 · 북잡이
  const ecx = e.x + e.w / 2, sees = live && dist < 400 && Math.abs(pcy - (e.y + e.h / 2)) < 90 && los(ecx, e.y + 8, pcx, pcy), next = () => { let t = (Math.floor(songPos / bl) + 1) * bl; if (t - songPos < .5) t += bl; return t; };
  e.swingT = Math.max(0, (e.swingT || 0) - dt);
  const walk = sp => { const ahead = ecx + e.face * 14; if (groundPt(ahead, e.y + e.h + 4) && !solidPt(ahead, e.y + 10)) moveX(e, e.face * sp * dt); };
  if (e.type === "p") {
    if (sees && e.swingAt == null) e.face = Math.sign(pcx - ecx) || e.face;
    if (sees && e.swingAt == null && dist > 46) walk(70);
    if (sees && e.swingAt == null && dist < 76 && songPos >= e.nextSwing) e.swingAt = next();
    if (e.swingAt != null && songPos >= e.swingAt) { const zone = { x: e.face > 0 ? ecx : ecx - 70, y: e.y - 4, w: 70, h: e.h + 4 };
      addFx("fx", FX.slashA, ecx + e.face * 36, e.y + e.h / 2, 64, { life: .25, rot: e.face > 0 ? 0 : Math.PI }); Music.sfx("slash"); e.swingT = .3;
      if (live && hurtsPlayer() && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.3 }; die(); } e.swingAt = null; e.nextSwing = songPos + 2.5 * bl; }
  } else if (e.type === "a") {
    e.counter = live && P.focus && dist < 320 && !(e.lungeT > 0) && !(e.stunT > 0);   // 자객: when you slip into 무아경, he settles into a counter stance
    if (e.counter) e.face = Math.sign(pcx - ecx) || e.face;
    if (live && P.tapDash && P.dashT > 0 && dist < 130 && e.counter) { e.counter = false; e.stunT = .7; addFx("hud", HUD.spark, ecx, e.y + 10, 40, { life: .3 }); }   // a feint: the quick dash breaks his stance
    if (e.lungeT > 0) { e.lungeT -= dt; if (moveX(e, e.face * 620 * dt)) e.lungeT = 0;
      if (live && hurtsPlayer() && overlap(e, P)) { lastHitDir = { x: e.face, y: -.3 }; die(); } }
    else if (!e.counter) {
      if (sees && e.dashAt == null) e.face = Math.sign(pcx - ecx) || e.face;
      if (sees && e.dashAt == null && dist > 120) walk(120);
      if (sees && e.dashAt == null && dist < 230 && songPos >= e.nextLunge) e.dashAt = next();
      if (e.dashAt != null && songPos >= e.dashAt) { e.dashAt = null; e.lungeT = .32; e.nextLunge = songPos + 3 * bl; Music.sfx("dash"); }
    }
  } else {   // 북잡이
    e.beatT = Math.max(0, e.beatT - dt);
    if (sees) e.face = Math.sign(pcx - ecx) || e.face;
    if (live && dist < 560 && e.drumAt == null && songPos >= e.nextDrum) e.drumAt = next();
    if (e.drumAt != null && songPos >= e.drumAt) { e.drumAt = null; e.nextDrum = songPos + 4 * bl; e.beatT = .3; shake = Math.max(shake, 4); Music.sfx("kill");
      ringFx(ecx, e.y + e.h * .6, 120, "rgba(195,22,28,.6)", .4); haz.push({ kind: "ring", x: ecx, y: e.y + e.h * .6, at: songPos, speed: 260, max: 110 });
      const t = next();   // the drum sets every soldier near him to strike together on the next beat
      for (const o of enemies) { if (!o.alive || o === e || Math.hypot(o.x - e.x, o.y - e.y) > 320) continue;
        if ((o.type === "g" || o.type === "s") && o.fireAt == null) { o.fireAt = t; o.aimFrom = songPos; o.tx = pcx; o.ty = pcy; }
        else if (o.type === "p" && o.swingAt == null && Math.abs(o.x - P.x) < 120) o.swingAt = t;
        else if (o.type === "h" && o.thrustAt == null && Math.abs(o.x - P.x) < 120) o.thrustAt = t; } }
  }
  if (live && overlap(e, P) && !(P.dashT > 0) && !(e.lungeT > 0)) { P.vx = Math.sign(pcx - ecx || 1) * 260; }   // bodies shove
  dashThrough(e);
}
function dashThrough(e) { if (state === "play" && P.dashT > 0 && overlap(e, P) && !P.dashHit.has(e.id)) { P.dashHit.add(e.id); dashHurt(e); } }
let inChain = false;
const FLASH = .35;   // the glint before a blow lands: long enough to answer by hand, longer still in 무아경 (the music slows)
function blowAt(e) { // when this foe's blow lands (null when nothing is coming)
  if (!e || !e.alive) return null;
  if (e.type === "b") return e.act && !e.hidden && !["gamtu", "mask"].includes(e.act) ? e.hitAt : null;
  for (const k of ["fireAt", "thrustAt", "swingAt", "dashAt", "drumAt", "diveAt"]) if (e[k] != null) return e[k];
  if (e.type === "m") return e.castAt;
  if (e.type === "r") return e.ph === "rise" ? e.nextAt : null;
  return null;
}
function isFlashing(e) { const t = blowAt(e); return t != null && songPos >= t - FLASH && songPos < t + .06; }
function preFlash(e) { const t = blowAt(e); return t != null && songPos >= t - FLASH - .3 && songPos < t - FLASH ? (songPos - (t - FLASH - .3)) / .3 : 0; }
function drawKanAura(e) { // behind the body: ink rising as the blow gathers
  if (!SPR.kfx) return; const pre = preFlash(e), on = isFlashing(e); if (!pre && !on) return;
  const big = e.type === "b"; ctx.globalAlpha = on ? .6 + .15 * Math.sin(performance.now() / 50) : pre * .45;
  drawSprite("kfx", KF.aura, e.x + e.w / 2, e.y + e.h + 4, e.h * (big ? 1.3 : 1.6) / SPR.kfx.f[KF.aura].h, false, .5, false, 1); ctx.globalAlpha = 1;
}
function drawKanFlash(e, tt) { // over the body: the bead swelling at the blade, then the cross flash
  if (!SPR.kfx) return; const pre = preFlash(e), on = isFlashing(e), big = e.type === "b", f = e.face || 1;
  const tx = e.x + e.w / 2 + (big ? 0 : f * (e.w / 2 + 6)), ty = big ? e.y + e.h * .3 : e.y + e.h * .32;
  if (!on) { if (e.flashOn) { e.flashOn = false; e.lastBlow = songPos; } }
  if (pre && !on) { const sz = 6 + 16 * pre; drawSprite("kfx", KF.bead, tx, ty, sz / SPR.kfx.f[KF.bead].h, false, .5, false, .5); return; }
  if (!on) return;
  if (!e.flashOn) { e.flashOn = true; if (Math.hypot(e.x - P.x, e.y - P.y) < 520) { flashDim = .07; Music.sfx("clang"); } }
  const t = blowAt(e), q = Math.max(0, Math.min(1, (songPos - (t - FLASH)) / FLASH)), mua = P && P.focus, pop = 1 + .35 * Math.max(0, 1 - q * 4);
  const sz = (big ? 120 : 58) * (mua ? 1.35 : 1) * pop;
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(.15 * Math.sin(tt * 9));
  drawSprite("kfx", KF.cross, 0, 0, sz / SPR.kfx.f[KF.cross].h, false, .5, false, .5);
  ctx.rotate(-tt * 4); ctx.globalAlpha = .85; drawSprite("kfx", KF.star, 0, 0, sz * .55 / SPR.kfx.f[KF.star].h, false, .5, false, .5); ctx.restore(); ctx.globalAlpha = 1;
  if (mua && P) { const px = P.x + P.w / 2, py = P.y + P.h / 2, L = Math.hypot(tx - px, ty - py);   // 무아경: a dotted stroke shows the way in
    if (L < 360 && L > 30) { const g = SPR.kfx.f[KF.guide]; ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(ty - py, tx - px)); ctx.globalAlpha = .75; ctx.drawImage(SPR.kfx.img, g.x, g.y, g.w, g.h, 18, -5, L - 36, 10); ctx.restore(); ctx.globalAlpha = 1; } }
}
const viaMua = () => !!(P && P.aimDash && !P.tapDash);   // the cut came out of 무아경
function chainAdd(n) { if (!P) return; const g0 = Math.min(5, P.chain || 0); P.chain = (P.chain || 0) + n; P.chainPop = .25; if (Math.min(5, P.chain) > g0) Music.sfx("lantern"); }
function addQi(n) { // 천고 기운: won by fighting well — 일섬, 간파, 과녁
  if (mode === "tutorial" || !run) return; const before = run.qi || 0; run.qi = Math.min(100, before + n * (oath("jangdan") ? 2 : 1) * (1 + .15 * Math.min(8, (P && P.chain) || 0)));
  if (before < 100 && run.qi >= 100) { toast("천고 기운이 찼다 · 무아경에 들었다 풀면 천고일섬"); Music.jing(); }
}
function chungo() { // 천고일섬: the full drum — every foe in reach cut in one stroke of stopped time
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2, d = (a, b) => Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy);
  const ts = enemies.filter(e => e.alive && !ghostly(e) && !e.hidden && d(e) < 480).sort((a, b) => d(a) - d(b)).slice(0, 8);
  if (!ts.length) return false;
  let px = cx, py = cy; P.aimDash = true; P.aimedUntil = songPos + .6;
  for (const e of ts) { const ex = e.x + e.w / 2, ey = e.y + e.h / 2; beams.push({ x0: px, y0: py, x1: ex, y1: ey, t: 0, life: .55, red: true, w: 2.8 });
    { const L = Math.hypot(ex - px, ey - py); if (L > 20) addFx("mech", MECH.slash, (px + ex) / 2, (py + ey) / 2, Math.max(60, L * .72), { life: .55, grow: .05, rot: Math.atan2(ey - py, ex - px) + Math.PI / 4 }); }
    addFx("bvfx", BV.impact, ex, ey, 110, { life: .35, rot: Math.random() * 6.28 }); hurtEnemy(e, 2); px = ex; py = ey; }
  P.aimDash = false; run.qi = 0;
  const last = ts[ts.length - 1], side = Math.sign(last.x + last.w / 2 - cx) || P.face, nx = last.x + last.w / 2 + side * (last.w / 2 + 16) - P.w / 2, ny = last.y + last.h - P.h - .01;
  if (!rectSolid(nx, ny, P.w, P.h)) { P.x = nx; P.y = ny; P.face = -side; } P.vx = 0; P.vy = -200; regainAir();
  banner("天鼓", SEAL, "천고일섬"); shake = 16; flash = .3; hitstop = .25; killCam = Math.max(killCam, .6); Music.jing(); return true;
}
function breakTarget(g) { // 과녁: the cut gives the air dash back, and the target hangs again a moment later
  g.t = 2.5; addQi(5); P.ki = Math.min(1, (P.ki || 0) + .25); P.airDash = Math.max(P.airDash, baseAir()); P.dashCd = 0; P.djN = 0; if (has("p_quick")) P.reloadAt = 0;
  addFx("fx", FX.slashARed, g.x, g.y, 46, { life: .25, rot: Math.random() * 6.28 }); ringFx(g.x, g.y, 34, "rgba(195,22,28,.85)", .3);
  hitstop = Math.max(hitstop, .04); Music.sfx("lantern"); buzz(10);
}
function dashHurt(e) { // what a dash does to whatever it passes through
  if (P.ram && e.type !== "b") { e.stunT = Math.max(e.stunT || 0, .6); moveX(e, P.dashDir.x * 40); }
  if (P.iaiCut) seals.push({ x: e.x + e.w / 2, y: e.y + 6, t: 0, rot: (Math.random() - .5) * .4 });
  hurtEnemy(e, P.iaiCut, P.aimDash && !P.tapDash ? "il" : null);   // 일섬 is the reach; only the glint (간파) or a full 거합 makes it an 일격
}
// 무당: every fourth beat she lays a talisman ward on the two nearest soldiers; it eats one plain cut
function stepMudang(e, dt, pcx, dist, live) {
  e.castT = Math.max(0, e.castT - dt);
  const sees = live && dist < 560; if (sees) e.face = Math.sign(pcx - (e.x + e.w / 2)) || e.face;
  if (sees && songPos >= e.castAt) {
    const bl = Music.beatLen, near = enemies.filter(o => o.alive && o !== e && o.type !== "m" && o.type !== "b" && !o.ward && Math.hypot(o.x - e.x, o.y - e.y) < 280).sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 2);
    for (const o of near) { o.ward = true; o.wardBy = e.id; addFx("hud", HUD.spark, o.x + o.w / 2, o.y + 4, 34, { life: .4 }); }
    e.castT = .6; e.castAt = (Math.floor(songPos / bl) + 4) * bl; if (near.length) Music.sfx("hook");
  }
  dashThrough(e);
}
// 저승사자: sinks into ink, rises beside you one beat later and swings on the next beat
function stepReaper(e, dt, pcx, pcy, dist, live) {
  const bl = Music.beatLen, fast = 1 + .22 * cyc();
  e.fade = approach(e.fade, e.ph === "gone" ? 0 : 1, dt * 5); e.swingT = Math.max(0, (e.swingT || 0) - dt);
  if (e.ph === "idle") {
    e.face = Math.sign(pcx - (e.x + e.w / 2)) || e.face;
    if (live && dist < 620 && songPos >= e.nextAt) { e.ph = "gone"; e.nextAt = (Math.floor(songPos / bl) + 1) * bl; addFx("hud", HUD.smoke, e.x + e.w / 2, e.y + e.h - 10, 60, { life: .7, grow: .8 }); }
  } else if (e.ph === "gone" && songPos >= e.nextAt) {
    const foot = P.y + P.h, offs = [-140, 140, -175, 175, -105, 105]; if (Math.random() < .5) offs.reverse();
    for (const o of offs) { // stand on solid ground near the swordsman's feet, clear above
      const x = pcx + o, tx = Math.floor(x / T); let ty = Math.floor((foot - 4) / T);
      while (ty < LV.h && tileAt(tx, ty) !== 1) ty++;
      if (ty >= LV.h || Math.abs(ty * T - foot) > 3 * T || tileAt(tx, ty - 1) || tileAt(tx, ty - 2) || !los(x, ty * T - 20, pcx, pcy)) continue;
      e.x = x - e.w / 2; e.y = ty * T - e.h - .01; break;
    }
    e.face = Math.sign(pcx - (e.x + e.w / 2)) || 1; e.ph = "rise"; e.nextAt = (Math.floor(songPos / bl) + 1) * bl + (bl < .5 ? bl : 0);
    addFx("hud", HUD.smoke, e.x + e.w / 2, e.y + e.h - 10, 60, { life: .7, grow: .8 });
  } else if (e.ph === "rise" && songPos >= e.nextAt) {
    const ex = e.x + e.w / 2, zone = { x: e.face > 0 ? ex : ex - 78, y: e.y - 6, w: 78, h: e.h + 6 };
    addFx("fx", FX.slashARed, ex + e.face * 36, e.y + e.h / 2, 70, { life: .3, rot: e.face > 0 ? 0 : Math.PI });
    Music.sfx("slash"); e.swingT = .3;
    if (live && P.dashT <= 0 && !((P.invT || 0) > 0) && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.2 }; die(); }
    e.ph = "idle"; e.nextAt = songPos + Math.max(3, Math.round(7 / fast)) * bl;
  }
  if (e.ph !== "gone") dashThrough(e);
}
// ---------- bosses ----------
// one guards 천고 at the end of 天鼓臺. All act on the beat: an act is chosen, wound up (telegraphed) until
// the next beat, then performed. A plain cut takes 1, an 일격 3 and staggers the boss out of its wind-up.
const BOSSES = {
  sumun: { name: "수문장", han: "守門將", hp: 8, w: 44, h: 84, draw: 124, sheet: "foes2", idle: F2.boss, atk: F2.bossUp, hit: F2.bossSlam, stag: F2.bossKneel, line: "천고를 지키는 장수가 길을 막는다.",
    pool: c => ["slam", "charge", ...(c >= 1 ? ["volley"] : []), ...(c >= 2 ? ["summon"] : [])] },
  gumiho: { name: "구미호", han: "九尾狐", hp: 8, w: 52, h: 44, draw: 84, sheet: "bossA", idle: 0, atk: 1, speed: 90, line: "아홉 꼬리가 달빛에 흔들린다.",
    pool: c => ["pounce", "foxfire", "pounce", "illusion", ...(c >= 1 ? ["foxfire"] : [])] },
  dokkaebi: { name: "도깨비", han: "鬼", hp: 10, w: 46, h: 80, draw: 120, sheet: "bossA", idle: 2, atk: 3, speed: 60, line: "방망이 소리가 뚝딱 울린다.",
    pool: c => ["club", "coins", "gamtu", ...(c >= 1 ? ["coins"] : [])] },
  imugi: { name: "이무기", han: "螭", hp: 8, w: 46, h: 90, draw: 134, sheet: "bossA", idle: 4, atk: 5, still: true, line: "용이 되지 못한 뱀이 땅 밑에서 운다.",
    pool: c => ["burst", "spit", ...(c >= 1 ? ["burst2"] : ["burst"])] },
  wongwi: { name: "원귀", han: "冤鬼", hp: 7, w: 34, h: 70, draw: 112, sheet: "bossA", idle: 6, atk: 7, fly: true, line: "흰 소복이 허공에 떠 있다.",
    pool: c => ["scream", "blink", "hair", ...(c >= 1 ? ["scream"] : [])] },
  jangseung: { name: "장승", han: "長丞", hp: 12, w: 64, h: 112, draw: 150, sheet: "bossA", idle: 8, atk: 8, still: true, line: "천하대장군과 지하여장군이 눈을 부릅뜬다.",
    pool: c => ["low", "high", "spirits", ...(c >= 1 ? ["lowhigh", "highlow"] : ["low"])] },
  haetae: { name: "해태", han: "獬豸", hp: 9, w: 70, h: 56, draw: 98, sheet: "bossB", idle: 0, atk: 1, speed: 70, line: "불을 먹는 짐승이 앞을 막는다.",
    pool: c => ["breath", "charge", "leap", ...(c >= 1 ? ["breath"] : [])] },
  bulgasari: { name: "불가사리", han: "不可殺", hp: 9, w: 72, h: 64, draw: 110, sheet: "bossB", idle: 2, atk: 3, speed: 40, armored: true, line: "쇠를 먹는 괴물. 보통 칼은 먹혀 버린다. 일격만이 통한다.",
    pool: c => ["stomp", "inhale", "scrap", ...(c >= 1 ? ["stomp"] : [])] },
  baekho: { name: "백호", han: "白虎", hp: 8, w: 66, h: 46, draw: 86, sheet: "bossB", idle: 4, atk: 5, speed: 110, line: "산군이 내려왔다.",
    pool: c => ["leap", "claw", "roar", ...(c >= 1 ? ["leap"] : [])] },
  talchum: { name: "탈춤꾼", han: "假面", hp: 8, w: 28, h: 60, draw: 98, sheet: "bossB", idle: 6, atk: 7, speed: 80, line: "탈을 바꿔 쓸 때마다 다른 사람이 된다.",
    pool: c => ["fan", "dance", "mask", "fan", ...(c >= 1 ? ["fan2"] : [])] }
};
// extra poses on bossC/bossD: hurt (recoil) for everyone, plus a move or signature-move frame
const BOSS_POSE = {
  gumiho: { hurt: ["bossC", 1], move: ["bossC", 0] },
  dokkaebi: { hurt: ["bossC", 3], move: ["bossC", 2] },
  imugi: { hurt: ["bossC", 5], spec: ["bossC", 4] },
  wongwi: { hurt: ["bossC", 7], spec: ["bossC", 6] },
  jangseung: { hurt: ["bossD", 0], spec: ["bossC", 8] },
  haetae: { hurt: ["bossD", 2], spec: ["bossD", 1] },
  bulgasari: { hurt: ["bossD", 4], spec: ["bossD", 3] },
  baekho: { hurt: ["bossD", 6], spec: ["bossD", 5] },
  talchum: { hurt: ["bossD", 8], spec: ["bossD", 7] }
};
// 4-frame loops (bossE/bossF, one boss per row): walk/run cycles advance with distance, 원귀's drift with time
const cyc4 = (sh, r) => [0, 1, 2, 3].map(i => [sh, r * 4 + i]);
const BOSS_ANIM = { gumiho: cyc4("bossE", 0), dokkaebi: cyc4("bossE", 1), haetae: cyc4("bossE", 2), bulgasari: cyc4("bossE", 3), baekho: cyc4("bossF", 0), talchum: cyc4("bossF", 1), sumun: cyc4("bossF", 2), wongwi: cyc4("bossF", 3) };
const animK = {};
function animScale(kind) { // size a loop so its frames match the boss's idle painting (by area, since gaits stretch the outline)
  if (animK[kind]) return animK[kind];
  const B = BOSSES[kind], fr = BOSS_ANIM[kind], s0 = SPR[B.sheet]; if (!s0 || !fr.every(([sh]) => SPR[sh])) return 0;
  const i0 = s0.f[B.idle], a0 = Math.sqrt(i0.w * i0.h), a1 = fr.reduce((t, [sh, i]) => t + Math.sqrt(SPR[sh].f[i].w * SPR[sh].f[i].h), 0) / fr.length;
  return (animK[kind] = kOf(B.sheet, B.idle, B.draw) * a0 / a1 * (kind === "wongwi" ? 1 : .95));
}
const SHEET_SC = { bossA: 1.0241, bossB: .88235, bossC: 1, bossD: 1 };   // slicer scale per sheet, so poses from different sheets keep one size
Object.assign(BOSSES, {
  cheongo: { name: "천고의 주인", han: "天鼓主", hp: 26, w: 60, h: 100, draw: 156, sheet: "misc", idle: 0, atk: 1, stag: 2, speed: 35, line: "천고 앞에 북의 주인이 앉아 있다. 이름을 되찾은 자여, 북을 다시 울려라.",
    pool: c => ["drum", "coins", "low", "scream", "high", "summon", "drum", "lowhigh"] },
  shadow: { name: "그림자 무명", han: "影無名", hp: 12, w: 18, h: 30, draw: 64, sheet: "hero3", idle: 0, atk: 12, speed: 150, line: "삿갓 아래, 또 하나의 내가 서 있다.",
    pool: c => ["shblink", "shcut", "shdash", "shstrike"] }
});
function shadowBook() { const others = META.books.filter(b => !run || b.id !== run.book); return others.length ? others[(Math.random() * others.length) | 0] : null; }
const BOSS_ORDER = ["gumiho", "dokkaebi", "imugi", "wongwi", "jangseung", "haetae", "bulgasari", "baekho", "talchum"];
const MASKS = ["양반탈", "각시탈", "말뚝이탈"];
function bossFor(seed, cy, m) { // one guardian per turn, 수문장 first, then a run-seeded order of the rest
  const rnd = mulberry((seed ^ 0xB055) >>> 0), o = BOSS_ORDER.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [o[i], o[j]] = [o[j], o[i]]; }
  const full = ["sumun", ...o], k = cy;
  return full[(k + Math.floor(k / 10) * 3) % 10];
}
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c % 28 ? a : b); };
// hazards: painted zones that turn deadly at songPos `at` until `end` (telegraphed before), and expanding rings
let haz = [];
function addHaz(kind, x, y, w, h, at, end) { const z = { kind, x, y, w, h, at, end, t0: songPos }; haz.push(z); return z; }
function hurtsPlayer() { return state === "play" && P.dashT <= 0 && !((P.invT || 0) > 0); }
function stepHazards() {
  for (const z of haz) {
    if (z.kind === "ring") {
      const r = (songPos - z.at) * z.speed; if (r < 0) continue;
      if (r > z.max) { z.done = true; continue; }
      const d = Math.hypot(P.x + P.w / 2 - z.x, P.y + P.h / 2 - z.y);
      if (hurtsPlayer() && Math.abs(d - r) < 14) { lastHitDir = { x: Math.sign(P.x - z.x) || 1, y: -.3 }; die(); }
      continue;
    }
    if (songPos > z.end) { z.done = true; continue; }
    if (songPos >= z.at && hurtsPlayer() && overlap(z, { x: P.x + 3, y: P.y + 3, w: P.w - 6, h: P.h - 6 })) { lastHitDir = { x: 0, y: -1 }; die(); }
  }
  haz = haz.filter(z => !z.done);
}
function bossFloor(e) { return e.floor; }
function leap(e, tx, t) { const g = 1900, ecx = e.x + e.w / 2; e.vx = (tx - ecx) / t; e.vy = -.5 * g * t; e.air = true; e.face = Math.sign(e.vx) || e.face; }
function summonHawks(e, n = 2) {
  const hp = 1 + cyc(), ecx = e.x + e.w / 2;
  for (let i = 0; i < n; i++) { const dx = (i - (n - 1) / 2) * 120; enemies.push({ hp, maxHp: hp, id: 9000 + Math.floor(Math.random() * 1e6), type: "d", x: ecx + dx, y: e.y - 60, w: 28, h: 20, vx: 0, vy: 0, hx: ecx + dx, hy: e.y - 60, t: Math.random() * 6, alive: true }); }
  Music.sfx("hook");
}
const slowShot = () => (has("malli") ? .5 : has("gwian") ? .7 : 1) * (upOn("tan") ? 1.3 : 1);
function aimShot(e, x, y, tx, ty, sp, o = {}) { const d = Math.hypot(tx - x, ty - y) || 1; bullets.push({ x, y, vx: (tx - x) / d * sp * slowShot(), vy: (ty - y) / d * sp * slowShot(), owner: e, friendly: false, life: 3, ...o }); }
function lob(e, x, y, tx, ty, t, o = {}) { const g = 900; bullets.push({ x, y, vx: (tx - x) / t, vy: (ty - y - .5 * g * t * t) / t, g, owner: e, friendly: false, life: 3, ...o }); }
function waves(e, sp) { const ecx = e.x + e.w / 2; for (const dir of [-1, 1]) bullets.push({ x: ecx + dir * (e.w / 2 + 8), y: e.floor - 12, vx: dir * sp, vy: 0, owner: e, friendly: false, life: 2.2, wave: true, noReflect: true }); }
// things decided the moment an act is chosen (so the telegraph can show where it will land)
function bossChoose(e, a, I) {
  const { pcx, bl, c } = I, f = e.floor, W = 1200;
  if (a === "burst" || a === "burst2") { e.hidden = true; e.tx = pcx; addHaz("pillar", pcx - 32, f - 160, 64, 160, e.hitAt, e.hitAt + .35); if (a === "burst2") { const x2 = pcx + (Math.random() < .5 ? -1 : 1) * 130; addHaz("pillar", x2 - 32, f - 160, 64, 160, e.hitAt + bl, e.hitAt + bl + .35); } addFx("hud", HUD.smoke, e.x + e.w / 2, f - 10, 90, { life: .8, grow: .8 }); }
  else if (a === "low" || a === "lowhigh") { addHaz("beam", e.x - W, f - 30, W * 2, 30, e.hitAt, e.hitAt + .3); if (a === "lowhigh") addHaz("beam", e.x - W, f - 140, W * 2, 102, e.hitAt + bl, e.hitAt + bl + .3); }
  else if (a === "high" || a === "highlow") { addHaz("beam", e.x - W, f - 140, W * 2, 102, e.hitAt, e.hitAt + .3); if (a === "highlow") addHaz("beam", e.x - W, f - 30, W * 2, 30, e.hitAt + bl, e.hitAt + bl + .3); }
  else if (a === "breath") { addHaz("fire", e.face > 0 ? e.x + e.w : e.x - 190, f - 64, 190, 64, e.hitAt, e.hitAt + bl).flip = e.face < 0; }
  else if (a === "hair") { const n = 3 + Math.min(2, c); for (let i = 0; i < n; i++) { const x = pcx + (i - (n - 1) / 2) * 85; addHaz("hair", x - 14, f - 120, 28, 120, e.hitAt + i * bl * .5, e.hitAt + i * bl * .5 + .3); } }
  else if (a === "coins") { const n = 5 + Math.min(3, c); for (let i = 0; i < n; i++) { const x = pcx + (i - (n - 1) / 2) * 64 + (Math.random() - .5) * 30, at = e.hitAt + bl * .5 + i * bl * .25; addHaz("coin", x - 16, f - 34, 32, 34, at, at + .14); } }
  else if (a === "inhale") e.suck = true;
  else if (a === "gamtu") { e.invisT = 2 * bl; toast("도깨비 감투 · 모습이 사라졌다"); }
  else if (a === "mask") { e.mask = ((e.mask || 0) + 1) % 3; toast(`탈을 바꿔 썼다 · ${MASKS[e.mask]}`); }
}
function bossPerform(e, a, I) {
  const { pcx, pcy, bl, c } = I, ecx = e.x + e.w / 2, f = e.floor;
  switch (a) {
    case "slam": case "club": { addFx("bvfx", BV.quake, ecx + e.face * 80, f - 18, 70, { life: .5, grow: .2, ay: .8 });
      const zone = { x: e.face > 0 ? ecx : ecx - 150, y: f - 70, w: 150, h: 70 };
      shake = 10; Music.sfx("kill"); addFx("hud", HUD.dust, ecx + e.face * 90, f, 90, { life: .5, ay: 1 });
      if (hurtsPlayer() && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.5 }; die(null, 2); }
      if (c >= 1) waves(e, 360 + 30 * c); break; }
    case "charge": e.chargeT = e.kind === "haetae" ? .6 : .5; e.cv = e.kind === "haetae" ? 640 : 520 + 40 * c; Music.sfx("dash"); break;
    case "volley": { const n = c >= 3 ? 5 : 3, ang = Math.atan2(pcy - (e.y + 30), pcx - ecx), sp = 420 * (1 + .1 * c) * slowShot();
      for (let i = 0; i < n; i++) { const t = ang + (i - (n - 1) / 2) * .16; bullets.push({ x: ecx + e.face * 30, y: e.y + 30, vx: Math.cos(t) * sp, vy: Math.sin(t) * sp, owner: e, friendly: false, life: 3 }); }
      Music.sfx("shoot"); break; }
    case "summon": case "spirits": summonHawks(e, a === "spirits" && c >= 1 ? 3 : 2); break;
    case "pounce": leap(e, pcx, .55); Music.sfx("dash"); break;
    case "leap": leap(e, pcx, .6); Music.sfx("dash"); break;
    case "foxfire": { const n = 6 + 2 * Math.min(2, c); for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; bullets.push({ x: ecx, y: e.y + 10, vx: Math.cos(t) * 150 * slowShot(), vy: Math.sin(t) * 150 * slowShot(), owner: e, friendly: false, life: 4, orb: true, home: .9 }); } Music.sfx("hook"); break; }
    case "illusion": for (const dx of [-90, 90]) enemies.push({ hp: 1, maxHp: 1, id: 9000 + Math.floor(Math.random() * 1e6), type: "i", kind: "gumiho", x: ecx + dx - 20, y: f - 36, w: 40, h: 36, face: Math.sign(pcx - ecx - dx) || 1, life: 4, alive: true }); Music.sfx("hook"); break;
    case "coins": Music.sfx("clang"); break;
    case "gamtu": e.act = "club"; e.hitAt = (Math.floor(songPos / bl) + 2) * bl; return true;   // reappears swinging two beats later
    case "burst": case "burst2": e.hidden = false; e.emergeT = .6; e.x = e.tx - e.w / 2; e.y = f - e.h; e.face = Math.sign(pcx - e.tx) || e.face; shake = 10; Music.sfx("kill"); addFx("hud", HUD.dust, e.tx, f, 110, { life: .5, ay: 1 }); break;
    case "spit": for (const dx of [-70, 0, 70]) lob(e, ecx + e.face * 20, e.y + 16, pcx + dx, pcy, .9, { orb: true, water: true }); Music.sfx("shoot"); break;
    case "scream": addFx("bvfx", BV.ring, ecx, e.y + e.h / 2, 140, { life: .6, grow: 1.4, a: .8 }); haz.push({ kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos, speed: 300, max: 560 }); if (c >= 2) haz.push({ kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos + bl * .5, speed: 300, max: 560 }); shake = 6; Music.sfx("die"); break;
    case "blink": { const side = Math.random() < .5 ? -1 : 1; e.x = pcx + side * 190 - e.w / 2; e.y = f - 95 - e.h / 2; e.face = -side; addFx("hud", HUD.smoke, e.x + e.w / 2, e.y + e.h / 2, 70, { life: .6 });
      const dx = pcx - (e.x + e.w / 2), dy = pcy - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1; e.swoopT = .55; e.svx = dx / d * 480; e.svy = dy / d * 480; Music.sfx("dash"); break; }
    case "low": case "high": case "lowhigh": case "highlow": case "hair": Music.sfx("strike"); shake = 5; break;
    case "breath": Music.sfx("snipe"); if (c >= 1) addHaz("fire", e.face > 0 ? e.x + e.w + 150 : e.x - 230, f - 22, 80, 22, songPos + bl, songPos + bl * 3); break;
    case "stomp": addFx("bvfx", BV.quake, ecx, f - 18, 80, { life: .55, grow: .25, ay: .8 }); shake = 12; Music.sfx("kill"); waves(e, 340 + 30 * c); if (hurtsPlayer() && Math.abs(pcx - ecx) < e.w / 2 + 50 && P.y + P.h > f - 40) { lastHitDir = { x: Math.sign(pcx - ecx) || 1, y: -.6 }; die(null, 2); } break;
    case "inhale": { e.suck = false; const zone = { x: e.face > 0 ? ecx : ecx - 110, y: f - 70, w: 110, h: 70 }; Music.sfx("kill"); if (hurtsPlayer() && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.3 }; die(); } break; }
    case "scrap": for (let i = 0; i < 5; i++) lob(e, ecx + e.face * 30, e.y + 10, pcx + (i - 2) * 55, f - 10, .8 + i * .05, { scrap: true }); Music.sfx("shoot"); break;
    case "claw": addFx("bvfx", BV.crescent, ecx + e.face * 60, f - 34, 90, { life: .3, flip: e.face < 0, grow: .2 }); for (let i = 0; i < 3; i++) { const at = songPos + i * bl * .5; addHaz("claw", e.face > 0 ? ecx + 10 : ecx - 120, f - 64, 110, 64, at, at + .15); } Music.sfx("slash"); break;
    case "roar": addFx("bvfx", BV.ring, ecx, e.y + e.h / 2, 140, { life: .6, grow: 1.4, a: .8 }); shake = 14; Music.sfx("die"); if (Math.abs(pcx - ecx) < 360) { P.vx = Math.sign(pcx - ecx || 1) * 560; P.dashCd = Math.max(P.dashCd, bl * 1.5); } if (c >= 1) haz.push({ kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos, speed: 320, max: 240 }); break;
    case "fan": case "fan2": { const n = a === "fan2" || e.mask === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) { const ang = Math.atan2(pcy - (e.y + 20), pcx - ecx) + (n > 1 ? (i - .5) * .5 : 0), sp = 430 * slowShot(); bullets.push({ x: ecx + e.face * 16, y: e.y + 20, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: e, friendly: false, life: 3.5, fan: true, boom: .7, t: 0 }); }
      Music.sfx("slash"); break; }
    case "dance": e.danceT = 2 * bl; Music.sfx("dash"); break;
    case "drum": // 천고의 주인 strikes its own drum: two rings and a ground wave addFx("bvfx", BV.ring, ecx, e.y + e.h / 2, 140, { life: .6, grow: 1.4, a: .8 });
      haz.push({ kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos, speed: 280, max: 620 }, { kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos + bl, speed: 280, max: 620 });
      waves(e, 340 + 25 * c); shake = 12; Music.jing(); break;
    case "shblink": { const side = Math.random() < .5 ? -1 : 1, nx = pcx + side * 60 - e.w / 2; if (!rectSolid(nx, e.y, e.w, e.h)) e.x = nx; e.face = -side; addFx("perkfx", PF.clone, ecx, f, 60, { life: .3, ay: 1, a: .5 });
      e.act = "shcut"; e.hitAt = (Math.floor(songPos / bl) + 1) * bl; return true; }
    case "shcut": case "shstrike": { const w = a === "shstrike" ? 120 : 70, zone = { x: e.face > 0 ? ecx : ecx - w, y: e.y - 20, w, h: e.h + 30 };
      addFx("slashfx", a === "shstrike" ? SF.arcRed : SF.arc, ecx + e.face * w / 2, e.y + e.h / 2, a === "shstrike" ? 90 : 60, { life: .25, flip: e.face < 0 }); Music.sfx(a === "shstrike" ? "strike" : "slash");
      if (hurtsPlayer() && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.3 }; die(); } break; }
    case "shdash": e.chargeT = .28; e.cv = 760; Music.sfx("dash"); break;
  }
  return false;
}
function stepBoss(e, dt, pcx, pcy, dist, live) {
  const B = BOSSES[e.kind], bl = Music.beatLen, c = cyc() + 1, I = { pcx, pcy, bl, c };   // guardians fight one tier above the turn
  e.emergeT = Math.max(0, (e.emergeT || 0) - dt); e.stagT = Math.max(0, (e.stagT || 0) - dt); e.swingT = Math.max(0, (e.swingT || 0) - dt); e.walkT = Math.max(0, (e.walkT || 0) - dt); e.invisT = Math.max(0, (e.invisT || 0) - dt);
  if (!e.awake) { if (!(live && dist < 470)) return; e.awake = true; Music.jing(); e.fightBreath = run.breath; sealArena(e, true); e.hpShow = e.hp;
    const seen = (LV.introSeen = LV.introSeen || new Set()).has(e.kind); LV.introSeen.add(e.kind);
    if (!seen && mode !== "tutorial") bossIntro = { t: 0, e }; else toast(josa(B.name, "이", "가") + " 길을 막는다");
    e.nextAt = (Math.floor(songPos / bl) + 2) * bl + (bossIntro ? 1.7 : 0); }
  let ecx = e.x + e.w / 2;
  const deadly = () => { if (live && hurtsPlayer() && overlap(e, P)) { lastHitDir = { x: Math.sign(pcx - ecx) || 1, y: -.3 }; die(); } };
  if (e.air) { // leaping: arc under gravity, deadly on contact, shake on landing
    e.vy += 1900 * dt; moveX(e, e.vx * dt);
    if (moveY(e, e.vy * dt) && e.vy > 0) { e.air = false; e.vx = 0; e.vy = 0; shake = 8; addFx("bvfx", BV.quake, e.x + e.w / 2, e.floor - 16, 60, { life: .45, grow: .2, ay: .8 }); addFx("hud", HUD.dust, e.x + e.w / 2, e.y + e.h, 80, { life: .4, ay: 1 });
      if (e.kind === "baekho") addHaz("claw", e.x - 50, e.y + e.h - 60, e.w + 100, 60, songPos, songPos + .12);
      if (e.kind === "haetae") { addHaz("fire", e.x - 40, e.floor - 22, e.w + 80, 22, songPos, songPos + bl * 1.5); if (c >= 1) waves(e, 330); }
      if (e.kind === "gumiho" && c >= 1) for (let i = 0; i < 4; i++) { const t = -Math.PI * (i + .5) / 4; bullets.push({ x: e.x + e.w / 2, y: e.y + 10, vx: Math.cos(t) * 170, vy: Math.sin(t) * 170, owner: e, friendly: false, life: 3, orb: true, home: .6 }); }
    }
    if (e.y > LV.h * T) { e.y = e.floor - e.h; e.air = false; }
    deadly();
  } else if (e.chargeT > 0) {
    e.chargeT -= dt; const ahead = ecx + e.face * (e.w / 2 + 4);
    if (!groundPt(ahead, e.y + e.h + 4) || moveX(e, e.face * e.cv * dt)) { if (e.kind === "haetae" && !e.bounced) { e.bounced = true; e.face = -e.face; } else e.chargeT = 0; }
    if (e.chargeT <= 0) e.bounced = false;
    deadly();
  } else if (e.swoopT > 0) { // 원귀's dive
    e.swoopT -= dt; e.x += e.svx * dt; e.y = Math.min(e.floor - e.h, e.y + e.svy * dt); deadly();
  } else if (e.danceT > 0) { // 탈춤꾼 spins toward you, step by step
    e.danceT -= dt; e.face = Math.sign(pcx - ecx) || e.face; const ahead = ecx + e.face * (e.w / 2 + 4);
    if (groundPt(ahead, e.y + e.h + 4)) moveX(e, e.face * (e.mask === 1 ? 300 : 220) * dt); deadly();
  } else if (!e.act) {
    if (e.stagT <= 0 && !e.hidden) e.face = Math.sign(pcx - ecx) || e.face;
    if (B.fly && !e.hidden) { // hover a little way off, bobbing
      const tx = pcx - e.face * 200, ty = e.floor - 95 - e.h / 2 + Math.sin(songPos * 2) * 14;
      e.x += Math.max(-140 * dt, Math.min(140 * dt, tx - ecx)); e.y += Math.max(-120 * dt, Math.min(120 * dt, ty - (e.y + e.h / 2)));
    } else if (!B.still && dist > 110 && e.stagT <= 0) {
      const ahead = ecx + e.face * (e.w / 2 + 4), sp = (B.speed || 55) * 1.25 * (e.hp <= e.maxHp / 2 ? 1.3 : 1) * (e.invisT > 0 ? 2 : 1) * (e.mask === 1 ? 1.6 : 1) + 10 * c;
      if (groundPt(ahead, e.y + e.h + 4) && !solidPt(ahead, e.y + e.h - 10)) { moveX(e, e.face * sp * dt); e.walkT = .12; e.wph = (e.wph || 0) + sp * dt / Math.max(22, e.w * .55); }
    }
    if (live && songPos >= e.nextAt && e.stagT <= 0) {
      if (!e.raged && e.hp <= e.maxHp / 2) { e.raged = true; banner("激怒", SEAL, `${josa(B.name, "이", "가")} 격노했다 — 새 기술이 섞인다`); shake = 14; flash = .25; Music.jing();
        for (let i = 0; i < 3; i++) bleed(ecx + (i - 1) * 24, e.y + 20 + i * 10, { x: i - 1, y: -.5 }, true); }
      const pool = e.raged ? [...B.pool(c), ...(RAGE_ADD[e.kind] || [])] : B.pool(c); let a = pool[(e.n = (e.n || 0) + 1) % pool.length];
      if ((a === "slam" || a === "club" || a === "inhale") && dist > 280) a = e.kind === "sumun" ? (c >= 1 ? "volley" : "charge") : e.kind === "dokkaebi" ? "coins" : "scrap";
      if (a === "claw" && dist > 200) a = "leap";
      e.act = a; e.hitAt = (Math.floor(songPos / bl) + 1) * bl; if (e.hitAt - songPos < .45) e.hitAt += bl; e.actFrom = songPos;
      bossChoose(e, a, I);
    }
  } else {
    if (e.suck && live && P.dashT <= 0) P.vx += Math.sign(ecx - pcx) * 1100 * dt;   // 불가사리 breathes in
    if (songPos >= e.hitAt) {
      const a = e.act; e.act = null; e.swingT = .35; e.lastAct = a;
      const rage = e.raged || e.hp <= e.maxHp / 2, gap = Math.max(rage && c >= 3 ? 1 : 2, (e.kind === "jangseung" ? 3 : 3) - (c >> 1) - (e.mask === 1 ? 1 : 0) - (rage ? 1 : 0));
      if (!bossPerform(e, a, I)) e.nextAt = e.hitAt + gap * bl;
    }
  }
  ecx = e.x + e.w / 2;
  if (live && !e.hidden && !e.air && !(e.chargeT > 0) && !(e.swoopT > 0) && !(e.danceT > 0) && overlap(e, P) && P.dashT <= 0) { P.vx = Math.sign(pcx - ecx || 1) * 320; if (!P.onGround) P.vy = Math.min(P.vy, -120); }   // bulk shoves you back
  if (!e.hidden) dashThrough(e);
}
// 구미호's illusions: run at you, vanish after a few seconds or one cut
function stepIllusion(e, dt, pcx, live) {
  e.life -= dt; if (e.life <= 0) { e.alive = false; addFx("hud", HUD.smoke, e.x + e.w / 2, e.y + e.h / 2, 50, { life: .5 }); return; }
  e.face = Math.sign(pcx - (e.x + e.w / 2)) || e.face; const ahead = e.x + e.w / 2 + e.face * 24;
  if (groundPt(ahead, e.y + e.h + 4)) moveX(e, e.face * 230 * dt);
  if (live && hurtsPlayer() && overlap(e, P)) { lastHitDir = { x: e.face, y: -.3 }; die(); }
  dashThrough(e);
}
function muzzle(e) { return e.type === "s" ? [e.x + e.w / 2 + e.face * 34, e.y + 17] : [e.x + e.w / 2 + e.face * 32, e.y + 6]; }
function cutDrum(d) {
  run.cutDrums.push(d.id); saveRun();
  addFx("hud", HUD.spark, d.x, d.y - 20, 70, { life: .5 }); seals.push({ x: d.x, y: d.y - 30, t: 0, rot: -.1 });
  Music.sfx("strike"); Music.jing(); shake = 8; hitstop = .12; buzz(30);
  if (mode !== "tutorial") { questEvent("cut"); gainStroke("cut"); }
  if (run.endingDue) { state = "result"; Music.stop(); setTimeout(showEnding, 700); return; }
  if (run.tower) { towerNext(); return; }
  run.choosing = "cycle"; saveRun();
  state = "result"; Music.stop(); setTimeout(() => showChoice("cycle"), 700);
}
function drumsInPlay() { return mode === "tutorial" || !LV.drums ? [] : LV.drums.filter(d => !(run.cutDrums || []).includes(d.id)); }
function slashHits() {
  if (P.slashT <= 0) return;
  if (!bossAlive()) for (const d of drumsInPlay()) { const cx = P.x + P.w / 2 + P.slashDir.x * 26, cy = P.y + P.h / 2 + P.slashDir.y * 26; if (Math.abs(cx - d.x) < 52 + (d.big ? 20 : 0) && cy > d.y - d.h - 24 && cy < d.y + 10) cutDrum(d); }
  const WP = WEAPONS[wpn()];
  if (P.whiff) return;
  let R = (P.strike ? 54 * (has("gangta") ? 1.5 : 1) : 40) * (has("ssang") ? 1.35 : 1) * (has("seomil") && P.dashT > 0 ? 1.6 : 1) + (has("ilseom") ? 12 : 0); let reach = (P.strike ? 30 : 26) + (has("ilseom") ? 14 : 0);
  R *= WP.R * (has("heup") ? .7 : 1) * (oath("hyeon") ? 1.2 : 1) * (P.strike && oath("goyo2") ? 2.5 : 1); reach += WP.reach + (has("heup") ? 30 : 0);
  if (P.flowBig) R *= 1.7;
  if (oath("jilpung2")) R *= .7; if (oath("geommu")) R *= P.danceRest ? .5 : 1 + .2 * (P.dance || 0);
  if (chr("munyeo")) R *= .85; if (chr("posu")) { R *= .75; reach += 24; }
  if (has("geommak")) for (const b of bullets) if (!b.friendly && Math.hypot(b.x - P.x - P.w / 2, b.y - P.y - P.h / 2) < 95) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 18, { life: .2 }); }
  const spin = (has("hoeseon") && !P.onGround) || !!WP.ring, cx = P.x + P.w / 2 + (spin ? 0 : P.slashDir.x * reach), cy = P.y + P.h / 2 + (spin ? 0 : P.slashDir.y * reach);
  if (spin) R *= has("nakcheon") ? 1.75 : 1.35;
  const moon = P.strike && has("wolgwang") && !chr("munyeo") && !chr("posu"); if (moon) R *= has("manwol") ? 2.5 : 2;
  const bx2 = P.x + P.w / 2 - P.slashDir.x * reach, by2 = P.y + P.h / 2 - P.slashDir.y * reach, back = moon && has("ssangwol");
  for (const e of enemies) {
    if (!e.alive || ghostly(e)) continue;
    const ex = Math.max(e.x, Math.min(cx, e.x + e.w)), ey = Math.max(e.y, Math.min(cy, e.y + e.h)), ex2 = Math.max(e.x, Math.min(bx2, e.x + e.w)), ey2 = Math.max(e.y, Math.min(by2, e.y + e.h));
    if (Math.hypot(ex - cx, ey - cy) >= R && !(back && Math.hypot(ex2 - bx2, ey2 - by2) < R)) continue;
    if (moon) e.stunT = Math.max(e.stunT || 0, (has("manwol") ? 1 : .5) * (e.type === "b" ? .35 : 1));
    if (P.strike && has("cheohyeong") && e.type !== "b") e.stunT = Math.max(e.stunT || 0, .45);
    if (wk() === "woldo" && e.type !== "b" && e.type !== "d") moveX(e, Math.sign(e.x + e.w / 2 - P.x - P.w / 2) * 34);
    if (has("heup") && (P.blood = (P.blood || 0) + 1) % 8 === 0 && run.breath < breathCap() && mode !== "tutorial") { run.breath++; setHud(); toast("흡혈 · 숨 하나를 빼앗았다"); }
    if (e.type === "h" && !P.strike && !has("cheol") && wk() !== "woldo" && Math.sign(P.x + P.w / 2 - (e.x + e.w / 2)) === e.face) { if (!P.clanged.has(e.id)) { P.clanged.add(e.id); clang(e); } continue; }   // the shield only covers his front
    if (P.hitSet && P.hitSet.has(e.id)) continue;   // one hit per swing
    if (P.hitSet) P.hitSet.add(e.id);
    if (P.strike) seals.push({ x: e.x + e.w / 2, y: e.y + 6, t: 0, rot: (Math.random() - .5) * 0.4 });
    addFx("perkfx", P.strike ? PF.spark : PF.splash, e.x + e.w / 2, e.y + e.h / 2, P.strike ? 46 : 34, { life: .22, rot: Math.random() * 6.28, grow: .5 });
    hurtEnemy(e, P.strike);   // 단화: one who is aiming falls to any cut
    if (wrule() === "hwando" && !P.onGround && !P.airCutUsed) { P.airCutUsed = true; regainAir(); }   // 연격: once in each flight a plain cut in the air wins the air back
    if (wrule() === "ssang") { P.gise = songPos - (P.giseAt ?? -9) < .8 ? Math.min(5, (P.gise || 0) + 1) : 1; P.giseAt = songPos; }   // 기세
    if (wrule() === "woldo" && !P.onGround && P.slashDir.y > .5) pogo();   // 내려베기
    if (P.strike && res("noe", 4) && !P.boltArc) { P.boltArc = true; const n = nearestFoes(e.x + e.w / 2, e.y + e.h / 2, 2, 190).find(o => o !== e);   // 뇌 공명: a spark leaps from the cut
      if (n) { boltFx(e.x + e.w / 2, e.y + e.h / 2, n.x + n.w / 2, n.y + n.h / 2, .28, 14); n.stunT = Math.max(n.stunT || 0, n.type === "b" ? .2 : .7); hurtEnemy(n, false); } }
    if (!P.onGround && res("pung", 4) && !P.windBack) { P.windBack = true; P.djN = 0; P.airDash = Math.max(P.airDash, baseAir()); P.wallBonus = 1; addFx("perkfx", PF.wind, P.x + P.w / 2, P.y + P.h / 2, 70, { life: .35, grow: .5, a: .8 }); }
  }
  for (const g of LV.targets) if (g.t <= 0 && Math.hypot(g.x - cx, g.y - cy) < R + 10) {   // the basic cut on a 과녁: only the 장단 on the beat, or a 내려베기
    if (wrule() === "hwando" && !P.onGround) breakTarget(g); else if (wrule() === "woldo" && !P.onGround && P.slashDir.y > .5) { breakTarget(g); pogo(); } }
  for (const b of bullets) {
    if (b.friendly || b.noReflect || Math.hypot(b.x - cx, b.y - cy) >= R + 8) continue;
    { const tti = Math.hypot(b.x - P.x - P.w / 2, b.y - P.y - P.h / 2) / (Math.hypot(b.vx, b.vy) || 1);   // 정밀 튕기기: only a cut in the last instant turns it back
      if (!(tti < (chr("munyeo") ? .3 : .15) || P.strike)) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 18, { life: .2 }); continue; }
      addFx("mech", MECH.deflect, b.x, b.y, 54, { life: .25, grow: .3 }); addQi(4); }
    if (wrule() === "woldo" && !P.onGround && P.slashDir.y > .5) pogo();
    b.friendly = true; b.pierce = P.strike || has("bantan"); b.life = 3; b.g = 0; b.home = 0; b.boom = 0;
    const sp = Math.max(700, Math.hypot(b.vx, b.vy) * (has("bantan") ? 1.6 : 1.1)) * (chr("munyeo") ? 2 : 1), o = b.owner; if (chr("munyeo")) { b.pierce = true; b.strike = P.strike; } if (has("neokpuri")) { b.seek = 9; b.neok = true; }
    if (o && o.alive) { const dx = o.x + o.w / 2 - b.x, dy = o.y + o.h / 2 - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * sp; b.vy = dy / d * sp; }
    else { b.vx = P.slashDir.x * sp; b.vy = P.slashDir.y * sp; }
    if (has("yeokryu")) for (const t of [-.25, .25]) { const c = Math.cos(t), sn = Math.sin(t); bullets.push({ ...b, vx: b.vx * c - b.vy * sn, vy: b.vx * sn + b.vy * c, hits: null }); }
    Music.sfx("reflect"); hitstop = Math.max(hitstop, 0.04);
    for (let i = 0; i < 6; i++) parts.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300, life: .25, max: .25, c: JJOK, s: 2 });
  }
}
function stepBullets(dt) {
  const pr = { x: P.x + 3, y: P.y + 3, w: P.w - 6, h: P.h - 6 };
  for (const b of bullets) {
    b.t = (b.t || 0) + dt;
    if (b.g) b.vy += b.g * dt;
    if (b.dragon && has("yeomryong2") && (b.fd = (b.fd || 0) + Math.abs(b.vx) * dt) > 50) { b.fd = 0; bullets.push({ x: b.x, y: b.y + 14, vx: 0, vy: 0, friendly: true, fire: true, pierce: true, life: .8, owner: null }); }
    if (b.seek && b.friendly) { const t = nearestFoes(b.x, b.y, 1, 420)[0]; if (t) { const a = Math.atan2(b.vy, b.vx), want = Math.atan2(t.y + t.h / 2 - b.y, t.x + t.w / 2 - b.x), sp = Math.hypot(b.vx, b.vy); let dd = want - a; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); const na = a + Math.max(-b.seek * dt, Math.min(b.seek * dt, dd)); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; } }
    if (b.tornado) for (const o of bullets) if (!o.friendly && o.life > 0 && Math.hypot(o.x - b.x, o.y - b.y) < (b.big ? 64 : 38)) { o.life = 0; addFx("hud", HUD.spark, o.x, o.y, 20, { life: .2 }); }
    if (b.home && !b.friendly && state === "play") { const a = Math.atan2(b.vy, b.vx), want = Math.atan2(P.y + P.h / 2 - b.y, P.x + P.w / 2 - b.x), sp = Math.hypot(b.vx, b.vy); let d = want - a; d = Math.atan2(Math.sin(d), Math.cos(d)); const na = a + Math.max(-b.home * dt, Math.min(b.home * dt, d)); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
    if (b.boom && !b.friendly && b.t > b.boom && b.owner && b.owner.alive) { // the fan curves back to the dancer's hand
      const o = b.owner, dx = o.x + o.w / 2 - b.x, dy = o.y + 20 - b.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(b.vx, b.vy);
      b.vx += (dx / d * sp - b.vx) * Math.min(1, dt * 4); b.vy += (dy / d * sp - b.vy) * Math.min(1, dt * 4); if (d < 24) b.life = 0;
    }
    const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 8));
    for (let i = 0; i < n && b.life > 0; i++) {
      const bk = !b.friendly && P && P.focus ? (has("d_freeze") || (has("d_calm") && run.breath <= 1 && mode !== "tutorial") ? 0 : simb("yeong") ? 1.4 : 2.6) : 1;   // the aim slows the world, but shots still close in (정지 · 영심법 hold them back)
      b.x += b.vx * dt / n * bk; b.y += b.vy * dt / n * bk;
      if (solidPt(b.x, b.y) && !(b.fan && !b.friendly)) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 22, { life: .25, rot: Math.random() * 6.28 }); break; }
      if (b.friendly) {
        if (!b.noHit) for (const e of enemies) if (e.alive && !ghostly(e) && b.x > e.x - (b.r || 0) && b.x < e.x + e.w + (b.r || 0) && b.y > e.y - (b.r || 0) && b.y < e.y + e.h + (b.r || 0)) {
          if (b.hits && b.hits.has(e.id)) continue;
          if (e.type === "h" && Math.sign(b.vx) === -e.face && !b.pierce) { b.life = 0; Music.sfx("clang"); break; }
          (b.hits = b.hits || new Set()).add(e.id); if (b.neok || b.talisman) e.stunT = Math.max(e.stunT || 0, e.type === "b" ? .25 : b.neok ? 1.4 : .5); if (b.talisman && SPR.mfx) addFx("mfx", 2, e.x + e.w / 2, e.y + e.h / 2, 54, { life: .3, grow: .4, ay: .5 }); hurtEnemy(e, !!b.strike || (b.pierce && !b.wind && !b.fire && !b.tornado && !b.dragon && !b.sword)); if (!b.pierce) b.life = 0;
          if ((b.sword && has("yuseong")) || (b.dragon && has("biryong"))) P.airDash = Math.max(P.airDash, baseAir());
          if (b.sword && has("noegeom")) { const o = nearestFoes(e.x + e.w / 2, e.y + e.h / 2, 2, 260).find(o => o !== e); if (o) { beams.push({ x0: e.x + e.w / 2, y0: e.y + e.h / 2, x1: o.x + o.w / 2, y1: o.y + o.h / 2, t: 0, life: .2 }); hurtEnemy(o, false); } }
        }
      } else if (state === "play" && !(has("jangmak") && P.focus) && !((P.invT || 0) > 0) && b.x > pr.x - 3 && b.x < pr.x + pr.w + 3 && b.y > pr.y - 3 && b.y < pr.y + pr.h + 3) {
        if (P.ward) { P.ward = false; b.life = 0; addFx("slashfx", SF.guard, P.x + P.w / 2, P.y + P.h / 2, 70, { life: .35, grow: .6 }); Music.sfx("clang");   // 수호령 takes it
          if (has("yeongmak")) for (const o of bullets) if (!o.friendly && Math.hypot(o.x - P.x, o.y - P.y) < 320) o.life = 0;
          if (has("wolryeong")) { const px = P.x + P.w / 2, py = P.y + P.h / 2; addFx("perkfx", PF.spin, px, py, 130, { life: .35, grow: .3 }); for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - px, e.y + e.h / 2 - py) < 110) hurtEnemy(e, false); }
          break; }
        if (has("jiljoo") && !b.noReflect && P.onGround && Math.abs(P.vx) > maxv() * .85 && Math.sign(b.vx) === -Math.sign(P.vx)) { b.friendly = true; b.pierce = true; b.vx = -b.vx * 1.2; b.vy = -b.vy; b.g = 0; b.home = 0; b.boom = 0; b.life = 3; Music.sfx("reflect"); break; }
        if (has("cheonra") && P.focus && !b.noReflect) { // 천라지망: the shot turns back on its shooter
          const o = b.owner, sp = Math.hypot(b.vx, b.vy) * 1.3; b.friendly = true; b.pierce = true; b.life = 3;
          if (o && o.alive) { const dx = o.x + o.w / 2 - b.x, dy = o.y + o.h / 2 - b.y, d = Math.hypot(dx, dy) || 1; b.vx = dx / d * sp; b.vy = dy / d * sp; } else { b.vx = -b.vx; b.vy = -b.vy; }
          Music.sfx("reflect"); break;
        }
        const sp = Math.hypot(b.vx, b.vy) || 1; lastHitDir = { x: b.vx / sp, y: b.vy / sp }; die(); b.life = 0; }
    }
    b.life -= dt;
  }
  bullets = bullets.filter(b => b.life > 0);
}

// ---------- loop ----------
let last = performance.now(), cvInverted = false;
const GPU_SOFT = (() => { try { const g = document.createElement("canvas").getContext("webgl"), d = g && g.getExtension("WEBGL_debug_renderer_info"); return !!(d && /swiftshader|llvmpipe|software/i.test(g.getParameter(d.UNMASKED_RENDERER_WEBGL))); } catch (e) { return false; } })();   // the browser drawing without the GPU
if (GPU_SOFT && MOBILE) { dprCap = 1; setTimeout(resize, 0); }   // no GPU on this phone's browser: draw at native 1x from the start
let showFps = localStorage.getItem("chungo.fps") === "1", fpsNow = 0, fpsAcc = 0, fpsCnt = 0;
let vsyncMs = 16.7, lastTick = 0, workMs = 0;
function frame(now) {
  vsyncMs += (Math.min(40, now - lastTick) - vsyncMs) * .05; lastTick = now;   // the screen's own refresh, for the 진단 line
  if (now - last < 10) { requestAnimationFrame(frame); return; }   // 120Hz+ screens: draw every other refresh (a steady 60) instead of doubling the work
  const t0 = performance.now();
  const raw = (now - last) / 1000, rdt = Math.min(0.05, raw); last = now;
  fpsAcc += raw; fpsCnt++; if (fpsAcc >= 1) { fpsNow = Math.round(fpsCnt / fpsAcc); fpsAcc = fpsCnt = 0; hudCache = ""; }
  if (state === "play" && raw < .5) { perfT += raw; perfN++; if (perfN >= 90) { const avg = perfT / perfN; perfT = perfN = 0;   // three seconds of slow frames: draw at a lower resolution
    if (avg > 1 / 45 && dprCap > 1) { dprCap = Math.max(1, +(dprCap - .25).toFixed(2)); resize(); } } }
  if (state === "play" || state === "dead") {
    songPos = Music.pos();
    if (state === "play") frameInput(rdt);
    let ts = 1;
    if (bossIntro && (bossIntro.t += rdt) > 1.7) bossIntro = null;
    if (bossOut && (bossOut.t += rdt) > 2.2) bossOut = null;
    if (bossBanner && (bossBanner.t += rdt) > 1.3) bossBanner = null;
    if (LV && LV.seal) LV.seal.t += rdt;
    if (state === "play" && bossIntro) ts = 0.03;
    else if (hitstop > 0) { hitstop -= rdt; ts = 0.06; } else if (state === "play" && P.focus) ts = run && run.qi >= 100 && mode !== "tutorial" ? 0.02 : has("d_jeong") ? 0.07 : 0.12; else if (state === "play" && killCam > 0) ts = .32;
    if (state === "dead") ts = 0.3;
    const wdt = rdt * ts, n = Math.max(1, Math.ceil(wdt / (1 / 120))), sdt = wdt / n;
    for (let i = 0; i < n; i++) {
      if (state === "play") { stepPlayer(sdt); P.slashT = Math.max(0, P.slashT - sdt); slashHits(); playerHazards(); }
      if (state === "play" || state === "dead") { stepEnemies(sdt); stepBullets(sdt); if (state === "play") stepHazards(); }
      if (state !== "play" && state !== "dead") break;
    }
    if (state === "play") run.time += rdt;
    if (state === "dead") { deathT += rdt; if (deathT > 0.75) afterDeath(); }
    hookCand = state === "play" && !P.hook ? findHook() : null;
    updateHud();
  } else slashReq = null;
  for (const p of parts) { p.x += p.vx * rdt; p.y += p.vy * rdt; p.vy += 600 * rdt; p.life -= rdt; }
  parts = parts.filter(p => p.life > 0); if (parts.length > (MOBILE ? 220 : 400)) parts.splice(0, parts.length - (MOBILE ? 220 : 400));   // oldest drops go first
  for (const g of ghosts) g.age += rdt; ghosts = ghosts.filter(g => g.age < g.life);
  for (const s of seals) s.t += rdt; seals = seals.filter(s => s.t < (s.ch ? 1.1 : 0.7));
  for (const v of vfx) v.t += rdt; vfx = vfx.filter(v => v.t < v.life);
  for (const b of beams) b.t += rdt; beams = beams.filter(b => b.t < b.life); for (const b of bolts) b.t += rdt; bolts = bolts.filter(b => b.t < b.life); for (const r of rings) r.t += rdt; rings = rings.filter(r => r.t < r.life); for (const c of cutLines) c.t += rdt; cutLines = cutLines.filter(c => c.t < c.life); killCam = Math.max(0, killCam - rdt);
  if (state === "play") for (const c of clones) { c.t -= rdt; if (c.t <= 0) { // 분광: the shadow strikes once, then is gone
    const r = has("hwanyeong") ? 120 : 85; for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - c.x, e.y + e.h / 2 - (c.y - 20)) < r) hurtEnemy(e, has("hwanyeong") && e.type !== "b");
    if (chr("munyeo") && SPR.mfx) addFx("mfx", 0, c.x + c.face * 26, c.y - 22, 70, { life: .28, flip: c.face < 0, ay: .5 }); else if (chr("posu") && SPR.pfx) addFx("pfx", 0, c.x + c.face * 40, c.y - 22, 30, { life: .25, flip: c.face < 0, ay: .5 }); else addFx("slashfx", SF.arc, c.x + c.face * 20, c.y - 22, 70, { life: .25, flip: c.face < 0 }); } }
  clones = clones.filter(c => c.t > 0);
  shake = Math.max(0, shake - rdt * 40); flash = Math.max(0, flash - rdt);
  if (toastT > 0) { toastT -= rdt; if (toastT <= 0) $("toast").classList.remove("on"); }
  const inv = !!(P && (P.focus || killCam > 0) && state === "play");
  Music.setRate(inv ? .45 : 1);
  if (inv !== cvInverted) { cvInverted = inv; document.body.classList.toggle("night", inv); }
  render(rdt);
  workMs += (performance.now() - t0 - workMs) * .1;
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); }
function setHud() {
  document.body.classList.toggle("night", !!(LV && LV.pal.night));
  if (mode === "tutorial") { $("hMadang").textContent = "수련터"; $("hJang").textContent = Music.JANGDAN[TUTORIAL.jd].name; }
  else { const om = OMENS.find(o => o.id === run.omen); $("hMadang").textContent = stageName(run.m); $("hJang").textContent = Music.JANGDAN[MADANG[MD(run.m)].jd].name + (om ? " · " + om.name : ""); }
  const hb = $("hBreath"); hb.innerHTML = ""; hb.classList.toggle("inf", mode === "tutorial");
  if (mode !== "tutorial") { const lostNow = (hb.dataset.b != null && +hb.dataset.b > run.breath) ? +hb.dataset.b : -1;   // the 숨 just lost bursts red, and the row shakes
    for (let i = 0; i < Math.max(breathCap(), run.breath); i++) { const d = document.createElement("i"); if (i >= run.breath) d.className = "lost" + (i < lostNow ? " gone" : ""); hb.appendChild(d); }
    if (lostNow >= 0) { hb.classList.remove("hurt"); void hb.offsetWidth; hb.classList.add("hurt"); }
    hb.dataset.b = run.breath; }
  const hs = $("hSchool"); if (hs) { hs.hidden = true; } if (false) { hs.innerHTML = ""; if (mode !== "tutorial") for (const k in SCHOOLS) { const n = schoolN(k); if (!n) continue; const S = SCHOOLS[k], el = document.createElement("span");
    el.style.setProperty("--sc", S.col); el.className = n >= 2 ? "on" : ""; el.innerHTML = Array.from({ length: Math.min(n, 6) }, (_, i) => `<i class="bd${i < n - n % 2 ? " on" : ""}"></i>`).join("") + (n > 6 ? `<em>+${n - 6}</em>` : ""); el.title = `${S.name} ${n} · ${S.tiers.filter((_, i) => n >= i * 2 + 2).join(" / ") || "공명 없음"}`; hs.appendChild(el); }
    hs.hidden = !hs.children.length; }
  hudCache = "";
}
let hudCache = "";
function updateHud() {
  const t = fmt(run.time), pip = (P.onGround || P.airDash > 0) && P.dashCd <= 0, hk = !!hookCand, key = t + pip + hk;
  if (key === hudCache) return; hudCache = key;
  $("hTime").textContent = t + (showFps ? ` · ${fpsNow}fps ${workMs.toFixed(0)}ms ${Math.round(1000 / vsyncMs)}Hz ${DPR}x${GPU_SOFT ? " SW" : ""}` : ""); $("pip").classList.toggle("on", pip); $("bHook").classList.toggle("ready", hk);
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
  const pal = !LV ? PAL[0] : (P && (P.focus || killCam > 0) && state === "play") ? NIGHT : LV.pal, k = SCALE * DPR, vw = W / SCALE, vh = H / SCALE;
  if (P && LV) {
    let tx = P.x + P.w / 2 + Math.max(-110, Math.min(110, P.vx * 0.22)) + P.face * 24, ty = P.y + P.h / 2 - 24; const f = Math.min(1, rdt * (bossIntro ? 4 : 7));
    if (bossIntro) { const e = bossIntro.e; tx = tx * .25 + (e.x + e.w / 2) * .75; ty = ty * .4 + (e.y + e.h / 2 - 30) * .6; }
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
  const ssn0 = LV && state !== "menu" && !pal.night ? season() : 0;   // the season's tint is baked into the paper, so the screen is washed once, not twice
  const paperTex = ssn0 ? tintedPaper(ssn0) : pattern("tex-paper", DPR * 0.9);
  if (paperTex && !LITE()) { ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = pal.rim ? .35 : .9; ctx.fillStyle = paperTex; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; }
  else { ctx.fillStyle = paperPat; ctx.fillRect(0, 0, cv.width, cv.height); }
  if (!LV || state === "menu") return;
  const ssn = season(), tt = performance.now() / 1000;
  if (ssn && !pal.night && !IMG["tex-paper"]) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = SEASON_TINT[ssn]; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = "source-over"; }
  if (!LITE()) drawWeather(ssn, tt, pal);

  ctx.setTransform(k, 0, 0, k, Math.round((W / 2 + sx) * DPR - cam.x * k), Math.round((H / 2 + sy) * DPR - cam.y * k));
  const x0 = Math.max(0, Math.floor((cam.x - vw / 2) / T) - 1), x1 = Math.min(LV.w - 1, Math.ceil((cam.x + vw / 2) / T) + 1);
  const y0 = Math.max(0, Math.floor((cam.y - vh / 2) / T) - 1), y1 = Math.min(LV.h - 1, Math.ceil((cam.y + vh / 2) / T) + 1);
  const visible = x => x > cam.x - vw / 2 - 60 && x < cam.x + vw / 2 + 60;

  if (SPR.rocks && LV && !LV.scenery) buildScenery();
  const SC = LV.scenery;
  if (SC && SPR.pines) for (const p of SC.pines) { // far pines drift slower than the ground (parallax .75)
    const f = SPR.pines.f[p.i], px = p.x, gy = p.gy;   // fixed in the world, rooted behind the ground edge
    if (px < cam.x - vw / 2 - 300 || px > cam.x + vw / 2 + 300) continue;
    ctx.save(); ctx.translate(px, gy); if (p.flip) ctx.scale(-1, 1); ctx.globalAlpha = pal.night ? p.a * .6 : p.a * 1.6;
    const k = p.h / f.h, im = pal.night ? SPR.pines.inv : SPR.pines.img; ctx.globalAlpha = pal.night ? .4 : .8;
    for (let r = 1; r > 0; r--) ctx.drawImage(im, f.x, f.y, f.w, f.h, -f.w * k / 2, -p.h, f.w * k, p.h); // stacked passes deepen the pale ink
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (SC && SPR.slabs) for (const c of SC.slabs) if (Math.abs(c.x - cam.x) < vw / 2 + c.w) { // drawn before tiles so the walkable top stays crisp
    const f = SPR.slabs.f[c.i], h = Math.max(c.minH + 14, Math.min(c.w * f.h / f.w, c.minH * 2.2)); // width = the run; height covers the block
    ctx.save(); ctx.translate(c.x, c.y); if (c.flip) ctx.scale(-1, 1);
    ctx.drawImage(pal.night ? SPR.slabs.inv : SPR.slabs.img, f.x, f.y, f.w, f.h, -c.w / 2, 0, c.w, h); ctx.restore();
  }
  if (SC && SPR.pillars) for (const c of SC.pillars) if (!c.g && Math.abs(c.x - cam.x) < vw / 2 + c.w) drawPillar(c, pal);   // floating ones behind the rock
  if (SC) for (const c of SC.back) if (Math.abs(c.x - cam.x) < vw / 2 + c.h * 2 + 200) drawCliff(c, pal.night ? SPR.rocks.inv : SPR.rocks.img, pal.night ? .25 : .45);
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
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (LV.grid[ty * LV.w + tx] === 1 && !(LV.slabTiles && LV.slabTiles.has(ty * LV.w + tx))) rock.rect(tx * T - .3, ty * T - .3, T + .6, T + .6);
  const granite = pattern("tex-slab", 0.45);
  ctx.fillStyle = pal.tile; ctx.fill(rock);
  if (SPR.pillars) { // ground built from the same painted rock columns as the pillars, so both read as one cliff
    const pf = SPR.pillars.f, colW = 70, img = bake(pal.night ? SPR.pillars.inv : SPR.pillars.img, .8, 1.15);
    ctx.save(); ctx.clip(rock); if (pal.night) ctx.globalAlpha = .45;
    const cx0 = Math.floor((cam.x - vw / 2) / colW) - 1, cx1 = Math.ceil((cam.x + vw / 2) / colW) + 1;
    for (let c = cx0; c <= cx1; c++) {
      const hsh = (c * 2654435761) >>> 0, i = hsh % 3, f = pf[i], w = colW * 1.35, segH = w * f.h / f.w, off = (hsh >>> 8) % 97;
      const rowH = segH - 10; // one spacing for both the start row and the step, so rows stay put as the camera moves
      for (let y = Math.floor((cam.y - vh / 2 - off) / rowH) * rowH + off - rowH; y < cam.y + vh / 2 + segH; y += rowH) {
        ctx.save(); ctx.translate(c * colW + colW / 2, y); if ((hsh >>> 3) & 1) ctx.scale(-1, 1); ctx.drawImage(img, f.x, f.y, f.w, f.h, -w / 2, 0, w, segH); ctx.restore();
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
    const sh = ctx.createLinearGradient(0, cam.y - vh / 2, 0, cam.y + vh / 2); sh.addColorStop(0, "rgba(20,18,16,0)"); sh.addColorStop(1, "rgba(20,18,16,.3)");
    ctx.fillStyle = sh; ctx.fill(rock);
  } else if (granite) { // painted granite face, darkening with depth; night keeps it dim
    ctx.globalAlpha = pal.night ? .35 : 1; ctx.fillStyle = granite; ctx.fill(rock); ctx.globalAlpha = 1;
    const sh = ctx.createLinearGradient(0, cam.y - vh / 2, 0, cam.y + vh / 2); sh.addColorStop(0, "rgba(20,18,16,0)"); sh.addColorStop(1, "rgba(20,18,16,.35)");
    ctx.fillStyle = sh; ctx.fill(rock);
  } else if (stone) { ctx.globalAlpha = pal.rim ? .8 : 1; ctx.fillStyle = stone; ctx.fill(rock); ctx.globalAlpha = 1; }
  if (SC && SPR.pillars) for (const c of SC.pillars) if (c.g && Math.abs(c.x - cam.x) < vw / 2 + c.w) drawPillar(c, pal);   // grounded pillars over the rock but under every giwa band
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
        if (ssn === 2) { ctx.fillStyle = pal.night ? "rgba(236,230,216,.5)" : "rgba(250,250,252,.92)"; ctx.fillRect(px - l, py - 6.5, T + l + r, 3); }
      } else if (tileAt(tx, ty - 1) !== 1) {
        const s = (tx * 73 + ty * 31) % 7;
        ctx.beginPath(); ctx.moveTo(px - .5, py + 2); ctx.lineTo(px + 6 + s, py - 1.5); ctx.lineTo(px + 18, py + .5 - s * .2); ctx.lineTo(px + T + .5, py - 1); ctx.lineTo(px + T + .5, py + 3); ctx.closePath(); ctx.fill();
        if (pal.rim) { ctx.fillStyle = pal.rim; ctx.fillRect(px, py - 1, T, 1.2); }
      }
      for (const sd of [-1, 1]) if (tileAt(tx + sd, ty) !== 1 && granite && !(LV.slabTiles && LV.slabTiles.has(ty * LV.w + tx))) { // dark ink edge where the rock face turns away
        const gx = sd < 0 ? px : px + T - 7, gg = ctx.createLinearGradient(gx, 0, gx + 7, 0);
        gg.addColorStop(sd < 0 ? 0 : 1, "rgba(15,14,16,.75)"); gg.addColorStop(sd < 0 ? 1 : 0, "rgba(15,14,16,0)"); ctx.fillStyle = gg; ctx.fillRect(gx, py, 7, T);
      }
      if (pal.rim && (tileAt(tx - 1, ty) !== 1 || tileAt(tx + 1, ty) !== 1)) { // stone-rubbing speckle on exposed sides
        ctx.fillStyle = pal.rim; const sx = tileAt(tx - 1, ty) !== 1 ? px : px + T - 1.5;
        for (let i = 0; i < 4; i++) ctx.fillRect(sx, py + ((tx * 13 + ty * 7 + i * 9) % T), 1.5, 2 + (i % 2) * 2);
      }
    } else if (v === 3 && tileAt(tx - 1, ty) !== 3) { // one painted ledge per run of '=' tiles
      let n = 1; while (tileAt(tx + n, ty) === 3) n++;
      const i = LV.ledgeStone ? P2.ledge : P2.plank, f = SPR.props2 && SPR.props2.f[i];
      if (f) { const segN = Math.max(1, Math.round(n / 4)), segW = n * T / segN, hh = segW * f.h / f.w;
        for (let k = 0; k < segN; k++) ctx.drawImage(pal.night ? SPR.props2.inv : SPR.props2.img, f.x, f.y, f.w, f.h, px + k * segW - 2, py - 3, segW + 4, Math.min(hh, LV.ledgeStone ? 30 : 26)); }
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
  if (SC && SPR.pines) { ctx.globalAlpha = .8; for (const p of SC.front) if (visible(p.x)) for (let r = 1; r > 0; r--) drawSprite("pines", p.i, p.x, p.y + 6, p.h / SPR.pines.f[p.i].h, p.flip, .5, pal.night); ctx.globalAlpha = 1; }
  const sealed = bossAlive();
  for (const d of drumsInPlay()) if (visible(d.x)) { // 천고 on a lacquered stand, pulsing on the beat; dim while its guardian stands
    if (sealed) ctx.globalAlpha = .45;
    const beat = 1 - (songPos / Music.beatLen % 1), s = 1 + Math.max(0, beat - .75) * .4;
    const gl = ctx.createRadialGradient(d.x, d.y - 22, 4, d.x, d.y - 22, 44); gl.addColorStop(0, "rgba(195,22,28,.28)"); gl.addColorStop(1, "rgba(195,22,28,0)"); ctx.fillStyle = gl; ctx.fillRect(d.x - 44, d.y - 66, 88, 88);
    ctx.fillStyle = "#3a1b14"; ctx.fillRect(d.x - 12, d.y - 14, 3, 14); ctx.fillRect(d.x + 9, d.y - 14, 3, 14);
    if (!drawSprite("hudsolid", HUD.bigDrum, d.x, d.y - 10, (d.big ? 86 : 38) * s / (SPR.hudsolid ? SPR.hudsolid.f[HUD.bigDrum].h : 1), false, .5, false, 1)) { ctx.fillStyle = SEAL; ctx.beginPath(); ctx.arc(d.x, d.y - 26, 16, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
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
  if (LV.seal) { const sl = LV.seal, h = (sl.y1 + 1) * T, grow = Math.min(1, sl.t * 2.5);   // 결계: two curtains of ink hung with talismans
    for (const x of [sl.x0, sl.x1]) { const wx = x * T, top = h - h * grow;
      if (SPR.bvfx) { const f = SPR.bvfx.f[BV.curtain], sc = 54 / f.w; ctx.globalAlpha = .8; for (let y = h; y > top - f.h * sc * .5; y -= f.h * sc * .8) drawSprite("bvfx", BV.curtain, wx + T / 2, y, sc, false, .5, pal.night, 1); ctx.globalAlpha = 1; }
      else { ctx.globalAlpha = .55; inkWash(wx + 4, top, T - 8, h - top, pal.night ? "#d8d1c4" : "#1d1b20", x * 13); ctx.globalAlpha = 1; }
      for (let y = h - 40; y > top + 10; y -= 74) { const sw = Math.sin(tt * 2 + y * .05 + x) * 3; ctx.save(); ctx.translate(wx + T / 2 + sw, y); ctx.rotate(sw * .03);
        if (!spr("bcal", BC.talisman, 0, 0, 40)) { ctx.fillStyle = "#e8cf6a"; ctx.fillRect(-7, -16, 14, 32); ctx.strokeStyle = SEAL; ctx.lineWidth = 1.4; ctx.strokeRect(-5, -13, 10, 26); } ctx.restore(); } } }
  // 과녁: a red ring hung on a cord; a faint ghost of it while it waits to hang again
  for (const g of LV.targets) { if (!visible(g.x)) continue;
    const sw = Math.sin(tt * 1.6 + g.sway) * 2, up = g.t > 0, k = up ? Math.max(.18, 1 - g.t / 2.5) : 1;
    ctx.save(); ctx.translate(g.x + sw, g.y); ctx.globalAlpha = up ? .22 : 1;
    ctx.strokeStyle = pal.tile; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(-3, -40, 0, -64); ctx.stroke();
    brushRing(0, 0, 13 * (up ? k : 1), SEAL, 2.6, 3); brushRing(0, 0, 6.5, SEAL, 1.8, 4);
    if (!up) { ctx.fillStyle = SEAL; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore(); }
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
    if (on) { ctx.globalAlpha = .5 + .25 * Math.sin(tt * 12); brushRing(p.x + sw, p.y, 17, JJOK, 1.6, p.x); ctx.globalAlpha = 1; }
    if (on && P && !P.hook) { ctx.globalAlpha = .55; brushLine(P.x + P.w / 2, P.y + 10, p.x + sw, p.y, JJOK, 2, true, p.x); ctx.globalAlpha = 1; }   // what jump or 연 will catch
  }
  if (hookCand && hookCand.enemy && P && !P.hook) { ctx.globalAlpha = .6; brushLine(P.x + P.w / 2, P.y + 10, hookCand.x, hookCand.y, SEAL, 2, true, 7); brushRing(hookCand.x, hookCand.y, 16, SEAL, 1.6, 7); ctx.globalAlpha = 1; }   // 연사슬 target
  if (P && P.kiteFlash) { ctx.globalAlpha = Math.min(1, P.kiteFlash.t * 6); brushLine(P.x + P.w / 2, P.y + 12, P.kiteFlash.x1, P.kiteFlash.y1, pal.fig, 2, false, 3); ctx.globalAlpha = 1; }   // the kite string, snapping for a blink

  drawHazards(pal);
  for (const e of enemies) if (e.alive && (visible(e.x) || e.type === "b")) {
    if (e.hitT > 0 && Math.floor(e.hitT * 30) % 2) ctx.globalAlpha = .45;   // hit flicker
    if (e.alive) { const ga = ctx.globalAlpha; drawKanAura(e); ctx.globalAlpha = ga; }
    drawEnemy(e, pal); ctx.globalAlpha = 1;
    if (e.stunT > 0) { ctx.strokeStyle = `rgba(214,170,60,${.5 + .3 * Math.sin(tt * 20)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.type === "d" ? e.y - 8 : e.y - 26, 12, 4, 0, 0, 7); ctx.stroke(); }   // frozen by moonlight / lightning
    if (e.ward) { // 무당's talisman hovering over the warded soldier
      const wy = e.type === "d" ? e.y - 22 : e.y - 46, bob = Math.sin(tt * 3 + e.id) * 2;
      if (!drawSprite("foes2", F2.ward, e.x + e.w / 2, wy + bob, 24 / (SPR.foes2 ? SPR.foes2.f[F2.ward].h : 1), false, .5, false, .5)) { ctx.strokeStyle = JJOK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 26, 0, 7); ctx.stroke(); }
    }
    drawKanFlash(e, tt);
    if (e.maxHp > 1 && e.type !== "b") { // remaining hits as small ink drops over the head
      const top = e.type === "d" ? e.y - 10 : e.y - 34, cx = e.x + e.w / 2;
      for (let i = 0; i < e.maxHp; i++) { ctx.fillStyle = i < e.hp ? SEAL : "rgba(80,74,70,.35)"; ctx.beginPath(); ctx.arc(cx + (i - (e.maxHp - 1) / 2) * 7, top, 2.6, 0, 7); ctx.fill(); }
    }
  }
  for (const b of bullets) {
    if (b.talisman) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.ang + Math.sin(b.t * 9) * .15); ctx.globalAlpha = Math.min(1, b.life * 4);   // 부적: yellow paper, vermilion seal strokes
      ctx.fillStyle = "#e8cf6a"; ctx.fillRect(-7, -12, 14, 24); ctx.strokeStyle = "#17161a"; ctx.lineWidth = .8; ctx.strokeRect(-7, -12, 14, 24);
      ctx.strokeStyle = SEAL; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(3, -8); ctx.moveTo(0, -9); ctx.lineTo(0, 8); ctx.moveTo(-4, -1); ctx.lineTo(4, 3); ctx.moveTo(4, -1); ctx.lineTo(-4, 3); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; continue; }
    if (b.blade && SPR.slashfx) { const f = SPR.slashfx.f[SF.arc], left = Math.cos(b.ang) < -.2; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(left ? b.ang + Math.PI : b.ang); ctx.globalAlpha = Math.min(1, b.life * 5) * .55;
      drawSprite("slashfx", SF.arc, 0, 0, 44 / f.h * (1 + .1 * Math.sin(b.t * 40)), left, .5, pal.night, .5); ctx.restore(); ctx.globalAlpha = 1; continue; }
    if (b.thorn) { const a = Math.atan2(b.vy, b.vx); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); ctx.fillStyle = "#9a1424"; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, -3); ctx.lineTo(-16, 0); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill(); ctx.restore();   // 혈 공명's thorn of blood
      if (Math.random() < .6) parts.push({ x: b.x, y: b.y, vx: 0, vy: 30, life: .3, max: .3, c: "#9a1424", s: 2 }); continue; }
    if (b.smoke && SPR.pfx) { const f = SPR.pfx.f[3]; ctx.globalAlpha = Math.min(1, b.life * 2.5) * .9; drawSprite("pfx", 3, b.x, b.y, 54 / f.h * (1 + (1 - Math.min(1, b.life)) * .3), false, .5, false, .5); ctx.globalAlpha = 1; continue; }   // 화약 연기
    if (b.fire && !b.smoke) { drawFlame(b); continue; }
    const bg = b.big ? 1.6 : 1, ps = b.sword ? ["slashfx", SF.sword, 16] : b.moon ? ["slashfx", SF.moon, 46 * bg] : b.dragon ? ["perkfx", PF.dragon, 40] : b.fire ? ["perkfx", PF.fire, 26 * bg] : b.tornado ? ["perkfx", PF.wind, 58 * bg] : null;
    if (ps && SPR[ps[0]]) { const f = SPR[ps[0]].f[ps[1]], fade = b.fire || b.tornado ? Math.min(1, b.life * 3) : 1; ctx.save(); ctx.translate(b.x, b.y); ctx.globalAlpha = fade * .95;
      if (b.sword || b.moon || b.dragon) { const a = Math.atan2(b.vy, b.vx), left = Math.cos(a) < 0; ctx.rotate(left ? a + Math.PI : a); drawSprite(ps[0], ps[1], 0, 0, ps[2] / f.h, left, .5, false, .5); }
      else drawSprite(ps[0], ps[1], 0, b.fire ? 8 : 0, ps[2] / f.h, false, .5, false, b.fire ? 1 : .5);
      ctx.restore(); ctx.globalAlpha = 1; continue; }
    const bs = b.fan ? FXB.fan : b.water ? FXB.water : b.scrap ? FXB.scrap : null;
    if (bs != null && SPR.bossfx && !b.friendly) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.fan ? b.t * 18 : b.scrap ? b.t * 9 : 0); drawSprite("bossfx", bs, 0, 0, (b.fan ? 30 : b.water ? 20 : 22) / SPR.bossfx.f[bs].h, false, .5, false, .5); ctx.restore(); continue; }
    if (b.orb && !b.friendly && SPR.bossB) { drawSprite("bossB", F3.orb, b.x, b.y, 24 / SPR.bossB.f[F3.orb].h, false, .5, false, .5); continue; }
    if (b.wave) { // the ground wave: a running crest of black ink with a red lip
      const d = Math.sign(b.vx), wob = Math.sin(tt * 30 + b.x * .05) * 2;
      ctx.fillStyle = pal.night ? "#d8d1c4" : "#17161a"; ctx.beginPath(); ctx.moveTo(b.x - d * 34, b.y + 12); ctx.quadraticCurveTo(b.x - d * 10, b.y - 20 + wob, b.x + d * 8, b.y - 14 + wob); ctx.quadraticCurveTo(b.x + d * 2, b.y, b.x + d * 12, b.y + 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = SEAL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x - d * 6, b.y - 16 + wob); ctx.quadraticCurveTo(b.x + d * 6, b.y - 16 + wob, b.x + d * 8, b.y - 6); ctx.stroke();
      continue;
    }
    if (b.red && SPR.mech) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI); drawSprite("mech", MECH.fire, 0, 0, 30 / SPR.mech.f[MECH.fire].h, false, .2, false, .5); ctx.restore(); continue; }
    const sp = Math.hypot(b.vx, b.vy) || 1, tl = b.sniper ? 34 : 18;
    const tr = ctx.createLinearGradient(b.x, b.y, b.x - b.vx / sp * tl, b.y - b.vy / sp * tl);
    tr.addColorStop(0, b.friendly ? "rgba(39,70,106,.8)" : "rgba(195,22,28,.75)"); tr.addColorStop(1, "rgba(140,134,126,0)");
    ctx.strokeStyle = tr; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / sp * tl, b.y - b.vy / sp * tl); ctx.stroke();
    ctx.fillStyle = pal.night ? "#d8d1c4" : "#141317"; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.friendly ? JJOK_L : "#ff6a3d"; ctx.beginPath(); ctx.arc(b.x, b.y, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
  const gsh = chr("munyeo") && SPR.mu ? "mu" : chr("posu") && SPR.po ? "po" : null;
  for (const g of ghosts) { ctx.globalAlpha = .3 * (1 - g.age / g.life); if (gsh) { drawSprite(gsh, H3.dash, g.x + 9, g.y + 31, kOf(gsh, 0, HERO_H * 1.08), g.face < 0, (gsh === "mu" ? MU_AX : PO_AX)[H3.dash], !!LV.pal.night); continue; } if (!(SPR.hero3 ? drawSprite("hero3", H3.dash, g.x + 9, g.y + 31, kOf("hero3", H3.idle, HERO_H * 1.08), g.face < 0, H3_AX[H3.dash], !!LV.pal.night) : drawSprite("hero", HERO.dash, g.x + 9, g.y + 31, kOf("hero", 0, HERO_H), g.face < 0, .55, !!LV.pal.night))) drawRunner(g.x, g.y, g.face, JJOK, null); }
  ctx.globalAlpha = 1;
  for (const bm of beams) if (bm.arrow) { // 각궁: the arrow crosses its line in a blink, a wake of ink behind it
    const k = 1 - bm.t / bm.life, f = Math.min(1, bm.t / .08), hx = bm.x0 + (bm.x1 - bm.x0) * f, hy = bm.y0 + (bm.y1 - bm.y0) * f, a = Math.atan2(bm.y1 - bm.y0, bm.x1 - bm.x0);
    ctx.strokeStyle = `rgba(23,22,26,${.45 * k})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(bm.x0, bm.y0); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); ctx.globalAlpha = Math.min(1, k * 2);
    ctx.strokeStyle = "#17161a"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.fillStyle = "#17161a"; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(2, -4); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = SEAL; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-38, -6); ctx.lineTo(-34, 0); ctx.lineTo(-38, 6); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
  for (const bm of beams) if (bm.red && !bm.arrow) { const k = 1 - bm.t / bm.life;   // 포수: the shot's line, a vermilion thread
    ctx.strokeStyle = `rgba(195,22,28,${.9 * k})`; ctx.lineWidth = (3.2 * k + .6) * (bm.w || 1); ctx.beginPath(); ctx.moveTo(bm.x0, bm.y0); ctx.lineTo(bm.x1, bm.y1); ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,190,${k})`; ctx.lineWidth = 1; ctx.stroke(); }
  if (SPR.slashfx) for (const bm of beams) if (!bm.red) { // 뇌전: a bolt stretched from the blade to each foe
    const f = SPR.slashfx.f[SF.bolt], len = Math.hypot(bm.x1 - bm.x0, bm.y1 - bm.y0), th = 26 * (1 - bm.t / bm.life * .5);
    ctx.save(); ctx.translate(bm.x0, bm.y0); ctx.rotate(Math.atan2(bm.y1 - bm.y0, bm.x1 - bm.x0)); ctx.globalAlpha = 1 - bm.t / bm.life * .6;
    ctx.drawImage(SPR.slashfx.img, f.x, f.y, f.w, f.h, 0, -th / 2, len, th); ctx.restore(); ctx.globalAlpha = 1; }
  drawBolts(); drawKegsRings(); drawCutLines();
  if (SPR.perkfx) for (const c of clones) { ctx.globalAlpha = .45 + .15 * Math.sin(performance.now() / 40); const cf = CF("clone"); if (cf && SPR[cf[0]]) { drawSprite(cf[0], cf[1], c.x, c.y, HERO_H * 1.15 / SPR[cf[0]].f[cf[1]].h, c.face < 0, .5, false, 1); ctx.globalAlpha = 1; continue; } drawSprite("perkfx", PF.clone, c.x, c.y, kOf("hero3", H3.idle, HERO_H * 1.08) * 1.1, c.face < 0, .5, false, 1); ctx.globalAlpha = 1; }
  if (P && (state === "play" || state === "pause" || state === "result" || state === "dead")) drawPlayer(pal);
  for (const p of parts) { // round drops of ink, stretched a little along their flight — never square specks
    const k = Math.max(0, p.life / p.max), sp = Math.hypot(p.vx, p.vy), r = p.s * .5 * (.6 + .4 * k), st = Math.min(2.2, 1 + sp / 500);
    ctx.globalAlpha = k; ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * st, r, sp > 20 ? Math.atan2(p.vy, p.vx) : 0, 0, 6.283); ctx.fill(); }
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
    if (s.ch) { // a stamped character: vermilion block, carved frame, paper-white 斬 — it lands hard and stays a moment
      const a = s.t < .06 ? s.t / .06 : 1 - Math.max(0, s.t - .7) / .4, sc = s.t < .06 ? 2 - s.t / .06 : 1 + Math.max(0, .1 - s.t) * .6, z = s.big ? 46 : 30;
      ctx.save(); ctx.translate(s.x, s.y - 30); ctx.rotate(s.rot); ctx.scale(sc, sc); ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "rgba(23,22,26,.35)"; ctx.fillRect(-z / 2 + 3, -z / 2 + 3, z, z);
      ctx.fillStyle = SEAL; ctx.fillRect(-z / 2, -z / 2, z, z);
      if (SPR.vis) drawSprite("vis", VIS.seal, 0, 0, z * 1.08 / SPR.vis.f[VIS.seal].h, false, .5, false, .5);
      ctx.fillStyle = "#f6f0e2"; ctx.font = `700 ${Math.round(z * .62)}px "Song Myung", serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s.ch, 0, 1);
      ctx.restore(); ctx.textAlign = "left"; continue;
    }
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
    const ac = pal.night && !SPR.guide ? "#b9c8ea" : JJOK;   // indigo on paper, pale blue on the inverted night
    ctx.globalAlpha = .7; brushLine(cx + d.x * 20, cy + d.y * 20, cx + d.x * 138, cy + d.y * 138, ac, 2.4, true, 11); ctx.globalAlpha = 1;   // the line of the dash, a light trail of brush dabs
    if (has("d_charge")) { const c = Math.min(1, P.focusT / .8); ctx.globalAlpha = .75; brushRing(cx, cy, 16 + 22 * c, c >= 1 ? SEAL : ac, c >= 1 ? 2.4 : 1.4, 7); ctx.globalAlpha = 1; }   // 축기: the ring fills, red when full
    const rs = 1 + Math.sin(performance.now() / 90) * .06;
    { const rx = cx + d.x * 152, ry = cy + d.y * 152; ctx.globalAlpha = .8; brushRing(rx, ry, 9 * rs, ac, 1.6, 5); if (!SPR.guide) for (let q = 0; q < 4; q++) { const qa = q * Math.PI / 2 + .3; inkDab(rx + Math.cos(qa) * 14 * rs, ry + Math.sin(qa) * 14 * rs, qa, 6, 1.6, ac); } ctx.globalAlpha = 1; }   // where the dash will land, a small brushed ring
  }

  // screen space overlays
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!vignette) { vignette = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .75); vignette.addColorStop(0, "rgba(20,18,16,0)"); vignette.addColorStop(1, "rgba(20,18,16,.32)"); }
  if (omen("angae") && P) { // 안개: only a pocket of paper around the swordsman stays clear
    const px = (P.x + P.w / 2 - cam.x) * SCALE * DPR + cv.width / 2, py = (P.y + P.h / 2 - cam.y) * SCALE * DPR + cv.height / 2, r = 120 * SCALE * DPR;
    const fg = ctx.createRadialGradient(px, py, r * .8, px, py, r * 2.6); fg.addColorStop(0, "rgba(226,222,212,0)"); fg.addColorStop(1, pal.night ? "rgba(30,28,30,.9)" : "rgba(226,222,212,.9)");
    ctx.fillStyle = fg; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  if (!LITE()) { ctx.fillStyle = vignette; ctx.fillRect(0, 0, cv.width, cv.height); }
  const boss = enemies.find(e => e.type === "b" && e.alive && e.awake);
  if (boss && (state === "play" || state === "dead" || state === "pause")) { // 수문장's life as a brush bar along the top
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bw = Math.min(440, W * .6), bx = W / 2 - bw / 2, by = 48, fr = Math.max(0, boss.hp) / boss.maxHp;
    boss.hpShow = Math.max(boss.hp, (boss.hpShow ?? boss.hp) - rdt * boss.maxHp * .35);
    ctx.fillStyle = "rgba(23,22,26,.3)"; ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
    ctx.fillStyle = "rgba(242,226,200,.85)"; ctx.fillRect(bx, by, bw * Math.max(0, boss.hpShow) / boss.maxHp, 8);
    ctx.fillStyle = boss.raged ? "#e0331f" : SEAL; ctx.fillRect(bx, by, bw * fr, 8);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(bx, by, bw * fr, 3);
    if (!boss.raged) { ctx.fillStyle = pal.text; ctx.fillRect(bx + bw / 2 - 1, by - 4, 2, 16); }   // where the fury wakes
    if (boss.stagT > .5) { ctx.fillStyle = JJOK; ctx.font = `400 12px "Song Myung", serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("흐트러짐", bx + bw + 8, by + 4); }
    { const ni = BNAME[boss.kind], hw = SPR.bname && ni != null ? sprW("bname", ni, 20) : 0, label = `${BOSSES[boss.kind].name}${boss.raged ? " · 격노" : ""}`;
      ctx.font = `400 16px "Song Myung", serif`; const tw = ctx.measureText(label).width, x0 = W / 2 - (tw + (hw ? hw + 8 : 0)) / 2;
      ctx.fillStyle = boss.raged ? SEAL : pal.text; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.fillText(label, x0, by - 4);
      if (hw) spr("bname", ni, x0 + tw + 8 + hw / 2, by - 13, 20); else { ctx.fillStyle = pal.text; ctx.fillText(" " + BOSSES[boss.kind].han, x0 + tw, by - 4); } }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  drawBossCards(pal); drawCombatHud(pal);
  if (P && P.focus && state === "play") { ctx.fillStyle = "rgba(39,70,106,.14)"; ctx.fillRect(0, 0, cv.width, cv.height); }
  else if (killCam > 0 && state === "play") { ctx.fillStyle = `rgba(120,10,16,${.12 * Math.min(1, killCam * 3)})`; ctx.fillRect(0, 0, cv.width, cv.height); }   // a faint red breath over the held moment
  if (flash > 0) { ctx.strokeStyle = `rgba(195,22,28,${flash * 3})`; ctx.lineWidth = 10 * DPR; ctx.strokeRect(0, 0, cv.width, cv.height); }
  drawTrail();
  if (state === "play" || state === "dead" || state === "pause") drawBeatBar(pal);
  if (state === "dead") {
    const a = Math.max(0, 1 - deathT / 0.75);
    ctx.fillStyle = `rgba(20,18,20,${0.55 * a})`; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = Math.min(1, a * 2);
    ctx.fillStyle = "#f1ede4"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const sf = SPR.roguea && SPR.roguea.f[0];
    if (sf) { // 絶命 in red brush, written down the screen; lands large and settles
      const k = Math.min(1, deathT / .12), sw = Math.min(W * .22, 180) * (1.2 - .2 * k), sh = sw * sf.h / sf.w;
      ctx.drawImage(SPR.roguea.img, sf.x, sf.y, sf.w, sf.h, W / 2 - sw / 2, H / 2 - sh / 2 - 6, sw, sh);
    } else { ctx.font = `400 ${Math.min(72, W / 8)}px "Song Myung", serif`; ctx.fillText("절명", W / 2, H / 2 - 12); }
    if (mode !== "tutorial") { ctx.font = `600 13px ${BODY_FONT}`; ctx.fillText(run.breath > 0 ? `남은 숨 ${run.breath}` : "숨이 다했다", W / 2, H - 92); }
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }
}
const SEASON_TINT = [null, "rgb(236,206,170)", "rgb(196,210,232)", "rgb(246,226,226)"];
const LEAF = ["#a8471f", "#c7782a", "#7a3a1a", "#b5561f"], PETAL = ["#e9a3b0", "#f2c4cc", "#f7dbe0"];
function drawWeather(ssn, tt, pal) { // screen-space weather: 여름 비, 가을 낙엽, 겨울 눈, 봄 꽃잎; 역풍 slants it hard
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const wind = omen("yeokpung") ? 1 : 0, wrap = (v, m) => ((v % m) + m) % m;
  if (ssn === 0) {
    ctx.strokeStyle = `rgba(${pal.wash},.13)`; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const rx = wrap(i * 137.5 + tt * (50 - wind * 420) - cam.x * 0.6, W + 40) - 20, ry = wrap(i * 89.3 + tt * 650, H + 40) - 20;
      ctx.moveTo(rx, ry); ctx.lineTo(rx - 3 - wind * 9, ry + 13);
    }
    ctx.stroke(); return;
  }
  const n = ssn === 2 ? 80 : 34;
  for (let i = 0; i < n; i++) {
    const sp = ssn === 2 ? 40 + (i % 5) * 12 : 55 + (i % 4) * 14, sway = Math.sin(tt * (1 + i % 3 * .4) + i) * (ssn === 2 ? 14 : 30);
    const x = wrap(i * 173.3 + sway + tt * (14 - wind * 260) - cam.x * .5, W + 40) - 20, y = wrap(i * 97.1 + tt * sp, H + 40) - 20;
    if (ssn === 2) { ctx.fillStyle = pal.night ? "rgba(236,230,216,.6)" : "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * .7, 0, 7); ctx.fill(); continue; }
    ctx.save(); ctx.translate(x, y); ctx.rotate(tt * (1 + i % 4) * .7 + i); ctx.globalAlpha = .75;
    ctx.fillStyle = ssn === 1 ? LEAF[i % 4] : PETAL[i % 3];
    ctx.beginPath(); ctx.ellipse(0, 0, ssn === 1 ? 4.2 : 3, ssn === 1 ? 2.2 : 1.8, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawBackdrop(pal) {
  const camX = cam.x || 0, camY = cam.y || 0;
  const lh = LV ? LV.h * T : 512;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  { const by = H * .8 + (lh - camY) * .22 * .5 * SCALE, g = ctx.createLinearGradient(0, Math.min(H * .55, by - H * .25), 0, H);   // under the far hills: mist thickening toward the gorge, never bare paper
    g.addColorStop(0, `rgba(${pal.wash},0)`); g.addColorStop(.55, `rgba(${pal.wash},${pal.night ? .08 : .1})`); g.addColorStop(1, `rgba(${pal.wash},${pal.night ? .18 : .26})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
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
let beatHitAt = 0;   // when the last 일격 landed, for the burst on the ring
function drawBeatBar(pal) {
  // drums slide in at an even spacing and are struck as they reach the ring on the left: that moment is the 일격 window
  const def = Music.def; if (!def) return;
  const bl = Music.beatLen, pos = Music.pos(), gap = 64, mx = W / 2 - 96, y = H - 30, ahead = 4;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bf = SPR.props2 && SPR.props2.f[P2.board];
  if (bf) { // lacquered board: end caps keep their proportions, only the plain middle stretches
    const bw = gap * ahead + 104, bh = 62, cap = bf.w * .16, capW = cap * bh / bf.h, bx = mx - 52, im = SPR.props2.img;
    ctx.drawImage(im, bf.x, bf.y, cap, bf.h, bx, y - 30, capW, bh);
    ctx.drawImage(im, bf.x + cap, bf.y, bf.w - cap * 2, bf.h, bx + capW - .5, y - 30, bw - capW * 2 + 1, bh);
    ctx.drawImage(im, bf.x + bf.w - cap, bf.y, cap, bf.h, bx + bw - capW, y - 30, capW, bh);
  }
  else uiPatch(5, mx - 46, y - 30, gap * ahead + 92, 60, pal.night ? .5 : .9);
  // 천고 기운: five drums light up as the fight is won by 일섬; all five lit, the great drum calls for 천고일섬
  const qi = (run && run.qi) || 0, full = qi >= 100 && mode !== "tutorial", ph = ((pos / bl) % 1 + 1) % 1, beatK = Math.max(0, .2 - Math.min(ph, 1 - ph)) * 1.2;   // the drums still nod to the music
  for (let i = 0; i <= ahead; i++) {
    const x = mx + i * gap, big = i === ahead, lit = Math.max(0, Math.min(1, (qi - i * 20) / 20)), sz = (big ? 42 : 30) * (1 + (lit >= 1 ? beatK : 0) + (full && big ? .12 + beatK : 0));
    ctx.globalAlpha = .22 + .78 * lit;
    if (!(SPR.vis && drawSprite("vis", big ? VIS.bigDrum : VIS.drum, x, y, sz / SPR.vis.f[big ? VIS.bigDrum : VIS.drum].h, false, .5, false, .5))) { ctx.fillStyle = lit >= 1 ? SEAL : pal.text; ctx.beginPath(); ctx.arc(x, y, sz / 3, 0, Math.PI * 2); ctx.fill(); }
    if (lit > 0 && lit < 1) { ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(232,184,74,.9)"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, sz * .56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lit); ctx.stroke(); }
  }
  if (full) { const x = mx + ahead * gap, pulse = .6 + .4 * Math.sin(performance.now() / 120); ctx.globalAlpha = pulse;
    if (!(SPR.mech && drawSprite("mech", MECH.drum, x, y, 66 * (1 + .06 * pulse) / SPR.mech.f[MECH.drum].h, false, .5, false, .5))) { ctx.strokeStyle = "rgba(232,184,74,.95)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.font = `400 13px "Song Myung", serif`; ctx.textAlign = "center"; ctx.fillStyle = SEAL; ctx.fillText("천고", x, y - 30); ctx.textAlign = "left"; }
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
// mv0-2 (무명·무녀·포수): an 8-step run with the legs crossing, a 4-step cut and a 4-step dashing cut
const MV_BASE = { mv0: "hero3", mv1: "mu", mv2: "po", mvrun: "hero3" };
function movePose(mv) {
  if (!SPR[mv]) return null;
  if (P.slashT > 0 && Math.abs(P.slashDir.y) <= .5) { const pr = 1 - Math.min(1, P.slashT / (P.slashDur || .14)); return [mv, (P.dashT > 0 ? 12 : 8) + Math.min(3, Math.floor(pr * 4))]; }
  if (P.dashT > 0 && !P.hook && P.slashT <= 0) return [mv, 14];
  if (P.onGround && Math.abs(P.vx) > 40 && !(P.landT > 0) && P.slashT <= 0) return [mv === "mv0" && SPR.mvrun ? "mvrun" : mv, Math.floor(P.run / 1.05) % 8];
  return null;
}
function heroPose() { // [sheet, frame]
  const cb = !SPR.chars ? -1 : chr("munyeo") ? 0 : chr("posu") ? 8 : -1;
  if (cb >= 0) { // 무녀 and 포수 have their own sheet
    const w = wpn();
    if (SPR.arms && state !== "dead") { // 방울·신칼·각궁·창 have their own stances
      if (w === "gakgung" && (P.iaiHold || (P.slashT > 0 && P.strike))) return ["arms", P.iaiHold ? 4 : 5];
      const A = { bangul: [0, 1], singal: [2, 3], gakgung: [null, 5], chang: [6, 7] }[w];
      if (A && P.slashT > 0) return ["arms", A[1]];
      if (A && A[0] != null && P.onGround && Math.abs(P.vx) <= 40 && !(P.dashT > 0)) return ["arms", A[0]];
    }
    if (state === "dead") return ["chars", cb + 7];
    const sh = cb ? "po" : "mu";
    if (SPR[sh]) { // the full set of moves
      const mp = movePose(cb ? "mv2" : "mv1"); if (mp) return mp;
      if (P.slashT > 0) return [sh, P.slashDir.y < -0.5 ? H3.up : (P.slashDir.y > 0.5 && !P.onGround ? H3.down : H3.slash)];
      if (P.dashT > 0 || P.hook) return [sh, H3.dash];
      if (!P.onGround) return [sh, P.wall ? H3.wall : P.vy < -150 ? H3.rise : Math.abs(P.vy) < 150 ? H3.flip : H3.fall];
      if (P.landT > 0) return [sh, H3.land];
      if (Math.abs(P.vx) > 40) return [sh, H3.run[Math.floor(P.run / 1.05) % H3.run.length]];
      return [sh, H3.idle];
    }
    if (P.slashT > 0) return ["chars", cb + (P.strike ? 6 : 5)];
    if (P.dashT > 0 || P.hook) return ["chars", cb ? cb + 2 : 6];
    if (!P.onGround) return ["chars", cb + 4];
    if (Math.abs(P.vx) > 40) return ["chars", cb + 1 + Math.floor(P.run / 1.05) % 3];
    return ["chars", cb];
  }
  if (state === "dead") return ["hero", HERO.dead];
  if (SPR.hero3 && SPR.weapons && wpn() !== "hwando") { // the weapon's own stances
    const w = wpn();
    if (w === "baldo" && (P.iaiCut || (P.slashT > 0 && P.strike))) return ["weapons", WF.bdCut];
    if (w === "baldo" && P.iaiHold && P.onGround) return ["weapons", WF.bdStance];
    if (P.slashT > 0) return ["weapons", w === "ssang" ? ((P.combo || 0) % 2 ? WF.ssA : WF.ssB) : w === "woldo" ? (P.slashDir.y > .5 && !P.onGround ? WF.wdSlam : WF.wdSweep) : WF.bdCut];
    if (P.onGround && Math.abs(P.vx) <= 40 && !P.landT && !(P.dashT > 0)) return ["weapons", w === "ssang" ? WF.ssIdle : w === "woldo" ? WF.wdIdle : WF.bdSheathe];
  }
  if (SPR.hero3) {
    { const mp = movePose("mv0"); if (mp) return mp; }
    if (P.slashT > 0 && SPR.slashfx) return ["slashfx", P.slashDir.y < -0.5 ? SF.up : (P.slashDir.y > 0.5 && !P.onGround ? SF.down : SF.fwd)];
    if (P.slashT > 0) return ["hero3", P.slashDir.y < -0.5 ? H3.up : (P.slashDir.y > 0.5 && !P.onGround ? H3.down : H3.slash)];
    if (P.dashT > 0 || P.hook) return ["hero3", H3.dash];
    if (!P.onGround) return ["hero3", P.wall ? H3.wall : P.vy < -150 ? H3.rise : Math.abs(P.vy) < 150 ? H3.flip : H3.fall];
    if (P.landT > 0) return ["hero3", H3.land];
    if (Math.abs(P.vx) > 40) return ["hero3", H3.run[Math.floor(P.run / 1.05) % H3.run.length]];
    return ["hero3", H3.idle];
  }
  if (P.slashT > 0) return ["hero", P.slashDir.y < -0.5 ? HERO.up : (P.slashDir.y > 0.5 && !P.onGround ? HERO.fall : HERO.slash)];
  if (P.dashT > 0 || P.hook) return ["hero", HERO.dash];
  if (!P.onGround) {
    if (P.wall) return ["hero", HERO.wall];
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
  const cx = P.x + P.w / 2, wallPose = sheet === "hero" && fr === HERO.wall, face = wallPose ? P.wall : P.face;
  // hero2 is scaled so its first running step matches the original running frames
  const k = MV_BASE[sheet] ? kOf(MV_BASE[sheet], 0, HERO_H * 1.08) * SPR[MV_BASE[sheet]].f[1].h / SPR[sheet].f[0].h : sheet === "mu" || sheet === "po" ? kOf(sheet, 0, HERO_H * 1.08) : sheet === "arms" ? kOf("arms", fr < 4 ? 2 : 5, HERO_H * 1.08) : sheet === "chars" ? kOf("chars", fr < 8 ? 0 : 8, HERO_H * 1.08) : sheet === "weapons" ? kOf("hero3", H3.idle, HERO_H * 1.08) * SLASH_K * .75 / .8 : sheet === "slashfx" ? kOf("hero3", H3.idle, HERO_H * 1.08) * SLASH_K : sheet === "hero3" ? kOf("hero3", H3.idle, HERO_H * 1.08) : sheet === "hero" ? kOf("hero", 0, HERO_H) : kOf("hero", 0, HERO_H) * SPR.hero.f[1].h / SPR.hero2.f[H2.start].h;
  if (state === "dead") ctx.globalAlpha = Math.max(0, 1 - deathT / 0.75);
  else if (P.invT > 0 && !(P.dashInvT > 0)) ctx.globalAlpha = Math.floor(P.invT * 14) % 2 ? .35 : 1;
  else if (P.dashInvT > 0) ctx.globalAlpha = .75 + .25 * Math.sin(performance.now() / 60);
  if (pal.night && !LV.pal.night) { // slow-mo: hero keeps his ink, lifted off the dark paper by a pale wash
    const g = ctx.createRadialGradient(cx, P.y + P.h / 2, 4, cx, P.y + P.h / 2, 46); g.addColorStop(0, "rgba(236,230,216,.55)"); g.addColorStop(1, "rgba(236,230,216,0)");
    ctx.fillStyle = g; ctx.fillRect(cx - 46, P.y + P.h / 2 - 46, 92, 92);
  }
  const h3wall = (sheet === "hero3" || sheet === "mu" || sheet === "po") && fr === H3.wall, f3 = h3wall ? P.wall : face, breathe = (sheet === "hero3" || sheet === "mu" || sheet === "po") && fr === H3.idle ? 1 + Math.sin(performance.now() / 380) * .012 : 1;
  ctx.save(); ctx.translate(cx, P.y + P.h + 1 + (sheet === "mvrun" ? RUN_BOB[fr] : 0)); ctx.scale(1, breathe);
  drawSprite(sheet, fr, 0, 0, k, f3 < 0, MV_BASE[sheet] ? (MV_AX[sheet][fr] ?? .5) : sheet === "mu" ? MU_AX[fr] : sheet === "po" ? PO_AX[fr] : sheet === "arms" ? AF_AX[fr] : sheet === "chars" ? CF_AX[fr] : sheet === "weapons" ? WF_AX[fr] : sheet === "slashfx" ? SF_AX[fr] : sheet === "hero3" ? H3_AX[fr] : sheet === "hero" ? (HERO_AX[fr] ?? .55) : (wallPose ? .62 : .5), !!LV.pal.night);
  ctx.restore();
  ctx.globalAlpha = 1;
  if (wrule() === "ssang" && P.gise > 0 && songPos - (P.giseAt ?? -9) < 3 && state !== "dead") { const n = P.gise, full = n >= 3;   // 기세: red beads over the head, ready at three
    for (let i = 0; i < n; i++) { ctx.fillStyle = full ? SEAL : "rgba(60,56,50,.75)"; ctx.beginPath(); ctx.arc(cx - (n - 1) * 3.5 + i * 7, P.y - 10, full ? 2.8 : 2.2, 0, Math.PI * 2); ctx.fill(); } }
  if (chr("posu") && wpn() !== "gakgung" && (P.reloadAt || 0) > songPos && state !== "dead") { const k = 1 - ((P.reloadAt - songPos) / ((has("soksa") ? 1 : 2) * Music.beatLen));   // the match being relit: a small arc over his hat
    ctx.strokeStyle = "rgba(23,22,26,.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, P.y - 14, 6, 0, 6.283); ctx.stroke(); ctx.strokeStyle = SEAL; ctx.beginPath(); ctx.arc(cx, P.y - 14, 6, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.stroke(); }
  if (P.iaiHold && wk() === "baldo" && state !== "dead") { const held = (performance.now() - (P.iaiAt || 0)) / 1000, near = held >= IAI_MASTER, q = Math.min(1, held / IAI_FULL), cy = P.y + P.h / 2;   // first ring: the draw; it turns red at the second   // 발도: the ring fills as the draw gathers, and reddens on the beat once full
    ctx.strokeStyle = "rgba(23,22,26,.25)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, 30, 0, 7); ctx.stroke();
    ctx.strokeStyle = q < 1 ? "rgba(23,22,26,.7)" : near ? SEAL : JJOK; ctx.lineWidth = q < 1 ? 2.2 : near ? 3.4 : 2.6; ctx.beginPath(); ctx.arc(cx, cy, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q); ctx.stroke();
    if (q >= 1 && near) { ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(cx, cy, 36, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } }   // 발도: the ring reddens when releasing now would land on the beat
  if (P.orbit && state !== "dead" && (chr("munyeo") || chr("posu"))) for (let i = 0; i < P.orbit.n; i++) { const a = P.orbit.a + i * Math.PI * 2 / P.orbit.n, ox = cx + Math.cos(a) * 46, oy = P.y + P.h / 2 + Math.sin(a) * 40;   // talismans for her, balls of shot for him
    ctx.save(); ctx.translate(ox, oy); ctx.globalAlpha = Math.min(1, P.orbit.t * 3);
    if (chr("munyeo")) { ctx.rotate(a + Math.PI / 2); ctx.fillStyle = "#e8cf6a"; ctx.fillRect(-6, -10, 12, 20); ctx.strokeStyle = SEAL; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.moveTo(-3, -2); ctx.lineTo(3, 2); ctx.stroke(); }
    else { ctx.fillStyle = "#2a2628"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.283); ctx.fill(); ctx.fillStyle = "rgba(232,184,74,.8)"; ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.6, 0, 6.283); ctx.fill(); if (Math.random() < .4) parts.push({ x: ox, y: oy, vx: 0, vy: -20, life: .3, max: .3, c: "rgba(90,86,94,.5)", s: 3 }); }
    ctx.restore(); ctx.globalAlpha = 1; }
  else if (P.orbit && SPR.slashfx && state !== "dead") for (let i = 0; i < P.orbit.n; i++) { const a = P.orbit.a + i * Math.PI * 2 / P.orbit.n, f = SPR.slashfx.f[SF.sword];
    ctx.save(); ctx.translate(cx + Math.cos(a) * 46, P.y + P.h / 2 + Math.sin(a) * 40); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = Math.min(1, P.orbit.t * 3); drawSprite("slashfx", SF.sword, 0, 0, 13 / f.h, false, .5, pal.night, .5); ctx.restore(); ctx.globalAlpha = 1; }
  const cd = CF("dragon"), dsh = cd && SPR[cd[0]] ? cd[0] : "perkfx", dfr = cd && SPR[cd[0]] ? cd[1] : PF.dragon;
  if (P.coil && SPR[dsh] && state !== "dead") for (let i = 0; i < P.coil.n; i++) { const a = P.coil.a + i * Math.PI, f = SPR[dsh].f[dfr];
    const fade = Math.min(1, P.coil.t * 4, (P.coil.max - P.coil.t) * 8 + .3), sz = P.coil.r * .95;
    for (let j = 3; j >= 0; j--) { const aj = a - j * .32;   // the body trails behind the head in fading ink
      ctx.save(); ctx.translate(cx + Math.cos(aj) * P.coil.r * .78, P.y + P.h / 2 + Math.sin(aj) * P.coil.r * .6); ctx.rotate(aj + Math.PI / 2); ctx.globalAlpha = fade * (j ? .22 / j : .95); drawSprite(dsh, dfr, 0, 0, sz * (1 - j * .1) / f.h, false, .5, false, .5); ctx.restore(); }
    ctx.globalAlpha = 1; }
  if (P.coil && state !== "dead") { ctx.strokeStyle = `rgba(23,22,26,${.25 * Math.min(1, P.coil.t * 3)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, P.y + P.h / 2, P.coil.r * .78, P.coil.r * .6, 0, P.coil.a - 2.2, P.coil.a); ctx.stroke(); }   // the sweep of its coil
  if (P.flowReady && state !== "dead") { ctx.strokeStyle = `rgba(195,22,28,${.5 + .3 * Math.sin(performance.now() / 90)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, P.y + P.h / 2, 34, 0, 6.283); ctx.stroke(); }   // 기세: a vermilion ring while it is full
  else if (has("gise") && (P.flowN || 0) > 0 && state !== "dead") for (let i = 0; i < P.flowN; i++) { ctx.fillStyle = SEAL; ctx.beginPath(); ctx.arc(cx - 9 + i * 6, P.y - 8, 2.2, 0, 6.283); ctx.fill(); }   // the count so far, as dots over the head
  if ((P.possessUntil || 0) > songPos && state !== "dead") for (let i = 0; i < 2; i++) parts.push({ x: cx + (Math.random() - .5) * 26, y: P.y + P.h - Math.random() * P.h, vx: 0, vy: -60 - Math.random() * 60, life: .4, max: .4, c: i ? "rgba(217,165,32,.8)" : "rgba(242,239,230,.9)", s: 2.5 });   // 신내림: the god's light rises off her
  if (P.ward && chr("posu") && SPR.pfx && state !== "dead") { ctx.globalAlpha = .7 + .15 * Math.sin(performance.now() / 160); drawSprite("pfx", 8, cx + P.face * 14, P.y + P.h / 2, 46 / SPR.pfx.f[8].h, P.face < 0, .5, false, .5); ctx.globalAlpha = 1; }
  else if (P.ward && SPR.slashfx && state !== "dead") { ctx.globalAlpha = .55 + .15 * Math.sin(performance.now() / 160); drawSprite("slashfx", SF.guard, cx, P.y + P.h / 2, 64 / SPR.slashfx.f[SF.guard].h, false, .5, false, .5); ctx.globalAlpha = 1; }
  const wfx = WEAPONS[wpn()].fx;
  if (P.slashT > 0 && state !== "dead" && wfx && wfx !== "streamer") drawWeaponFx(wfx, cx, P.y + P.h / 2, pal);
  else if (P.slashT > 0 && state !== "dead" && SPR.slashfx) { // one clean crescent: black ink, or a thin vermilion line for 일격
    const d = P.slashDir, dur = P.slashDur || .14, prog = 1 - Math.min(1, P.slashT / dur), i = P.strike ? SF.arcRed : SF.arc, f = SPR.slashfx.f[i];
    const left = d.x < -.2, ang = Math.atan2(d.y, Math.abs(d.x) < .2 ? .001 : Math.abs(d.x)), hh = (P.strike ? 78 : 68) * (.9 + prog * .15) * ({ woldo: 1.45, ssang: .82, baldo: 1 }[wpn()] || 1);
    const ox = cx + d.x * 26, oy = P.y + P.h / 2 - 2 + d.y * 24, rot = left ? -ang : ang, a0 = prog < .2 ? prog / .2 : Math.min(1, (1 - prog) * 2.2), sw = left ? -1 : 1;
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(rot);
    ctx.globalAlpha = a0 * .32; ctx.save(); ctx.rotate(-.42 * sw); drawSprite("slashfx", i, -6 * sw, 0, hh * .86 / f.h, left, .5, pal.night && !P.strike, .5); ctx.restore();   // afterimage of the swing a beat behind
    ctx.globalAlpha = a0; drawSprite("slashfx", i, 0, 0, hh / f.h, left, .5, pal.night && !P.strike, .5);
    if (prog > .35 && SPR.fx) { const bi = P.strike ? FX.slashBRed : FX.slashB, bf = SPR.fx.f[bi]; ctx.globalAlpha = Math.min(1, (1 - prog) * 1.6) * .45; ctx.save(); ctx.scale(sw, 1); ctx.rotate(Math.PI); drawSprite("fx", bi, -10, 0, hh * .9 / bf.h, false, .45, pal.night && !P.strike, .5); ctx.restore(); }   // the stroke breaking into ink as it ends
    if (P.strike) { ctx.globalAlpha = a0 * (1 - prog); ctx.strokeStyle = "rgba(255,236,190,.95)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-hh * .1 * sw, -hh * .48); ctx.quadraticCurveTo(hh * .3 * sw, 0, -hh * .1 * sw, hh * .48); ctx.stroke(); }   // a hairline of light along the 일격's edge
    ctx.restore(); ctx.globalAlpha = 1;
    if (wfx === "streamer") drawWeaponFx("streamer", cx, P.y + P.h / 2, pal);
  } else if (P.slashT > 0 && state !== "dead" && SPR.fx) { // fallback while the sheet loads
    const d = P.slashDir, prog = 1 - Math.min(1, P.slashT / 0.14), ang = Math.atan2(d.y, d.x), i = P.strike ? FX.slashBRed : FX.slashB, f = SPR.fx.f[i];
    ctx.save(); ctx.translate(cx + d.x * 24, P.y + P.h / 2 - 4 + d.y * 22); ctx.rotate(ang + Math.PI); if (d.x < -.2) ctx.scale(1, -1);
    ctx.globalAlpha = Math.min(1, (1 - prog) * 2.4); drawSprite("fx", i, 0, 0, 68 / f.h, false, .45, pal.night && !P.strike, .5); ctx.restore(); ctx.globalAlpha = 1;
  }
}
// 무녀·포수: their own strokes instead of the sword's crescent
const OBANG = ["#2f5fa8", "#c3161c", "#d9a520", "#f2efe6", "#1d1b20"];   // 오방색
function drawWeaponFx(kind, cx, cy, pal) {
  const d = P.slashDir, dur = P.slashDur || .14, prog = 1 - Math.min(1, P.slashT / dur), st = P.strike, left = d.x < -.2, sw = left ? -1 : 1;
  const ang = Math.atan2(d.y, Math.abs(d.x) < .2 ? .001 : Math.abs(d.x)), fade = prog < .15 ? prog / .15 : Math.min(1, (1 - prog) * 2.4), ink = pal.night ? "#ece6d8" : "#17161a";
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  if ((kind === "fan" || kind === "streamer") && SPR.mfx) { const f = SPR.mfx.f[st ? 1 : 0], hh = (st ? 104 : 84) * (.85 + prog * .3);   // the gust the fan throws
    ctx.save(); ctx.translate(cx + d.x * 34, cy + d.y * 30); ctx.rotate(left ? -ang : ang); ctx.globalAlpha = fade * .9; drawSprite("mfx", st ? 1 : 0, 0, 0, hh / f.h, left, .5, false, .5); ctx.restore(); }
  if ((kind === "thrust" || kind === "spear") && SPR.pfx) { const f = SPR.pfx.f[0], L = (kind === "spear" ? 130 : 96) * (st ? 1.15 : 1);   // a streak of ink along the thrust
    ctx.save(); ctx.translate(cx + d.x * (L * .5 + 6), cy + d.y * (L * .5 + 4)); ctx.rotate(Math.atan2(d.y, d.x)); ctx.globalAlpha = fade * .85; drawSprite("pfx", 0, 0, 0, L / f.w, false, .5, false, .5); ctx.restore(); }
  if (kind === "fan") { // a folding fan snaps open through the swing: ribs of ink, paper washed white to vermilion
    const L = (st ? 70 : 56), open = Math.min(1, prog * 2.2) * 2.1, a0 = -1.05;
    ctx.translate(cx + d.x * 8, cy + d.y * 8); ctx.scale(sw, 1); ctx.rotate(left ? -ang : ang); ctx.globalAlpha = fade;
    const g = ctx.createRadialGradient(0, 0, L * .25, 0, 0, L); g.addColorStop(0, "rgba(242,239,230,.0)"); g.addColorStop(.55, "rgba(242,239,230,.85)"); g.addColorStop(1, st ? "rgba(195,22,28,.9)" : "rgba(195,22,28,.55)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L, a0, a0 + open); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.2; for (let i = 0; i <= 9; i++) { const a = a0 + open * i / 9; ctx.beginPath(); ctx.moveTo(Math.cos(a) * L * .2, Math.sin(a) * L * .2); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.stroke(); }
    ctx.lineWidth = 2.4; ctx.strokeStyle = st ? SEAL : ink; ctx.beginPath(); ctx.arc(0, 0, L, a0, a0 + open); ctx.stroke();
    if (prog > .4) { ctx.globalAlpha = fade * .5; ctx.strokeStyle = st ? SEAL : ink; ctx.lineWidth = 1.2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, L + 8 + i * 7, a0 + open * .3, a0 + open); ctx.stroke(); } }   // the gust it throws
  } else if (kind === "bell") { // spirit bells: rings of sound spread from the body, gold, vermilion for 일격
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) { const t = Math.max(0, prog - i * .14), r = (st ? 80 : 64) * (.3 + t * .9); if (t <= 0) continue;
      ctx.globalAlpha = Math.min(1, fade * 1.4) * (1 - t * .6) * (i ? .6 : 1);
      ctx.strokeStyle = pal.night ? "rgba(236,230,216,.5)" : "rgba(23,22,26,.45)"; ctx.lineWidth = (i ? 1 : 2) + 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke();   // an ink edge so the gold reads on paper
      ctx.strokeStyle = st ? SEAL : "#d9a520"; ctx.lineWidth = i ? 1.6 : 3.4; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke(); }
    ctx.globalAlpha = fade;
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + prog * 2.4, r = (st ? 78 : 62) * (.4 + prog * .7), bx = Math.cos(a) * r, by = Math.sin(a) * r * .85;   // little bells shaken loose on the ring
      ctx.fillStyle = "#b8861b"; ctx.beginPath(); ctx.arc(bx, by, 4, Math.PI, 0); ctx.lineTo(bx + 4.6, by + 3); ctx.lineTo(bx - 4.6, by + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#17161a"; ctx.beginPath(); ctx.arc(bx, by + 3.4, 1.3, 0, 6.283); ctx.fill(); }
  } else if (kind === "streamer") { // 신칼: five silk streamers trail the blade's arc
    ctx.translate(cx, cy); ctx.scale(sw, 1); ctx.rotate(left ? -ang : ang); ctx.globalAlpha = fade * .9;
    OBANG.forEach((c, i) => { const r = 40 + i * 7, a1 = -1.2 + prog * 2.3, a0 = a1 - 1.1 - i * .08; ctx.strokeStyle = c; ctx.lineWidth = 3.2;
      ctx.beginPath(); for (let k = 0; k <= 12; k++) { const a = a0 + (a1 - a0) * k / 12, w = Math.sin(k * .9 + prog * 12 + i) * 4; k ? ctx.lineTo(Math.cos(a) * (r + w), Math.sin(a) * (r + w)) : ctx.moveTo(Math.cos(a) * (r + w), Math.sin(a) * (r + w)); } ctx.stroke(); });
    if (pal.night) {} else { ctx.strokeStyle = "rgba(23,22,26,.35)"; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(0, 0, 61, -1.2 + prog * 2.3 - 1.4, -1.2 + prog * 2.3); ctx.stroke(); }   // the white silk needs an edge on paper
  } else { // thrust / spear: one hard line out and back, speed lines beside it, a glint at the tip
    const long = kind === "spear", L = (long ? 116 : 84) * (st ? 1.15 : 1) * (prog < .45 ? .35 + prog / .45 * .65 : 1), w = long ? 7 : 5;
    ctx.translate(cx + d.x * 10, cy + d.y * 8); ctx.rotate(Math.atan2(d.y, d.x)); ctx.globalAlpha = fade;
    ctx.fillStyle = st ? "rgba(195,22,28,.85)" : (pal.night ? "rgba(236,230,216,.8)" : "rgba(23,22,26,.8)"); ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.lineTo(L, 0); ctx.lineTo(0, w / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pal.night ? "rgba(236,230,216,.5)" : "rgba(23,22,26,.4)"; ctx.lineWidth = 1;
    for (const o of [-13, -7, 8, 14]) { ctx.beginPath(); ctx.moveTo(L * .15, o); ctx.lineTo(L * (.55 + Math.abs(o) * .01), o * .8); ctx.stroke(); }
    if (prog > .3 && prog < .8) { ctx.fillStyle = "#fff6d8"; ctx.globalAlpha = fade * (1 - Math.abs(prog - .55) * 4); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 3 : 11; ctx.lineTo(L + Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
  }
  ctx.restore(); ctx.globalAlpha = 1;
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
  if ("mrbi".includes(e.type)) { drawNewFoe(e, pal, cx); return; }
  if ("pak".includes(e.type) && SPR.foes3) { const near = t => t != null && t - songPos < Music.beatLen * 1.2;   // 순라 · 자객 · 북잡이
    const fr = e.type === "p" ? (e.swingT > 0 ? 2 : near(e.swingAt) ? 1 : 0) : e.type === "a" ? (e.lungeT > 0 || near(e.dashAt) ? 5 : e.counter ? 4 : 3) : (e.beatT > 0 ? 8 : near(e.drumAt) ? 7 : 6);
    const hh = e.type === "k" ? 66 : e.type === "a" ? 58 : 62, ref = e.type === "k" ? 6 : e.type === "a" ? 3 : 0, k = hh / SPR.foes3.f[ref].h;
    if (e.counter) { ctx.globalAlpha = .55 + .2 * Math.sin(performance.now() / 70); ctx.strokeStyle = SEAL; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, e.y + e.h - 2, 26, 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    drawSprite("foes3", fr, cx, e.y + e.h + 1, k, (e.face < 0) !== (fr === 2), .5, pal.night); return; }
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
    ctx.globalAlpha = locked ? .95 : .25 + prog * .5; brushLine(mx, my, mx + dx * len, my + dy * len, SEAL, locked ? 3.6 : 2.2, !sniper && !locked, e.id * 13); ctx.globalAlpha = 1;   // the aim, brushed in vermilion
  }
  // 순라 / 포수: wide-brimmed hat silhouette
  ctx.fillStyle = pal.foe;
  ctx.beginPath(); ctx.moveTo(e.x + 3, e.y + 30); ctx.lineTo(e.x + 6, e.y + 10); ctx.lineTo(e.x + e.w - 6, e.y + 10); ctx.lineTo(e.x + e.w - 3, e.y + 30); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, e.y + 7, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.tile; ctx.fillRect(cx - (sniper ? 9 : 12), e.y + 1.5, sniper ? 18 : 24, 2.2); ctx.fillRect(cx - 3, e.y - 2, 6, 4);
  ctx.strokeStyle = pal.tile; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, e.y + 14); ctx.lineTo(cx + e.face * (sniper ? 22 : 14), e.y + 12); ctx.stroke();
  ctx.fillStyle = SEAL; ctx.fillRect(cx + e.face * 2 - 1, e.y + 6, 2, 2);
}

function drawNewFoe(e, pal, cx) {
  const has2 = !!SPR.foes2, feet = e.y + e.h + 1;
  if (e.type === "m") {
    if (!has2 || !drawSprite("foes2", e.castT > 0 ? F2.mudangCast : F2.mudang, cx, feet, kOf("foes2", F2.mudang, FOE_H * 1.02), e.face < 0, .5, pal.night)) { ctx.fillStyle = SEAL; ctx.fillRect(e.x, e.y, e.w, e.h); }
    return;
  }
  if (e.type === "r") {
    if (e.ph === "rise") { // the coming swing, painted as a red arc that fills in toward the beat
      const bl = Music.beatLen, prog = Math.max(0, Math.min(1, 1 - (e.nextAt - songPos) / bl));
      ctx.fillStyle = `rgba(195,22,28,${.08 + prog * .22})`; ctx.beginPath(); ctx.moveTo(cx, e.y + e.h / 2); ctx.arc(cx, e.y + e.h / 2, 78, e.face > 0 ? -1.1 : Math.PI - 1.1, e.face > 0 ? 1.1 : Math.PI + 1.1); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha *= Math.max(.05, e.fade);
    if (!has2 || !drawSprite("foes2", e.ph === "gone" || e.fade < .9 ? F2.reaperSmoke : F2.reaper, cx, feet, kOf("foes2", F2.reaper, FOE_H * 1.08), e.face < 0, .5, pal.night)) { ctx.fillStyle = "#111"; ctx.fillRect(e.x, e.y, e.w, e.h); }
    return;
  }
  if (e.type === "i") { // 구미호's illusion: a pale, flickering copy
    const B = BOSSES.gumiho; ctx.globalAlpha *= .45 + .2 * Math.sin(performance.now() / 60);
    const ak = animScale("gumiho"), [is, ifr] = ak ? BOSS_ANIM.gumiho[Math.floor(performance.now() / 90 + e.id) % 4] : SPR.bossC ? BOSS_POSE.gumiho.move : [B.sheet, B.atk];
    if (!drawSprite(is, ifr, cx, feet, ak ? ak * .8 : kOf(B.sheet, B.idle, B.draw * .8) * SHEET_SC[B.sheet] / SHEET_SC[is], e.face < 0, .5, pal.night)) { ctx.fillStyle = "#ddd"; ctx.fillRect(e.x, e.y, e.w, e.h); }
    return;
  }
  drawBoss(e, pal, cx, feet);
}
function drawCombatHud(pal) { // 기력 under the 숨, the chain's numeral at the right
  if (!P || !run || (state !== "play" && state !== "pause")) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (flashDim > 0) { ctx.fillStyle = `rgba(20,10,12,${flashDim * 3})`; ctx.fillRect(0, 0, W, H); flashDim = Math.max(0, flashDim - 1 / 60); }   // the screen draws a breath as a glint opens
  if (mode !== "tutorial") { const ki = Math.max(0, Math.min(1, P.ki ?? 1)), bx = 18, by = 54, bw = 104, bh = 10, f = SPR.mech && SPR.mech.f[MECH.bar];
    const low = ki < .25 && Math.sin(performance.now() / 90) > 0;
    ctx.font = `400 11px "Song Myung", serif`; ctx.fillStyle = pal.text; ctx.globalAlpha = .8; ctx.fillText("기력", bx, by + bh - 1);
    const x0 = bx + 30;
    if (f) { ctx.globalAlpha = .2; ctx.drawImage(SPR.mech.img, f.x, f.y, f.w, f.h, x0, by, bw, bh);
      ctx.globalAlpha = low ? .5 : 1; ctx.save(); ctx.beginPath(); ctx.rect(x0, by - 4, bw * ki, bh + 8); ctx.clip(); ctx.drawImage(SPR.mech.img, f.x, f.y, f.w, f.h, x0, by, bw, bh); ctx.restore();
      if (P.focus) { ctx.globalAlpha = .5; ctx.fillStyle = JJOK; ctx.fillRect(x0, by + bh / 2 - 1, bw * ki, 2); } }
    else { ctx.globalAlpha = .25; ctx.fillStyle = pal.text; ctx.fillRect(x0, by, bw, bh); ctx.globalAlpha = 1; ctx.fillRect(x0, by, bw * ki, bh); }
    ctx.globalAlpha = 1; }
  const n = P.chain || 0;
  if (n >= 1) { P.chainPop = Math.max(0, (P.chainPop || 0) - 1 / 60); const g = Math.min(5, n), k = 1 + P.chainPop * 1.6, x = W - 54, y = 86;
    const nf = SPR.mech && SPR.mech.f[MECH.n1 + g - 1];
    if (!(nf && drawSprite("mech", MECH.n1 + g - 1, x, y, Math.min(26 / nf.h, 36 / nf.w) * k, false, .5, pal.night, .5))) { ctx.font = `400 34px "Song Myung", serif`; ctx.textAlign = "center"; ctx.fillStyle = pal.text; ctx.fillText("一二三四五"[g - 1], x, y + 12); }
    ctx.font = `400 12px "Song Myung", serif`; ctx.textAlign = "center"; ctx.fillStyle = g >= 5 ? SEAL : pal.text; ctx.fillText(`${n} 연속`, x, y + 24); ctx.textAlign = "left"; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function drawBossCards(pal) { // screen-space: the guardian's entrance, the big words, the fall — painted where the sheets are in
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const halo = pal.night ? "rgba(20,18,20,.75)" : "rgba(242,239,230,.88)";
  if (bossIntro) { const t = bossIntro.t, kind = bossIntro.e.kind, B = BOSSES[kind], inA = Math.min(1, t / .25), out = Math.max(0, (t - 1.35) / .35), a = inA * (1 - out), bar = H * .13 * a;
    ctx.fillStyle = "#0e0d10"; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    ctx.globalAlpha = a; const sx = W / 2 + (1 - Math.min(1, t / .5)) * 40, cy = H * .46, nh = Math.min(96, H * .24);
    const sw = Math.min(1, t / .35);   // the red stroke is laid first, the name written over it
    ctx.save(); ctx.beginPath(); ctx.rect(sx - W, 0, W + (sw - .5) * W * 1.2, H); ctx.clip(); if (!spr("bcal", BC.stroke, sx, cy + nh * .52, nh * .5)) brushLine(sx - 150, cy + 30, sx + 150, cy + 30, SEAL, 7, false, 77); ctx.restore();
    const ni = BNAME[kind], nw = sprW("bname", ni, nh);
    if (ni != null && nw) { const bx = sx, glow = Math.min(1, Math.max(0, (t - .15) / .3)); ctx.globalAlpha = a * glow; spr("bname", ni, bx, cy, nh); ctx.globalAlpha = a; }
    else { ctx.fillStyle = pal.text; ctx.font = `400 52px "Song Myung", serif`; ctx.fillText(B.han, sx, cy); }
    ctx.font = `400 22px "Song Myung", serif`; ctx.lineWidth = 5; ctx.strokeStyle = halo; ctx.fillStyle = pal.text; ctx.strokeText(B.name, sx, cy + nh * .9); ctx.fillText(B.name, sx, cy + nh * .9);
    ctx.font = `400 15px "Song Myung", serif`; ctx.lineWidth = 4; ctx.strokeText(B.line || "", W / 2, cy + nh * .9 + 28); ctx.fillText(B.line || "", W / 2, cy + nh * .9 + 28);
    const st = Math.min(1, Math.max(0, (t - .5) / .15)); if (st > 0) { ctx.save(); ctx.translate(sx + Math.max(nw, 120) / 2 + 34, cy - nh * .38); ctx.rotate(-.1); const k = 1.7 - .7 * st; ctx.scale(k, k); ctx.globalAlpha = a * st;
      ctx.fillStyle = "#f2efe6"; ctx.fillRect(-21, -21, 42, 42); if (!spr("bcal", BC.gyeoljeon, 0, 0, 52)) { ctx.fillStyle = SEAL; ctx.fillRect(-20, -20, 40, 40); } ctx.restore(); if (st < 1) shake = Math.max(shake, 3); }
    ctx.globalAlpha = 1; }
  if (bossBanner) { const t = bossBanner.t, a = Math.min(1, t / .12) * Math.min(1, (1.3 - t) / .35), k = 1 + Math.max(0, .25 - t) * 1.6, fr = { "激怒": BC.gyeoknu, "看破": BC.ganpa }[bossBanner.text], mfr = bossBanner.text === "天鼓" ? MECH.chungo : null;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H * .34); ctx.scale(k, k);
    if (!(mfr != null && spr("mech", mfr, 0, 0, Math.min(140, H * .34))) && (fr == null || !spr("bcal", fr, 0, 0, Math.min(130, H * .32)))) { ctx.font = `400 58px "Song Myung", serif`; ctx.lineWidth = 7; ctx.strokeStyle = halo; ctx.strokeText(bossBanner.text, 0, 0); ctx.fillStyle = bossBanner.col; ctx.fillText(bossBanner.text, 0, 0); }
    if (bossBanner.sub) { ctx.font = `400 15px "Song Myung", serif`; ctx.lineWidth = 4; ctx.strokeStyle = halo; ctx.fillStyle = pal.text; ctx.strokeText(bossBanner.sub, 0, Math.min(130, H * .32) * .5 + 16); ctx.fillText(bossBanner.sub, 0, Math.min(130, H * .32) * .5 + 16); } ctx.restore(); }
  if (bossOut) { const t = bossOut.t, a = Math.min(1, t / .2) * Math.min(1, (2.2 - t) / .5), st = Math.min(1, Math.max(0, (t - .35) / .18));
    ctx.fillStyle = `rgba(120,10,16,${.18 * a})`; ctx.fillRect(0, 0, W, H);
    if (st > 0) { ctx.save(); ctx.globalAlpha = a * .5; ctx.translate(W / 2, H * .42); ctx.rotate(.4); spr("bcal", BC.inkBurst, 0, 0, 250 * (.7 + .3 * st)); ctx.restore();
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H * .42); ctx.rotate(-.08); ctx.scale(2.2 - 1.2 * st, 2.2 - 1.2 * st);
      ctx.fillStyle = "#f2efe6"; ctx.fillRect(-44, -44, 88, 88); if (!spr("bcal", BC.tobeol, 0, 0, 110)) { ctx.fillStyle = SEAL; ctx.fillRect(-46, -46, 92, 92); } ctx.restore();
      ctx.globalAlpha = a; const ni = BNAME[bossOut.kind];
      if (ni != null && SPR.bname) { spr("bname", ni, W / 2 - 34, H * .42 + 84, 30); ctx.font = `400 18px "Song Myung", serif`; ctx.fillStyle = pal.text; ctx.lineWidth = 4; ctx.strokeStyle = halo; ctx.textAlign = "left"; ctx.strokeText(`${bossOut.name} 처치`, W / 2 - 34 + sprW("bname", ni, 30) / 2 + 10, H * .42 + 85); ctx.fillText(`${bossOut.name} 처치`, W / 2 - 34 + sprW("bname", ni, 30) / 2 + 10, H * .42 + 85); }
      else { ctx.fillStyle = pal.text; ctx.font = `400 18px "Song Myung", serif`; ctx.fillText(`${bossOut.name} ${bossOut.han} 처치`, W / 2, H * .42 + 84); }
      ctx.globalAlpha = 1; if (st < 1) shake = Math.max(shake, 6); } }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function drawBoss(e, pal, cx, feet) {
  const B = BOSSES[e.kind];
  if (e.kind === "shadow" && SPR.hero3) { // drawn from the hero's own sheet, inverted to bone white, trailing ink
    const fr = e.act || e.swingT > 0 ? (e.act === "shstrike" || e.swingT > 0 ? H3.slash : H3.idle) : e.chargeT > 0 ? H3.dash : e.walkT > 0 ? H3.run[Math.floor(performance.now() / 90) % 6] : H3.idle;
    ctx.globalAlpha *= .9; drawSprite("hero3", fr, cx, feet, kOf("hero3", H3.idle, HERO_H * 1.08), e.face < 0, H3_AX[fr], true); ctx.globalAlpha = 1;
    if (e.act && songPos < e.hitAt) { ctx.strokeStyle = "rgba(195,22,28,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, e.y + e.h / 2, 26, 0, 7); ctx.stroke(); }
    return;
  }
  if (e.hidden) { // underground: only a heaving ripple of earth
    const x = e.tx || cx, w = 40 + Math.sin(performance.now() / 80) * 6; ctx.fillStyle = "rgba(40,34,30,.55)"; ctx.beginPath(); ctx.ellipse(x, e.floor - 2, w, 7, 0, 0, 7); ctx.fill(); return;
  }
  if (e.act && songPos < e.hitAt && !e.hidden && SPR.bvfx) { const q = Math.max(0, Math.min(1, 1 - (e.hitAt - songPos) / Math.max(.2, e.hitAt - (e.actFrom ?? e.hitAt - 1))));   // sparks gathering to the moment it lands
    ctx.save(); ctx.globalAlpha = .25 + .6 * q; ctx.translate(cx, e.y + e.h * .45); ctx.rotate(performance.now() / 700); spr("bvfx", BV.warn, 0, 0, e.h * (1.4 - .7 * q)); ctx.restore(); }
  if (e.stagT > 0 && !e.hidden && SPR.bvfx) { ctx.save(); ctx.translate(cx, e.y - 14); ctx.rotate(performance.now() / 260); ctx.globalAlpha = Math.min(1, e.stagT * 3); spr("bvfx", BV.dizzy, 0, 0, 30); ctx.restore(); }
  if (e.act && songPos < e.hitAt && ACT_NAME[e.act] && !e.hidden) { const span = Math.max(.2, e.hitAt - (e.actFrom ?? e.hitAt - Music.beatLen)), q = Math.max(0, Math.min(1, (songPos - (e.actFrom ?? songPos)) / span)), y = e.y - 22;
    ctx.save(); ctx.font = `400 15px "Song Myung", serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 4; ctx.strokeStyle = pal.night ? "rgba(20,18,20,.8)" : "rgba(242,239,230,.9)";
    ctx.strokeText(ACT_NAME[e.act], cx, y); ctx.fillStyle = q > .7 ? SEAL : pal.text; ctx.fillText(ACT_NAME[e.act], cx, y);
    ctx.strokeStyle = SEAL; ctx.globalAlpha = .35 + .5 * q; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx, y - 16, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q); ctx.stroke(); ctx.restore(); }
  if (e.act && songPos < e.hitAt) { // telegraph what is coming
    const prog = Math.max(0, Math.min(1, 1 - (e.hitAt - songPos) / Music.beatLen)), a = .1 + prog * .3, f = e.floor;
    const sd = e.id * 7 + (e.hitAt * 3 | 0);   // the same strokes for the whole wind-up
    if (e.act === "slam" || e.act === "club" || e.act === "inhale") { const w = e.act === "inhale" ? 110 : 150; ctx.globalAlpha = a * 2.2; inkWash(e.face > 0 ? cx : cx - w, f - 70, w, 70, SEAL, sd); ctx.globalAlpha = 1; }
    else if (e.act === "stomp") { ctx.globalAlpha = a * 2.2; inkWash(e.x - 50, f - 40, e.w + 100, 40, SEAL, sd); ctx.globalAlpha = 1; }
    else if (["charge", "pounce", "leap", "dance"].includes(e.act)) { ctx.globalAlpha = Math.min(1, (a + .2) * 1.6); brushLine(cx, f - 20, cx + e.face * 220, f - 20, SEAL, 9, false, sd); ctx.globalAlpha = 1; }
    else if (["volley", "fan", "fan2", "spit", "scrap", "foxfire"].includes(e.act)) { ctx.globalAlpha = Math.min(1, a + .4); const r = 6 + prog * 8; for (let i = 0; i < 4; i++) inkDab(cx + e.face * 26, e.y + 22, i * .8 + hrnd(sd, i), r * 2.2, r * 1.2, SEAL); ctx.globalAlpha = 1; }
    else if (e.act === "shcut" || e.act === "shstrike") { const w = e.act === "shstrike" ? 120 : 70; ctx.globalAlpha = a * 2.2; inkWash(e.face > 0 ? cx : cx - w, e.y - 20, w, e.h + 30, SEAL, sd); ctx.globalAlpha = 1; }
    else if (["summon", "spirits", "illusion", "mask", "gamtu", "roar", "scream", "blink", "drum", "shblink"].includes(e.act)) { ctx.globalAlpha = Math.min(1, (a + .2) * 1.5); brushRing(cx, e.y + e.h / 2, 30 + prog * 40, JJOK, 4, sd); ctx.globalAlpha = 1; }
  }
  if (e.raged && SPR.bvfx) { const fl = 1 + Math.sin(performance.now() / 90) * .05; ctx.globalAlpha = .55 + .15 * Math.sin(performance.now() / 140); spr("bvfx", BV.rage, cx, e.y + e.h * .45, e.h * 1.5 * fl); ctx.globalAlpha = 1; }   // 격노: a painted fire behind the body
  else if (e.raged) { const g = ctx.createRadialGradient(cx, e.y + e.h / 2, 6, cx, e.y + e.h / 2, Math.max(e.w, e.h)); g.addColorStop(0, `rgba(195,22,28,${.18 + .08 * Math.sin(performance.now() / 120)})`); g.addColorStop(1, "rgba(195,22,28,0)"); ctx.fillStyle = g; ctx.fillRect(cx - e.w - e.h, e.y - e.h, (e.w + e.h) * 2, e.h * 3); }   // 격노
  if (e.invisT > 0) ctx.globalAlpha *= .12;   // 도깨비 감투
  const atk = e.act || e.swingT > 0 || e.chargeT > 0 || e.air || e.swoopT > 0 || e.danceT > 0 || e.suck;
  const PO = BOSS_POSE[e.kind] || {}, now = performance.now();
  let kAnim = 0, sheet = B.sheet, fr = e.kind === "sumun" && (e.chargeT > 0 || (!e.act && e.swingT > 0)) ? B.hit : atk ? B.atk : B.idle;
  const spec = { imugi: e.emergeT > 0, wongwi: e.swoopT > 0, jangseung: !!e.act || e.swingT > 0, haetae: e.chargeT > 0, bulgasari: e.suck, baekho: e.act === "roar" || (e.lastAct === "roar" && e.swingT > 0), talchum: e.danceT > 0 }[e.kind];
  if (e.stagT > 0 || e.hitT > 0) { if (PO.hurt) [sheet, fr] = PO.hurt; else fr = B.stag ?? B.atk; }
  else if (spec && PO.spec) [sheet, fr] = PO.spec;
  else if (!atk && BOSS_ANIM[e.kind] && animScale(e.kind) && (e.walkT > 0 || e.kind === "wongwi")) { // walking (or drifting) loop
    const n = e.kind === "wongwi" ? Math.floor(now / 200 + e.id) : Math.floor(e.wph || 0); [sheet, fr] = BOSS_ANIM[e.kind][((n % 4) + 4) % 4]; kAnim = animScale(e.kind);
  }
  else if (!atk && e.walkT > 0 && PO.move) [sheet, fr] = PO.move;
  if (!SPR[sheet]) { sheet = B.sheet; fr = atk ? B.atk : B.idle; kAnim = 0; }
  const k = kAnim || kOf(B.sheet, B.idle, B.draw) * (SHEET_SC[B.sheet] || 1) / (SHEET_SC[sheet] || 1), spin = e.danceT > 0 && !PO.spec ? Math.sin(now / 50) : 1;
  const breathe = !atk && !(e.stagT > 0) && !kAnim ? 1 + Math.sin(now / 420 + e.id) * .015 : 1;   // idle: a slow breath so it never stands frozen
  ctx.save(); ctx.translate(cx, feet); ctx.scale(1, breathe); if (e.stagT > 0 && B.stag == null && !PO.hurt) ctx.rotate(-.12 * e.face); if (e.kind === "jangseung" && e.act) ctx.translate(Math.sin(now / 30) * 1.5, 0);
  if (!drawSprite(sheet, fr, 0, 0, k, (e.face < 0) !== (spin < 0), .5, pal.night)) { ctx.fillStyle = "#222"; ctx.fillRect(-e.w / 2, -e.h, e.w, e.h); }
  ctx.restore();
  if (e.kind === "talchum") { ctx.fillStyle = SEAL; ctx.font = `400 13px "Song Myung", serif`; ctx.textAlign = "center"; ctx.fillText(MASKS[e.mask || 0], cx, e.y - 34); ctx.textAlign = "left"; }
}
function drawHazards(pal) {
  const tt = performance.now() / 1000;
  for (const z of haz) {
    if (z.kind === "ring") {
      const r = (songPos - z.at) * z.speed; if (r < 0) { ctx.globalAlpha = .45; brushRing(z.x, z.y, 20, JJOK, 3, z.x); ctx.globalAlpha = 1; continue; }
      ctx.strokeStyle = `rgba(23,22,26,${.75 * (1 - r / z.max)})`; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, 7); ctx.stroke();
      ctx.strokeStyle = `rgba(236,230,216,${.8 * (1 - r / z.max)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, 7); ctx.stroke(); continue;
    }
    const live = songPos >= z.at, prog = Math.max(0, Math.min(1, (songPos - z.t0) / Math.max(.01, z.at - z.t0)));
    if (!live) { // warning: a reddening wash that fills in toward the beat
      if (z.kind === "coin") { // the coin falls into place; its shadow marks the spot
        ctx.fillStyle = `rgba(23,22,26,${.15 + prog * .3})`; ctx.beginPath(); ctx.ellipse(z.x + z.w / 2, z.y + z.h, 12 + prog * 6, 3, 0, 0, 7); ctx.fill();
        const y = z.y - 260 * (1 - prog * prog);
        if (!drawSprite("bossfx", FXB.coin, z.x + z.w / 2, y + z.h / 2, 30 / (SPR.bossfx ? SPR.bossfx.f[FXB.coin].h : 1), false, .5, false, .5)) { ctx.fillStyle = "#b08a3a"; ctx.beginPath(); ctx.arc(z.x + z.w / 2, y + z.h / 2, 12, 0, 7); ctx.fill(); }
        continue;
      }
      ctx.globalAlpha = .1 + prog * .4; inkWash(z.x, z.y, z.w, z.h, SEAL, z.x + z.y); ctx.globalAlpha = 1;   // a reddening wash, brushed in
      if (z.kind === "beam") { ctx.globalAlpha = .4 + prog * .5; brushLine(z.x, z.y, z.x + z.w, z.y, SEAL, 3, false, z.x); brushLine(z.x, z.y + z.h, z.x + z.w, z.y + z.h, SEAL, 3, false, z.y); ctx.globalAlpha = 1; }
      continue;
    }
    const f = { coin: FXB.coin, fire: FXB.fire, claw: FXB.claw, hair: FXB.hair, pillar: FXB.pillar, beam: FXB.beam }[z.kind], S = SPR.bossfx;
    if (S && f != null) {
      const fr = S.f[f];
      if (z.kind === "beam") { ctx.globalAlpha = .9; ctx.drawImage(S.img, fr.x, fr.y, fr.w, fr.h, z.x, z.y - z.h * .2, z.w, z.h * 1.4); ctx.globalAlpha = 1; continue; }
      if (z.kind === "fire" || z.kind === "claw") { ctx.save(); ctx.translate(z.x + z.w / 2, z.y + z.h / 2); if (z.flip) ctx.scale(-1, 1); ctx.drawImage(S.img, fr.x, fr.y, fr.w, fr.h, -z.w / 2, -z.h * .6, z.w, z.h * 1.2 + Math.sin(tt * 30) * 2); ctx.restore(); continue; }
      if (z.kind === "coin") { drawSprite("bossfx", f, z.x + z.w / 2, z.y + z.h / 2, 30 / fr.h, false, .5, false, .5); continue; }
      ctx.drawImage(S.img, fr.x, fr.y, fr.w, fr.h, z.x - z.w * .2, z.y, z.w * 1.4, z.h + 4);   // hair, pillar: rise from the ground
      continue;
    }
    ctx.fillStyle = z.kind === "fire" ? "rgba(220,90,30,.75)" : z.kind === "beam" ? "rgba(214,160,40,.8)" : "rgba(23,22,26,.8)"; ctx.fillRect(z.x, z.y, z.w, z.h);
  }
}
// ---------- outside the run: 비급첩, 천고탑 ----------
// a board is a scrolling panel of rows with buttons, used by every screen outside a run
function board(title, sub, rows, buttons) {
  $("bdTitle").textContent = title; $("bdSub").textContent = sub || "";
  const body = $("bdBody"); body.innerHTML = "";
  for (const r of rows) body.appendChild(r);
  const bb = $("bdBtns"); bb.innerHTML = "";
  for (const [label, fn, pri] of buttons) { const b = document.createElement("button"); b.className = "btn" + (pri ? " pri" : ""); b.textContent = label; b.addEventListener("click", fn); bb.appendChild(b); }
  state = "menu"; showScreen("board");
}
function bdRow(title, desc, pic, btnLabel, onBtn, disabled) {
  const r = document.createElement("div"); r.className = "bd-row";
  r.innerHTML = `<i class="pic"></i><div><b></b><small></small></div>`;
  if (pic) r.querySelector(".pic").style.setProperty("--pic", pic); else r.classList.add("nopic");
  r.querySelector("b").textContent = title; r.querySelector("small").textContent = desc;
  if (btnLabel) { const b = document.createElement("button"); b.className = "btn"; b.textContent = btnLabel; b.disabled = !!disabled; b.addEventListener("click", onBtn); r.appendChild(b); } else r.appendChild(document.createElement("span"));
  return r;
}
const curLine = () => { const d = document.createElement("div"); d.className = "bd-cur"; d.innerHTML = `<span><i></i> 혼 ${META.hon}</span><span>천고 조각 ${META.shard}</span>`; return d; };
const bookCap = () => PERK_MAX;         // 비급 a 비급첩 can hold
const shelfCap = () => 3 + Math.min(4, META.bld.bigeup);        // 비급첩 kept at once
const perkName = id => (CHOSIK.find(c => c.id === id) || { name: id }).name;
function bookLine(bk) { return `${WEAPONS[bk.weapon || "hwando"].name}${bk.oath ? " · " + OATHS.find(o => o.id === bk.oath).name : ""} · 비급 ${bk.perks.length} · 최고 ${bk.best || 0}층`; }
// sealing: the run's 변형, weapon and oath come along; of the rest, only as many 비급 as the book can hold
function sealScreen() {
  const r = sealable; if (!r) return;
  const rest = r.perks.filter(id => id !== "sum" && CHOSIK.some(c => c.id === id));
  const pick = new Set(fitPerks(rest));   // the same slots as in a run
  const nK = k => [...pick].filter(id => kindOf(id) === k).length;
  const name = document.createElement("input"); name.className = "bd-name"; name.maxLength = 12; name.value = `제${(META.firsts.bookN || 0) + 1}첩`;
  const chips = document.createElement("div"); chips.className = "chips";
  const info = document.createElement("small");
  const draw = () => { chips.innerHTML = "";
    for (const id of rest) { const c = document.createElement("button"); c.className = "chip" + (pick.has(id) ? " on" : ""); c.textContent = `${kindOf(id)} · ${perkName(id)}`;
      c.addEventListener("click", () => {
        if (pick.has(id)) pick.delete(id);
        else if (nK(kindOf(id)) < SLOT[kindOf(id)]) pick.add(id); else toast(`${kindOf(id)} 비급은 ${SLOT[kindOf(id)]}개까지`); draw(); }); chips.appendChild(c); }
    info.textContent = `${SLOT_ORDER.map(k => `${k} ${nK(k)}/${SLOT[k]}`).join(" · ")} · ${WEAPONS[r.weapon || "hwando"].name}${r.oath ? " · " + OATHS.find(o => o.id === r.oath).name : ""}`; };
  draw();
  const save = (replace) => {
    const bk = { id: Date.now().toString(36), name: name.value.trim() || "이름 없는 첩", weapon: r.weapon || "hwando", oath: r.oath || null, char: r.char || "mumyeong", simbeop: r.simbeop || null, perks: [...pick], best: 0, made: todayKey() };
    if (replace != null) META.books.splice(replace, 1, bk); else META.books.push(bk);
    META.firsts.bookN = (META.firsts.bookN || 0) + 1; saveMeta(); sealable = null; $("bSeal").hidden = true; toast(`「${bk.name}」를 봉인했다`);
    if (typeof gainStroke === "function") gainStroke("seal"); toMenu();
  };
  const rows = [name, chips, info];
  if (META.books.length >= shelfCap()) { const t = document.createElement("small"); t.textContent = "비급첩을 둘 자리가 없다. 하나를 골라 덮어쓴다."; rows.push(t);
    META.books.forEach((bk, i) => rows.push(bdRow(bk.name, bookLine(bk), null, "덮어쓰기", () => save(i)))); }
  board("비급첩에 봉인", "이 판의 빌드에서 핵심만 골라 담는다", rows, META.books.length >= shelfCap() ? [["그만두기", () => showScreen("result")]] : [["봉인", () => save(null), true], ["그만두기", () => showScreen("result")]]);
}
// 천고탑: pick a 비급첩, then climb until the breath runs out
function towerScreen() {
  const rows = [curLine()];
  rows.push(bdRow("맨몸으로 오르기", "검객·무기·심법·서약을 고르고 빈손으로 오른다. 층을 넘을 때마다 비급 하나", null, "오르기", startTowerFresh));
  if (!META.books.length) rows.push(bdRow("봉인된 비급첩이 없다", "천고를 한 번 이상 벤 판이 끝나면 그 빌드를 비급첩에 봉인해, 처음부터 그 빌드로 오를 수 있다."));
  META.books.forEach((bk, i) => rows.push(bdRow(bk.name, bookLine(bk), null, "오르기", () => startTower(bk))));
  board("천고탑", `최고 기록 ${META.towerBest}층 · 층마다 우두머리, 적은 늘고 징조는 쌓인다`, rows, [["돌아가기", toMenu]]);
}
function startTower(bk) {
  run = { tower: true, book: bk.id, seed: (Math.random() * 2 ** 32) >>> 0, dateKey: todayKey(), m: LAST_M, floor: 1, cycle: 0, cp: -1, dead: [],
    breath: Math.min(oath2cap(bk.oath), 3 + (META.bld.sadang >= 1 ? 1 : 0)), time: 0, deaths: 0, kills: 0, strikes: 0, slashes: 0, perks: fitPerks(bk.perks), weapon: bk.weapon, oath: bk.oath, char: bk.char || "mumyeong", simbeop: bk.simbeop || null, omens: [], cutDrums: [] };
  mode = "tower"; saveRun();
  if (META.ended && typeof upPicks === "function") upPicks(() => { saveRun(); showInterlude(); }); else showInterlude();
}
const oath2cap = o => o === "pi" ? 2 : 6;
function startTowerFresh() { // no book: pick the hand like a new run, then climb, learning one 비급 a floor
  run = { tower: true, fresh: true, seed: (Math.random() * 2 ** 32) >>> 0, dateKey: todayKey(), m: LAST_M, floor: 1, cycle: 0, cp: -1, dead: [],
    breath: 3 + (META.bld.sadang >= 1 ? 1 : 0), time: 0, deaths: 0, kills: 0, strikes: 0, slashes: 0, perks: [], weapon: "hwando", oath: null, char: "mumyeong", omens: [], picking: true };
  mode = "tower"; saveRun(); startPicks();
}
function towerRest() {
  if ((run.floor - 1) % 3 === 0) pickScreen("쉼터", `천고탑 ${run.floor - 1}층을 넘었다`, [
    { name: "숨 고르기", han: "息", desc: "숨 하나를 되찾는다" }, { name: "혼 모으기", han: "魂", desc: "이번 판에서 얻는 혼이 늘어난다" }, { name: "곧장 오르기", han: "登", desc: "아무것도 하지 않는다", calm: true }],
    it => { if (it.han === "息") run.breath = Math.min(breathCap(), run.breath + 1); if (it.han === "魂") run.honDouble = (run.honDouble || 0) + .25; saveRun(); Music.stop(); showInterlude(); });
  else { Music.stop(); showInterlude(); }
}
function towerNext() { // 천고 of this floor is cut: one floor up, another omen, and a rest every third floor
  run.floor++; run.cycle = run.floor - 1; run.cp = -1; run.dead = []; run.cutDrums = []; run.honDouble = 0;
  if (typeof gainStroke === "function") gainStroke("floor", run.floor - 1);
  if (run.floor % 10 === 0 || run.floor > 1) { const pool = OMENS.filter(o => !o.calm && !run.omens.includes(o.id) && o.id !== "geupbak"); if (pool.length && run.floor > 1 && run.omens.length < 6) run.omens.push(pool[(Math.random() * pool.length) | 0].id); }
  saveRun(); state = "result"; Music.stop();
  setTimeout(() => { if (run.fresh) { run.choosing = "tower"; saveRun(); showChoice("tower"); } else towerRest(); }, 700);
}
// first time a guardian falls: a 천고 조각 and its entry in the 도감
function codexBoss(e) {
  const c = META.codex[e.kind] = META.codex[e.kind] || { kills: 0, marks: [] };
  if (!c.kills) { run.firstBoss = (run.firstBoss || 0) + 1; toast(`도감에 ${BOSSES[e.kind].name}의 이름이 적혔다`); }
  c.kills++;
  const mk = m => { if (!c.marks.includes(m)) c.marks.push(m); };
  if (e.fightBreath != null && run.breath >= e.fightBreath) mk("nohit");
  if (!e.softHits) mk("strike");
  if ((run.upPts || 0) >= 10) mk("up");
  checkTitles(); questEvent("boss", { nohit: c.marks.includes("nohit") && e.fightBreath != null && run.breath >= e.fightBreath }); gainStroke("codex");
}
// ---------- 암자: buildings that widen what a run can be ----------
const BUILDINGS = [
  { id: "seogo", name: "서고", han: "書庫", pic: 3, lv: [
    { hon: 60, desc: "서약 해금 · 고독의 서약", give: () => unlockList("oaths", ["godok"]) },
    { hon: 130, desc: "서약 해금 · 피의 서약", give: () => unlockList("oaths", ["pi"]) },
    { hon: 220, desc: "서약 해금 · 현의 서약", give: () => unlockList("oaths", ["hyeon"]) }] },
  { id: "daejang", name: "대장간", han: "鍛冶間", pic: 4, lv: [
    { hon: 100, shard: 1, desc: "무기 해금 · 쌍검", give: () => unlockList("weapons", ["ssang"]) },
    { hon: 180, shard: 2, desc: "무기 해금 · 월도", give: () => unlockList("weapons", ["woldo"]) },
    { hon: 260, shard: 3, desc: "무기 해금 · 발도", give: () => unlockList("weapons", ["baldo"]) }] },
  { id: "bigeup", name: "비급각", han: "秘笈閣", pic: 5, lv: [1, 2, 3, 4].map(n => ({ shard: n, desc: `비급첩 보관 ${3 + n}권` })) },
  { id: "sadang", name: "사당", han: "祠堂", pic: 6, lv: [
    { hon: 80, desc: "판을 시작할 때 숨 하나 더" }, { hon: 160, desc: "비급을 고를 때 다시 뽑기 한 번" }, { hon: 260, desc: "비급 선택지가 네 장" }] },
  { id: "uibang", name: "의방", han: "衣房", pic: 7, lv: [
    { hon: 40, desc: "띠 물들이기 · 쪽빛" }, { hon: 60, desc: "띠 물들이기 · 금빛" }, { hon: 90, desc: "띠 물들이기 · 흰빛" }] }
];
const SASH = { red: ["붉은 띠", null], jjok: ["쪽빛 띠", 215], gold: ["금빛 띠", 42], white: ["흰 띠", -1] };
const SASH_BY_LV = ["red", "jjok", "gold", "white"];
function unlockList(key, ids) { for (const id of ids) if (!META[key].includes(id)) META[key].push(id); }
function hermitScreen() {
  questsToday();
  const rows = [curLine()];
  for (const B of BUILDINGS) {
    const lv = META.bld[B.id] || 0, nx = B.lv[lv];
    const cost = nx ? [nx.hon ? `혼 ${nx.hon}` : "", nx.shard ? `천고 조각 ${nx.shard}` : ""].filter(Boolean).join(" · ") : "";
    const can = nx && META.hon >= (nx.hon || 0) && META.shard >= (nx.shard || 0);
    rows.push(bdRow(`${B.name} ${B.han} · ${lv}단계`, nx ? `${nx.desc} — ${cost}` : "모두 올렸다", `var(--misc-${B.pic})`, nx ? "올리기" : null, () => {
      META.hon -= nx.hon || 0; META.shard -= nx.shard || 0; META.bld[B.id] = lv + 1; if (nx.give) nx.give(); saveMeta(); Music.sfx("lantern"); toast(`${josa(B.name, "을", "를")} 올렸다 · ${nx.desc}`); hermitScreen(); }, !can));
  }
  const cw = Object.entries(WEAPONS).filter(([, w]) => w.ch && w.cost && META.chars.includes(w.ch));
  if (cw.length) { const wh = document.createElement("h2"); wh.textContent = "무구 武具"; wh.style.fontSize = "20px"; rows.push(wh);
    for (const [id, w] of cw) { const got = META.weapons.includes(id), who = CHARS.find(c => c.id === w.ch).name;
      rows.push(bdRow(`${w.han} ${w.name} · ${who}`, w.desc + (got ? "" : ` — 혼 ${w.cost}`), null, got ? null : "벼리기", () => {
        META.hon -= w.cost; META.weapons.push(id); saveMeta(); Music.sfx("lantern"); toast(`${who}의 ${josa(w.name, "을", "를")} 벼렸다`); hermitScreen(); }, !got && META.hon < w.cost)); } }
  const mh = document.createElement("h2"); mh.textContent = "심법 心法"; mh.style.fontSize = "20px"; rows.push(mh);
  for (const m of SIMBEOP) { const got = META.simbeop.includes(m.id);
    rows.push(bdRow(`${m.han} ${m.name}`, `${m.desc} · 시작 비급 ${CHOSIK.find(c => c.id === m.start).name}` + (got ? "" : ` — 혼 ${m.hon}`), null, got ? null : "익히기", () => {
      META.hon -= m.hon; META.simbeop.push(m.id); saveMeta(); Music.sfx("lantern"); toast(`${josa(m.name, "을", "를")} 익혔다`); hermitScreen(); }, !got && META.hon < m.hon)); }
  // sash colours bought at the 의방
  const sash = document.createElement("div"); sash.className = "chips";
  SASH_BY_LV.slice(0, 1 + (META.bld.uibang || 0)).forEach(k => { const c = document.createElement("button"); c.className = "chip" + (META.sash === k ? " on" : ""); c.textContent = SASH[k][0];
    c.addEventListener("click", () => { META.sash = k; saveMeta(); recolorSash(); hermitScreen(); }); sash.appendChild(c); });
  rows.push(sash);
  const qh = document.createElement("h2"); qh.textContent = "오늘의 수행"; qh.style.fontSize = "20px"; rows.push(qh);
  for (const q of META.quests.list) rows.push(bdRow((q.done ? "✓ " : "") + q.text, q.done ? "마쳤다" : `${Math.min(q.prog || 0, q.n || 1)} / ${q.n || 1} · 보상 혼 40, 천고 조각 1`));
  rows.push(bdRow(`이름의 획 ${META.mem.length} / 9`, "획을 되찾을 때마다 기억이 하나씩 돌아온다", null, META.mem.length ? "기억 보기" : null, () => memoryList()));
  board("암자", "산중 암자 · 건물을 올려 새 길을 연다", rows, [["돌아가기", toMenu]]);
}
// 의방: repaint the vermilion sash pixels of the hero's sheets in the chosen hue
const RUN_BOB = [0, 1.5, .5, -3, 0, 1.5, .5, -3];   // contact · down · passing · up, twice: the body dips and lifts with each stride
const SASH_SHEETS = ["hero3", "weapons", "mv0", "mvrun"];   // the swordsman's own sheets (the run, the cuts, the stances)
function recolorSash() {
  const hue = SASH[META.sash || "red"][1];
  for (const n of SASH_SHEETS) { const s = SPR[n]; if (!s) continue; if (!s.orig) s.orig = s.img; if (hue == null) { s.img = s.orig; continue; }
    const c = document.createElement("canvas"); c.width = s.orig.width; c.height = s.orig.height; const g = c.getContext("2d"); g.drawImage(s.orig, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; if (!(r > gg + 60 && r > b + 60)) continue;
      const v = r / 255; if (hue < 0) { d[i] = d[i + 1] = d[i + 2] = 200 + v * 50; continue; }
      const h = hue / 60, x = 1 - Math.abs(h % 2 - 1), rgb = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
      d[i] = rgb[0] * v * 230; d[i + 1] = rgb[1] * v * 230; d[i + 2] = rgb[2] * v * 230; }
    g.putImageData(id, 0, 0); s.img = c; gpuize(c, bm => { if (s.img === c) s.img = bm; }); }
}
// ---------- 수행: three tasks a day ----------
const QUEST_POOL = [
  { k: "kills", n: 60, text: "한 판에 적 60명 베기" }, { k: "strikes", n: 25, text: "한 판에 일격 25회" }, { k: "boss", n: 2, text: "우두머리 둘 쓰러뜨리기" },
  { k: "tower", n: 5, text: "천고탑 5층 넘기" }, { k: "oathCut", text: "서약을 걸고 천고 베기" }, { k: "noHook", text: "연을 잡지 않고 천고 베기" },
  { k: "nohitBoss", text: "숨을 잃지 않고 우두머리 쓰러뜨리기" }, { k: "weaponBoss", text: "기본 검이 아닌 무기로 우두머리 쓰러뜨리기" }, { k: "tower10", n: 10, text: "천고탑 10층 넘기" }];
function questsToday() {
  const key = todayKey(); if (META.quests && META.quests.date === key) return;
  const rnd = mulberry(hashStr("quest-" + key)), pool = QUEST_POOL.filter(q => q.k !== "weaponBoss" || META.weapons.length > 1), list = [];
  while (list.length < 3) list.push({ ...pool.splice((rnd() * pool.length) | 0, 1)[0], prog: 0, done: false });
  META.quests = { date: key, list }; saveMeta();
}
function questEvent(type, data = {}) {
  if (!run || mode === "tutorial") return; questsToday();
  for (const q of META.quests.list) { if (q.done) continue; let hit = false;
    if (type === "runEnd") { if (q.k === "kills") q.prog = Math.max(q.prog, run.kills); if (q.k === "strikes") q.prog = Math.max(q.prog, run.strikes); if ((q.k === "tower" || q.k === "tower10") && run.tower) q.prog = Math.max(q.prog, data.reached); }
    if (type === "boss") { if (q.k === "boss") q.prog++; if (q.k === "nohitBoss" && data.nohit) hit = true; if (q.k === "weaponBoss" && !Object.values(BASE_W).includes(wpn())) hit = true; }
    if (type === "cut") { if (q.k === "oathCut" && run.oath) hit = true; if (q.k === "noHook" && !run.hooked) hit = true; }
    if (hit) q.prog = 1;
    if (q.prog >= (q.n || 1)) { q.done = true; META.firsts.quests = (META.firsts.quests || 0) + 1; META.hon += 40; META.shard += 1; toast(`수행을 마쳤다 · ${q.text}`); } }
  saveMeta();
}
// ---------- 이름의 획: nine milestones, each returns a stroke and a memory ----------
const NAME = "徐律", NAME_KO = "서율";
const MEMORY = [
  "새벽마다 천고를 치던 고수가 있었다. 북이 울리면 하늘이 날을 열었다.",
  "어느 새벽, 검은 그림자가 고수의 이름을 적은 두루마리를 앗아 갔다. 그날 북이 멈췄다.",
  "장단이 어긋나자 산과 물에 잠들어 있던 것들이 눈을 떴다.",
  "이름을 잃은 고수는 비 속에 무릎을 꿇었다. 아무도 그를 부르지 못했다.",
  "탑의 계단마다 수문장이 섰다. 북을 다시 울리려는 자를 막으라는 명이었다.",
  "북이 멈춘 밤, 마을이 불탔다. 붉은 달 아래 장단 없는 춤이 이어졌다.",
  "그림자는 고수와 같은 삿갓을 쓰고 있었다. 빼앗은 것은 이름만이 아니었다.",
  "탑 꼭대기, 천고는 쇠사슬에 묶여 있었다. 그 앞에 북의 주인이 앉아 있다.",
  "이름을 되찾은 자만이 천고를 다시 칠 수 있다. 그의 이름은 서율(徐律)이었다. 천고탑 30층, 북의 주인이 기다린다."];
const MILESTONE = [
  () => META.firsts.cut, () => META.books.length > 0, () => META.towerBest >= 5, () => META.towerBest >= 10,
  () => Object.keys(META.codex).length >= 3, () => META.towerBest >= 15, () => META.towerBest >= 20,
  () => Object.keys(META.codex).length >= 10, () => META.towerBest >= 25];
let memQueue = [];
function gainStroke(kind, v) {
  if (kind === "floor" && v > META.towerBest) META.towerBest = v;
  if (kind === "cut") META.firsts.cut = true;
  for (let i = 0; i < MILESTONE.length; i++) if (!META.mem.includes(i) && MILESTONE[i]()) { META.mem.push(i); memQueue.push(i); toast(`이름의 획 하나가 돌아왔다 · ${META.mem.length} / 9`); }
  saveMeta();
}
function memoryCard(i) {
  const d = document.createElement("div"); d.className = "mem";
  d.innerHTML = `<i style="background-position:${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%"></i><p></p>`; d.querySelector("p").textContent = MEMORY[i]; return d;
}
function showMemories(after) { // play back what returned during the run, one card at a time
  if (!memQueue.length) { after(); return; }
  const i = memQueue.shift();
  board(`기억 조각 ${META.mem.indexOf(i) + 1}`, `이름의 획 ${META.mem.length} / 9`, [memoryCard(i)], [["이어서", () => showMemories(after), true]]);
}
function memoryList() { board("기억", `이름의 획 ${META.mem.length} / 9`, META.mem.slice().sort((a, b) => a - b).map(memoryCard), [["돌아가기", hermitScreen]]); }
function nameProgress() { // the name on the title screen, filled in stroke by stroke
  const el = $("nameLine"); if (!el) return;
  el.style.setProperty("--p", (META.mem.length / 9).toFixed(3)); el.hidden = !META.mem.length;
  el.querySelector("b").textContent = NAME; const t = (typeof TITLES !== "undefined" && TITLES.find(t => t.id === META.title)) || null;
  el.querySelector("small").textContent = (META.mem.length >= 9 ? NAME_KO : `이름의 획 ${META.mem.length} / 9`) + (t ? ` · 호 「${t.name}」` : "");
}
// ---------- after the name: 결말, 업, 도감, 호, 숙련, 새 검객 ----------
function showEnding() {
  const first = !META.ended; META.ended = true; unlockList("chars", ["munyeo", "posu"]); saveMeta();
  const rows = [memoryCard(8)], t = document.createElement("p"); t.className = "end-p";
  t.textContent = first ? "천고가 다시 울렸다. 하늘이 날을 열고, 서율은 이름을 되찾았다. 그러나 장단은 끝나지 않는다. — 업(業)이 열렸고, 무녀와 포수가 탑에 오를 수 있다." : "천고가 다시 울렸다.";
  rows.push(t); run.won = true;
  board("천고가 울린다", "결말", rows, [["끝맺기", () => { run.endingDue = false; endRun(true); }, true]]);
}
// 업: self-imposed burdens for any run once the tale is told; each point raises the rewards
const UPS = [
  { id: "tan", name: "빠른 탄", pts: 1, desc: "적의 탄이 30% 빠르다" }, { id: "fast", name: "급한 장단", pts: 1, desc: "장단이 15% 빠르다" },
  { id: "omen2", name: "짙은 징조", pts: 1, desc: "징조 하나를 안고 시작한다" }, { id: "hp", name: "질긴 적", pts: 2, desc: "모든 적의 체력 +1" },
  { id: "narrow", name: "얕은 무아경", pts: 2, desc: "무아경이 절반 길이로 짧아진다" }, { id: "rage", name: "격노", pts: 2, desc: "우두머리가 처음부터 격노해 있다" },
  { id: "bosshp", name: "강철 우두머리", pts: 2, desc: "우두머리 체력 +50%" }, { id: "noheal", name: "마른 숨", pts: 3, desc: "관문을 넘어도 숨이 차지 않는다" }];
function upPicks(next) {
  const on = new Set(run.up || []), info = document.createElement("small"), chips = document.createElement("div"); chips.className = "chips";
  const pts = () => [...on].reduce((t, id) => t + UPS.find(u => u.id === id).pts, 0);
  const draw = () => { chips.innerHTML = ""; for (const u of UPS) { const c = document.createElement("button"); c.className = "chip" + (on.has(u.id) ? " on" : ""); c.textContent = `${u.name} +${u.pts}`; c.title = u.desc;
    c.addEventListener("click", () => { on.has(u.id) ? on.delete(u.id) : on.add(u.id); draw(); }); chips.appendChild(c); }
    info.textContent = `업 ${pts()} · 보상 ×${(1 + .15 * pts()).toFixed(2)} · 최고 업 ${META.upBest}` + (on.size ? " — " + [...on].map(id => UPS.find(u => u.id === id).desc).join(", ") : ""); };
  draw();
  board("업을 지라", "스스로 무게를 얹을수록 얻는 것이 크다", [chips, info], [["이대로 오른다", () => {
    run.up = [...on]; run.upPts = pts(); META.upBest = Math.max(META.upBest, run.upPts); saveMeta();
    if (upOn("omen2")) { const pool = OMENS.filter(o => !o.calm && o.id !== "geupbak"); (run.omens = run.omens || []).push(pool[(Math.random() * pool.length) | 0].id); }
    run.picking = false; saveRun(); Music.stop(); next(); }, true]]);
}
// 호: titles earned by deeds, one worn on the title screen
const TITLES = [
  { id: "drum", name: "첫 북소리", desc: "천고를 처음 베다", ok: () => META.firsts.cut },
  { id: "beat", name: "일섬의 귀신", desc: "한 판에 일섬으로 적 40을 베다", ok: () => META.firsts.beat },
  { id: "hundred", name: "백전불패", desc: "우두머리 열을 모두 도감에 올리다", ok: () => BOSS_ORDER.concat("sumun").every(k => META.codex[k]) },
  { id: "untouched", name: "맞지 않는 자", desc: "다섯 우두머리를 숨을 잃지 않고 쓰러뜨리다", ok: () => Object.values(META.codex).filter(c => c.marks.includes("nohit")).length >= 5 },
  { id: "tower", name: "탑의 주인", desc: "천고탑 30층에 오르다", ok: () => META.towerBest >= 30 },
  { id: "karma", name: "업보", desc: "업 10 이상을 지고 오르다", ok: () => META.upBest >= 10 },
  { id: "ascetic", name: "수행자", desc: "수행 열 가지를 마치다", ok: () => (META.firsts.quests || 0) >= 10 },
  { id: "name", name: "이름을 되찾은 자", desc: "결말을 보다", ok: () => META.ended }];
function checkTitles() { for (const t of TITLES) if (!META.titles.includes(t.id) && t.ok()) { META.titles.push(t.id); toast(`호를 얻었다 · ${t.name}`); if (!META.title) META.title = t.id; } saveMeta(); }
const BOSS_LORE = {
  sumun: "천고를 지키라는 마지막 명을 아직도 지키고 있다. 명을 내린 이가 누구였는지는 잊었다.",
  gumiho: "천 년을 채우면 사람이 된다 했다. 북이 멈춘 날, 그 천 년도 멈췄다.",
  dokkaebi: "장단에 맞춰 방망이를 두드리던 장난꾸러기. 장단이 사라지자 장난도 사나워졌다.",
  imugi: "여의주를 물고 하늘로 오르려던 날, 천고가 멈추어 길이 닫혔다.",
  wongwi: "이름을 불러 주는 이가 없어 떠나지 못한다. 무명과 닮은 처지다.",
  jangseung: "마을 어귀를 지키던 장승. 지킬 마을이 불탄 뒤에도 눈을 감지 못했다.",
  haetae: "불을 먹어 궁을 지키던 짐승. 붉은 달의 밤에 너무 많은 불을 삼켰다.",
  bulgasari: "쇠를 먹고 자란 괴물. 사람들이 버린 칼과 창을 먹고 탑만큼 커졌다.",
  baekho: "서쪽 산의 산군. 산에 장단이 사라지자 사냥만 남았다.",
  talchum: "탈을 쓰면 누구든 될 수 있었다. 이제는 탈 아래 얼굴을 잊었다.",
  cheongo: "북을 멈추게 한 자는 북의 주인 그 자신이었다. 날을 여는 일에 지쳐서.",
  shadow: "이름을 앗아 간 그림자. 이름을 되찾으려는 마음이 만든 또 하나의 나."
};
const MARK_NAME = { nohit: "무피격", strike: "일격만으로", up: "업 10 이상" };
function codexScreen() {
  checkTitles();
  const rows = [curLine()];
  for (const k of ["sumun", ...BOSS_ORDER, "cheongo", "shadow"]) { const B = BOSSES[k], c = META.codex[k];
    rows.push(bdRow(c ? `${B.name} ${B.han}` : "？？？", c ? `처치 ${c.kills} · ${["nohit", "strike", "up"].map(m => (c.marks.includes(m) ? "◆" : "◇") + MARK_NAME[m]).join(" ")}${c.marks.length >= 3 ? " — " + BOSS_LORE[k] : ""}` : "아직 만나지 못했다",
      c && B.sheet !== "hero3" ? `var(--boss-${k})` : null)); }
  const seen = (META.seen || []).length, total = CHOSIK.filter(c => c.id !== "sum").length;
  rows.push(bdRow(`비급 도감 ${seen} / ${total}`, "한 번이라도 익힌 비급"));
  rows.push(bdRow("무기 숙련", Object.keys(WEAPONS).filter(w => META.weapons.includes(w) || (WEAPONS[w].ch && !WEAPONS[w].cost && META.chars.includes(WEAPONS[w].ch))).map(w => `${WEAPONS[w].name} ${masteryLv(w)}단`).join(" · ")));
  const th = document.createElement("h2"); th.textContent = "호(號)"; th.style.fontSize = "20px"; rows.push(th);
  for (const t of TITLES) { const got = META.titles.includes(t.id);
    rows.push(bdRow((META.title === t.id ? "◆ " : "") + (got ? t.name : "？？？"), t.desc, null, got && META.title !== t.id ? "쓰기" : null, () => { META.title = t.id; saveMeta(); codexScreen(); })); }
  board("도감", "만난 우두머리와 익힌 비급, 얻은 호", rows, [["돌아가기", toMenu]]);
}
// 숙련: each weapon grows with the foes it fells; the fifth step gilds its stroke
const masteryLv = w => Math.min(5, Math.floor(Math.sqrt((META.mastery[w] || 0) / 25)));
// 새 검객 (after the ending): different hands on the same tower
const CHARS = [
  { id: "mumyeong", name: "무명", han: "無名", desc: "이름 없는 검객. 모든 무기를 쓴다" },
  { id: "munyeo", name: "무녀", han: "巫女", desc: "일섬이 스친 탄을 쏜 적에게 되받아친다. 공중에서 한 번 더 뛰고, 베는 범위는 좁다" },
  { id: "posu", name: "포수", han: "砲手", desc: "무아경을 풀면 화승총을 쏘고 반동으로 튕겨 난다(두 박자 장전, 장전 중엔 총검 돌진). 보통 베기는 총검 찌르기" }];
const chr = id => !!(run && run.char === id);
const MV_AX = { mvrun: [.566, .631, .634, .635, .544, .63, .62, .639],   // the run sheet, aligned on the hat so the head rides level
  mv0: [.52, .6, .64, .62, .61, .61, .55, .61, .54, .48, .44, .59, .58, .61, .43, .45],   // body axis of each frame, so the feet stay put
  mv1: [.53, .62, .62, .62, .57, .6, .57, .59, .63, .57, .44, .53, .54, .64, .46, .44], mv2: [.46, .5, .52, .49, .48, .5, .49, .46, .52, .41, .41, .44, .39, .45, .42, .42] };
const VIS = { cut: 0, splat: 1, ring: 2, drum: 3, bigDrum: 4, burst: 5, stroke: 6, seal: 7, drops: 8 };   // blood, stamps and the beat bar, painted to read at a glance
const MU_AX = [.57, .63, .61, .61, .54, .57, .57, .59, .58, .55, .62, .6, .44, .46, .49, .53], PO_AX = [.48, .5, .49, .47, .48, .47, .46, .51, .46, .42, .51, .43, .42, .47, .53, .39];   // 무녀·포수: same 16 moves as the swordsman's hero3
const CF = (k) => chr("munyeo") ? { dragon: ["mfx", 4], bloom: ["mfx", 5], clone: ["mfx", 8] }[k] : chr("posu") ? { dragon: ["pfx", 4], bloom: ["pfx", 2], clone: ["pfx", 7] }[k] : null;   // each hand's own picture of a shared gift
const dirFx = d => ({ rot: d.x < 0 ? Math.atan2(d.y, d.x) - Math.PI : Math.atan2(d.y, d.x), flip: d.x < 0 });
const AF_AX = [.48, .47, .4, .24, .37, .35, .47, .3];   // arms sheet: 무녀 방울 0-1, 신칼 2-3 / 포수 각궁 4-5, 창 6-7
const CF_AX = [.57, .64, .61, .67, .53, .41, .4, .66, .37, .47, .46, .46, .49, .34, .39, .53];   // chars sheet: 무녀 0-7, 포수 8-15
// ---------- screens ----------
function showScreen(id) {
  for (const s of ["menu", "settings", "interlude", "pause", "result", "choice", "board"]) $(s).hidden = s !== id;
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
  if (s) $("bContinue").innerHTML = `<span>이어하기</span><small style="color:inherit">${stageName(s.m, s)} · 숨 ${s.breath}</small>`;
  $("bTower").hidden = false; $("towerInfo").textContent = `무한 · 최고 ${META.towerBest}층` + (META.books.length ? ` · 비급첩 ${META.books.length}권` : "");
}
function toMenu() {
  Music.menuBgm(true);
  document.body.classList.remove("night");
  Music.stop(); state = "menu"; buildMenu(); showScreen("menu"); nameProgress();
  if (!LV) loadMap(START_PIECE.map((r, y) => r + r + r + r), PAL[0]);
}
function pauseGame() {
  if (state !== "play") return;
  state = "pause"; for (const k in held) held[k] = 0; Music.pause(); Music.muffle(false); if (P) P.focus = false;
  $("pTitle").textContent = mode === "tutorial" ? "수련터" : stageName(run.m);
  const st = $("pStats"); st.innerHTML = "";
  const rows = [["시간", fmt(run.time)], ["베인 횟수", run.deaths], ["일격", run.strikes + " / " + run.slashes]];
  if (mode !== "tutorial") rows.splice(1, 0, ["남은 숨", run.breath]);
  for (const [k, v] of rows) { const a = document.createElement("span"), b = document.createElement("b"); a.textContent = k; b.textContent = v; st.append(a, b); }
  pauseBuild();
  $("bGiveUp").hidden = mode === "tutorial";
  showScreen("pause");
}
function pauseBuild() { // the build so far: hand and weapon, 심법, 서약, 공명, and every 비급 read in this hand's words
  const box = $("pBuild"); box.innerHTML = ""; if (mode === "tutorial" || !run) { box.hidden = true; return; } box.hidden = false;
  const line = (label, name, desc, col) => { const d = document.createElement("div"); d.className = "pb-row"; d.innerHTML = `<span class="pb-k"></span><div><b></b><small></small></div>`;
    d.querySelector(".pb-k").textContent = label; const b = d.querySelector("b"); b.textContent = name; if (col) b.style.setProperty("--sc", col), b.classList.add("bead"); d.querySelector("small").textContent = desc || ""; box.appendChild(d); };
  const ch = CHARS.find(c => c.id === (run.char || "mumyeong")), w = WEAPONS[wpn()];
  line("검객", `${ch ? ch.name : "무명"} · ${w.name}`, w.desc);
  const sm = SIMBEOP.find(m => m.id === run.simbeop); line("심법", sm ? sm.name : "없음", sm ? sm.desc : "", sm ? SCHOOLS[sm.id].col : null);
  const oa = OATHS.find(o => o.id === run.oath); line("서약", oa ? oa.name : "없음", oa ? `${oa.desc} — 대가 · ${oa.cost}` : "");
  for (const k of SLOT_ORDER) { const ps = heldPerks().filter(id => kindOf(id) === k).map(id => CHOSIK.find(c => c.id === id));
    if (!ps.length) line(`${k} 0/${SLOT[k]}`, "비어 있음", ""); ps.forEach((c, i) => line(i ? "" : `${k} ${ps.length}/${SLOT[k]}`, c.name, c.desc, null)); }
}
function resumeGame() { if (state !== "pause") return; showScreen(null); Music.resume(); state = "play"; last = performance.now(); }

$("bNew").addEventListener("click", () => newRun(false));
$("bContinue").addEventListener("click", continueRun);
$("bTut").addEventListener("click", startTutorial);
$("bTower").addEventListener("click", towerScreen);
$("bSeal").addEventListener("click", sealScreen);
$("bHermit").addEventListener("click", () => typeof hermitScreen === "function" && hermitScreen());
$("bCodex").addEventListener("click", () => typeof codexScreen === "function" && codexScreen());
$("bEnter").addEventListener("click", enterMadang);
$("bPause").addEventListener("click", pauseGame);
$("bResume").addEventListener("click", resumeGame);
$("bGiveUp").addEventListener("click", () => { state = "play"; endRun(false); $("rSub").textContent = stageName(run.m) + "에서 판을 내려놓았다."; });
$("bToMenu").addEventListener("click", () => { saveRun(); toMenu(); });
$("bPauseSet").addEventListener("click", () => openSettings("pause"));
$("bSettings").addEventListener("click", () => openSettings("menu"));
const liteLabel = () => { $("bLite").textContent = LITE() ? "켜짐" : "꺼짐"; $("bFps").textContent = showFps ? "켜짐" : "꺼짐"; };
liteLabel();
$("bLite").addEventListener("click", () => { localStorage.setItem("chungo.lite", LITE() ? "0" : "1"); dprCap = LITE() ? 1 : MOBILE ? 1.5 : 2; resize(); liteLabel(); });
$("bFps").addEventListener("click", () => { showFps = !showFps; localStorage.setItem("chungo.fps", showFps ? "1" : "0"); liteLabel(); });
// touch buttons: a size for all of them and a place for each, kept on this device
const padCfg = Object.assign({ s: 1.2, pos: {} }, store.get("pad3", {}));   // "pad2": the new default layout replaces any older arrangement
function applyPad() {
  document.documentElement.style.setProperty("--tbs", padCfg.s); $("padVal").textContent = Math.round(padCfg.s * 100) + "%";
  for (const id of ["bJump", "bDash", "bHook"]) { const el = $(id), p = padCfg.pos[id]; el.style.right = p ? p.r + "px" : ""; el.style.bottom = p ? p.b + "px" : ""; }
}
applyPad();
$("bPadDn").addEventListener("click", () => { padCfg.s = Math.max(.6, +(padCfg.s - .1).toFixed(1)); store.set("pad3", padCfg); applyPad(); });
$("bPadUp").addEventListener("click", () => { padCfg.s = Math.min(1.6, +(padCfg.s + .1).toFixed(1)); store.set("pad3", padCfg); applyPad(); });
$("bPadReset").addEventListener("click", () => { padCfg.s = 1.2; padCfg.pos = {}; store.set("pad3", padCfg); applyPad(); toast("버튼을 처음 자리로 돌렸다"); });
$("bPadEdit").addEventListener("click", () => { $("settings").hidden = true; $("pad").hidden = false; $("padBar").hidden = false; document.body.classList.add("padEdit"); });
$("bPadDone").addEventListener("click", () => { document.body.classList.remove("padEdit"); $("padBar").hidden = true; store.set("pad3", padCfg); for (const k in held) held[k] = 0; for (const k in press) press[k] = 0; showScreen("settings"); });
{ let drag = null;   // while editing, the pad's own handlers never see the touch: it moves the button instead
  $("pad").addEventListener("pointerdown", e => { if (!document.body.classList.contains("padEdit")) return; const b = e.target.closest(".tb"); e.stopPropagation(); e.preventDefault(); if (!b) return;
    const r = b.getBoundingClientRect(); drag = { b, id: b.id, x0: e.clientX, y0: e.clientY, r0: innerWidth - r.right + (r.width - r.width / padCfg.s) / 2, b0: innerHeight - r.bottom + (r.height - r.height / padCfg.s) / 2 };
    try { $("pad").setPointerCapture(e.pointerId); } catch (_) {} }, true);
  $("pad").addEventListener("pointermove", e => { if (!drag) return; e.stopPropagation();
    const rr = Math.max(0, Math.min(innerWidth - 40, drag.r0 - (e.clientX - drag.x0))), bb = Math.max(0, Math.min(innerHeight - 40, drag.b0 - (e.clientY - drag.y0)));
    padCfg.pos[drag.id] = { r: Math.round(rr), b: Math.round(bb) }; drag.b.style.right = rr + "px"; drag.b.style.bottom = bb + "px"; }, true);
  const end = e => { if (!drag) return; e.stopPropagation(); drag = null; store.set("pad3", padCfg); };
  $("pad").addEventListener("pointerup", end, true); $("pad").addEventListener("pointercancel", end, true); }
$("bSetClose").addEventListener("click", () => { if (settingsBack === "pause") showScreen("pause"); else showScreen("menu"); });
$("bSound").addEventListener("click", () => { settings.sound = !settings.sound; saveSettings(); });
$("bOffDn").addEventListener("click", () => { settings.offset = Math.max(-200, settings.offset - 10); saveSettings(); });
$("bOffUp").addEventListener("click", () => { settings.offset = Math.min(200, settings.offset + 10); saveSettings(); });
$("bAgain").addEventListener("click", () => newRun());
$("bResMenu").addEventListener("click", () => showMemories(toMenu));
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


if (location.hash === "#debug") window.__dbg = { tp(tx, ty) { P.x = tx * T + 7; P.y = (ty + 1) * T - 30; P.vx = P.vy = 0; }, get state() { return state; }, get P() { return P; }, get LV() { return LV; }, get state2() { return state; }, get SC() { return LV.scenery; }, get E() { return enemies; }, get run() { return run; }, set hs(v) { hitstop = v; }, kill(e) { killEnemy(e); }, get bolts() { return bolts; }, get rings() { return rings; }, get B() { return bullets; }, get beams() { return beams; }, flashing: e => isFlashing(e) };
window.addEventListener("pointerdown", () => Music.unlock(), { once: true, capture: true });   // first tap anywhere starts the sound
resize();
toMenu();
P = null; cam.x = 600; cam.y = 300;
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
})();
