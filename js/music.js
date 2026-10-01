// 천고 장단 엔진: synthesised 장구/북/징 and a 대금-like line, scheduled ahead on the
// AudioContext clock so that gameplay (금줄, enemy fire, 일격 judging) can share the same beat grid.
// Patterns are simplified versions of the named 장단, tuned for play rather than strict tradition.
"use strict";

// strokes: D 덩 (both), K 쿵 (북편), T 덕 (채편), G 기덕 (grace + 덕), 0 rest
const JANGDAN = {
  jinyang:   { name: "진양조",   bpm: 66,  beats: 6,  sub: 3, pat: "D00000000000K0TT00" },
  jungmori:  { name: "중모리",   bpm: 88,  beats: 12, sub: 1, pat: "D0TKT0K0TT00" },
  jajinmori: { name: "자진모리", bpm: 104, beats: 4,  sub: 3, pat: "D00T0TK0T0T0" },
  hwimori:   { name: "휘모리",   bpm: 126, beats: 4,  sub: 2, pat: "D0TTK0T0" },
  danmori:   { name: "단모리",   bpm: 146, beats: 4,  sub: 2, pat: "DTKTDGKT" }
};
// 계면조-ish pentatonic (Hz): mi la si re' mi' la'
const SCALE = [164.8, 220.0, 246.9, 293.7, 329.6, 440.0];

