// 천고 장단 엔진: synthesised 장구/북/징 and a 대금-like line, scheduled ahead on the
// AudioContext clock so that gameplay (금줄, enemy fire, 일격 judging) can share the same beat grid.
// Patterns are simplified versions of the named 장단, tuned for play rather than strict tradition.
"use strict";

// strokes: D 덩 (both), K 쿵 (북편), T 덕 (채편), G 기덕 (grace + 덕), 0 rest
const JANGDAN = {
  // every 박 (beat) carries a stroke so the pulse is always audible; tempos are kept playable
  jinyang:   { name: "진양조",   bpm: 66,  beats: 6,  sub: 3, pat: "D00K00T00K0TK00T00" },
  jungmori:  { name: "중모리",   bpm: 84,  beats: 12, sub: 1, pat: "DKTKTTDKTKTT" },
  jajinmori: { name: "자진모리", bpm: 96,  beats: 4,  sub: 3, pat: "D00T0TK0TK0T" },
  hwimori:   { name: "휘모리",   bpm: 108, beats: 4,  sub: 2, pat: "D0TTK0T0" },
  danmori:   { name: "단모리",   bpm: 120, beats: 4,  sub: 2, pat: "DTKTDGKT" }
};
// 계면조 on A: 라 도 레 미 솔 라' 도' 레' (Hz). 미 is shaken (떠는 음), 도 is bent down from 레 (꺾는 음),
// phrases end on 라 with a falling tail (퇴성).
const GYE = [220.0, 261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3];

