/* ============================================================
   Neon Bastion - main.js
   Boot, responsive scaling and the main game loop.
   ============================================================ */
(function (TD) {
  'use strict';
  const { W, H } = TD.C;
  const STAGE_W = 1560, STAGE_H = 720;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let k = 1; // canvas backing-store pixels per game unit

  TD.game = null;
  TD.demo = null;

  /** Scale the whole stage to fit the window and size the canvas for crisp rendering. */
  TD.resize = function () {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H) * 0.98;
    document.documentElement.style.setProperty('--scale', scale.toFixed(4));
    const dpr = window.devicePixelRatio || 1;
    const maxK = TD.settings.quality === 'low' ? 1 : 2;
    k = Math.max(0.5, Math.min(maxK, scale * dpr));
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
  };

  /** Attract-mode game that plays itself behind the menus. */
  TD.makeDemo = function () {
    const mapIndex = Math.floor(Math.random() * TD.MAPS.length);
    const d = new TD.Game(mapIndex, 'endless', true);
    TD.sfxBlocked = true;
    TD.autoPlaceDemo(d);
    d.startNextWave();
    // fast-forward a few seconds so the screen is busy immediately
    for (let i = 0; i < 60 * 8; i++) d.update(1 / 60);
    TD.sfxBlocked = false;
    TD.demo = d;
  };

  let last = performance.now();
  // Auto-quality: if a real game runs below ~30 FPS for a few seconds, switch to LOW once.
  const perf = { frames: 0, time: 0, done: false };
  function checkPerformance(rawDt) {
    if (perf.done || !TD.game || TD.game.paused || TD.settings.quality === 'low') return;
    if (rawDt > 0.5) return; // ignore hiccups (tab switch etc.)
    perf.frames++;
    perf.time += rawDt;
    if (perf.time < 4) return;
    const fps = perf.frames / perf.time;
    perf.frames = 0;
    perf.time = 0;
    if (fps < 30) {
      perf.done = true;
      TD.settings.quality = 'low';
      TD.persist();
      TD.resize();
      TD.UI.syncSettings();
      TD.UI.toast('Low FPS detected: switched to LOW graphics (change in Settings)', '#35e0ff');
    }
  }

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    checkPerformance(dt);
    if (dt > 0.1) dt = 0.1; // tab was inactive: avoid huge jumps
    if (dt < 0) dt = 0;

    const g = TD.game || TD.demo;
    try {
      if (g) {
        if (!g.paused) {
          const total = dt * g.speed;
          const steps = Math.max(1, Math.ceil(total / (1 / 60)));
          const sub = total / steps;
          TD.sfxBlocked = g.demo;
          for (let i = 0; i < steps; i++) g.update(sub);
          TD.sfxBlocked = false;
        }
        g.render(ctx, k);
      }
      TD.UI.update();
    } catch (err) {
      TD.sfxBlocked = false;
      console.error(err);
    }
    requestAnimationFrame(frame);
  }

  function boot() {
    TD.resize();
    window.addEventListener('resize', TD.resize);
    TD.makeDemo();
    TD.UI.init();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.TD);