const Music = (() => {
  let ac = null, out = null, master = null, filt = null, noiseBuf = null;
  let def = null, t0 = 0, nextIdx = 0, timer = null, running = false, rng = Math.random;
  let fallbackStart = 0, fallbackPausedAt = 0;
  let volume = 1, offsetMs = 0;

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
  const kung = (t, v) => { osc(t, "sine", 120, 52, 0.42, 0.55 * v); noise(t, 0.08, 180, "lowpass", 0.25 * v); };
  const deok = (t, v) => { noise(t, 0.05, 2600, "bandpass", 0.32 * v, 1.2); osc(t, "triangle", 760, 520, 0.04, 0.08 * v); };
  function stroke(ch, t, strong) {
    const v = strong ? 1 : 0.8;
    if (ch === "D") { kung(t, v); deok(t, v); }
    else if (ch === "K") kung(t, v);
    else if (ch === "T") deok(t, v);
    else if (ch === "G") { deok(t - 0.045, 0.45); deok(t, v); }
  }
  function flute(t, freq, dur) {
    const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "triangle"; o.frequency.setValueAtTime(freq * 0.985, t); o.frequency.linearRampToValueAtTime(freq, t + 0.08);
    o.frequency.setValueAtTime(freq, t + dur * 0.7); o.frequency.linearRampToValueAtTime(freq * 0.94, t + dur); // 꺾는 끝음
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(freq * 0.018, t + dur * 0.6); // 농음
    lfo.connect(lg).connect(o.frequency);
    f.type = "lowpass"; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.06); g.gain.setValueAtTime(0.07, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    noise(t, 0.12, 1400, "bandpass", 0.02, 0.5); // breath
  }
  function drone(t, freq, dur) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.value = freq / 2; f.type = "lowpass"; f.frequency.value = 260;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.3); g.gain.setValueAtTime(0.05, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
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
  function bak(t) { noise(t, 0.04, 3400, "bandpass", 0.6, 2); noise(t + 0.012, 0.05, 1900, "bandpass", 0.4, 2); } // 박: wooden clapper

  // ---- scheduler ----
  const subLen = () => 60 / def.bpm / def.sub;
  function tick() {
    if (!running || !ac) return;
    const horizon = ac.currentTime + 0.15, sl = subLen(), len = def.pat.length;
    while (t0 + nextIdx * sl < horizon) {
      const t = t0 + nextIdx * sl, i = nextIdx % len, ch = def.pat[i];
      if (ch !== "0") stroke(ch, t, i === 0);
      if (i % def.sub === 0) {
        const beat = (nextIdx / def.sub) | 0, bl = sl * def.sub;
        if (beat % def.beats === 0) drone(t, SCALE[[0, 1, 0, 3][(beat / def.beats | 0) % 4]], bl * def.beats);
        if (rng() < 0.42) flute(t, SCALE[1 + ((rng() * 5) | 0)], bl * (rng() < 0.5 ? 1 : 2) * 0.95);
      }
      nextIdx++;
    }
  }

  return {
    JANGDAN,
    unlock() { return ensure(); },
    start(key, seed) {
      ensure(); this.stop();
      def = JANGDAN[key] || JANGDAN.jungmori;
      let s = (seed >>> 0) || 1; rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      nextIdx = 0; running = true;
      if (ac) { t0 = ac.currentTime + 0.25; timer = setInterval(tick, 25); tick(); }
      else { fallbackStart = performance.now() / 1000 + 0.25; }
    },
    stop() { running = false; if (timer) clearInterval(timer); timer = null; },
    pause() { if (ac) ac.suspend().catch(() => {}); else fallbackPausedAt = performance.now() / 1000; },
    resume() { if (ac) ac.resume().catch(() => {}); else if (fallbackPausedAt) { fallbackStart += performance.now() / 1000 - fallbackPausedAt; fallbackPausedAt = 0; } },
    get def() { return def; },
    get beatLen() { return def ? 60 / def.bpm : 0.6; },
    // song position as the player hears it (seconds since the first beat)
    pos() {
      if (!def) return 0;
      if (ac) return ac.currentTime - t0 - latency();
      return performance.now() / 1000 - fallbackStart;
    },
    // song position of an input event (event.timeStamp, performance clock)
    posAt(perfTs) { return this.pos() + (perfTs - performance.now()) / 1000; },
    beatTime(k) { return k * this.beatLen; },
    // signed distance (s) from position p to its nearest beat
    offBeat(p) { const b = this.beatLen; return p - Math.round(p / b) * b; },
    muffle(on) { if (filt) filt.frequency.setTargetAtTime(on ? 700 : 18000, ac.currentTime, 0.05); },
    setVolume(v) { volume = v; if (out) out.gain.setTargetAtTime(v, ac.currentTime, 0.02); },
    setOffset(ms) { offsetMs = ms; },
    jing() { if (ensure()) jing(ac.currentTime + 0.02); },
    bak() { if (ensure()) bak(ac.currentTime + 0.01); },
    sfx(kind) {
      if (!ac || !volume) return;
      const t = ac.currentTime + 0.005;
      switch (kind) {
        case "slash": noise(t, 0.09, 4200, "highpass", 0.22); noise(t, 0.12, 900, "bandpass", 0.1); break; // paper tear
        case "strike": noise(t, 0.14, 3000, "bandpass", 0.4, 1.5); osc(t, "square", 1100, 700, 0.08, 0.06); break;
        case "kill": osc(t, "sawtooth", 180, 50, 0.2, 0.12); noise(t, 0.16, 700, "lowpass", 0.3); break;
        case "clang": osc(t, "square", 1800, 1500, 0.12, 0.07); osc(t, "square", 2700, 2300, 0.1, 0.04); break;
        case "dash": noise(t, 0.16, 5200, "bandpass", 0.25, 0.6); break;
        case "jump": osc(t, "triangle", 260, 420, 0.07, 0.05); break;
        case "hook": osc(t, "triangle", 700, 1300, 0.12, 0.06); break;
        case "shoot": osc(t, "square", 600, 220, 0.07, 0.04); break;
        case "snipe": osc(t, "sawtooth", 1300, 140, 0.25, 0.06); break;
        case "reflect": osc(t, "square", 1400, 2300, 0.08, 0.05); break;
        case "die": osc(t, "sawtooth", 260, 40, 0.5, 0.14); noise(t, 0.35, 400, "lowpass", 0.3); break;
        case "lantern": osc(t, "triangle", 660, 990, 0.2, 0.07); break;
        case "seal": bak(t); setTimeout(() => this.bak(), 260); break;
      }
    }
  };
})();