const Music = (() => {
  let ac = null, out = null, master = null, filt = null, noiseBuf = null;
  let def = null, t0 = 0, nextIdx = 0, rate = 1, basePos = 0, baseTime = 0, timer = null, running = false, rng = Math.random;
  let fallbackStart = 0, fallbackPausedAt = 0;
  let volume = 1, offsetMs = 0;
  // background music: 「국악 효과음 #151」 © 주식회사 아이티앤, CC BY (공유마당). Loaded once, looped with a crossfaded seam.
  let bgmBuf = null, bgmSrc = null, bgmGain = null, bgmLoading = false;
  function loadBgm() {
    if (bgmBuf || bgmLoading || !ac) return; bgmLoading = true;
    fetch("assets/audio/bgm.mp3").then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => ac.decodeAudioData(b, res, rej))).then(raw => {
      // drop the trailing silence and blend the tail into the head so the loop has no gap or click
      // only the first two phrases (2.9 s, phrase every ~1.45 s) are looped; the rest drags.
      // A 20 ms blend at the seam avoids a click.
      const sr = raw.sampleRate, len = Math.min(raw.length, Math.round(2.9 * sr)), xf = Math.round(.02 * sr), buf = ac.createBuffer(raw.numberOfChannels, len, sr);
      for (let c = 0; c < raw.numberOfChannels; c++) {
        const a = raw.getChannelData(c), o = buf.getChannelData(c);
        for (let i = 0; i < len; i++) o[i] = i < xf ? a[i] * (i / xf) + (a[len + i] || 0) * (1 - i / xf) : a[i];   // last phrase's ring blends into the restart
      }
      bgmBuf = buf; if (running || wantBgm) playBgm();
    }).catch(() => { useTag = true; if (running || wantBgm) playBgm(); }).finally(() => { bgmLoading = false; });
  }
  let useTag = false, tag = null, wantBgm = false;   // <audio> fallback when Web Audio can't decode the file
  function playBgm() {
    if (useTag) { if (!tag) { tag = new Audio("assets/audio/bgm.mp3"); tag.loop = true; tag.addEventListener("timeupdate", () => { if (tag.currentTime > 2.9) tag.currentTime -= 2.9; }); tag.volume = .6 * volume; tag.preservesPitch = false; tag.webkitPreservesPitch = false; } tag.playbackRate = rate; tag.play().catch(() => {}); return; }
    if (!ac || !bgmBuf || bgmSrc) return;
    bgmGain = ac.createGain(); bgmGain.gain.value = .6; bgmGain.connect(master);
    bgmSrc = ac.createBufferSource(); bgmSrc.buffer = bgmBuf; bgmSrc.loop = true; bgmSrc.playbackRate.value = rate;
    bgmSrc.connect(bgmGain); bgmSrc.start(ac.currentTime + .05);
  }
  function stopBgm() { if (tag) tag.pause(); if (bgmSrc) { try { bgmSrc.stop(); } catch (e) {} bgmSrc.disconnect(); bgmSrc = null; } }

  function ensure() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" }); } catch (e) { ac = null; }
      if (ac) {
        out = ac.createGain(); out.gain.value = volume;
        filt = ac.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 18000; filt.Q.value = 0.4;
        master = ac.createGain(); master.gain.value = 0.9;
        master.connect(filt).connect(out).connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
    }
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  }
  const now = () => (ac ? ac.currentTime : performance.now() / 1000);
  const latency = () => (ac ? (ac.outputLatency || ac.baseLatency || 0) : 0) + offsetMs / 1000;

  // ---- instruments ----
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function noise(t, dur, freq, type, peak, q) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    env(g, t, 0.002, peak, dur); s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function osc(t, type, f0, f1, dur, peak, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.003, peak, dur); o.connect(g).connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  const kung = (t, v) => { osc(t, "sine", 96, 58, 0.5, 0.6 * v); osc(t, "sine", 190, 120, 0.12, 0.12 * v); noise(t, 0.05, 240, "lowpass", 0.22 * v); };   // 북편: leather, palm
  const deok = (t, v) => { osc(t, "triangle", 430, 300, 0.09, 0.2 * v); osc(t, "sine", 860, 640, 0.05, 0.06 * v); noise(t, 0.025, 1800, "bandpass", 0.25 * v, 1.4); };   // 채편: bamboo stick on tight skin
  function stroke(ch, t, strong, gain = 1) {
    const v = (strong ? 1 : 0.8) * gain;
    if (ch === "D") { kung(t, v); deok(t, v); }
    else if (ch === "K") kung(t, v);
    else if (ch === "T") deok(t, v);
    else if (ch === "G") { deok(t - 0.045, 0.45); deok(t, v); }
  }
  function drone(t, freq, dur) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.value = freq / 2; f.type = "lowpass"; f.frequency.value = 340; // 아쟁-like low bow
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.5); g.gain.setValueAtTime(0.03, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function jing(t) { // 징: a few inharmonic partials with a slow swell
    if (!ac) return;
    for (const [m, a] of [[1, 0.18], [1.48, 0.06], [2.03, 0.05], [2.74, 0.03]]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(196 * m, t); o.frequency.linearRampToValueAtTime(190 * m, t + 3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(g).connect(master); o.start(t); o.stop(t + 3.3);
    }
  }
  function gayageum(t, f, dur, vol) { // plucked silk string: bright attack, quick dark decay, a little 농현 bend
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(f * 1.01, t); o.frequency.exponentialRampToValueAtTime(f, t + .04); o.frequency.setValueAtTime(f, t + dur * .5); o.frequency.linearRampToValueAtTime(f * .97, t + dur);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(f * 8, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur * .6);
    env(g, t, .002, vol, dur); o.connect(lp).connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function kkwaeng(t, v, muted) { // 꽹과리: clustered metallic partials
    const d = muted ? .06 : .35;
    for (const [m, a] of [[1, .05], [1.47, .035], [2.09, .03], [2.76, .02]]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = "square"; o.frequency.value = 1180 * m; env(g, t, .001, a * v, d); o.connect(g).connect(master); o.start(t); o.stop(t + d + .05); }
    noise(t, d * .6, 6000, "bandpass", .12 * v, 1.5);
  }
  function daegeum(t, f0, f1, dur) { // 대금 swoop
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(); o.type = "triangle";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); lp.type = "lowpass"; lp.frequency.value = 2000;
    env(g, t, .03, .08, dur); o.connect(lp).connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function bak(t) { noise(t, 0.04, 3400, "bandpass", 0.6, 2); noise(t + 0.012, 0.05, 1900, "bandpass", 0.4, 2); } // 박: wooden clapper

  // ---- scheduler ----
  const subLen = () => 60 / def.bpm / def.sub;
  // song position (s) <-> audio clock; rate < 1 slows the whole 장단 during slow-mo aim
  const audioAt = sp => baseTime + (sp - basePos) / rate;
  const songAt = at => basePos + (at - baseTime) * rate;
  function tick() {
    if (!running || !ac) return;
    const horizon = ac.currentTime + 0.12, sl = subLen(), len = def.pat.length;
    while (audioAt(nextIdx * sl) < horizon) {
      const t = audioAt(nextIdx * sl), i = nextIdx % len, ch = def.pat[i];
      if (ch !== "0") stroke(ch, t, i === 0, .7);   // 장구 keeps the beat the game is judged on; the recording carries the music
      nextIdx++;
    }
  }

  return {
    JANGDAN,
    unlock() { const a = ensure(); loadBgm(); return a; },
    menuBgm(on) { wantBgm = on; if (on) { ensure(); loadBgm(); playBgm(); } else if (!running) stopBgm(); },
    start(key, seed, speed = 1) {
      ensure(); this.stop();
      const base = JANGDAN[key] || JANGDAN.jungmori; def = Object.assign({}, base, { bpm: Math.round(base.bpm * speed) });
      let s = (seed >>> 0) || 1; rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      nextIdx = 0; running = true; rate = 1; loadBgm(); playBgm();
      if (bgmSrc) bgmSrc.playbackRate.value = 1; if (tag) tag.playbackRate = 1;
      if (ac) { t0 = ac.currentTime + 0.25; baseTime = t0; basePos = 0; timer = setInterval(tick, 25); tick(); }
      else { fallbackStart = performance.now() / 1000 + 0.25; }
    },
    stop() { running = false; if (timer) clearInterval(timer); timer = null; if (!wantBgm) stopBgm(); },
    pause() { if (ac) ac.suspend().catch(() => {}); else fallbackPausedAt = performance.now() / 1000; },
    resume() { if (ac) ac.resume().catch(() => {}); else if (fallbackPausedAt) { fallbackStart += performance.now() / 1000 - fallbackPausedAt; fallbackPausedAt = 0; } },
    get def() { return def; },
    get bgmState() { return { loaded: !!bgmBuf, playing: !!bgmSrc, ctx: ac && ac.state }; },
    get beatLen() { return def ? 60 / def.bpm : 0.6; },
    // song position as the player hears it (seconds since the first beat)
    pos() {
      if (!def) return 0;
      if (ac) return songAt(ac.currentTime - latency());
      return performance.now() / 1000 - fallbackStart;
    },
    // song position of an input event (event.timeStamp, performance clock)
    posAt(perfTs) { return this.pos() + (perfTs - performance.now()) / 1000; },
    beatTime(k) { return k * this.beatLen; },
    // signed distance (s) from position p to its nearest beat
    offBeat(p) { const b = this.beatLen; return p - Math.round(p / b) * b; },
    setRate(r) { // rebase so the song position stays continuous
      if (!ac || !def || r === rate) return;
      const now = ac.currentTime; basePos = songAt(now); baseTime = now; rate = r;
      if (bgmSrc) bgmSrc.playbackRate.setTargetAtTime(r, now, .05); if (tag) tag.playbackRate = r;   // the recording slows (and drops in pitch) with the 장단
      const sl = subLen(); nextIdx = Math.max(nextIdx, Math.ceil(basePos / sl)); // drop nothing already scheduled
    },
    muffle(on) { if (filt) filt.frequency.setTargetAtTime(on ? 700 : 18000, ac.currentTime, 0.05); },
    setVolume(v) { volume = v; if (tag) tag.volume = .6 * v; if (out) out.gain.setTargetAtTime(v, ac.currentTime, 0.02); },
    setOffset(ms) { offsetMs = ms; },
    jing() { if (ensure()) jing(ac.currentTime + 0.02); },
    bak() { if (ensure()) bak(ac.currentTime + 0.01); },
    sfx(kind) {
      if (!ac || !volume) return;
      const t = ac.currentTime + 0.005;
      switch (kind) {
        case "slash": noise(t, 0.07, 5200, "highpass", 0.2); kkwaeng(t, .25, 1); break;              // swish + muted 꽹과리 tick
        case "strike": kkwaeng(t, .9, 0); deok(t, 1.2); break;                                       // open 꽹과리 + 채편: 일격
        case "kill": kung(t, 1.1); gayageum(t + .02, 98, .5, .14); break;                           // 북 + low 가야금 string
        case "clang": kkwaeng(t, .6, 1); kkwaeng(t + .04, .35, 1); break;
        case "dash": daegeum(t, 520, 300, .22); noise(t, 0.14, 2600, "bandpass", 0.12, 0.6); break;  // breathy 대금 swoop
        case "jump": { const s2 = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s2.buffer = noiseBuf; f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2600, t + .14); env(g, t, .02, .16, .14); s2.connect(f).connect(g).connect(master); s2.start(t, Math.random() * .5); s2.stop(t + .2); break; }   // coat swish, nothing drum-like
        case "hook": gayageum(t, 440, .35, .08); gayageum(t + .07, 659, .35, .07); break;
        case "shoot": noise(t, 0.12, 900, "lowpass", 0.35); noise(t, 0.05, 3000, "bandpass", 0.2); break;   // 화승총 crack
        case "snipe": noise(t, 0.2, 700, "lowpass", 0.45); noise(t, 0.06, 4000, "bandpass", 0.25); break;
        case "reflect": kkwaeng(t, .5, 1); gayageum(t, 880, .2, .06); break;
        case "die": jing(t); kung(t, 1.3); break;                                                   // 징
        case "lantern": [330, 392, 494].forEach((f, i) => gayageum(t + i * .07, f, .5, .07)); break;  // 가야금 arpeggio
        case "seal": bak(t); setTimeout(() => this.bak(), 260); break;
      }
    }
  };
})();
