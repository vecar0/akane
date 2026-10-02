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
// a turn of the tower is three 마당; each draws on one of the five tiers below (진양조 → 자진모리 → 단모리)
const LAST_M = 2, MD = m => [0, 2, 4][Math.min(LAST_M, m)];
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
const IMG = {}, PAT = {};
for (const k of ["tex-paper", "tex-stone", "tex-giwa", "tex-granite", "tex-slab"]) { const im = new Image(); im.onload = () => { IMG[k] = im; PAT[k] = null; }; im.src = "assets/" + k + ".webp"; }
function pattern(key, scale) { // world- or screen-anchored repeating pattern, built once per image
  if (!IMG[key]) return null;
  if (!PAT[key]) { PAT[key] = ctx.createPattern(IMG[key], "repeat"); PAT[key].setTransform(new DOMMatrix().scale(scale)); }
  return PAT[key];
}
for (const k of ["far", "mid"]) { const im = new Image(); im.onload = () => { IMG[k] = softened(seamlessStrip(im), k === "far" ? 3 : 2); }; im.src = "assets/" + k + ".webp"; }
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
const H3_AX = [.48, .57, .64, .62, .65, .57, .62, .58, .59, .54, .63, .47, .36, .42, .51, .5];
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
const CHOSIK = [
  { id: "ssang", name: "쌍검", han: "雙劍", desc: "베는 범위가 넓어진다", icon: 2 },
  { id: "eot", name: "엇박", han: "엇拍", desc: "일격 판정이 너그러워진다", icon: 3 },
  { id: "yeon", name: "연환", han: "連環", desc: "적을 베면 공중 대시 2회", icon: 4 },
  { id: "hosin", name: "호신부", han: "護身符", desc: "마당마다 한 번, 치명상을 막는다", icon: 5 },
  { id: "baram", name: "바람길", han: "風路", desc: "연을 더 멀리서 잡고 더 높이 난다", icon: 6 },
  { id: "janyeong", name: "잔영", han: "殘影", desc: "대시가 길어지고 닿은 적을 벤다", icon: 7 },
  { id: "sum", name: "숨", han: "息", desc: "숨 하나를 되찾는다 (최대 5)", icon: 8, repeat: true },
  { id: "jilpung", name: "질풍", han: "疾風", desc: "달리는 속도가 빨라진다", icon: 100 },
  { id: "idan", name: "허공답보", han: "虛空踏步", desc: "공중에서 한 번 더 뛴다", icon: 101 },
  { id: "bantan", name: "반탄", han: "反彈", desc: "튕겨낸 탄이 더 빠르고 적을 꿰뚫는다", icon: 102 },
  { id: "cheol", name: "파패", han: "破牌", desc: "등패수를 일격 없이도 벤다", icon: 103 },
  { id: "hyeol", name: "혈로", han: "血路", desc: "적을 열 명 벨 때마다 숨 하나", icon: 104 },
  { id: "mae", name: "매사냥", han: "放鷹", desc: "매가 느려진다", icon: 105 },
  { id: "jeong", name: "정중동", han: "靜中動", desc: "조준 슬로모션이 더 길고 더 느리다", icon: 106 },
  { id: "geum", name: "금줄 끊기", han: "斷繩", desc: "금줄이 켜져 있는 시간이 절반", icon: 107 },
  { id: "nakhwa", name: "낙화", han: "落花", desc: "공중에서 내려베어 적을 베면 다시 솟구친다", icon: 108 },
  { id: "cheongeun", name: "천근추", han: "千斤墜", desc: "공중에서 아래를 누르면 빠르게 떨어진다", icon: 200 },
  { id: "ilseom", name: "일섬", han: "一閃", desc: "베기가 더 멀리 닿는다", icon: 201 },
  { id: "yeongyeok", name: "연격", han: "連擊", desc: "더 빠르게 이어 벤다", icon: 202 },
  { id: "gwigeom", name: "귀검", han: "鬼劍", desc: "일격의 기운이 둘레의 적도 벤다", icon: 203 },
  { id: "josik", name: "조식", han: "調息", desc: "마당을 넘을 때 숨이 하나 더 찬다", icon: 204 },
  { id: "gyeonggong", name: "경공", han: "輕功", desc: "더 높이 뛴다", icon: 205 },
  { id: "byeokho", name: "벽호공", han: "壁虎功", desc: "벽을 두 배 오래 탄다", icon: 206 },
  { id: "biyeon", name: "비연", han: "飛燕", desc: "공중 대시가 하나 더 생긴다", icon: 207 },
  { id: "seomgwang", name: "섬광", han: "閃光", desc: "대시를 쉬지 않고 쓴다", icon: 208 },
  { id: "yeonsa", name: "연줄", han: "鳶絲", desc: "연을 놓으면 공중 대시가 둘", icon: 300 },
  { id: "danhwa", name: "단화", han: "斷火", desc: "적이 총을 겨누는 시간이 길어진다", icon: 301 },
  { id: "gwian", name: "귀안", han: "鬼眼", desc: "적의 탄이 느려진다", icon: 302 },
  { id: "heuphon", name: "흡혼", han: "吸魂", desc: "일격으로 베면 잠시 무적", icon: 303 },
  { id: "jangmak", name: "장막", han: "帳幕", desc: "조준하는 동안 탄에 맞지 않는다", icon: 304 },
  { id: "gangta", name: "고진", han: "鼓震", desc: "일격의 범위가 넓어진다", icon: 305 },
  { id: "geompung", name: "검풍", han: "劍風", desc: "벨 때마다 검기가 날아간다", icon: 306 },
  { id: "bulsa", name: "불사", han: "不死", desc: "숨이 다할 때 한 번 되살아난다", icon: 307 },
  { id: "chukji", name: "축지", han: "縮地", desc: "땅에서의 대시가 두 배 멀리 간다", icon: 308 },
  // 조합 비급: offered once both halves are learned
  { id: "ssangryong", name: "쌍룡검", han: "雙龍劍", desc: "보통 베기도 두 번 벤다", combo: ["ssang", "yeongyeok"] },
  { id: "nodo", name: "질풍노도", han: "疾風怒濤", desc: "대시에 닿은 적은 일격처럼 쓰러진다", combo: ["jilpung", "chukji"] },
  { id: "cheonra", name: "천라지망", han: "天羅地網", desc: "조준하는 동안 날아든 탄은 쏜 자에게 돌아간다", combo: ["bantan", "jangmak"] },
  { id: "pilsal", name: "일격필살", han: "一擊必殺", desc: "일격 때 둘레의 탄이 모두 흩어진다", combo: ["eot", "gangta"] },
  { id: "bicheon", name: "비천", han: "飛天", desc: "공중 대시를 쓰면 공중 도약이 되살아난다", combo: ["biyeon", "idan"] },
  { id: "bulmyeol", name: "불멸", han: "不滅", desc: "호신부가 마당마다 두 번 탄다", combo: ["bulsa", "hosin"] },
  { id: "hyeolpung", name: "혈풍", han: "血風", desc: "혈로가 다섯 명마다 숨을 준다", combo: ["hyeol", "heuphon"] },
  { id: "yeonbi", name: "연비어약", han: "鳶飛魚躍", desc: "연을 놓으면 잠시 무적, 대시가 바로 찬다", combo: ["baram", "yeonsa"] },
  { id: "gwisin", name: "귀신검", han: "鬼神劍", desc: "일격으로 날린 검풍은 적을 단번에 꿰뚫는다", combo: ["gwigeom", "geompung"] },
  { id: "nakhwayusu", name: "낙화유수", han: "落花流水", desc: "빠르게 떨어져 내려앉으면 둘레의 적을 벤다", combo: ["nakhwa", "cheongeun"] },
  { id: "neunggong", name: "능공허도", han: "凌空虛渡", desc: "공중에서 두 번 더 뛴다", combo: ["gyeonggong", "idan"] },
  { id: "byeokryeok", name: "벽력", han: "霹靂", desc: "벽을 차고 뛰면 공중 대시가 하나 더 생긴다", combo: ["byeokho", "seomgwang"] },
  { id: "eunggyeok", name: "응격", han: "鷹擊", desc: "매는 한 번만 베어도 떨어진다", combo: ["mae", "ilseom"] },
  { id: "mancheon", name: "만천화우", han: "滿天花雨", desc: "검풍이 세 갈래로 날아간다", combo: ["geompung", "ssang"] },
  { id: "siman", name: "심안", han: "心眼", desc: "일격 판정이 훨씬 너그러워진다", combo: ["jeong", "eot"] },
  { id: "geumgang", name: "금강불괴", han: "金剛不壞", desc: "호신부가 타면 둘레의 탄이 사라지고 2초 동안 무적", combo: ["hosin", "jangmak"] },
  { id: "malli", name: "만리안", han: "萬里眼", desc: "적의 탄이 절반 속도로 날아온다", combo: ["gwian", "danhwa"] },
  { id: "hyeolseon", name: "혈선", han: "血旋", desc: "적을 벨 때마다 잠깐 무적", combo: ["hyeol", "yeon"] },
  { id: "bisang", name: "비상", han: "飛翔", desc: "달리다 뛰면 훨씬 멀리 난다", combo: ["jilpung", "gyeonggong"] },
  { id: "yeonbiyeon", name: "연환비연", han: "連環飛燕", desc: "적을 베면 공중 대시가 셋", combo: ["yeon", "biyeon"] },
  { id: "pacheon", name: "파천", han: "破天", desc: "우두머리에게 일격 피해가 하나 더 들어간다", combo: ["cheol", "gangta"] },
  { id: "yeokryu", name: "역류", han: "逆流", desc: "튕겨낸 탄이 세 갈래로 갈라진다", combo: ["bantan", "gwian"] },
  { id: "bunsin", name: "분신", han: "分身", desc: "대시가 끝난 자리에서 둘레를 벤다", combo: ["janyeong", "seomgwang"] },
  { id: "hwangol", name: "환골탈태", han: "換骨奪胎", desc: "불사가 발동하면 숨 셋으로 되살아난다", combo: ["josik", "bulsa"] },
  { id: "deungun", name: "등운", han: "騰雲", desc: "연을 놓으면 더 높이 솟고 공중 도약이 되살아난다", combo: ["baram", "gyeonggong"] },
  { id: "samyeon", name: "삼연격", han: "三連擊", desc: "일격 직후 잠깐은 모든 베기가 일격이 된다", combo: ["yeongyeok", "eot"] },
  { id: "talhon", name: "탈혼", han: "奪魂", desc: "귀검의 충격파도 일격처럼 벤다", combo: ["gwigeom", "heuphon"] },
  { id: "munyeom", name: "무념", han: "無念", desc: "조준 슬로모션이 훨씬 길게 이어진다", combo: ["jangmak", "jeong"] },
  { id: "jeokmak", name: "적막", han: "寂寞", desc: "적이 쏘는 간격이 길어진다", combo: ["mae", "danhwa"] },
  { id: "dansung", name: "단승", han: "斷繩", desc: "대시로 금줄을 지나면 금줄이 끊어진다", combo: ["geum", "janyeong"] },
  { id: "seomil", name: "섬광일섬", han: "閃光一閃", desc: "돌진베기의 범위가 크게 넓어진다", combo: ["ilseom", "seomgwang"] },
  { id: "yeoncham", name: "연참", han: "鳶斬", desc: "연을 잡는 순간 둘레의 적을 벤다", combo: ["yeonsa", "yeon"] },
  { id: "saenggi", name: "생기", han: "生氣", desc: "마당을 넘으면 숨이 가득 찬다", combo: ["hyeol", "josik"] },
  { id: "jiljoo", name: "질주", han: "疾走", desc: "힘껏 달리는 동안 앞에서 오는 탄을 튕겨낸다", combo: ["jilpung", "janyeong"] },
  { id: "cheollyeon", name: "천리연", han: "千里鳶", desc: "연을 두 배 멀리서 잡는다", combo: ["baram", "biyeon"] }
];
for (const c of CHOSIK) if (c.combo) { c.icon = CHOSIK.find(o => o.id === c.combo[0]).icon; c.icon2 = CHOSIK.find(o => o.id === c.combo[1]).icon; }
// 징조: one rule chosen for each new turn of the tower, harder ones pay back
const OMENS = [
  { id: "angae", name: "안개", han: "霧", desc: "앞이 잘 보이지 않는다", gift: "비급 하나 더", bonus: true },
  { id: "geupbak", name: "급박", han: "急拍", desc: "장단이 한층 빨라진다", gift: "숨 하나 (최대 5)" },
  { id: "yeokpung", name: "역풍", han: "逆風", desc: "앞에서 바람이 밀어낸다", gift: "비급 하나 더", bonus: true },
  { id: "hyeolmaeng", name: "피의 맹세", han: "血盟", desc: "적은 일격으로만 쓰러진다", gift: "다섯을 벨 때마다 숨 하나" },
  { id: "gyeopjul", name: "겹금줄", han: "重繩", desc: "금줄이 훨씬 많아진다", gift: "비급 하나 더", bonus: true },
  { id: "gunse", name: "군세", han: "軍勢", desc: "적이 더 많이 나온다", gift: "비급 하나 더", bonus: true },
  { id: "goyo", name: "고요", han: "靜", desc: "장단판의 북이 보이지 않는다", gift: "비급 하나 더", bonus: true },
  { id: "pyeong", name: "평온", han: "平", desc: "아무 일도 일어나지 않는다", gift: "보상 없음", calm: true }
];
const SEASON = [{ name: "여름", line: "장맛비가 그치지 않는다." }, { name: "가을", line: "단풍이 진다. 천고가 다시 울린다." }, { name: "겨울", line: "눈이 내린다. 장단이 얼어붙듯 빠르다." }, { name: "봄", line: "꽃잎이 날린다. 탑은 다시 처음이다." }];
const has = id => !!(run && run.perks && run.perks.includes(id));
const baseAir = () => (has("biyeon") ? 2 : 1);
const cyc = () => (run && mode !== "tutorial" ? run.cycle || 0 : 0);   // how many times 천고 has been cut
const omen = id => !!(run && mode !== "tutorial" && run.omen === id);
const season = () => { const c = cyc(); return c ? ((c - 1) % 3) + 1 : 0; };   // 여름 비, then 가을 · 겨울 · 봄 in turn
const ghostly = e => (e.type === "r" && e.ph === "gone") || !!e.hidden;
const bossAlive = () => enemies.some(e => e.alive && e.type === "b");
const F3 = { orb: 8 }, FXB = { coin: 0, fire: 1, claw: 2, hair: 3, pillar: 4, beam: 5, fan: 6, water: 7, scrap: 8 };   // bossB extra frame; bossfx sheet
const maxv = () => MAXV * (has("jilpung") ? 1.18 : 1);
const strikeWin = () => STRIKE_WIN * (has("siman") ? 2.3 : has("eot") ? 1.6 : 1);
const PINE_N = 5, DEATH_SEAL = 5;   // pines sheet: five misty pines, then the 絶命 seal
const P2 = { plank: 0, ledge: 1, board: 2, rack: 3, haetae: 4, gate: 5, brazier: 6, lanterns: 7, sacks: 8 };
const CAL = { title: 0, death: 1, madang: [2, 3, 4, 5, 6], end: 7, clear: 8 };   // 천고 절명 초입 연비 망루 승천 결전 종국 등천
const PROP = { rope: 0, aim: 1, reticle: 2, pine: 3, stoneLantern: 4, jars: 5, banner: 6, sotdae: 7, palisade: 8 };
const DRESS = [[PROP.pine, 74, 3], [PROP.stoneLantern, 34, 2], [PROP.jars, 26, 1], [PROP.banner, 80, 3], [PROP.sotdae, 84, 3], [PROP.palisade, 28, 1]]; // [frame, world height, headroom tiles]
const OBJ = { lanternOn: 0, lanternOff: 1, kite: 2, thorns: 3, seal: 4, emitter: 5, slash: 6, slashRed: 7, splat: 8 };
for (const n of ["hero", "hero2", "foes", "objects", "ui", "fx", "hud", "hudsolid", "props", "props2", "rocks", "pines", "slabs", "pillars", "rogue", "roguea", "rogue2", "rogue3", "rogue4", "foes2", "bossA", "bossB", "bossfx", "bossC", "bossD", "bossE", "bossF", "hero3", "herofx"]) {
  Promise.all([
    fetch(`assets/sprites/${n}.json`).then(r => r.json()),
    new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `assets/sprites/${n}.webp`; })
  ]).then(([f, img]) => { SPR[n] = { f, img, inv: ["hero", "hero2", "foes", "objects", "fx", "props", "props2", "rocks", "pines", "slabs", "pillars"].includes(n) ? inkInverted(img) : null }; applyUiSprites(); }).catch(() => {});
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
  // icons come from the colour-keyed sheet: the flood-keyed one left paper-white patches inside the art
  if (SPR.roguea && !root.getPropertyValue("--chosik-2")) for (let i = 2; i < 9; i++) root.setProperty("--chosik-" + i, url("roguea", i));
  if (SPR.rogue && !root.getPropertyValue("--card")) {
    const s = SPR.rogue, f = s.f[1], cx = Math.round(f.w * .4), c = document.createElement("canvas"); c.width = f.w - cx; c.height = f.h;
    c.getContext("2d").drawImage(s.img, f.x + cx, f.y, f.w - cx, f.h, 0, 0, f.w - cx, f.h); root.setProperty("--card", `url(${c.toDataURL()})`);
  }
  if (SPR.rogue2 && !root.getPropertyValue("--chosik-100")) {
    for (let i = 0; i < 9; i++) root.setProperty("--chosik-" + (100 + i), url("rogue2", i));
  }
  if (SPR.rogue3 && !root.getPropertyValue("--chosik-200")) for (let i = 0; i < 9; i++) root.setProperty("--chosik-" + (200 + i), url("rogue3", i));
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
function drawPillar(c, pal) { // stacked rock segments; a grounded pillar fades into the ground over its last 56px
  const f = SPR.pillars.f[c.i], segH = c.w * f.h / f.w, img = pal.night ? SPR.pillars.inv : SPR.pillars.img, base = pal.night ? .45 : .88;
  const solidEnd = c.g ? c.g : c.y1, fade = c.g ? 56 : 0;
  const bands = [[c.y0, c.g ? solidEnd : solidEnd + 4, base]];
  for (let k = 1; k <= 7 && fade; k++) bands.push([solidEnd, solidEnd + k * 8, .26]);   // nested translucent layers sum to a smooth fade with no band edges
  ctx.filter = "brightness(.72) contrast(1.15)";
  for (const [a, b, al] of bands) {
    ctx.save(); ctx.beginPath(); ctx.rect(c.x - c.w, a, c.w * 2, b - a); ctx.clip(); ctx.globalAlpha = al;
    for (let y = c.y0, k = 0; y < b; y += segH - 10, k++) { if (y + segH < a) continue; ctx.save(); ctx.translate(c.x, y); if ((k + (c.flip ? 1 : 0)) % 2) ctx.scale(-1, 1); ctx.drawImage(img, f.x, f.y, f.w, f.h, -c.w / 2, 0, c.w, segH); ctx.restore(); }
    ctx.restore();
  }
  ctx.filter = "none"; ctx.globalAlpha = 1;
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
    } else {                                                      // open ground, maybe a guard or a hawk
      if (rng() < .5) put(x + 1, 11, "?"); else if (rng() < .4) put(x + 1, 6, "*");
      x += 3 + ((rng() * 3) | 0);
    }
  }
  return c;
}
// boss arena before the last drum: a long floor with two ledges to dodge the 수문장's ground waves
const ARENA_PIECE = (() => { const r = []; for (let y = 0; y < 16; y++) r.push(y >= 12 ? "#".repeat(26) : y === 11 ? " C" + " ".repeat(16) + "b" + " ".repeat(7) : y === 9 ? "     ====      ====       " : " ".repeat(26)); return r; })();
function buildMadangMap(seed, m, cy = 0, om = null) {
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
        c[y][x] = m === 0 ? "g" : m === 1 ? (r < .75 ? "g" : "s") : m === 2 ? (r < .5 ? "g" : r < .75 ? "h" : "s") : (r < .4 ? "g" : r < .7 ? "h" : "s");
        if (cy >= 1) { const r2 = rng(); if (r2 < .14) c[y][x] = "m"; else if (cy >= 2 && r2 < .28) c[y][x] = "r"; }   // 무당 from the second turn, 저승사자 from the third
      } else if (ch === "*") c[y][x] = rng() < .5 + .12 * m ? "d" : " ";
      else if ((ch === "L" || ch === "M") && rng() < .5) c[y][x] = ch === "L" ? "M" : "L";
    }
    // extra guard on open ground in about half the pieces
    for (let extra = om === "gunse" ? 2 : 1; extra > 0; extra--) if (rng() < .45 + .08 * m + (om === "gunse" ? .35 : 0)) for (let tries = 0; tries < 8; tries++) {
      const x = 3 + ((rng() * (c[0].length - 6)) | 0);
      let y = 2; while (y < 15 && c[y][x] === " ") y++;
      if (y < 15 && c[y][x] === "#" && c[y - 1][x] === " " && c[y - 2][x] === " " && !c[y - 1].some(ch => "gshdmr".includes(ch))) { c[y - 1][x] = m >= 2 && rng() < .35 ? "h" : "g"; break; }
    }
    for (let y = 0; y < 16; y++) rows[y] += c[y].join("");
  }
  if (m === 4 || m === 2) for (let y = 0; y < 16; y++) rows[y] += ARENA_PIECE[y];
  for (let y = 0; y < 16; y++) rows[y] += END_PIECE[y];
  // scatter extra kites through open sky so the 연 line can carry you across most of the 마당
  const W = rows[0].length, grid = rows.map(r => r.split(""));
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
  const lv = { w, h, grid, pal, hints: hints || [], defs: [], points: [], cps: [], lasers: [], start: null, exit: null, stains: [] };
  let id = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = map[y][x] || " ";
    if (ch === "#") grid[y * w + x] = 1;
    else if (ch === "^") grid[y * w + x] = 2;
    else if (ch === "=") grid[y * w + x] = 3;   // ledge: stand on it, jump up through it
    else if (ch === "P") lv.start = { x: x * T + 7, y: (y + 1) * T - 30 };
    else if (ch === "E") lv.exit = { x: x * T + 1, y: (y - 1) * T + 6, w: T - 2, h: 2 * T - 6 };
    else if ("gsdhmrb".includes(ch)) lv.defs.push({ type: ch, tx: x, ty: y, id: id++ });
    else if (ch === "o") lv.points.push({ x: x * T + 16, y: y * T + 16, sway: Math.random() * 6 });
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
let mode = null;         // "run" | "daily" | "tutorial"
let run = null;
let P = null, enemies = [], bullets = [], parts = [], ghosts = [], seals = [];
let deadIds = new Set(), cpSave = null, vfx = [];
let lastHitDir = null, deathT = 0, hitstop = 0, shake = 0, songPos = 0, flash = 0;
let cam = { x: 0, y: 0 }, hookCand = null, toastT = 0;

