/* ============================================================
   Neon Bastion - entities.js
   Enemy, Tower and Projectile classes + their drawing code.
   ============================================================ */
(function (TD) {
  'use strict';
  const U = TD.U;
  const TILE = TD.C.TILE;
  const sfx = (n) => { if (!TD.sfxBlocked && TD.Audio) TD.Audio.play(n); };

  let nextId = 1;

  /* =============================== ENEMY =============================== */
  class Enemy {
    constructor(game, type, pathIndex, wave, from) {
      const def = TD.ENEMIES[type];
      this.id = nextId++;
      this.game = game;
      this.type = type;
      this.def = def;
      this.wave = wave;
      const hs = TD.hpScale(wave) * game.map.hpMul * (game.demo ? 0.55 : 1);
      this.maxHp = this.hp = def.hp * hs;
      this.maxShield = this.shield = (def.shield || 0) * hs;
      this.speed = def.speed * (game.map.speedMul || 1);
      this.reward = Math.round(def.reward * TD.rewardScale(wave));
      this.air = !!def.air;
      this.size = def.size;
      this.pathIndex = pathIndex;
      this.path = game.paths[pathIndex];
      this.seg = 0;
      this.bx = this.path[0].x;
      this.by = this.path[0].y;
      this.progress = 0;
      this.dirX = 1; this.dirY = 0;
      if (from) { // spawned from a splitter
        this.seg = from.seg; this.bx = from.bx; this.by = from.by;
        this.progress = from.progress; this.dirX = from.dirX; this.dirY = from.dirY;
      }
      this.lane = def.boss ? 0 : U.rand(-7, 7);
      this.x = this.bx; this.y = this.by;
      this.slowT = 0; this.slowAmt = 0;
      this.flashT = 0; this.shieldCd = 0; this.healT = U.rand(0.3, 1);
      this.rot = Math.random() * U.TAU;
      this.bob = Math.random() * U.TAU;
      this.alive = true;
      this.leaked = false;
    }

    update(dt) {
      const def = this.def;
      if (this.flashT > 0) this.flashT -= dt;
      if (this.slowT > 0) {
        this.slowT -= dt;
        if (this.slowT <= 0) this.slowAmt = 0;
      }
      if (this.maxShield > 0) {
        if (this.shieldCd > 0) this.shieldCd -= dt;
        else if (this.shield < this.maxShield) this.shield = Math.min(this.maxShield, this.shield + this.maxShield * 0.25 * dt);
      }
      if (def.heal) {
        this.healT -= dt;
        if (this.healT <= 0) {
          this.healT = 1.2;
          const r2 = def.healRange * def.healRange;
          let healed = false;
          for (const e of this.game.enemies) {
            if (!e.alive || e.hp >= e.maxHp) continue;
            if (U.dist2(this.x, this.y, e.x, e.y) > r2) continue;
            e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (e.def.boss ? 0.01 : def.heal));
            healed = true;
          }
          if (healed) this.game.particles.ring(this.x, this.y, def.color, 6, def.healRange, 0.6, 3);
        }
      }

      let move = this.speed * (1 - this.slowAmt) * dt;
      this.progress += move;
      const path = this.path;
      while (move > 0 && this.seg < path.length - 1) {
        const tgt = path[this.seg + 1];
        const dx = tgt.x - this.bx, dy = tgt.y - this.by;
        const d = Math.hypot(dx, dy);
        if (d <= move) {
          this.bx = tgt.x; this.by = tgt.y;
          this.seg++;
          move -= d;
        } else {
          this.dirX = dx / d; this.dirY = dy / d;
          this.bx += this.dirX * move;
          this.by += this.dirY * move;
          move = 0;
        }
      }
      this.x = this.bx - this.dirY * this.lane;
      this.y = this.by + this.dirX * this.lane;
      this.rot += dt * (def.boss ? 0.6 : 2.2);
      this.bob += dt * 3;

      if (this.seg >= path.length - 1) {
        this.alive = false;
        this.leaked = true;
        this.game.leak(this);
      }
    }

    /** Apply damage. opts: {src, pierce (ignore armor), ignoreShield}. Returns damage dealt. */
    damage(amount, opts) {
      if (!this.alive || amount <= 0) return 0;
      opts = opts || {};
      let a = amount;
      if (this.def.armor && !opts.pierce) a *= 1 - this.def.armor;
      let dealt = 0;
      if (this.shield > 0 && !opts.ignoreShield) {
        const s = Math.min(this.shield, a);
        this.shield -= s;
        a -= s;
        dealt += s;
        this.shieldCd = 3;
      }
      if (a > 0) {
        const h = Math.min(this.hp, a);
        this.hp -= a;
        dealt += h;
      }
      this.flashT = 0.07;
      if (opts.src) opts.src.dealt += dealt;
      if (this.hp <= 0) {
        this.hp = 0;
        this.alive = false;
        this.game.killEnemy(this, opts.src);
      }
      return dealt;
    }

    slow(amount, dur) {
      if (this.def.boss) amount *= 0.5;
      this.slowAmt = Math.max(this.slowAmt, amount);
      this.slowT = Math.max(this.slowT, dur);
    }

    /** y offset for flying units */
    get hover() {
      return this.air ? 14 + Math.sin(this.bob) * 3 : 0;
    }

    drawShadow(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(this.x + 4, this.y + 6, this.size * 0.9, this.size * 0.45, 0, 0, U.TAU);
      ctx.fill();
    }

    draw(ctx, t, glowOn) {
      const def = this.def, s = this.size;
      const x = this.x, y = this.y - this.hover;
      const col = def.color;
      const flash = this.flashT > 0;

      if (glowOn) {
        ctx.globalCompositeOperation = 'lighter';
        U.glow(ctx, col, x, y, s * (def.boss ? 3.2 : 2.6), def.boss ? 0.55 + Math.sin(t * 4) * 0.15 : 0.45);
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.save();
      ctx.translate(x, y);
      const face = Math.atan2(this.dirY, this.dirX);
      ctx.lineWidth = 2;
      ctx.strokeStyle = flash ? '#ffffff' : col;
      ctx.fillStyle = flash ? 'rgba(255,255,255,0.9)' : U.rgba(col, 0.22);

      switch (def.shape) {
        case 'square':
          U.polyPath(ctx, 0, 0, s, 4, this.rot);
          ctx.fill(); ctx.stroke();
          U.polyPath(ctx, 0, 0, s * 0.45, 4, -this.rot);
          ctx.fillStyle = flash ? '#fff' : col; ctx.fill();
          break;
        case 'tri':
          ctx.rotate(face);
          ctx.beginPath();
          ctx.moveTo(s * 1.2, 0); ctx.lineTo(-s * 0.8, s * 0.8); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s * 0.8, -s * 0.8);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = flash ? '#fff' : col;
          ctx.beginPath(); ctx.arc(s * 0.1, 0, s * 0.28, 0, U.TAU); ctx.fill();
          break;
        case 'hex':
          U.polyPath(ctx, 0, 0, s, 6, this.rot * 0.3);
          ctx.fill(); ctx.stroke();
          U.polyPath(ctx, 0, 0, s * 0.62, 6, this.rot * 0.3);
          ctx.stroke();
          ctx.fillStyle = flash ? '#fff' : col;
          U.polyPath(ctx, 0, 0, s * 0.3, 6, -this.rot);
          ctx.fill();
          break;
        case 'wing': {
          ctx.rotate(face);
          const flap = Math.sin(this.bob * 3) * 0.25;
          ctx.beginPath();
          ctx.moveTo(s * 1.1, 0);
          ctx.lineTo(-s * 0.3, s * (1.1 + flap)); ctx.lineTo(-s * 0.7, s * 0.3);
          ctx.lineTo(-s * 0.4, 0);
          ctx.lineTo(-s * 0.7, -s * 0.3); ctx.lineTo(-s * 0.3, -s * (1.1 + flap));
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = flash ? '#fff' : col;
          ctx.beginPath(); ctx.arc(s * 0.15, 0, s * 0.25, 0, U.TAU); ctx.fill();
          break;
        }
        case 'circle':
          ctx.beginPath(); ctx.arc(0, 0, s, 0, U.TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = flash ? '#fff' : col;
          U.polyPath(ctx, 0, 0, s * 0.45, 3, this.rot); ctx.fill();
          break;
        case 'cross':
          ctx.rotate(this.rot * 0.4);
          ctx.beginPath(); ctx.arc(0, 0, s, 0, U.TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = flash ? '#fff' : col;
          ctx.fillRect(-s * 0.6, -s * 0.18, s * 1.2, s * 0.36);
          ctx.fillRect(-s * 0.18, -s * 0.6, s * 0.36, s * 1.2);
          break;
        case 'diamond':
          U.polyPath(ctx, 0, 0, s * 1.1, 4, this.rot * 0.5 + Math.PI / 4 * 0);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = flash ? '#fff' : col;
          for (let i = 0; i < 3; i++) {
            const a = this.rot + (i / 3) * U.TAU;
            ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, s * 0.18, 0, U.TAU); ctx.fill();
          }
          break;
        case 'boss': {
          U.starPath(ctx, 0, 0, s * 1.15, s * 0.8, 8, this.rot);
          ctx.fill(); ctx.stroke();
          ctx.strokeStyle = flash ? '#fff' : '#ffb3c6';
          U.polyPath(ctx, 0, 0, s * 0.68, 6, -this.rot * 1.5);
          ctx.stroke();
          const pulse = 0.3 + Math.sin(t * 5) * 0.06;
          ctx.fillStyle = flash ? '#fff' : col;
          ctx.beginPath(); ctx.arc(0, 0, s * pulse, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(0, 0, s * pulse * 0.45, 0, U.TAU); ctx.fill();
          break;
        }
      }
      ctx.restore();

      if (this.slowAmt > 0) {
        ctx.strokeStyle = 'rgba(160,220,255,0.8)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(x, y, s + 4, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (this.shield > 0) {
        const r = this.shield / this.maxShield;
        ctx.strokeStyle = 'rgba(120,190,255,' + (0.3 + r * 0.6) + ')';
        ctx.fillStyle = 'rgba(80,150,255,' + (0.08 + r * 0.1) + ')';
        ctx.lineWidth = 2;
        U.polyPath(ctx, x, y, s + 7, 6, t * 0.8);
        ctx.fill(); ctx.stroke();
      }
    }

    drawBars(ctx) {
      const hpR = this.hp / this.maxHp;
      if (hpR >= 1 && (this.maxShield === 0 || this.shield >= this.maxShield)) return;
      if (this.def.boss) return; // bosses get a big bar at the top of the screen
      const w = Math.max(18, this.size * 2 + 4), h = 3;
      const x = this.x - w / 2, y = this.y - this.hover - this.size - 9;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = hpR > 0.6 ? '#5dff8a' : hpR > 0.3 ? '#ffd34d' : '#ff4d5e';
      ctx.fillRect(x, y, w * hpR, h);
      if (this.maxShield > 0 && this.shield > 0) {
        ctx.fillStyle = '#6fb6ff';
        ctx.fillRect(x, y - 3, w * (this.shield / this.maxShield), 2);
      }
    }
  }

  /* =============================== TOWER =============================== */
  const TARGET_MODES = ['first', 'last', 'strong', 'close'];

  class Tower {
    constructor(game, type, c, r) {
      this.id = nextId++;
      this.game = game;
      this.type = type;
      this.def = TD.TOWERS[type];
      this.c = c; this.r = r;
      this.x = c * TILE + TILE / 2;
      this.y = r * TILE + TILE / 2;
      this.level = 1;
      this.invested = this.def.cost;
      this.cd = 0.15;
      this.angle = -Math.PI / 2;
      this.target = null;
      this.mode = 'first';
      this.kills = 0;
      this.dealt = 0;
      this.recoil = 0;
      this.beamT = 0;
      this.barrel = 0;
      this.buildT = 0;
      this.refresh();
    }
    refresh() { this.stats = TD.towerStats(this.def, this.level); }
    get upgradeCost() { return TD.upgradeCost(this.def, this.level); }
    get sellValue() { return Math.floor(this.invested * TD.SELL_RATE); }
    cycleMode() {
      this.mode = TARGET_MODES[(TARGET_MODES.indexOf(this.mode) + 1) % TARGET_MODES.length];
    }
    canHit(e) { return e.alive && (this.def.air || !e.air); }
    inRange(e) {
      const r = this.stats.range + e.size * 0.5;
      return U.dist2(this.x, this.y, e.x, e.y) <= r * r;
    }
    acquire() {
      let best = null, bv = -Infinity;
      const enemies = this.game.enemies;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!this.canHit(e) || !this.inRange(e)) continue;
        let v;
        switch (this.mode) {
          case 'last': v = -e.progress; break;
          case 'strong': v = e.hp + e.shield; break;
          case 'close': v = -U.dist2(this.x, this.y, e.x, e.y); break;
          default: v = e.progress;
        }
        if (v > bv) { bv = v; best = e; }
      }
      return best;
    }

    update(dt) {
      if (this.buildT < 1) this.buildT = Math.min(1, this.buildT + dt * 3);
      if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 6);
      if (this.cd > 0) this.cd -= dt;
      const kind = this.def.kind;

      if (kind === 'beam') {
        if (this.target && (!this.canHit(this.target) || !this.inRange(this.target))) this.target = null;
        if (!this.target) {
          this.target = this.acquire();
          this.beamT = 0;
        }
        const e = this.target;
        if (e) {
          this.angle = U.angleTo(this.x, this.y, e.x, e.y - e.hover);
          this.beamT += dt;
          const ramp = 1 + Math.min(this.beamT / 2.5, 1) * 2;
          const hx = e.x, hy = e.y - e.hover;
          e.damage(this.stats.dps * ramp * dt, { src: this });
          if (Math.random() < dt * 25) {
            this.game.particles.add({
              type: 'spark', x: hx, y: hy, vx: U.rand(-120, 120), vy: U.rand(-120, 120),
              life: 0.25, size: 1.5, color: this.def.color, drag: 0.85
            });
          }
          sfx('laser');
        }
        return;
      }

      this.target = this.acquire();
      const e = this.target;
      if (e && kind !== 'frost' && kind !== 'chain') {
        const want = U.angleTo(this.x, this.y, e.x, e.y - e.hover);
        this.angle = U.angleLerp(this.angle, want, Math.min(1, dt * 14));
      }
      if (e && this.cd <= 0) {
        this.cd = 1 / this.stats.rate;
        this.fire(e);
      }
    }

    fire(e) {
      const g = this.game, st = this.stats, col = this.def.color;
      const kind = this.def.kind;
      this.recoil = 1;
      if (kind === 'bullet' || kind === 'shell') {
        this.angle = U.angleTo(this.x, this.y, e.x, e.y - e.hover);
      }
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      const mx = this.x + ca * 18, my = this.y + sa * 18;

      switch (kind) {
        case 'bullet': {
          this.barrel = 1 - this.barrel;
          const off = this.barrel ? 3 : -3;
          const bx = mx - sa * off, by = my + ca * off;
          g.projectiles.push(new Projectile(g, 'bullet', bx, by, e, this, { speed: this.def.speed, damage: st.damage, color: col }));
          g.particles.glow(bx, by, col, 12, 0.08);
          sfx('pulse');
          break;
        }
        case 'shell':
          g.projectiles.push(new Projectile(g, 'shell', mx, my, e, this, { speed: this.def.speed, damage: st.damage, splash: st.splash, color: col }));
          g.particles.glow(mx, my, col, 22, 0.12);
          g.particles.smoke(mx, my, 3);
          sfx('cannon');
          break;
        case 'frost':
          g.projectiles.push(new Projectile(g, 'frost', this.x, this.y - 10, e, this, {
            speed: this.def.speed, damage: st.damage, splash: st.splash, slow: st.slow, slowDur: st.slowDur, color: col
          }));
          g.particles.ring(this.x, this.y, col, 8, 26, 0.3, 2);
          sfx('frost');
          break;
        case 'chain': {
          const hit = new Set();
          let fx = this.x, fy = this.y - 12, cur = e, dmg = st.damage;
          for (let i = 0; i < st.chains && cur; i++) {
            hit.add(cur);
            const tx = cur.x, ty = cur.y - cur.hover;
            g.addBolt(fx, fy, tx, ty, col, i === 0 ? 3 : 2);
            g.particles.burst(tx, ty, col, 5, 140, { life: 0.25, size: 1.5 });
            cur.damage(dmg, { src: this, ignoreShield: true });
            fx = tx; fy = ty;
            dmg *= 0.85;
            // find next target
            let next = null, bd = st.chainRange * st.chainRange;
            for (const o of g.enemies) {
              if (!o.alive || hit.has(o)) continue;
              const d2 = U.dist2(fx, fy, o.x, o.y - o.hover);
              if (d2 < bd) { bd = d2; next = o; }
            }
            cur = next;
          }
          sfx('tesla');
          break;
        }
        case 'rail': {
          this.angle = U.angleTo(this.x, this.y, e.x, e.y - e.hover);
          const c2 = Math.cos(this.angle), s2 = Math.sin(this.angle);
          const x1 = this.x + c2 * 20, y1 = this.y + s2 * 20;
          const len = st.range + 40;
          const x2 = this.x + c2 * len, y2 = this.y + s2 * len;
          const victims = [];
          for (const o of g.enemies) {
            if (!o.alive) continue;
            const r = o.size + 8;
            if (U.segDist2(o.x, o.y - o.hover, x1, y1, x2, y2) <= r * r) victims.push(o);
          }
          for (const o of victims) {
            o.damage(st.damage, { src: this, pierce: true });
            g.particles.burst(o.x, o.y - o.hover, col, 8, 220, { life: 0.35 });
          }
          g.effects.push({ kind: 'rail', x1: x1, y1: y1, x2: x2, y2: y2, life: 0.35, max: 0.35, color: col });
          g.particles.glow(x1, y1, col, 30, 0.2);
          g.addShake(3);
          sfx('rail');
          break;
        }
      }
    }

    draw(ctx, t, glowOn) {
      const s = 0.6 + 0.4 * easeOutBack(this.buildT);
      drawTower(ctx, this.def, this.level, this.x, this.y, this.angle, t, this.recoil, glowOn, s);
    }
  }
  Tower.MODES = TARGET_MODES;

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  /** Draws a tower. Used by the game and for the shop icons. */
  function drawTower(ctx, def, level, x, y, angle, t, recoil, glowOn, scale) {
    const col = def.color;
    ctx.save();
    ctx.translate(x, y);
    if (scale && scale !== 1) ctx.scale(scale, scale);

    if (glowOn) {
      ctx.globalCompositeOperation = 'lighter';
      U.glow(ctx, col, 0, 0, 34 + level * 4, 0.28 + 0.06 * Math.sin(t * 3));
      ctx.globalCompositeOperation = 'source-over';
    }
    // Base plate
    U.roundRect(ctx, -16, -16, 32, 32, 7);
    ctx.fillStyle = '#0a1024';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = U.rgba(col, 0.85);
    ctx.stroke();
    U.roundRect(ctx, -12, -12, 24, 24, 5);
    ctx.strokeStyle = U.rgba(col, 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();
    // level pips
    for (let i = 0; i < level; i++) {
      ctx.fillStyle = col;
      ctx.fillRect(-13 + i * 5, 11, 3, 3);
    }
    if (level >= 3) {
      ctx.strokeStyle = U.rgba(col, 0.6 + 0.4 * Math.sin(t * 4));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 20, t, t + 1.2); ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 20, t + Math.PI, t + Math.PI + 1.2); ctx.stroke();
    }

    const rc = (recoil || 0) * 4;
    ctx.lineWidth = 2;
    switch (def.id) {
      case 'pulse':
        ctx.rotate(angle);
        ctx.fillStyle = '#1a2748';
        ctx.strokeStyle = col;
        ctx.fillRect(2 - rc, -6, 16, 4); ctx.strokeRect(2 - rc, -6, 16, 4);
        ctx.fillRect(2 - rc, 2, 16, 4); ctx.strokeRect(2 - rc, 2, 16, 4);
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, 3.5 + level * 0.5, 0, U.TAU); ctx.fill();
        break;
      case 'cannon':
        ctx.rotate(angle);
        ctx.fillStyle = '#2a1a10';
        ctx.strokeStyle = col;
        ctx.fillRect(0 - rc, -5, 20, 10); ctx.strokeRect(0 - rc, -5, 20, 10);
        ctx.fillRect(16 - rc, -7, 5, 14); ctx.strokeRect(16 - rc, -7, 5, 14);
        U.polyPath(ctx, 0, 0, 11, 8, Math.PI / 8);
        ctx.fillStyle = '#1c1410'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, U.TAU); ctx.fill();
        break;
      case 'frost': {
        U.polyPath(ctx, 0, 0, 11, 6, t * 0.5);
        ctx.fillStyle = '#101c33'; ctx.strokeStyle = col;
        ctx.fill(); ctx.stroke();
        ctx.rotate(t * 1.2);
        ctx.fillStyle = U.rgba(col, 0.85);
        for (let i = 0; i < 3; i++) {
          ctx.rotate(U.TAU / 3);
          ctx.beginPath();
          ctx.moveTo(0, -3); ctx.lineTo(4, -9 - level); ctx.lineTo(0, -15 - level * 1.5); ctx.lineTo(-4, -9 - level);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, U.TAU); ctx.fill();
        break;
      }
      case 'laser':
        ctx.rotate(angle);
        ctx.fillStyle = '#26102a'; ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-8, 10); ctx.lineTo(-8, -10); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(13, 0, 3, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = U.rgba(col, 0.6);
        ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(8, 0); ctx.lineTo(-3, 5); ctx.stroke();
        break;
      case 'tesla': {
        ctx.fillStyle = '#1a1030'; ctx.strokeStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, U.TAU); ctx.stroke();
        const p = 4 + Math.sin(t * 8) * 1 + level * 0.5;
        if (glowOn) {
          ctx.globalCompositeOperation = 'lighter';
          U.glow(ctx, col, 0, 0, 16, 0.8);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = '#f3e6ff';
        ctx.beginPath(); ctx.arc(0, 0, p, 0, U.TAU); ctx.fill();
        // idle arcs
        ctx.strokeStyle = U.rgba(col, 0.9);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + i * 2.1;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
          ctx.lineTo(Math.cos(a + 0.3) * 9, Math.sin(a + 0.3) * 9);
          ctx.lineTo(Math.cos(a + 0.1) * 13, Math.sin(a + 0.1) * 13);
          ctx.stroke();
        }
        break;
      }
      case 'rail':
        ctx.rotate(angle);
        ctx.fillStyle = '#0f2419'; ctx.strokeStyle = col;
        ctx.fillRect(-2 - rc, -5, 26, 3); ctx.strokeRect(-2 - rc, -5, 26, 3);
        ctx.fillRect(-2 - rc, 2, 26, 3); ctx.strokeRect(-2 - rc, 2, 26, 3);
        U.roundRect(ctx, -10, -8, 16, 16, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillRect(-2 - rc, -1, 22, 2);
        ctx.fillRect(-7, -3, 6, 6);
        break;
    }
    ctx.restore();
  }

  /* ============================= PROJECTILE ============================ */
  class Projectile {
    constructor(game, kind, x, y, target, src, o) {
      this.game = game;
      this.kind = kind;
      this.x = x; this.y = y;
      this.sx = x; this.sy = y;
      this.target = target;
      this.src = src;
      this.tx = target.x; this.ty = target.y - target.hover;
      this.speed = o.speed;
      this.damage = o.damage;
      this.splash = o.splash || 0;
      this.slow = o.slow || 0;
      this.slowDur = o.slowDur || 0;
      this.color = o.color;
      this.alive = true;
      this.d0 = Math.max(1, U.dist(x, y, this.tx, this.ty));
      this.h = 0;
      this.trail = [];
      this.age = 0;
    }
    update(dt) {
      this.age += dt;
      const tg = this.target;
      if (tg && tg.alive) { this.tx = tg.x; this.ty = tg.y - tg.hover; }
      else this.target = null;
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      this.trail.push(this.x, this.y - this.h);
      if (this.trail.length > 16) this.trail.splice(0, 2);
      if (d <= step || this.age > 4) {
        this.x = this.tx; this.y = this.ty;
        this.impact();
        this.alive = false;
        return;
      }
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      if (this.kind === 'shell') {
        const p = U.clamp(1 - d / this.d0, 0, 1);
        this.h = Math.sin(p * Math.PI) * Math.min(50, this.d0 * 0.3);
      }
    }
    impact() {
      const g = this.game, col = this.color;
      if (this.kind === 'bullet') {
        if (this.target && this.target.alive) this.target.damage(this.damage, { src: this.src });
        g.particles.burst(this.x, this.y, col, 4, 120, { life: 0.2, size: 1.5 });
        sfx('hit');
      } else if (this.kind === 'shell') {
        const r = this.splash;
        for (const e of g.enemies) {
          if (!e.alive || e.air) continue;
          const d = U.dist(this.x, this.y, e.x, e.y);
          if (d <= r + e.size * 0.5) e.damage(this.damage * (1 - 0.5 * U.clamp(d / r, 0, 1)), { src: this.src });
        }
        g.explosion(this.x, this.y, col, r);
        sfx('boom');
      } else if (this.kind === 'frost') {
        const r = this.splash;
        for (const e of g.enemies) {
          if (!e.alive) continue;
          if (U.dist(this.x, this.y, e.x, e.y - e.hover) <= r + e.size * 0.5) {
            e.slow(this.slow, this.slowDur);
            e.damage(this.damage, { src: this.src });
          }
        }
        g.particles.ring(this.x, this.y, col, 4, r, 0.4, 3);
        const q = TD.settings.quality === 'low' ? 4 : 10;
        for (let i = 0; i < q; i++) {
          const a = Math.random() * U.TAU, s = U.rand(40, 140);
          g.particles.add({ type: 'shard', x: this.x, y: this.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, size: U.rand(2, 4), color: '#cfeaff', rot: a, vr: U.rand(-6, 6), drag: 0.9 });
        }
      }
    }
    draw(ctx, glowOn) {
      const col = this.color, tr = this.trail;
      ctx.globalCompositeOperation = 'lighter';
      if (tr.length >= 4) {
        ctx.strokeStyle = U.rgba(col, 0.5);
        ctx.lineWidth = this.kind === 'shell' ? 4 : 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tr[0], tr[1]);
        for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
        ctx.lineTo(this.x, this.y - this.h);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
      const y = this.y - this.h;
      if (glowOn) U.glow(ctx, col, this.x, y, this.kind === 'shell' ? 18 : 12, 0.9);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, y, this.kind === 'shell' ? 4 : 2.5, 0, U.TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (this.kind === 'shell') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y + 4, 4, 2, 0, 0, U.TAU); ctx.fill();
      }
    }
  }

  TD.Enemy = Enemy;
  TD.Tower = Tower;
  TD.Projectile = Projectile;
  TD.drawTower = drawTower;
})(window.TD);
