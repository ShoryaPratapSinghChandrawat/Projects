/* ============================================================
   Neon Bastion - utils.js
   Small math helpers, seeded RNG, colour helpers, glow sprites.
   ============================================================ */
window.TD = window.TD || {};

(function (TD) {
  'use strict';
  const U = {};

  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.dist2 = (ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    return dx * dx + dy * dy;
  };
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  /** Rotate angle a towards b by fraction t, taking the short way round. */
  U.angleLerp = (a, b, t) => {
    let d = (b - a) % U.TAU;
    if (d > Math.PI) d -= U.TAU;
    if (d < -Math.PI) d += U.TAU;
    return a + d * t;
  };

  /** Distance from point P to segment AB (squared). */
  U.segDist2 = (px, py, ax, ay, bx, by) => {
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
    t = U.clamp(t, 0, 1);
    const cx = ax + abx * t, cy = ay + aby * t;
    return U.dist2(px, py, cx, cy);
  };

  /** Deterministic RNG so maps & waves are always the same. */
  U.mulberry32 = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.fmt = (n) => {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  };

  const rgbCache = new Map();
  U.hexToRgb = (hex) => {
    let v = rgbCache.get(hex);
    if (v) return v;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
    return v;
  };
  U.rgba = (hex, a) => {
    const c = U.hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  /* ---------- Glow sprites (pre-rendered radial gradients) ---------- */
  const glowCache = new Map();
  const GLOW_R = 64;
  U.glowSprite = function (color) {
    let c = glowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = GLOW_R * 2;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(GLOW_R, GLOW_R, 0, GLOW_R, GLOW_R, GLOW_R);
    grd.addColorStop(0, U.rgba(color, 1));
    grd.addColorStop(0.2, U.rgba(color, 0.6));
    grd.addColorStop(0.5, U.rgba(color, 0.18));
    grd.addColorStop(1, U.rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, GLOW_R * 2, GLOW_R * 2);
    glowCache.set(color, c);
    return c;
  };
  /** Draw a soft glow. Caller should set globalCompositeOperation = 'lighter'. */
  U.glow = function (ctx, color, x, y, r, alpha) {
    if (r <= 0.5) return;
    const s = U.glowSprite(color);
    if (alpha !== undefined && alpha !== 1) {
      const old = ctx.globalAlpha;
      ctx.globalAlpha = old * alpha;
      ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = old;
    } else {
      ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    }
  };

  /* ---------- Shape helpers ---------- */
  U.polyPath = function (ctx, x, y, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * U.TAU;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  U.starPath = function (ctx, x, y, r1, r2, points, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = rot + (i / (points * 2)) * U.TAU;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  TD.U = U;
})(window.TD);