function newPlayer(x, y) {
  return { x, y, w: 18, h: 30, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0, wall: 0, wallLock: 0,
    airDash: 1, dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 }, slashT: 0, slashCd: 0, slashDir: { x: 1, y: 0 }, strike: false, clanged: null, dashHit: new Set(), hitSet: new Set(),
    hook: null, hookCd: 0, climbT: 0.5, climbing: false, focus: false, focusT: 0, run: 0, scarf: [] };
}
function spawnEnemies() {
  const hp = 1 + cyc();
  enemies = LV.defs.filter(d => !deadIds.has(d.id)).map(d => {
    if (d.type === "d") return { hp, maxHp: hp, id: d.id, type: "d", x: d.tx * T + 2, y: d.ty * T + 6, w: 28, h: 20, vx: 0, vy: 0, hx: d.tx * T + 2, hy: d.ty * T + 6, t: Math.random() * 6, alive: true };
    if (d.type === "h") return { hp, maxHp: hp, id: d.id, type: "h", x: d.tx * T + 4, y: (d.ty + 1) * T - 42, w: 24, h: 42, face: -1, vx: 0, alive: true };
    if (d.type === "m") return { hp, maxHp: hp, id: d.id, type: "m", x: d.tx * T + 5, y: (d.ty + 1) * T - 44, w: 22, h: 44, face: -1, castAt: songPos + 1 + Math.random(), castT: 0, alive: true };
    if (d.type === "r") return { hp, maxHp: hp, id: d.id, type: "r", x: d.tx * T + 5, y: (d.ty + 1) * T - 46, w: 22, h: 46, face: -1, ph: "idle", nextAt: songPos + 1.5 + Math.random(), fade: 1, alive: true };
    if (d.type === "b") {
      const kind = window.__forceBoss || (run && mode !== "tutorial" ? bossFor(run.seed, cyc(), run.m) : "sumun"), B = BOSSES[kind], bh = B.hp + 3 * cyc(), floor = (d.ty + 1) * T;
      return { hp: bh, maxHp: bh, id: d.id, type: "b", kind, x: d.tx * T + 16 - B.w / 2, y: (B.fly ? floor - 95 - B.h / 2 : floor - B.h), w: B.w, h: B.h, floor, face: -1, vx: 0, vy: 0, act: null, nextAt: 0, n: (run && run.seed || 0) % 4, mask: 0, alive: true };
    }
    return { hp, maxHp: hp, id: d.id, type: d.type, x: d.tx * T + 5, y: (d.ty + 1) * T - 42, w: 22, h: 42, face: -1, fireAt: null, aimFrom: 0, readyAt: songPos + 0.6 + Math.random() * 0.8, tx: 0, ty: 0, alive: true };
  });
}

