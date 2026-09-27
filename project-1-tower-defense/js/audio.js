/* ============================================================
   Neon Bastion - audio.js
   All sound effects and music are synthesised live with the
   Web Audio API - no audio files needed.
   ============================================================ */
(function (TD) {
  'use strict';

  const A = {
    ctx: null, master: null, sfx: null, music: null, noiseBuf: null,
    last: {}, intensity: 0, step: 0, nextT: 0, timer: null
  };

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      A.ctx = new AC();
    } catch (e) {
      return;
    }
    const c = A.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    A.master = c.createGain();
    A.master.gain.value = 0.9;
    A.master.connect(comp);
    comp.connect(c.destination);
    A.sfx = c.createGain();
    A.sfx.connect(A.master);
    A.music = c.createGain();
    A.music.connect(A.master);

    const len = c.sampleRate;
    A.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    A.apply();
    A.startMusic();
  };

  A.apply = function () {
    if (!A.ctx) return;
    A.sfx.gain.value = TD.settings.sfx * 0.55;
    A.music.gain.value = TD.settings.music * 0.4;
  };

  A.suspend = function () { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

  /* ----------------------------- primitives ---------------------------- */
  function tone(type, f0, f1, dur, vol, delay, dest, attack) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || A.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, ftype, freq, delay, q, freqEnd, dest) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const src = c.createBufferSource();
    src.buffer = A.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || A.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  const SOUNDS = {
    pulse: () => tone('square', 880 + Math.random() * 120, 420, 0.07, 0.035),
    cannon: () => { tone('sine', 170, 45, 0.3, 0.3); noise(0.18, 0.12, 'lowpass', 1200); },
    frost: () => { tone('triangle', 1400, 700, 0.12, 0.06); noise(0.15, 0.05, 'highpass', 4000); },
    laser: () => tone('sawtooth', 220, 330, 0.16, 0.025),
    tesla: () => { noise(0.16, 0.14, 'bandpass', 2500, 0, 3, 600); tone('sawtooth', 90, 60, 0.12, 0.05); },
    rail: () => { tone('sawtooth', 1800, 90, 0.35, 0.09); noise(0.3, 0.12, 'bandpass', 3000, 0, 1, 300); },
    boom: () => { noise(0.45, 0.22, 'lowpass', 900, 0, 1, 80); tone('sine', 110, 35, 0.35, 0.22); },
    hit: () => noise(0.04, 0.04, 'highpass', 3000),
    death: () => tone('triangle', 520 + Math.random() * 200, 140, 0.13, 0.07),
    bossDeath: () => { noise(1.2, 0.35, 'lowpass', 1500, 0, 1, 50); tone('sine', 90, 25, 1.2, 0.35); },
    build: () => { tone('sine', 420, 420, 0.08, 0.1); tone('sine', 630, 630, 0.08, 0.1, 0.07); tone('sine', 840, 840, 0.14, 0.1, 0.14); },
    upgrade: () => { [500, 630, 750, 1000].forEach((f, i) => tone('triangle', f, f, 0.12, 0.09, i * 0.06)); },
    sell: () => { tone('sine', 900, 400, 0.18, 0.1); tone('sine', 1200, 600, 0.12, 0.05, 0.05); },
    leak: () => { tone('sawtooth', 220, 70, 0.45, 0.14); noise(0.3, 0.1, 'lowpass', 500); },
    wave: () => { tone('sawtooth', 220, 220, 0.3, 0.07, 0, null, 0.05); tone('sawtooth', 330, 330, 0.45, 0.07, 0.25, null, 0.05); },
    boss: () => { tone('sawtooth', 70, 70, 1.2, 0.18, 0, null, 0.2); tone('sawtooth', 73, 73, 1.2, 0.14, 0, null, 0.2); tone('square', 140, 60, 1.2, 0.05, 0.3); },
    victory: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.5, 0.12, i * 0.13)); },
    defeat: () => { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.55, 0.08, i * 0.22)); },
    click: () => tone('sine', 1200, 900, 0.05, 0.06),
    error: () => { tone('square', 150, 140, 0.15, 0.06); },
    coin: () => { tone('sine', 1300, 1300, 0.06, 0.05); tone('sine', 1750, 1750, 0.1, 0.05, 0.05); }
  };
  const MIN_GAP = { pulse: 0.05, laser: 0.22, death: 0.035, hit: 0.04, frost: 0.06, cannon: 0.06, boom: 0.07, tesla: 0.07, coin: 0.08 };

  A.play = function (name) {
    if (!A.ctx || A.ctx.state !== 'running' || TD.settings.sfx <= 0) return;
    const now = A.ctx.currentTime;
    const gap = MIN_GAP[name] || 0.03;
    if (A.last[name] !== undefined && now - A.last[name] < gap) return;
    A.last[name] = now;
    const fn = SOUNDS[name];
    if (fn) {
      try { fn(); } catch (e) { /* ignore audio errors */ }
    }
  };

  /* -------------------------------- music ------------------------------ */
  const BPM = 100, STEP = 60 / BPM / 4;
  const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function playStep(s, t) {
    const c = A.ctx, out = A.music;
    const bar = Math.floor(s / 16) % 4, i = s % 16;
    const chord = PROG[bar];
    const delay = Math.max(0, t - c.currentTime);
    // pad
    if (i === 0) {
      chord.forEach((n) => tone('sine', mtof(n), mtof(n), STEP * 16, 0.035, delay, out, 0.6));
      chord.forEach((n) => tone('triangle', mtof(n - 12), mtof(n - 12), STEP * 16, 0.02, delay, out, 0.8));
    }
    // arpeggio
    if (i % 2 === 0) {
      const n = chord[(i / 2) % 3] + (i >= 8 ? 24 : 12);
      tone('triangle', mtof(n), mtof(n), STEP * 1.6, 0.03, delay, out);
    }
    if (A.intensity > 0) {
      // bass
      if (i % 4 === 0 || i === 14) tone('sawtooth', mtof(chord[0] - 24), mtof(chord[0] - 24), STEP * 2.5, 0.07, delay, out, 0.01);
      // kick
      if (i % 4 === 0) tone('sine', 130, 40, 0.22, 0.22, delay, out);
      // hats
      if (i % 2 === 1) noise(0.04, 0.03, 'highpass', 8000, delay, 1, null, out);
      // snare
      if (A.intensity > 1 && (i === 4 || i === 12)) noise(0.15, 0.08, 'bandpass', 1800, delay, 0.8, null, out);
    }
  }

  A.startMusic = function () {
    if (!A.ctx || A.timer) return;
    A.nextT = A.ctx.currentTime + 0.15;
    A.timer = setInterval(function () {
      const c = A.ctx;
      if (!c || c.state !== 'running') return;
      if (A.nextT < c.currentTime - 0.05) A.nextT = c.currentTime + 0.05; // tab was throttled
      while (A.nextT < c.currentTime + 0.12) {
        if (TD.settings.music > 0) playStep(A.step, A.nextT);
        A.nextT += STEP;
        A.step++;
      }
    }, 25);
  };

  TD.Audio = A;
})(window.TD);
