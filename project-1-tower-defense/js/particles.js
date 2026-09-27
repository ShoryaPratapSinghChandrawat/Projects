/* ============================================================
   Neon Bastion - particles.js
   Lightweight particle system (sparks, glows, rings, smoke, shards).
   ============================================================ */
(function (TD) {
  'use strict';
  const U = TD.U;

  class Particles {
    constructor() {
      this.list = [];
    }
    get max() {
      return TD.settings.quality === 'low' ? 350 : 1600;
    }
    add(p) {
      if (this.list.length >= this.max) return;
      p.life = p.max = p.life || 0.5;
      p.vx = p.vx || 0; p.vy = p.vy || 0;
      p.drag = p.drag === undefined ? 0.9 : p.drag;
      p.size = p.size || 3;
      p.rot = p.rot || 0; p.vr = p.vr || 0;
      this.list.push(p);
    }
    /** Radial burst of sparks + glows. */
    burst(x, y, color, n, speed, opts) {
      opts = opts || {};
      const q = TD.settings.quality === 'low' ? 0.35 : 1;
      n = Math.max(1, Math.round(n * q));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * U.TAU;
        const s = speed * (0.3 + Math.random() * 0.7);
        this.add({
          type: opts.type || 'spark', x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: (opts.life || 0.45) * (0.6 + Math.random() * 0.6),
          size: (opts.size || 2) * (0.7 + Math.random() * 0.6),
          color: color, drag: opts.drag || 0.88,
          rot: Math.random() * U.TAU, vr: U.rand(-10, 10)
        });
      }
    }
    ring(x, y, color, r0, r1, life, width) {
      this.add({ type: 'ring', x: x, y: y, r0: r0, r1: r1, life: life || 0.4, color: color, size: width || 3, drag: 1 });
    }
    glow(x, y, color, size, life) {
      this.add({ type: 'glow', x: x, y: y, size: size, life: life || 0.3, color: color, drag: 1 });
    }
    smoke(x, y, n) {
      if (TD.settings.quality === 'low') n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) {
        this.add({
          type: 'smoke', x: x + U.rand(-6, 6), y: y + U.rand(-6, 6),
          vx: U.rand(-25, 25), vy: U.rand(-35, -5), life: U.rand(0.6, 1.1),
          size: U.rand(6, 14), color: '#1a1f33', drag: 0.95
        });
      }
    }
    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.life -= dt;
        if (p.life <= 0) {
          L[i] = L[L.length - 1];
          L.pop();
          continue;
        }
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy *= d;
        if (p.grav) p.vy += p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }
    draw(ctx) {
      const L = this.list;
      if (!L.length) return;
      // Smoke first with normal blending
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        if (p.type !== 'smoke') continue;
        const t = p.life / p.max;
        ctx.globalAlpha = t * 0.45;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - t * 0.6), 0, U.TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        const t = p.life / p.max;
        switch (p.type) {
          case 'spark': {
            ctx.globalAlpha = t;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
            ctx.stroke();
            break;
          }
          case 'glow':
            ctx.globalAlpha = 1;
            U.glow(ctx, p.color, p.x, p.y, p.size * (0.5 + t * 0.5), t);
            break;
          case 'dot':
            ctx.globalAlpha = t;
            U.glow(ctx, p.color, p.x, p.y, p.size * 3, 1);
            break;
          case 'ring': {
            const r = p.r0 + (p.r1 - p.r0) * (1 - t * t);
            ctx.globalAlpha = t;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = p.size * t + 0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.1, r), 0, U.TAU);
            ctx.stroke();
            break;
          }
          case 'shard': {
            ctx.globalAlpha = t;
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.beginPath();
            ctx.moveTo(p.size * 1.6, 0);
            ctx.lineTo(0, p.size * 0.6);
            ctx.lineTo(-p.size, 0);
            ctx.lineTo(0, -p.size * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            break;
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  TD.Particles = Particles;
})(window.TD);