// ---------- run flow ----------
function newRun(daily) {
  const key = todayKey();
  run = { seed: daily ? hashStr("chungo-" + key) : (Math.random() * 2 ** 32) >>> 0, daily, dateKey: key, m: 0, cp: -1, dead: [],
    breath: 3, time: 0, deaths: 0, kills: 0, strikes: 0, slashes: 0, perks: [] };
  mode = daily ? "daily" : "run";
  saveRun(); showInterlude();
}
function continueRun() {
  const s = store.get("run", null); if (!s) return;
  run = s; mode = s.daily ? "daily" : "run";
  if (s.m > LAST_M) s.m = LAST_M;   // a run saved under the old five-마당 tower
  if (s.choosing === "omen") showOmen(); else if (s.choosing) showChoice(s.choosing); else showInterlude();
}
function saveRun() { if (run && mode !== "tutorial") store.set("run", run); }
function showInterlude() {
  state = "interlude";
  const md = MADANG[MD(run.m)], jd = Music.JANGDAN[md.jd];
  $("iOrd").textContent = MNAME[MD(run.m)];
  const om = OMENS.find(o => o.id === run.omen);
  const bk = run.m >= 1 && BOSSES[bossFor(run.seed, run.cycle || 0, run.m)];
  $("iLine").textContent = run.m === 0 && run.cycle ? SEASON[season()].line : bk ? `${bk.line} ${josa(bk.name, "을", "를")} 넘어 ${run.m === LAST_M ? "천고를 베어라." : "다음 마당으로."}` : md.line;
  $("iMeta").textContent = ((run.cycle || 0) ? `${run.cycle + 1}번째 판 · ${SEASON[season()].name} · ` : "") + ORD[run.m] + " 마당 · " + jd.name + " · " + "●".repeat(run.breath) + "○".repeat(Math.max(0, 3 - run.breath)) + (om && !om.calm ? " · 징조 " + om.name : "") + (run.daily ? " · 오늘의 판" : "");
  $("interlude").classList.remove("night");
  loadMap(buildMadangMap(run.seed, MD(run.m), run.cycle || 0, run.omen), PAL[MD(run.m)]); LV.ledgeStone = MD(run.m) >= 3;
  if (run.m === LAST_M && LV.exit) { // the last 마당 ends at 천고 itself instead of a seal
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
  P = newPlayer(s.x, s.y); run.hosinUsed = 0; run.cutDrums = run.cutDrums || [];
  bullets = []; parts = []; ghosts = []; seals = []; vfx = []; haz = [];
  Music.start(MADANG[MD(run.m)].jd, run.seed + run.m, (1 + .08 * (run.cycle || 0)) * (omen("geupbak") ? 1.15 : 1));
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
  bullets = []; ghosts = []; haz = [];
  const s = cpSave || { x: LV.start.x, y: LV.start.y, dead: new Set() };
  deadIds = new Set(s.dead);
  P = newPlayer(s.x, s.y);
  spawnEnemies(); state = "play"; setHud();
}
function die() {
  if (state !== "play" || (P.invT || 0) > 0) return;
  if (has("hosin") && (run.hosinUsed || 0) < (has("bulmyeol") ? 2 : 1) && P.y < LV.h * T) { // talisman burns instead of the swordsman
    run.hosinUsed = (run.hosinUsed || 0) + 1; P.invT = has("geumgang") ? 2 : 1.2;
    if (has("geumgang")) for (const b of bullets) if (!b.friendly && Math.hypot(b.x - P.x, b.y - P.y) < 320) b.life = 0; flash = .3; shake = 8; Music.sfx("clang"); toast("호신부가 타올랐다");
    addFx("fx", FX.burst, P.x + P.w / 2, P.y + P.h / 2, 70, { life: .5 }); return;
  }
  state = "dead"; deathT = 0; run.deaths++;
  if (mode !== "tutorial") { run.breath--; if (run.breath <= 0 && has("bulsa") && !run.bulsaUsed) { run.bulsaUsed = true; run.breath = has("hwangol") ? 3 : 1; toast("불사 · 숨이 다시 이어졌다"); } saveRun(); }
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
  run.m++; run.cp = -1; run.dead = []; run.cutDrums = []; run.breath = has("saenggi") ? 5 : Math.min(5, Math.max(run.breath, 3) + (has("josik") ? 1 : 0));   // breath refills each 마당
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
    saveRun(); Music.stop(); showInterlude();
  };
  const owned = id => (run.perks || []).includes(id);
  const rnd = mulberry((run.seed ^ (run.m * 7919) ^ ((run.cycle || 0) * 104729) ^ ((run.perks || []).length * 31337)) >>> 0), pool = CHOSIK.filter(c => !c.combo && (c.repeat ? run.breath < 5 : !owned(c.id)));
  const combos = CHOSIK.filter(c => c.combo && !owned(c.id) && c.combo.every(owned));
  const picks = []; if (combos.length) picks.push(combos[(rnd() * combos.length) | 0]);   // a ready combination always shows up first
  while (picks.length < 3 && pool.length) picks.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
  if (!picks.length) { toast("익힐 비급이 더 없다"); done(); return; }   // every 비급 learned and breath full
  $("chTitle").textContent = "비급을 고르라";
  const box = $("cards"); box.innerHTML = "";
  for (const c of picks) {
    const b = document.createElement("button"); b.className = "card" + (c.combo ? " combo" : "");
    b.innerHTML = (c.combo ? `<i class="ic duo" style="--ic:var(--chosik-${c.icon});--ic2:var(--chosik-${c.icon2})"></i><em class="tag">조합 · ${c.combo.map(id => CHOSIK.find(o => o.id === id).name).join(" + ")}</em>` : `<i class="ic" style="--ic:var(--chosik-${c.icon})"></i>`) + `<b class="nm"></b><span class="han"></span><span class="ds"></span>`;
    b.querySelector(".nm").textContent = c.name; b.querySelector(".han").textContent = c.han; b.querySelector(".ds").textContent = c.desc;
    b.addEventListener("click", () => {
      run.perks = run.perks || [];
      if (c.id === "sum") run.breath = Math.min(5, run.breath + 1); else run.perks.push(c.id);
      Music.sfx("lantern"); done();
    });
    box.appendChild(b);
  }
  $("chMadang").textContent = kind === "cycle" ? `천고를 베었다 · ${(run.cycle || 0) + 1}번째` : kind === "bonus" ? "징조의 대가" : `${ORD[run.m - 1]} 마당을 넘었다`;
  state = "choice"; Music.pause(); if (P) P.focus = false; for (const k in held) held[k] = 0; showScreen("choice");
}
function showOmen() {   // the rule for the coming turn: two omens drawn at random, or a calm one
  const rnd = mulberry((run.seed ^ ((run.cycle || 0) * 7477)) >>> 0), pool = OMENS.filter(o => !o.calm), picks = [];
  while (picks.length < 2) picks.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
  picks.push(OMENS.find(o => o.calm));
  $("chTitle").textContent = "징조를 고르라";
  $("chMadang").textContent = `${(run.cycle || 0) + 1}번째 판 · ${SEASON[season()].name}`;
  const box = $("cards"); box.innerHTML = "";
  for (const o of picks) {
    const b = document.createElement("button"); b.className = "card omen" + (o.calm ? " calm" : "");
    b.innerHTML = `<i class="ic"></i><b class="nm"></b><span class="ds"></span><span class="gift"></span>`;
    b.querySelector(".ic").textContent = o.han; b.querySelector(".nm").textContent = o.name; b.querySelector(".ds").textContent = o.desc; b.querySelector(".gift").textContent = "대가 · " + o.gift;
    b.addEventListener("click", () => {
      run.omen = o.calm ? null : o.id; Music.sfx("lantern");
      if (o.id === "geupbak") run.breath = Math.min(5, run.breath + 1);
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
  const reached = (run.cycle || 0) * (LAST_M + 1) + run.m + (won ? 1 : 0);
  const rate = run.slashes ? Math.round(run.strikes / run.slashes * 100) : 0;
  $("rSeal").textContent = won ? "登" : "終";
  $("rTitle").textContent = won ? "등천" : "절명";
  $("rSub").textContent = won ? "천고는 아직 위에서 울린다." : ORD[run.m] + " 마당에서 숨이 다했다.";
  $("rStats").innerHTML = "";
  for (const [k, v] of [["넘은 마당", reached + ((run.cycle || 0) ? ` · ${run.cycle}번 천고를 벰` : "")], ["시간", fmt(run.time)], ["일격", run.strikes + "회 · " + rate + "%"], ["벤 적", run.kills], ["베인 횟수", run.deaths]]) {
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
  const cyc = Math.floor(r.reached / 5), m = r.reached % 5;
  return `${head}\n${r.reached}마당 넘음${cyc ? ` · 천고 ${cyc}번 벰` : ""} · ${fmt(r.time)} · 일격 ${r.rate}%\n` + "●".repeat(cyc) + "▮".repeat(m) + "▯".repeat(5 - m);
}

// ---------- player ----------
const CLIMBV = 270, CLIMB_T = 0.5, GRAV = 1900, JUMPV = 640, MAXV = 300, DASHV = 1000, HOOK_R = 300, STRIKE_WIN = 0.15;
function aimDir() { const a = axis(), m = Math.hypot(a.x, a.y); return m < 0.35 ? { x: P.face, y: 0 } : { x: a.x / m, y: a.y / m }; }
function startDash(dir) {
  if (P.dashCd > 0) return false;
  if (!P.onGround) { if (P.airDash <= 0) return false; P.airDash--; if (has("bicheon")) P.djN = 0; }
  let d = dir || aimDir();
  if (P.onGround && d.y > 0.2) d = { x: d.x === 0 ? P.face : Math.sign(d.x), y: 0 };
  { const ang = Math.atan2(d.y, Math.abs(d.x)), dx = Math.abs(d.x) > .2 ? Math.sign(d.x) : P.face; heroFx("dash", P.x + P.w / 2 - d.x * 26, P.y + P.h / 2 - d.y * 26, dx, ang); }
  P.dashDir = d; P.dashT = (has("janyeong") ? 0.21 : 0.15) * (P.onGround && has("chukji") ? 1.8 : 1); P.dashCd = has("seomgwang") ? 0.1 : 0.32; P.dashHit = new Set(); P.hook = null;
  if (Math.abs(d.x) > 0.2) P.face = Math.sign(d.x);
  Music.sfx("dash"); return true;
}
function doSlash(req) {
  if (P.hook) return;
  if (P.slashCd > 0 && !req.dash) return;
  let d = req.dir;
  if (!d) { const a = axis(), m = Math.hypot(a.x, a.y); d = m > 0.5 ? { x: a.x / m, y: a.y / m } : { x: P.face, y: 0 }; }
  const off = Music.offBeat(Music.posAt(req.ts));
  const onBeat = Math.abs(off) < strikeWin(), strike = onBeat || (has("samyeon") && (P.chainT || 0) > 0);
  if (onBeat && has("samyeon")) P.chainT = .45;
  run.slashes++; if (strike) run.strikes++;
  P.slashDir = d; P.slashT = req.dash ? 0.22 : 0.14; P.slashCd = has("yeongyeok") ? 0.08 : 0.2; P.strike = strike; P.clanged = new Set(); P.hitSet = new Set();
  if (has("geompung")) { const gs = strike && has("gwisin"); for (const t of has("mancheon") ? [-.3, 0, .3] : [0]) { const c = Math.cos(t), sn = Math.sin(t), vx = d.x * c - d.y * sn, vy = d.x * sn + d.y * c; bullets.push({ x: P.x + P.w / 2 + vx * 20, y: P.y + P.h / 2 + vy * 20, vx: vx * 760, vy: vy * 760, friendly: true, wind: true, strike: gs, pierce: gs, life: gs ? .5 : .32, owner: null }); } }
  if (strike && has("pilsal")) for (const b of bullets) if (!b.friendly && Math.hypot(b.x - P.x - P.w / 2, b.y - P.y - P.h / 2) < 280) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 22, { life: .25 }); }
  if (strike && has("gwigeom")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 140) hurtEnemy(e, has("talhon") && e.type !== "b"); addFx("hud", HUD.spark, cx, cy, 120, { life: .35 }); }
  if (Math.abs(d.x) > 0.2) P.face = Math.sign(d.x);
  if (strike || d.y > .5) { const sx = Math.abs(d.x) > .2 ? Math.sign(d.x) : P.face; heroFx(strike ? "strike" : "arc", P.x + P.w / 2 + d.x * 30, P.y + P.h / 2 + d.y * 26, sx, Math.atan2(d.y, Math.abs(d.x) || .001)); }
  if (!P.onGround && P.vy > 60) P.vy = 60;
  if (req.dash) startDash(d);
  Music.sfx(strike ? "strike" : "slash");
  if (strike) flash = 0.12;
}
function findHook() {
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2; let best = null, bs = 1e9;
  for (const p of LV.points) {
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
    if (d > HOOK_R * (has("cheollyeon") ? 2 : has("baram") ? 1.4 : 1) || d < 24 || !los(cx, cy, p.x, p.y)) continue;
    const s = d - (dx * P.face > 0 ? 70 : 0) - (dy < 0 ? 40 : 0);
    if (s < bs) { bs = s; best = p; }
  }
  return best;
}
function frameInput(rdt) {
  if (press.jump && P.onGround && axis().y > .5 && onLedge(P)) { P.dropT = .25; P.y += 3; P.onGround = false; press.jump = 0; } // down + jump: drop through a ledge
  // in the air with no jump left to spend, jump grabs the 연 in reach: one button for "get higher"
  if (press.jump && !P.onGround && P.coyote <= 0 && !P.wall && !(P.wallT > 0) && hookCand && P.hookCd <= 0 && !P.hook) { press.hook = 1; press.jump = 0; }
  if (press.jump) P.jumpBuf = 0.18;
  if (slashReq) { doSlash(slashReq); slashReq = null; }
  if (press.hook && hookCand && P.hookCd <= 0) { P.hook = hookCand; P.dashT = 0; P.focus = false; Music.muffle(false); Music.sfx("hook"); heroFx("wind", hookCand.x, hookCand.y, 1);
    if (has("yeoncham")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 120) hurtEnemy(e, false); addFx("fx", FX.slashB, cx, cy, 80, { life: .3 }); } }
  if (press.dash) {
    if (P.onGround || P.hook) startDash();
    else if (P.airDash > 0 && P.dashCd <= 0) { P.focus = true; P.focusT = 0; Music.muffle(true); }
  }
  if (P.focus) { P.focusT += rdt; if (!held.dash || P.focusT > (has("munyeom") ? 4 : has("jeong") ? 2.2 : 1.2) || P.onGround) { P.focus = false; Music.muffle(false); startDash(); } }
  press.jump = press.dash = press.hook = 0;
  P.jumpBuf = Math.max(0, P.jumpBuf - rdt);
}
const approach = (v, t, a) => v < t ? Math.min(t, v + a) : Math.max(t, v - a);
function stepPlayer(dt) {
  const a = axis(), ix = a.x > 0.3 ? 1 : a.x < -0.3 ? -1 : 0;
  P.invT = Math.max(0, (P.invT || 0) - dt);
  if (P.dashT > 0 && !bossAlive()) for (const d of drumsInPlay()) if (Math.abs(P.x + P.w / 2 - d.x) < 24 && P.y + P.h > d.y - d.h && P.y < d.y) cutDrum(d); P.landT = Math.max(0, (P.landT || 0) - dt); P.dropT = Math.max(0, (P.dropT || 0) - dt); P.dashCd = Math.max(0, P.dashCd - dt); P.slashCd = Math.max(0, P.slashCd - dt); P.hookCd = Math.max(0, P.hookCd - dt); P.wallLock = Math.max(0, P.wallLock - dt);
  if (P.hook) {
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2, dx = P.hook.x - cx, dy = P.hook.y - cy, d = Math.hypot(dx, dy);
    if (d < 30) { const lb = (has("baram") ? 1.25 : 1) * (has("deungun") ? 1.2 : 1); if (has("deungun")) P.djN = 0; P.vx = dx / d * 700 * lb; P.vy = dy / d * 700 * lb - 260 * lb; P.hook = null; P.hookCd = 0.25; P.airDash = has("yeonsa") ? 2 : baseAir(); if (has("yeonbi")) { P.invT = Math.max(P.invT || 0, .5); P.dashCd = 0; } if (Math.abs(P.vx) > 40) P.face = Math.sign(P.vx); }
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
    if (has("dansung")) for (let i = LV.lasers.length - 1; i >= 0; i--) { const l = LV.lasers[i]; if (Math.abs(P.x + P.w / 2 - l.x) < 16 && P.y + P.h > l.y0 && P.y < l.y1) { LV.lasers.splice(i, 1); addFx("hud", HUD.spark, l.x, P.y + P.h / 2, 50, { life: .4 }); Music.sfx("clang"); } }
    if (P.dashT <= 0 || hx || hy) { P.dashT = 0; P.vx = P.dashDir.x * maxv() * 1.35; P.vy = P.dashDir.y * 380;
      if (has("bunsin")) { const cx = P.x + P.w / 2, cy = P.y + P.h / 2; for (const e of enemies) if (e.alive && Math.hypot(e.x + e.w / 2 - cx, e.y + e.h / 2 - cy) < 75) hurtEnemy(e, false); addFx("fx", FX.slashB, cx, cy, 90, { life: .3 }); } }
  } else {
    if (P.wallLock <= 0) {
      if (P.onGround) P.vx = (ix && Math.sign(P.vx) === ix && Math.abs(P.vx) > maxv()) ? approach(P.vx, ix * maxv(), 1400 * dt) : approach(P.vx, ix * maxv(), (ix ? 2600 : 2400) * dt);
      else if (ix) P.vx = (Math.sign(P.vx) === ix && Math.abs(P.vx) > maxv()) ? approach(P.vx, ix * maxv(), 450 * dt) : approach(P.vx, ix * maxv(), 1800 * dt);
      else P.vx = approach(P.vx, 0, 320 * dt);
      if (ix) P.face = ix;
    }
    if (P.jumpBuf > 0) {
      if (P.onGround || P.coyote > 0) { P.vy = -JUMPV * (has("gyeonggong") ? 1.12 : 1); if (has("bisang") && Math.abs(P.vx) > maxv() * .8) P.vx *= 1.3; heroFx("jump", P.x + P.w / 2, P.y + P.h + 2, P.face); P.onGround = false; P.coyote = 0; P.jumpBuf = 0; Music.sfx("jump"); }
      else if (P.wall || P.wallT > 0) { const wd = P.wall || P.wallMem; P.wallT = 0; P.vy = -600; P.vx = -wd * 380; P.face = -wd; P.wallLock = 0.15; P.jumpBuf = 0; P.climbT = Math.max(P.climbT, 0.35); if (has("byeokryeok")) P.airDash = Math.max(P.airDash, baseAir() + 1); Music.sfx("jump"); puff(wd > 0 ? P.x + P.w : P.x, P.y + P.h - 6, 6); heroFx("wall", P.x + P.w / 2 + wd * 10, P.y + P.h / 2, wd); }
      else if (has("idan") && (P.djN || 0) < (has("neunggong") ? 3 : 1)) { P.vy = -JUMPV * .9; P.djN = (P.djN || 0) + 1; heroFx("air", P.x + P.w / 2, P.y + P.h + 4, P.face); P.jumpBuf = 0; Music.sfx("jump"); addFx("hud", HUD.dust, P.x + P.w / 2, P.y + P.h, 26, { life: .35, a: .7 }); }
    }
    let g = GRAV; if (P.vy < 0 && !held.jump && !P.wallLock && !P.climbing) g *= 2.1;
    if (has("cheongeun") && axis().y > .5 && !P.wall) g *= 2.2;
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
  if (P.onGround) { P.airT = 0; P.runT = Math.abs(P.vx) > 40 ? (P.runT || 0) + dt : 0; P.coyote = 0.14; P.airDash = baseAir(); P.climbT = CLIMB_T * (has("byeokho") ? 2 : 1); if (!was) { addFx("hud", HUD.dust, P.x + P.w / 2, P.y + P.h + 2, 22, { life: .35, ay: 1, a: .8 }); P.landT = 0.1; if ((P.lastVy || 0) > 650) heroFx("land", P.x + P.w / 2, P.y + P.h + 3, P.face);
      if (has("nakhwayusu") && (P.lastVy || 0) > 900) { const cx = P.x + P.w / 2; for (const e of enemies) if (e.alive && Math.abs(e.x + e.w / 2 - cx) < 100 && Math.abs(e.y + e.h - P.y - P.h) < 50) hurtEnemy(e, false); addFx("hud", HUD.dust, cx, P.y + P.h, 90, { life: .45, ay: 1 }); shake = Math.max(shake, 6); Music.sfx("kill"); } } } else { P.coyote = Math.max(0, P.coyote - dt); P.airT = (P.airT || 0) + dt; }
  const wl = rectSolid(P.x - 3, P.y + 4, 3, P.h - 8), wr = rectSolid(P.x + P.w, P.y + 4, 3, P.h - 8);
  P.wall = P.onGround ? 0 : wr ? 1 : wl ? -1 : 0;
  if (P.wall) { P.wallMem = P.wall; P.wallT = .12; } else P.wallT = Math.max(0, (P.wallT || 0) - dt);   // wall jump still works a moment after slipping off
  if (P.onGround || P.wall) P.djN = 0;
  P.chainT = Math.max(0, (P.chainT || 0) - dt);
  if (P.wall) P.airDash = Math.max(P.airDash, baseAir());
  if (P.onGround && Math.abs(P.vx) > 20) P.run += dt * Math.abs(P.vx) * 0.045;
}
function ghost(gap) { const l = ghosts[ghosts.length - 1]; if (!l || l.age > gap) ghosts.push({ x: P.x, y: P.y, face: P.face, age: 0, life: 0.22 }); for (const g of ghosts) g.age += 0.004; }
// one-shot painted effects: grow and fade
function addFx(sheet, i, x, y, h, o = {}) { vfx.push({ sheet, i, x, y, h, t: 0, life: o.life || .5, rot: o.rot || 0, grow: o.grow ?? .35, flip: !!o.flip, ay: o.ay ?? .5, a: o.a ?? 1 }); }
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
  const fy = findFloor(x, y); if (fy != null && LV.stains.length < 160) LV.stains.push({ x, y: fy + 2, pool: true, w: big ? 70 : 46, rot: 0 });
}
function puff(x, y, n) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 80, life: .3, max: .3, c: LV.pal.foe, s: 2 }); }
function stain(x, y, n, col) {
  for (let i = 0; i < n; i++) LV.stains.push({ x: x + (Math.random() - .5) * 40, y: y + (Math.random() - .3) * 30, r: 2 + Math.random() * 6, c: col || LV.pal.tile, rot: Math.random() * 6.28 });
  if (LV.stains.length > 160) LV.stains.splice(0, LV.stains.length - 160);
}
function laserOn(l) { const b = Math.floor(songPos / Music.beatLen); return (((b + l.phase) % 4) + 4) % 4 < (has("geum") ? 1 : 2); }
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
  if (LV.exit && overlap(pr, LV.exit) && !bossAlive()) madangClear();
}

// ---------- enemies ----------
// one hit point per cut 천고 beyond the first; a plain cut removes one, an 일격 kills outright
function hurtEnemy(e, strike) {
  if (!e.alive || ghostly(e)) return;
  if (e.ward && !strike) { // 무당's talisman takes the cut instead
    e.ward = false; addFx("hud", HUD.spark, e.x + e.w / 2, e.y + 6, 40, { life: .3 }); Music.sfx("clang"); return;
  }
  if (e.type === "b") { // a plain cut takes one, an 일격 three (four with 파천) and staggers it out of its wind-up
    if (!strike && (BOSSES[e.kind].armored || (e.kind === "talchum" && e.mask === 0))) { e.hitT = .1; Music.sfx("clang"); addFx("hud", HUD.spark, e.x + e.w / 2, e.y + 20, 34, { life: .25 }); return; }
    e.hp -= strike ? (has("pacheon") ? 4 : 3) : has("ssangryong") ? 2 : 1; e.hitT = .22;
    if (strike) { e.stagT = .6; e.act = null; e.suck = false; e.chargeT = 0; e.danceT = 0; e.swoopT = 0; e.nextAt = songPos + 2 * Music.beatLen; if (e.hidden) { e.hidden = false; e.x = e.tx - e.w / 2; } }
    addFx("fx", FX.drops, e.x + e.w / 2, e.y + 30, 30, { life: .4, rot: Math.random() * 6.28 });
    hitstop = Math.max(hitstop, .05); Music.sfx("clang"); shake = Math.max(shake, 4);
    if (e.hp <= 0) killEnemy(e); return;
  }
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
  if (e.type === "b") { haz = []; for (const o of enemies) if (o.type === "i") o.alive = false; toast(`${josa(BOSSES[e.kind].name, "이", "가")} 쓰러졌다 · ${run.m === LAST_M ? "천고를 베어라" : "길이 열렸다"}`); Music.jing(); shake = 14; for (let k = 0; k < 3; k++) bleed(e.x + e.w / 2 + (k - 1) * 20, e.y + 20 + k * 18, { x: k - 1, y: -.4 }, true); }
  if (omen("hyeolmaeng") && mode !== "tutorial") { run.oath = (run.oath || 0) + 1; if (run.oath % 5 === 0 && run.breath < 5) { run.breath++; setHud(); toast("피의 맹세 · 숨 하나를 되찾았다"); } }
  if (has("hyeol") && run.kills % (has("hyeolpung") ? 5 : 10) === 0 && run.breath < 5) { run.breath++; setHud(); toast("혈로 · 숨 하나를 되찾았다"); }
  if (has("heuphon") && P.slashT > 0 && P.strike) { P.invT = Math.max(P.invT || 0, .5); P.airDash = Math.max(P.airDash, baseAir()); }
  if (has("nakhwa") && P.slashT > 0 && P.slashDir.y > .5 && !P.onGround) { P.vy = -560; P.airDash = Math.max(P.airDash, 1); }
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 320; parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: .6, max: .6, c: i % 5 ? LV.pal.tile : SEAL, s: 2 + Math.random() * 4 }); }
  bleed(cx, cy, P.slashT > 0 ? P.slashDir : { x: Math.sign(cx - P.x - P.w / 2) || 1, y: -.2 }, false);
  hitstop = 0.07; shake = Math.max(shake, 6); P.airDash = Math.max(baseAir(), has("yeonbiyeon") ? 3 : has("yeon") ? 2 : 1); P.dashCd = 0;
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
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2, dist = Math.hypot(pcx - ecx, pcy - ecy);
    if (e.type === "d") {
      e.t += dt;
      const sees = live && dist < 430 && los(ecx, ecy, pcx, pcy);
      if (sees) { e.vx += (pcx - ecx) / dist * 520 * dt; e.vy += (pcy - ecy) / dist * 520 * dt; }
      else { e.vx += (e.hx - e.x) * 2 * dt; e.vy += (e.hy + Math.sin(e.t * 2) * 10 - e.y) * 2 * dt; }
      const sp = Math.hypot(e.vx, e.vy), cap = (sees ? 175 : 80) * (has("mae") ? .55 : 1); if (sp > cap) { e.vx *= cap / sp; e.vy *= cap / sp; }
      if (moveX(e, e.vx * dt)) e.vx *= -0.5;
      if (moveY(e, e.vy * dt)) e.vy *= -0.5;
      if (live && overlap(e, P)) { if (P.dashT > 0 || P.slashT > 0) { if (P.dashT > 0 ? !P.dashHit.has(e.id) : !(P.hitSet && P.hitSet.has(e.id))) { (P.dashT > 0 ? P.dashHit : P.hitSet).add(e.id); hurtEnemy(e, (P.strike && P.slashT > 0) || (P.dashT > 0 && has("nodo"))); } } else if (!(e.hitT > 0)) die(); }
      continue;
    }
    if (e.type === "m") { stepMudang(e, dt, pcx, dist, live); continue; }
    if (e.type === "r") { stepReaper(e, dt, pcx, pcy, dist, live); continue; }
    if (e.type === "b") { stepBoss(e, dt, pcx, pcy, dist, live); continue; }
    if (e.type === "i") { stepIllusion(e, dt, pcx, live); continue; }
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
    const fast = (1 + .22 * cyc()) / (has("danhwa") ? 1.4 : 1);
    const sniper = e.type === "s", range = sniper ? 920 : 560, lead = (sniper ? 1.0 : 0.45) / fast, lock = (sniper ? 0.3 : 0.15) / Math.max(1, fast * .8);
    const sees = live && dist < range && los(ecx, e.y + 8, pcx, pcy);
    if (sees) e.face = Math.sign(pcx - ecx) || e.face;
    if (e.fireAt != null) {
      if (songPos < e.fireAt - lock && sees) { e.tx = pcx; e.ty = pcy; }
      if (!sees && songPos < e.fireAt - lock) { e.fireAt = null; e.readyAt = songPos + 0.3; }
      else if (songPos >= e.fireAt) {
        const [mx, my] = muzzle(e), dx = e.tx - mx, dy = e.ty - my, d = Math.hypot(dx, dy) || 1, sp = (sniper ? 1250 : 430) * (1 + .1 * cyc()) * slowShot();
        bullets.push({ x: mx, y: my, vx: dx / d * sp, vy: dy / d * sp, owner: e, friendly: false, life: 3, sniper });
        addFx("hud", HUD.smoke, mx + e.face * 8, my - 4, 30, { life: .9, grow: .9, a: .8, flip: e.face < 0 }); // powder smoke
        e.fireAt = null; e.readyAt = songPos + Math.max(1, Math.round((sniper ? 4 : 2) / fast * (has("jeokmak") ? 1.5 : 1))) * bl;
        Music.sfx(sniper ? "snipe" : "shoot");
      }
    } else if (sees && songPos >= e.readyAt) {
      let k = Math.ceil((songPos + lead) / bl);
      if (sniper) { const m4 = Math.max(1, Math.round(4 / fast)); k = Math.ceil(k / m4) * m4; }
      e.fireAt = k * bl; e.aimFrom = songPos; e.tx = pcx; e.ty = pcy;
    }
    if (live && P.dashT > 0 && overlap(e, P) && !P.dashHit.has(e.id)) { P.dashHit.add(e.id); hurtEnemy(e, has("nodo")); }
  }
}
function dashThrough(e) { if (state === "play" && P.dashT > 0 && overlap(e, P) && !P.dashHit.has(e.id)) { P.dashHit.add(e.id); hurtEnemy(e, has("nodo") && e.type !== "b"); } }
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
// one waits at the end of the 둘째 and 셋째 마당. All act on the beat: an act is chosen, wound up (telegraphed) until
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
const BOSS_ORDER = ["gumiho", "dokkaebi", "imugi", "wongwi", "jangseung", "haetae", "bulgasari", "baekho", "talchum"];
const MASKS = ["양반탈", "각시탈", "말뚝이탈"];
function bossFor(seed, cy, m) { // a run-seeded order: first the 셋째 마당 boss, then 수문장, then the rest; never the same twice in a row
  const rnd = mulberry((seed ^ 0xB055) >>> 0), o = BOSS_ORDER.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [o[i], o[j]] = [o[j], o[i]]; }
  const full = [o[0], "sumun", ...o.slice(1)], k = cy * 2 + (m === LAST_M ? 1 : 0);
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
const slowShot = () => has("malli") ? .5 : has("gwian") ? .7 : 1;
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
    case "slam": case "club": {
      const zone = { x: e.face > 0 ? ecx : ecx - 150, y: f - 70, w: 150, h: 70 };
      shake = 10; Music.sfx("kill"); addFx("hud", HUD.dust, ecx + e.face * 90, f, 90, { life: .5, ay: 1 });
      if (hurtsPlayer() && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.5 }; die(); }
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
    case "scream": haz.push({ kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos, speed: 300, max: 560 }); if (c >= 2) haz.push({ kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos + bl * .5, speed: 300, max: 560 }); shake = 6; Music.sfx("die"); break;
    case "blink": { const side = Math.random() < .5 ? -1 : 1; e.x = pcx + side * 190 - e.w / 2; e.y = f - 95 - e.h / 2; e.face = -side; addFx("hud", HUD.smoke, e.x + e.w / 2, e.y + e.h / 2, 70, { life: .6 });
      const dx = pcx - (e.x + e.w / 2), dy = pcy - (e.y + e.h / 2), d = Math.hypot(dx, dy) || 1; e.swoopT = .55; e.svx = dx / d * 480; e.svy = dy / d * 480; Music.sfx("dash"); break; }
    case "low": case "high": case "lowhigh": case "highlow": case "hair": Music.sfx("strike"); shake = 5; break;
    case "breath": Music.sfx("snipe"); if (c >= 1) addHaz("fire", e.face > 0 ? e.x + e.w + 150 : e.x - 230, f - 22, 80, 22, songPos + bl, songPos + bl * 3); break;
    case "stomp": shake = 12; Music.sfx("kill"); waves(e, 340 + 30 * c); if (hurtsPlayer() && Math.abs(pcx - ecx) < e.w / 2 + 50 && P.y + P.h > f - 40) { lastHitDir = { x: Math.sign(pcx - ecx) || 1, y: -.6 }; die(); } break;
    case "inhale": { e.suck = false; const zone = { x: e.face > 0 ? ecx : ecx - 110, y: f - 70, w: 110, h: 70 }; Music.sfx("kill"); if (hurtsPlayer() && overlap(zone, P)) { lastHitDir = { x: e.face, y: -.3 }; die(); } break; }
    case "scrap": for (let i = 0; i < 5; i++) lob(e, ecx + e.face * 30, e.y + 10, pcx + (i - 2) * 55, f - 10, .8 + i * .05, { scrap: true }); Music.sfx("shoot"); break;
    case "claw": for (let i = 0; i < 3; i++) { const at = songPos + i * bl * .5; addHaz("claw", e.face > 0 ? ecx + 10 : ecx - 120, f - 64, 110, 64, at, at + .15); } Music.sfx("slash"); break;
    case "roar": shake = 14; Music.sfx("die"); if (Math.abs(pcx - ecx) < 360) { P.vx = Math.sign(pcx - ecx || 1) * 560; P.dashCd = Math.max(P.dashCd, bl * 1.5); } if (c >= 1) haz.push({ kind: "ring", x: ecx, y: e.y + e.h / 2, at: songPos, speed: 320, max: 240 }); break;
    case "fan": case "fan2": { const n = a === "fan2" || e.mask === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) { const ang = Math.atan2(pcy - (e.y + 20), pcx - ecx) + (n > 1 ? (i - .5) * .5 : 0), sp = 430 * slowShot(); bullets.push({ x: ecx + e.face * 16, y: e.y + 20, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: e, friendly: false, life: 3.5, fan: true, boom: .7, t: 0 }); }
      Music.sfx("slash"); break; }
    case "dance": e.danceT = 2 * bl; Music.sfx("dash"); break;
  }
  return false;
}
function stepBoss(e, dt, pcx, pcy, dist, live) {
  const B = BOSSES[e.kind], bl = Music.beatLen, c = cyc(), I = { pcx, pcy, bl, c };
  e.emergeT = Math.max(0, (e.emergeT || 0) - dt); e.stagT = Math.max(0, (e.stagT || 0) - dt); e.swingT = Math.max(0, (e.swingT || 0) - dt); e.walkT = Math.max(0, (e.walkT || 0) - dt); e.invisT = Math.max(0, (e.invisT || 0) - dt);
  if (!e.awake) { if (!(live && dist < 470)) return; e.awake = true; toast(josa(B.name, "이", "가") + " 길을 막는다"); Music.jing(); e.nextAt = (Math.floor(songPos / bl) + 2) * bl; }
  let ecx = e.x + e.w / 2;
  const deadly = () => { if (live && hurtsPlayer() && overlap(e, P)) { lastHitDir = { x: Math.sign(pcx - ecx) || 1, y: -.3 }; die(); } };
  if (e.air) { // leaping: arc under gravity, deadly on contact, shake on landing
    e.vy += 1900 * dt; moveX(e, e.vx * dt);
    if (moveY(e, e.vy * dt) && e.vy > 0) { e.air = false; e.vx = 0; e.vy = 0; shake = 8; addFx("hud", HUD.dust, e.x + e.w / 2, e.y + e.h, 80, { life: .4, ay: 1 });
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
      const ahead = ecx + e.face * (e.w / 2 + 4), sp = (B.speed || 55) * (e.invisT > 0 ? 2 : 1) * (e.mask === 1 ? 1.6 : 1) + 10 * c;
      if (groundPt(ahead, e.y + e.h + 4) && !solidPt(ahead, e.y + e.h - 10)) { moveX(e, e.face * sp * dt); e.walkT = .12; e.wph = (e.wph || 0) + sp * dt / Math.max(22, e.w * .55); }
    }
    if (live && songPos >= e.nextAt && e.stagT <= 0) {
      const pool = B.pool(c); let a = pool[(e.n = (e.n || 0) + 1) % pool.length];
      if ((a === "slam" || a === "club" || a === "inhale") && dist > 280) a = e.kind === "sumun" ? (c >= 1 ? "volley" : "charge") : e.kind === "dokkaebi" ? "coins" : "scrap";
      if (a === "claw" && dist > 200) a = "leap";
      e.act = a; e.hitAt = (Math.floor(songPos / bl) + 1) * bl; if (e.hitAt - songPos < .45) e.hitAt += bl;
      bossChoose(e, a, I);
    }
  } else {
    if (e.suck && live && P.dashT <= 0) P.vx += Math.sign(ecx - pcx) * 1100 * dt;   // 불가사리 breathes in
    if (songPos >= e.hitAt) {
      const a = e.act; e.act = null; e.swingT = .35; e.lastAct = a;
      const gap = Math.max(2, (e.kind === "jangseung" ? 3 : 4) - (c >> 1) - (e.mask === 1 ? 1 : 0));
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
  run.choosing = "cycle"; saveRun();
  state = "result"; Music.stop(); setTimeout(() => showChoice("cycle"), 700);
}
function drumsInPlay() { return mode === "tutorial" || !LV.drums ? [] : LV.drums.filter(d => !(run.cutDrums || []).includes(d.id)); }
function slashHits() {
  if (P.slashT <= 0) return;
  if (!bossAlive()) for (const d of drumsInPlay()) { const cx = P.x + P.w / 2 + P.slashDir.x * 26, cy = P.y + P.h / 2 + P.slashDir.y * 26; if (Math.abs(cx - d.x) < 52 + (d.big ? 20 : 0) && cy > d.y - d.h - 24 && cy < d.y + 10) cutDrum(d); }
  const R = (P.strike ? 54 * (has("gangta") ? 1.5 : 1) : 40) * (has("ssang") ? 1.35 : 1) * (has("seomil") && P.dashT > 0 ? 1.6 : 1) + (has("ilseom") ? 12 : 0), reach = (P.strike ? 30 : 26) + (has("ilseom") ? 14 : 0);
  const cx = P.x + P.w / 2 + P.slashDir.x * reach, cy = P.y + P.h / 2 + P.slashDir.y * reach;
  for (const e of enemies) {
    if (!e.alive || ghostly(e)) continue;
    const ex = Math.max(e.x, Math.min(cx, e.x + e.w)), ey = Math.max(e.y, Math.min(cy, e.y + e.h));
    if (Math.hypot(ex - cx, ey - cy) >= R) continue;
    if (e.type === "h" && !P.strike && !has("cheol") && Math.sign(P.x + P.w / 2 - (e.x + e.w / 2)) === e.face) { if (!P.clanged.has(e.id)) { P.clanged.add(e.id); clang(e); } continue; }   // the shield only covers his front
    if (P.hitSet && P.hitSet.has(e.id)) continue;   // one hit per swing
    if (P.hitSet) P.hitSet.add(e.id);
    if (P.strike) seals.push({ x: e.x + e.w / 2, y: e.y + 6, t: 0, rot: (Math.random() - .5) * 0.4 });
    hurtEnemy(e, P.strike);
  }
  for (const b of bullets) {
    if (b.friendly || b.noReflect || Math.hypot(b.x - cx, b.y - cy) >= R + 8) continue;
    b.friendly = true; b.pierce = P.strike || has("bantan"); b.life = 3; b.g = 0; b.home = 0; b.boom = 0;
    const sp = Math.max(700, Math.hypot(b.vx, b.vy) * (has("bantan") ? 1.6 : 1.1)), o = b.owner;
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
    if (b.home && !b.friendly && state === "play") { const a = Math.atan2(b.vy, b.vx), want = Math.atan2(P.y + P.h / 2 - b.y, P.x + P.w / 2 - b.x), sp = Math.hypot(b.vx, b.vy); let d = want - a; d = Math.atan2(Math.sin(d), Math.cos(d)); const na = a + Math.max(-b.home * dt, Math.min(b.home * dt, d)); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
    if (b.boom && !b.friendly && b.t > b.boom && b.owner && b.owner.alive) { // the fan curves back to the dancer's hand
      const o = b.owner, dx = o.x + o.w / 2 - b.x, dy = o.y + 20 - b.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(b.vx, b.vy);
      b.vx += (dx / d * sp - b.vx) * Math.min(1, dt * 4); b.vy += (dy / d * sp - b.vy) * Math.min(1, dt * 4); if (d < 24) b.life = 0;
    }
    const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 8);
    for (let i = 0; i < n && b.life > 0; i++) {
      b.x += b.vx * dt / n; b.y += b.vy * dt / n;
      if (solidPt(b.x, b.y) && !(b.fan && !b.friendly)) { b.life = 0; addFx("hud", HUD.spark, b.x, b.y, 22, { life: .25, rot: Math.random() * 6.28 }); break; }
      if (b.friendly) {
        for (const e of enemies) if (e.alive && !ghostly(e) && b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          if (b.hits && b.hits.has(e.id)) continue;
          if (e.type === "h" && Math.sign(b.vx) === -e.face && !b.pierce) { b.life = 0; Music.sfx("clang"); break; }
          (b.hits = b.hits || new Set()).add(e.id); hurtEnemy(e, b.pierce && (!b.wind || b.strike)); if (!b.pierce) b.life = 0;
        }
      } else if (state === "play" && P.dashT <= 0 && !(has("jangmak") && P.focus) && !((P.invT || 0) > 0) && b.x > pr.x - 3 && b.x < pr.x + pr.w + 3 && b.y > pr.y - 3 && b.y < pr.y + pr.h + 3) {
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
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === "play" || state === "dead") {
    songPos = Music.pos();
    if (state === "play") frameInput(rdt);
    let ts = 1;
    if (hitstop > 0) { hitstop -= rdt; ts = 0.06; } else if (state === "play" && P.focus) ts = has("jeong") ? 0.07 : 0.12;
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
  parts = parts.filter(p => p.life > 0);
  for (const g of ghosts) g.age += rdt; ghosts = ghosts.filter(g => g.age < g.life);
  for (const s of seals) s.t += rdt; seals = seals.filter(s => s.t < 0.7);
  for (const v of vfx) v.t += rdt; vfx = vfx.filter(v => v.t < v.life);
  shake = Math.max(0, shake - rdt * 40); flash = Math.max(0, flash - rdt);
  if (toastT > 0) { toastT -= rdt; if (toastT <= 0) $("toast").classList.remove("on"); }
  const inv = !!(P && P.focus && state === "play");
  Music.setRate(inv ? .45 : 1);
  if (inv !== cvInverted) { cvInverted = inv; document.body.classList.toggle("night", inv); }
  render(rdt);
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); }
function setHud() {
  document.body.classList.toggle("night", !!(LV && LV.pal.night));
  if (mode === "tutorial") { $("hMadang").textContent = "수련터"; $("hJang").textContent = Music.JANGDAN[TUTORIAL.jd].name; }
  else { const om = OMENS.find(o => o.id === run.omen); $("hMadang").textContent = ORD[run.m] + " 마당"; $("hJang").textContent = Music.JANGDAN[MADANG[MD(run.m)].jd].name + (om ? " · " + om.name : ""); }
  const hb = $("hBreath"); hb.innerHTML = ""; hb.classList.toggle("inf", mode === "tutorial");
  if (mode !== "tutorial") for (let i = 0; i < Math.max(3, run.breath); i++) { const d = document.createElement("i"); if (i >= run.breath) d.className = "lost"; hb.appendChild(d); }
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
  const pal = !LV ? PAL[0] : (P && P.focus && state === "play") ? NIGHT : LV.pal, k = SCALE * DPR, vw = W / SCALE, vh = H / SCALE;
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
  const ssn = season(), tt = performance.now() / 1000;
  if (ssn && !pal.night) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = SEASON_TINT[ssn]; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = "source-over"; }
  drawWeather(ssn, tt, pal);

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
    const pf = SPR.pillars.f, colW = 70, img = pal.night ? SPR.pillars.inv : SPR.pillars.img;
    ctx.save(); ctx.clip(rock); ctx.filter = "brightness(.8) contrast(1.15)"; if (pal.night) ctx.globalAlpha = .45;
    const cx0 = Math.floor((cam.x - vw / 2) / colW) - 1, cx1 = Math.ceil((cam.x + vw / 2) / colW) + 1;
    for (let c = cx0; c <= cx1; c++) {
      const hsh = (c * 2654435761) >>> 0, i = hsh % 3, f = pf[i], w = colW * 1.35, segH = w * f.h / f.w, off = (hsh >>> 8) % 97;
      const rowH = segH - 10; // one spacing for both the start row and the step, so rows stay put as the camera moves
      for (let y = Math.floor((cam.y - vh / 2 - off) / rowH) * rowH + off - rowH; y < cam.y + vh / 2 + segH; y += rowH) {
        ctx.save(); ctx.translate(c * colW + colW / 2, y); if ((hsh >>> 3) & 1) ctx.scale(-1, 1); ctx.drawImage(img, f.x, f.y, f.w, f.h, -w / 2, 0, w, segH); ctx.restore();
      }
    }
    ctx.restore(); ctx.filter = "none"; ctx.globalAlpha = 1;
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
    if (on && P && !P.hook) { ctx.strokeStyle = JJOK; ctx.globalAlpha = .45; ctx.lineWidth = 1.4; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(P.x + P.w / 2, P.y + 10); ctx.lineTo(p.x + sw, p.y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }   // what jump or 연 will catch
  }
  if (P && P.hook) { ctx.strokeStyle = pal.fig; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(P.x + P.w / 2, P.y + 12); ctx.lineTo(P.hook.x, P.hook.y); ctx.stroke(); }

  drawHazards(pal);
  for (const e of enemies) if (e.alive && (visible(e.x) || e.type === "b")) {
    if (e.hitT > 0 && Math.floor(e.hitT * 30) % 2) ctx.globalAlpha = .45;   // hit flicker
    drawEnemy(e, pal); ctx.globalAlpha = 1;
    if (e.ward) { // 무당's talisman hovering over the warded soldier
      const wy = e.type === "d" ? e.y - 22 : e.y - 46, bob = Math.sin(tt * 3 + e.id) * 2;
      if (!drawSprite("foes2", F2.ward, e.x + e.w / 2, wy + bob, 24 / (SPR.foes2 ? SPR.foes2.f[F2.ward].h : 1), false, .5, false, .5)) { ctx.strokeStyle = JJOK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 26, 0, 7); ctx.stroke(); }
    }
    if (e.maxHp > 1 && e.type !== "b") { // remaining hits as small ink drops over the head
      const top = e.type === "d" ? e.y - 10 : e.y - 34, cx = e.x + e.w / 2;
      for (let i = 0; i < e.maxHp; i++) { ctx.fillStyle = i < e.hp ? SEAL : "rgba(80,74,70,.35)"; ctx.beginPath(); ctx.arc(cx + (i - (e.maxHp - 1) / 2) * 7, top, 2.6, 0, 7); ctx.fill(); }
    }
  }
  for (const b of bullets) {
    const bs = b.fan ? FXB.fan : b.water ? FXB.water : b.scrap ? FXB.scrap : null;
    if (bs != null && SPR.bossfx && !b.friendly) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.fan ? b.t * 18 : b.scrap ? b.t * 9 : 0); drawSprite("bossfx", bs, 0, 0, (b.fan ? 30 : b.water ? 20 : 22) / SPR.bossfx.f[bs].h, false, .5, false, .5); ctx.restore(); continue; }
    if (b.orb && !b.friendly && SPR.bossB) { drawSprite("bossB", F3.orb, b.x, b.y, 24 / SPR.bossB.f[F3.orb].h, false, .5, false, .5); continue; }
    if (b.wave) { // the ground wave: a running crest of black ink with a red lip
      const d = Math.sign(b.vx), wob = Math.sin(tt * 30 + b.x * .05) * 2;
      ctx.fillStyle = pal.night ? "#d8d1c4" : "#17161a"; ctx.beginPath(); ctx.moveTo(b.x - d * 34, b.y + 12); ctx.quadraticCurveTo(b.x - d * 10, b.y - 20 + wob, b.x + d * 8, b.y - 14 + wob); ctx.quadraticCurveTo(b.x + d * 2, b.y, b.x + d * 12, b.y + 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = SEAL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x - d * 6, b.y - 16 + wob); ctx.quadraticCurveTo(b.x + d * 6, b.y - 16 + wob, b.x + d * 8, b.y - 6); ctx.stroke();
      continue;
    }
    const sp = Math.hypot(b.vx, b.vy), tl = b.sniper ? 34 : 18;
    const tr = ctx.createLinearGradient(b.x, b.y, b.x - b.vx / sp * tl, b.y - b.vy / sp * tl);
    tr.addColorStop(0, b.friendly ? "rgba(39,70,106,.8)" : "rgba(195,22,28,.75)"); tr.addColorStop(1, "rgba(140,134,126,0)");
    ctx.strokeStyle = tr; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / sp * tl, b.y - b.vy / sp * tl); ctx.stroke();
    ctx.fillStyle = pal.night ? "#d8d1c4" : "#141317"; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.friendly ? JJOK_L : "#ff6a3d"; ctx.beginPath(); ctx.arc(b.x, b.y, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = "butt";
  for (const g of ghosts) { ctx.globalAlpha = .3 * (1 - g.age / g.life); if (!(SPR.hero3 ? drawSprite("hero3", H3.dash, g.x + 9, g.y + 31, kOf("hero3", H3.idle, HERO_H * 1.08), g.face < 0, H3_AX[H3.dash], !!LV.pal.night) : drawSprite("hero", HERO.dash, g.x + 9, g.y + 31, kOf("hero", 0, HERO_H), g.face < 0, .55, !!LV.pal.night))) drawRunner(g.x, g.y, g.face, JJOK, null); }
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
  if (omen("angae") && P) { // 안개: only a pocket of paper around the swordsman stays clear
    const px = (P.x + P.w / 2 - cam.x) * SCALE * DPR + cv.width / 2, py = (P.y + P.h / 2 - cam.y) * SCALE * DPR + cv.height / 2, r = 120 * SCALE * DPR;
    const fg = ctx.createRadialGradient(px, py, r * .8, px, py, r * 2.6); fg.addColorStop(0, "rgba(226,222,212,0)"); fg.addColorStop(1, pal.night ? "rgba(30,28,30,.9)" : "rgba(226,222,212,.9)");
    ctx.fillStyle = fg; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, cv.width, cv.height);
  const boss = enemies.find(e => e.type === "b" && e.alive && e.awake);
  if (boss && (state === "play" || state === "dead" || state === "pause")) { // 수문장's life as a brush bar along the top
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const bw = Math.min(320, W * .44), bx = W / 2 - bw / 2, by = 46;
    ctx.fillStyle = "rgba(23,22,26,.25)"; ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = SEAL; ctx.fillRect(bx, by, bw * Math.max(0, boss.hp) / boss.maxHp, 7);
    ctx.fillStyle = pal.text; ctx.font = `400 14px "Song Myung", serif`; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(`${BOSSES[boss.kind].name} ${BOSSES[boss.kind].han}`, W / 2, by - 3); ctx.textAlign = "left";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (P && P.focus && state === "play") { ctx.fillStyle = "rgba(39,70,106,.14)"; ctx.fillRect(0, 0, cv.width, cv.height); }
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
  if (bf) { // lacquered board: end caps keep their proportions, only the plain middle stretches
    const bw = gap * ahead + 104, bh = 62, cap = bf.w * .16, capW = cap * bh / bf.h, bx = mx - 52, im = SPR.props2.img;
    ctx.drawImage(im, bf.x, bf.y, cap, bf.h, bx, y - 30, capW, bh);
    ctx.drawImage(im, bf.x + cap, bf.y, bf.w - cap * 2, bf.h, bx + capW - .5, y - 30, bw - capW * 2 + 1, bh);
    ctx.drawImage(im, bf.x + bf.w - cap, bf.y, cap, bf.h, bx + bw - capW, y - 30, capW, bh);
  }
  else uiPatch(5, mx - 46, y - 30, gap * ahead + 92, 60, pal.night ? .5 : .9);
  const near = Math.abs(Music.offBeat(pos)) < strikeWin();
  uiPatch(0, mx - 25, y - 25, 50, 50, near && !omen("goyo") ? 1 : .55);                      // judgement ring
  if (omen("goyo")) return;   // 고요: the drums are heard, not seen
  const k0 = Math.floor(pos / bl) - 1;
  for (let k = k0 + ahead + 1; k >= k0; k--) {
    const dt = k * bl - pos, x = mx + dt / bl * gap;
    if (x < mx - 40 || x > mx + gap * ahead + 30) continue;
    const strong = ((k % def.beats) + def.beats) % def.beats === 0, hit = Math.abs(dt) < strikeWin(), past = dt < -strikeWin();
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
  if (SPR.hero3) {
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
  const k = sheet === "hero3" ? kOf("hero3", H3.idle, HERO_H * 1.08) : sheet === "hero" ? kOf("hero", 0, HERO_H) : kOf("hero", 0, HERO_H) * SPR.hero.f[1].h / SPR.hero2.f[H2.start].h;
  if (state === "dead") ctx.globalAlpha = Math.max(0, 1 - deathT / 0.75);
  else if (P.invT > 0) ctx.globalAlpha = Math.floor(P.invT * 14) % 2 ? .35 : 1;
  if (pal.night && !LV.pal.night) { // slow-mo: hero keeps his ink, lifted off the dark paper by a pale wash
    const g = ctx.createRadialGradient(cx, P.y + P.h / 2, 4, cx, P.y + P.h / 2, 46); g.addColorStop(0, "rgba(236,230,216,.55)"); g.addColorStop(1, "rgba(236,230,216,0)");
    ctx.fillStyle = g; ctx.fillRect(cx - 46, P.y + P.h / 2 - 46, 92, 92);
  }
  const h3wall = sheet === "hero3" && fr === H3.wall, f3 = h3wall ? P.wall : face, breathe = sheet === "hero3" && fr === H3.idle ? 1 + Math.sin(performance.now() / 380) * .012 : 1;
  ctx.save(); ctx.translate(cx, P.y + P.h + 1); ctx.scale(1, breathe);
  drawSprite(sheet, fr, 0, 0, k, f3 < 0, sheet === "hero3" ? H3_AX[fr] : sheet === "hero" ? (HERO_AX[fr] ?? .55) : (wallPose ? .62 : .5), !!LV.pal.night);
  ctx.restore();
  ctx.globalAlpha = 1;
  if (P.slashT > 0 && state !== "dead" && SPR.fx && !(sheet === "hero3" && !P.strike && fr !== H3.down)) { // two painted frames: the edge, then the full stroke breaking into ink
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
  if ("mrbi".includes(e.type)) { drawNewFoe(e, pal, cx); return; }
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
function drawBoss(e, pal, cx, feet) {
  const B = BOSSES[e.kind];
  if (e.hidden) { // underground: only a heaving ripple of earth
    const x = e.tx || cx, w = 40 + Math.sin(performance.now() / 80) * 6; ctx.fillStyle = "rgba(40,34,30,.55)"; ctx.beginPath(); ctx.ellipse(x, e.floor - 2, w, 7, 0, 0, 7); ctx.fill(); return;
  }
  if (e.act && songPos < e.hitAt) { // telegraph what is coming
    const prog = Math.max(0, Math.min(1, 1 - (e.hitAt - songPos) / Music.beatLen)), a = .1 + prog * .3, f = e.floor;
    if (e.act === "slam" || e.act === "club" || e.act === "inhale") { ctx.fillStyle = `rgba(195,22,28,${a})`; const w = e.act === "inhale" ? 110 : 150; ctx.fillRect(e.face > 0 ? cx : cx - w, f - 70, w, 70); }
    else if (e.act === "stomp") { ctx.fillStyle = `rgba(195,22,28,${a})`; ctx.fillRect(e.x - 50, f - 40, e.w + 100, 40); }
    else if (["charge", "pounce", "leap", "dance"].includes(e.act)) { ctx.strokeStyle = `rgba(195,22,28,${a + .2})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, f - 20); ctx.lineTo(cx + e.face * 220, f - 20); ctx.stroke(); }
    else if (["volley", "fan", "fan2", "spit", "scrap", "foxfire"].includes(e.act)) { ctx.fillStyle = `rgba(195,22,28,${a + .3})`; ctx.beginPath(); ctx.arc(cx + e.face * 26, e.y + 22, 6 + prog * 8, 0, 7); ctx.fill(); }
    else if (["summon", "spirits", "illusion", "mask", "gamtu", "roar", "scream", "blink"].includes(e.act)) { ctx.strokeStyle = `rgba(39,70,106,${a + .2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, e.y + e.h / 2, 30 + prog * 40, 0, 7); ctx.stroke(); }
  }
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
      const r = (songPos - z.at) * z.speed; if (r < 0) { ctx.strokeStyle = "rgba(39,70,106,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, 20, 0, 7); ctx.stroke(); continue; }
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
      ctx.fillStyle = `rgba(195,22,28,${.06 + prog * .22})`; ctx.fillRect(z.x, z.y, z.w, z.h);
      if (z.kind === "beam") { ctx.fillStyle = `rgba(195,22,28,${.3 + prog * .4})`; ctx.fillRect(z.x, z.y, z.w, 2); ctx.fillRect(z.x, z.y + z.h - 2, z.w, 2); }
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
// ---------- screens ----------
function showScreen(id) {
  for (const s of ["menu", "settings", "interlude", "pause", "result", "choice"]) $(s).hidden = s !== id;
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
  $("dailyInfo").textContent = `${dt.getMonth() + 1}월 ${dt.getDate()}일` + (d ? ` · ${d.reached}마당 ${fmt(d.time)}` : "");
}
function toMenu() {
  Music.menuBgm(true);
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
  if (run.perks && run.perks.length) rows.push(["비급", run.perks.map(id => CHOSIK.find(c => c.id === id).name).join(" · ")]);
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
$("bGiveUp").addEventListener("click", () => { state = "play"; endRun(false); $("rSub").textContent = ORD[run.m] + " 마당에서 판을 내려놓았다."; });
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


if (location.hash === "#debug") window.__dbg = { tp(tx, ty) { P.x = tx * T + 7; P.y = (ty + 1) * T - 30; P.vx = P.vy = 0; }, get state() { return state; }, get P() { return P; }, get LV() { return LV; }, get state2() { return state; }, get SC() { return LV.scenery; }, get E() { return enemies; }, get run() { return run; } };
window.addEventListener("pointerdown", () => Music.unlock(), { once: true, capture: true });   // first tap anywhere starts the sound
resize();
toMenu();
P = null; cam.x = 600; cam.y = 300;
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
})();
