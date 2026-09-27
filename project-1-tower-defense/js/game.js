/* ============================================================
   Neon Bastion - game.js
   The Game class: grid, waves, economy, update loop & rendering.
   ============================================================ */
(function (TD) {
  'use strict';
  const U = TD.U;
  const { TILE, COLS, ROWS, W, H } = TD.C;
  const sfx = (n) => { if (!TD.sfxBlocked && TD.Audio) TD.Audio.play(n); };

  const FREE = 0, PATH = 1, BLOCK = 2, TOWER = 3;

  class Game {
    /**
     * @param {number} mapIndex index into TD.MAPS
     * @param {'campaign'|'endless'} mode
     * @param {boolean} demo  attract-mode game shown behind the menus
     */
    constructor(mapIndex, mode, demo) {
      this.mapIndex = mapIndex;
      this.map = TD.MAPS[mapIndex];
      this.mode = mode || 'campaign';
      this.startMode = this.mode;
      this.demo = !!demo;
      this.totalWaves = this.mode === 'endless' ? Infinity : this.map.waves;

      this.gold = this.map.gold;
      this.lives = this.maxLives = this.map.lives;
      this.score = 0;
      this.wave = 0;
      this.kills = 0;
      this.goldEarned = 0;

      this.enemies = [];
      this.towers = [];
      this.projectiles = [];
      this.effects = [];
      this.texts = [];
      this.spawners = [];
      this.particles = new TD.Particles();

      this.state = 'playing'; // 'playing' | 'won' | 'lost'
      this.endTimer = 0;
      this.speed = 1;
      this.paused = false;
      this.time = 0;
      this.waveActive = false;
      this.autoWave = false;
      this.autoTimer = -1;

      this.selected = null;
      this.placing = null;
      this.hover = null;

      this.shake = 0;
      this.flash = 0;
      this.banner = null;
      this.corePulse = 0;

      this.bg = null;
      this.bgScale = 0;
      this.buildGrid();
    }

    /* ------------------------------ setup ----------------------------- */
    buildGrid() {
      this.grid = [];
      this.towerAt = [];
      for (let r = 0; r < ROWS; r++) {
        this.grid.push(new Array(COLS).fill(FREE));
        this.towerAt.push(new Array(COLS).fill(null));
      }
      this.paths = this.map.paths.map((p) => p.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })));
      this.pathLen = this.paths.map((p) => {
        let L = 0;
        for (let i = 1; i < p.length; i++) L += U.dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y);
        return L;
      });
      for (const p of this.map.paths) {
        for (let i = 0; i < p.length - 1; i++) {
          let [c, r] = p[i];
          const [c1, r1] = p[i + 1];
          const dc = Math.sign(c1 - c), dr = Math.sign(r1 - r);
          for (;;) {
            if (this.inBounds(c, r)) this.grid[r][c] = PATH;
            if (c === c1 && r === r1) break;
            c += dc; r += dr;
          }
        }
      }
      // decorative crystals block some tiles (never right next to the path)
      const rng = U.mulberry32(this.map.seed * 97);
      this.decor = [];
      let tries = 0;
      while (this.decor.length < 18 && tries++ < 800) {
        const c = Math.floor(rng() * COLS), r = Math.floor(rng() * ROWS);
        if (this.grid[r][c] !== FREE || this.nearPath(c, r)) continue;
        this.grid[r][c] = BLOCK;
        this.decor.push({ c, r, size: 9 + rng() * 7, rot: rng() * U.TAU, n: 3 + Math.floor(rng() * 3) });
      }
      // star field for the background
      this.starField = [];
      for (let i = 0; i < 160; i++) this.starField.push({ x: rng() * W, y: rng() * H, s: rng() * 1.6 + 0.3, a: rng() * 0.5 + 0.1 });
    }
    inBounds(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
    nearPath(c, r) {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc, rr = r + dr;
        if (this.inBounds(cc, rr) && this.grid[rr][cc] === PATH) return true;
      }
      return false;
    }
    canBuild(c, r) { return this.inBounds(c, r) && this.grid[r][c] === FREE; }

    /* ------------------------------ actions --------------------------- */
    placeTower(type, c, r) {
      const def = TD.TOWERS[type];
      if (!def || this.state !== 'playing') return false;
      if (!this.canBuild(c, r)) { this.toast('Cannot build there'); sfx('error'); return false; }
      if (this.gold < def.cost) { this.toast('Not enough gold'); sfx('error'); return false; }
      const t = new TD.Tower(this, type, c, r);
      this.towers.push(t);
      this.grid[r][c] = TOWER;
      this.towerAt[r][c] = t;
      this.gold -= def.cost;
      this.particles.ring(t.x, t.y, def.color, 10, 44, 0.5, 3);
      this.particles.burst(t.x, t.y, def.color, 14, 160, { life: 0.4 });
      sfx('build');
      return t;
    }
    upgradeTower(t) {
      if (!t || this.state !== 'playing') return false;
      if (t.level >= TD.MAX_LEVEL) return false;
      const cost = t.upgradeCost;
      if (this.gold < cost) { this.toast('Not enough gold'); sfx('error'); return false; }
      this.gold -= cost;
      t.invested += cost;
      t.level++;
      t.refresh();
      t.buildT = 0.4;
      this.particles.ring(t.x, t.y, t.def.color, 8, 60, 0.6, 4);
      this.particles.burst(t.x, t.y, '#ffffff', 18, 200, { life: 0.5 });
      this.addText(t.x, t.y - 24, 'LEVEL ' + t.level, t.def.color, 14);
      sfx('upgrade');
      return true;
    }
    sellTower(t) {
      if (!t || this.state !== 'playing') return false;
      const i = this.towers.indexOf(t);
      if (i < 0) return false;
      const v = t.sellValue;
      this.gold += v;
      this.towers.splice(i, 1);
      this.grid[t.r][t.c] = FREE;
      this.towerAt[t.r][t.c] = null;
      if (this.selected === t) this.selected = null;
      // projectiles keep flying but no longer credit anything important
      this.particles.burst(t.x, t.y, '#ffd34d', 16, 180, { life: 0.5 });
      this.addText(t.x, t.y - 20, '+' + v, '#ffd34d', 15);
      sfx('sell');
      return v;
    }
    towerAtTile(c, r) { return this.inBounds(c, r) ? this.towerAt[r][c] : null; }

    canCallWave() {
      return this.state === 'playing' && this.spawners.length === 0 && this.wave < this.totalWaves;
    }
    startNextWave() {
      if (!this.canCallWave()) return false;
      if (this.waveActive && this.enemies.length > 0) {
        const b = TD.earlyBonus(this.wave);
        this.gold += b;
        this.goldEarned += b;
        this.toast('Early call bonus +' + b + ' gold', '#ffd34d');
        sfx('coin');
      }
      this.wave++;
      const w = this.demo ? ((this.wave - 1) % 9) + 1 : this.wave;
      this.spawners.push({ events: TD.makeWave(this.map, w), idx: 0, t: 0, wave: w });
      this.waveActive = true;
      this.autoTimer = -1;
      const boss = w % 10 === 0;
      this.banner = { text: 'WAVE ' + this.wave, sub: boss ? 'WARNING: TITAN APPROACHING' : '', t: 0, boss: boss };
      sfx(boss ? 'boss' : 'wave');
      return true;
    }

    /* ------------------------------ events ---------------------------- */
    killEnemy(e, src) {
      this.kills++;
      if (src) src.kills++;
      const reward = this.demo ? 0 : e.reward;
      this.gold += reward;
      this.goldEarned += reward;
      this.score += Math.round(e.reward * 10 * (1 + this.wave * 0.05));
      const y = e.y - e.hover;
      if (e.def.boss) {
        this.explosion(e.x, y, e.def.color, 120, true);
        this.addShake(14);
        sfx('bossDeath');
      } else {
        this.particles.burst(e.x, y, e.def.color, 12 + e.size, 200, { life: 0.5, size: 2 });
        this.particles.glow(e.x, y, e.def.color, e.size * 3, 0.25);
        this.particles.ring(e.x, y, e.def.color, 2, e.size * 2.2, 0.3, 2);
        sfx('death');
      }
      if (TD.settings.texts && reward > 0) this.addText(e.x, y - 10, '+' + reward, '#ffd34d', 12);
      if (e.def.split) {
        for (let i = 0; i < e.def.splitCount; i++) {
          const child = new TD.Enemy(this, e.def.split, e.pathIndex, e.wave, e);
          child.lane = U.rand(-10, 10);
          child.progress -= i * 6; // tiny ordering spread
          this.enemies.push(child);
        }
      }
    }
    leak(e) {
      if (this.demo) return;
      const lost = e.def.lives || 1;
      this.lives = Math.max(0, this.lives - lost);
      this.flash = Math.min(1, this.flash + 0.5 + lost * 0.05);
      this.corePulse = 1;
      this.addShake(e.def.boss ? 16 : 6);
      sfx('leak');
      if (this.lives <= 0 && this.state === 'playing') this.lose();
    }
    lose() {
      this.state = 'lost';
      this.endTimer = 1.6;
      this.placing = null;
      sfx('defeat');
      this.finish(false);
    }
    win() {
      this.state = 'won';
      this.endTimer = 1.6;
      this.placing = null;
      sfx('victory');
      for (let i = 0; i < 6; i++) {
        setTimeout(() => this.explosion(U.rand(200, W - 200), U.rand(150, H - 150), U.pick(['#35e0ff', '#ff3cac', '#ffd34d', '#7dffb0']), 70, false), i * 220);
      }
      this.finish(true);
    }
    get stars() {
      if (this.state !== 'won') return 0;
      const r = this.lives / this.maxLives;
      return r >= 0.9 ? 3 : r >= 0.5 ? 2 : 1;
    }
    finish(won) {
      if (this.demo) return;
      const wavesDone = won ? this.wave : Math.max(0, this.wave - 1);
      this.result = {
        won: won, wave: wavesDone, score: this.score, stars: this.stars, kills: this.kills
      };
      this.result.newBest = TD.recordResult(this.map.id, this.mode, this.result);
    }

    /* ------------------------------ helpers --------------------------- */
    addShake(v) { if (TD.settings.shake) this.shake = Math.min(18, this.shake + v); }
    addText(x, y, text, color, size) {
      if (this.texts.length > 60) return;
      this.texts.push({ x, y, text, color, size: size || 12, life: 0.9, max: 0.9 });
    }
    toast(msg, color) { if (TD.UI && !this.demo) TD.UI.toast(msg, color); }
    addBolt(x1, y1, x2, y2, color, width) {
      const pts = [x1, y1];
      const d = U.dist(x1, y1, x2, y2);
      const n = Math.max(3, Math.floor(d / 12));
      const nx = -(y2 - y1) / (d || 1), ny = (x2 - x1) / (d || 1);
      for (let i = 1; i < n; i++) {
        const t = i / n, off = U.rand(-1, 1) * Math.min(12, d * 0.15);
        pts.push(x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off);
      }
      pts.push(x2, y2);
      this.effects.push({ kind: 'bolt', pts, color, width: width || 2, life: 0.18, max: 0.18 });
    }
    explosion(x, y, color, r, big) {
      const P = this.particles;
      P.glow(x, y, color, r * 1.6, 0.35);
      P.glow(x, y, '#ffffff', r * 0.6, 0.15);
      P.ring(x, y, color, 4, r, 0.45, 4);
      P.burst(x, y, color, big ? 60 : 18, big ? 420 : 240, { life: big ? 0.9 : 0.5, size: 2.2 });
      P.burst(x, y, '#fff2c0', big ? 20 : 6, big ? 300 : 160, { life: 0.3, size: 1.5 });
      P.smoke(x, y, big ? 14 : 5);
      if (big) P.ring(x, y, '#ffffff', 10, r * 2, 0.8, 6);
      this.addShake(big ? 10 : 2);
    }

    /* ------------------------------- update --------------------------- */
    update(dt) {
      this.time += dt;
      this.particles.update(dt);
      this.updateEffects(dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.5);
      if (this.corePulse > 0) this.corePulse = Math.max(0, this.corePulse - dt * 2);
      if (this.banner) {
        this.banner.t += dt;
        if (this.banner.t > 2.6) this.banner = null;
      }
      if (this.state !== 'playing') {
        if (this.endTimer > 0) this.endTimer -= dt;
        // keep enemies animating a little but frozen in place
        return;
      }

      // spawners
      for (let i = this.spawners.length - 1; i >= 0; i--) {
        const s = this.spawners[i];
        s.t += dt;
        while (s.idx < s.events.length && s.events[s.idx].t <= s.t) {
          const ev = s.events[s.idx++];
          const pathIndex = Math.min(ev.path, this.paths.length - 1);
          this.enemies.push(new TD.Enemy(this, ev.type, pathIndex, s.wave));
        }
        if (s.idx >= s.events.length) this.spawners.splice(i, 1);
      }

      // enemies (index loop: splitters may push new enemies during update)
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.alive) e.update(dt);
        if (this.state !== 'playing') break;
      }
      for (const t of this.towers) t.update(dt);
      for (const p of this.projectiles) if (p.alive) p.update(dt);

      // cleanup
      if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
      if (this.projectiles.some((p) => !p.alive)) this.projectiles = this.projectiles.filter((p) => p.alive);
      if (this.selected && this.towers.indexOf(this.selected) < 0) this.selected = null;
      if (this.state !== 'playing') return;

      // wave cleared?
      if (this.waveActive && this.spawners.length === 0 && this.enemies.length === 0) {
        this.waveActive = false;
        this.onWaveCleared();
      }
      if (this.autoTimer > 0) {
        this.autoTimer -= dt;
        if (this.autoTimer <= 0) { this.autoTimer = -1; this.startNextWave(); }
      }
      if (this.demo && this.spawners.length === 0 && this.enemies.length < 25) this.startNextWave();
    }
    onWaveCleared() {
      if (this.demo) return;
      const bonus = TD.waveBonus(this.wave);
      this.gold += bonus;
      this.goldEarned += bonus;
      this.score += this.wave * 50;
      this.toast('Wave ' + this.wave + ' cleared!  +' + bonus + ' gold', '#7dffb0');
      sfx('coin');
      if (this.wave >= this.totalWaves) { this.win(); return; }
      if (this.autoWave) this.autoTimer = 2.5;
    }
    updateEffects(dt) {
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const f = this.effects[i];
        f.life -= dt;
        if (f.life <= 0) { this.effects[i] = this.effects[this.effects.length - 1]; this.effects.pop(); }
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const t = this.texts[i];
        t.life -= dt;
        t.y -= 28 * dt;
        if (t.life <= 0) this.texts.splice(i, 1);
      }
    }

    /* ------------------------------- render --------------------------- */
    render(ctx, k) {
      const glowOn = TD.settings.quality !== 'low';
      if (!this.bg || this.bgScale !== k) {
        this.bg = renderBackground(this, k);
        this.bgScale = k;
      }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      if (this.shake > 0) ctx.translate(U.rand(-1, 1) * this.shake, U.rand(-1, 1) * this.shake);
      ctx.drawImage(this.bg, 0, 0, W, H);
      const t = this.time;

      this.drawStars(ctx, t);
      this.drawPathFlow(ctx, t);
      this.drawPortals(ctx, t, glowOn);
      if (this.placing && this.state === 'playing') this.drawPlacement(ctx);
      if (this.selected) this.drawRange(ctx, this.selected.x, this.selected.y, this.selected.stats.range, this.selected.def.color, true);

      // ground enemies
      for (const e of this.enemies) if (!e.air) e.draw(ctx, t, glowOn);
      for (const tw of this.towers) tw.draw(ctx, t, glowOn);
      if (this.selected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -t * 20;
        ctx.strokeRect(this.selected.x - 20, this.selected.y - 20, 40, 40);
        ctx.setLineDash([]);
      }
      for (const p of this.projectiles) p.draw(ctx, glowOn);
      for (const e of this.enemies) if (e.air) e.drawShadow(ctx);
      for (const e of this.enemies) if (e.air) e.draw(ctx, t, glowOn);

      this.drawBeams(ctx, t, glowOn);
      this.drawEffects(ctx, glowOn);
      this.particles.draw(ctx);
      for (const e of this.enemies) e.drawBars(ctx);
      this.drawTexts(ctx);
      ctx.restore();

      this.drawOverlay(ctx, t);
    }

    drawStars(ctx, t) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < this.starField.length; i += 3) {
        const s = this.starField[i];
        ctx.globalAlpha = s.a * (0.5 + 0.5 * Math.sin(t * 1.5 + i));
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    drawPathFlow(ctx, t) {
      const acc = this.map.theme.accent;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = U.rgba(acc, 0.35);
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 36]);
      ctx.lineDashOffset = -t * 70;
      for (const p of this.paths) {
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'source-over';
    }

    drawPortals(ctx, t, glowOn) {
      const acc = this.map.theme.accent;
      const clampPt = (p) => ({ x: U.clamp(p.x, 6, W - 6), y: U.clamp(p.y, 6, H - 6) });
      ctx.globalCompositeOperation = 'lighter';
      const seen = new Set();
      for (const p of this.paths) {
        const s = clampPt(p[0]);
        const key = s.x + ',' + s.y;
        if (seen.has(key)) continue;
        seen.add(key);
        if (glowOn) U.glow(ctx, '#ff3c6e', s.x, s.y, 46, 0.6 + Math.sin(t * 3) * 0.2);
        ctx.strokeStyle = 'rgba(255,80,120,0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 10 + i * 7, t * (2 + i) + i, t * (2 + i) + i + 2.2);
          ctx.stroke();
        }
      }
      // core
      const last = this.paths[0][this.paths[0].length - 1];
      const c = clampPt(last);
      const danger = 1 - this.lives / this.maxLives;
      const coreCol = danger > 0.6 ? '#ff4d5e' : acc;
      const pr = 1 + this.corePulse * 0.4;
      if (glowOn) U.glow(ctx, coreCol, c.x, c.y, 60 * pr, 0.7);
      ctx.strokeStyle = coreCol;
      ctx.lineWidth = 2;
      U.polyPath(ctx, c.x, c.y, 18 * pr, 6, t);
      ctx.stroke();
      U.polyPath(ctx, c.x, c.y, 12 * pr, 6, -t * 1.5);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(c.x, c.y, 4 + Math.sin(t * 5), 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    drawRange(ctx, x, y, r, color, solid) {
      ctx.fillStyle = U.rgba(color, 0.08);
      ctx.strokeStyle = U.rgba(color, solid ? 0.7 : 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill(); ctx.stroke();
    }

    drawPlacement(ctx) {
      // show buildable tiles faintly
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] === FREE) ctx.fillRect(c * TILE + 3, r * TILE + 3, TILE - 6, TILE - 6);
      }
      if (!this.hover) return;
      const { c, r } = this.hover;
      if (!this.inBounds(c, r)) return;
      const def = TD.TOWERS[this.placing];
      const ok = this.canBuild(c, r) && this.gold >= def.cost;
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      this.drawRange(ctx, x, y, TD.towerStats(def, 1).range, ok ? def.color : '#ff4d5e', false);
      ctx.fillStyle = ok ? 'rgba(80,255,160,0.18)' : 'rgba(255,60,80,0.25)';
      ctx.strokeStyle = ok ? 'rgba(80,255,160,0.9)' : 'rgba(255,60,80,0.9)';
      ctx.lineWidth = 2;
      ctx.fillRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
      ctx.strokeRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
      ctx.globalAlpha = 0.65;
      TD.drawTower(ctx, def, 1, x, y, -Math.PI / 2, this.time, 0, false, 1);
      ctx.globalAlpha = 1;
    }

    drawBeams(ctx, t, glowOn) {
      ctx.globalCompositeOperation = 'lighter';
      for (const tw of this.towers) {
        if (tw.def.kind !== 'beam' || !tw.target || !tw.target.alive) continue;
        const e = tw.target;
        const x1 = tw.x + Math.cos(tw.angle) * 14, y1 = tw.y + Math.sin(tw.angle) * 14;
        const x2 = e.x, y2 = e.y - e.hover;
        const heat = Math.min(tw.beamT / 2.5, 1);
        const col = tw.def.color;
        const flick = 0.8 + Math.random() * 0.2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = U.rgba(col, 0.25 * flick);
        ctx.lineWidth = 8 + heat * 6;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = U.rgba(col, 0.8);
        ctx.lineWidth = 3 + heat * 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * flick) + ')';
        ctx.lineWidth = 1.2 + heat;
        ctx.stroke();
        ctx.lineCap = 'butt';
        if (glowOn) {
          U.glow(ctx, col, x2, y2, 18 + heat * 14, 0.9);
          U.glow(ctx, col, x1, y1, 12, 0.8);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    drawEffects(ctx, glowOn) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.effects) {
        const a = f.life / f.max;
        if (f.kind === 'bolt') {
          const p = f.pts;
          ctx.lineJoin = 'round';
          for (let pass = 0; pass < 2; pass++) {
            ctx.strokeStyle = pass === 0 ? U.rgba(f.color, 0.35 * a) : 'rgba(255,255,255,' + a + ')';
            ctx.lineWidth = pass === 0 ? f.width * 4 : f.width * 0.8;
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
            ctx.stroke();
          }
          ctx.lineJoin = 'miter';
        } else if (f.kind === 'rail') {
          ctx.lineCap = 'round';
          ctx.strokeStyle = U.rgba(f.color, 0.3 * a);
          ctx.lineWidth = 14 * a;
          ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke();
          ctx.strokeStyle = U.rgba(f.color, a);
          ctx.lineWidth = 4 * a;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    drawTexts(ctx) {
      if (!this.texts.length) return;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of this.texts) {
        const a = Math.min(1, t.life / t.max * 2);
        ctx.globalAlpha = a;
        ctx.font = '700 ' + t.size + 'px Orbitron, "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(t.text, t.x + 1, t.y + 1);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }

    drawOverlay(ctx, t) {
      // damage flash
      if (this.flash > 0) {
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
        g.addColorStop(0, 'rgba(255,0,40,0)');
        g.addColorStop(1, 'rgba(255,0,40,' + (0.45 * this.flash) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      // boss health bar
      if (!this.demo) {
        const boss = this.enemies.find((e) => e.def.boss && e.alive);
        if (boss) {
          const bw = 460, bx = (W - bw) / 2, by = 18;
          ctx.fillStyle = 'rgba(10,0,10,0.75)';
          U.roundRect(ctx, bx - 8, by - 6, bw + 16, 30, 8);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,46,99,0.8)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#2a0b14';
          ctx.fillRect(bx, by + 10, bw, 8);
          const r = boss.hp / boss.maxHp;
          const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
          grd.addColorStop(0, '#ff2e63'); grd.addColorStop(1, '#ff9a3c');
          ctx.fillStyle = grd;
          ctx.fillRect(bx, by + 10, bw * r, 8);
          ctx.fillStyle = '#ffd0dc';
          ctx.font = '700 10px Orbitron, "Segoe UI", sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('TITAN', bx, by + 2);
          ctx.textAlign = 'right';
          ctx.fillText(U.fmt(boss.hp) + ' / ' + U.fmt(boss.maxHp), bx + bw, by + 2);
        }
      }
      // wave banner
      if (this.banner && !this.demo) {
        const b = this.banner;
        const a = b.t < 0.3 ? b.t / 0.3 : b.t > 2 ? Math.max(0, 1 - (b.t - 2) / 0.6) : 1;
        const sc = 1 + Math.max(0, 0.3 - b.t) * 0.8;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(W / 2, H * 0.42);
        ctx.scale(sc, sc);
        const col = b.boss ? '#ff2e63' : this.map.theme.accent;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(-W / 2, -46, W, b.sub ? 100 : 80);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '900 54px Orbitron, "Segoe UI", sans-serif';
        ctx.shadowColor = col;
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(b.text, 0, -6);
        ctx.shadowBlur = 0;
        if (b.sub) {
          ctx.font = '700 18px Orbitron, "Segoe UI", sans-serif';
          ctx.fillStyle = col;
          ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 10));
          ctx.fillText(b.sub, 0, 36);
        }
        ctx.restore();
      }
    }
  }

  /* ------------------------ static background --------------------------- */
  function renderBackground(game, k) {
    const map = game.map, th = map.theme;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * k));
    c.height = Math.max(1, Math.round(H * k));
    const g = c.getContext('2d');
    g.scale(k, k);
    const rng = U.mulberry32(map.seed * 13);

    // base gradient
    let grd = g.createRadialGradient(W * 0.5, H * 0.45, 60, W * 0.5, H * 0.5, W * 0.75);
    grd.addColorStop(0, th.bg2);
    grd.addColorStop(1, th.bg1);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    // nebula blobs
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = rng() * W, y = rng() * H, r = 150 + rng() * 250;
      const col = i % 2 ? th.accent : th.decor;
      grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, U.rgba(col, 0.07));
      grd.addColorStop(1, U.rgba(col, 0));
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';

    // grid + build pads
    g.strokeStyle = U.rgba(th.accent, 0.06);
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x += TILE) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += TILE) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
      if (game.grid[r][cc] !== FREE) continue;
      g.fillStyle = U.rgba(th.accent, 0.018 + rng() * 0.02);
      g.fillRect(cc * TILE + 4, r * TILE + 4, TILE - 8, TILE - 8);
      g.fillStyle = U.rgba(th.accent, 0.12);
      g.fillRect(cc * TILE + 4, r * TILE + 4, 2, 2);
    }

    // path
    const strokePaths = () => {
      for (const p of game.paths) {
        g.beginPath();
        g.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
        g.stroke();
      }
    };
    g.lineJoin = 'miter';
    g.lineCap = 'square';
    g.shadowColor = th.accent;
    g.shadowBlur = 28;
    g.strokeStyle = U.rgba(th.accent, 0.9);
    g.lineWidth = TILE + 4;
    strokePaths();
    g.shadowBlur = 0;
    g.strokeStyle = th.path;
    g.lineWidth = TILE - 2;
    strokePaths();
    g.strokeStyle = U.rgba(th.accent, 0.07);
    g.lineWidth = TILE - 14;
    strokePaths();
    g.strokeStyle = U.rgba(th.accent, 0.12);
    g.lineWidth = 1;
    g.setLineDash([10, 10]);
    strokePaths();
    g.setLineDash([]);
    // path edge lines
    g.lineCap = 'butt';

    // decor crystals
    for (const d of game.decor) {
      const x = d.c * TILE + TILE / 2, y = d.r * TILE + TILE / 2;
      g.globalCompositeOperation = 'lighter';
      U.glow(g, th.decor, x, y, d.size * 3, 0.5);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(x + 3, y + d.size * 0.6, d.size, d.size * 0.4, 0, 0, U.TAU); g.fill();
      for (let i = 0; i < d.n; i++) {
        const a = d.rot + i * 1.3, h = d.size * (1.4 - i * 0.2);
        const bx = x + Math.cos(a) * 5, by = y + Math.sin(a) * 3;
        g.fillStyle = U.rgba(th.decor, 0.35 + i * 0.1);
        g.strokeStyle = U.rgba(th.decor, 0.95);
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(bx, by - h);
        g.lineTo(bx + h * 0.32, by - h * 0.25);
        g.lineTo(bx, by + h * 0.25);
        g.lineTo(bx - h * 0.32, by - h * 0.25);
        g.closePath();
        g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.beginPath(); g.moveTo(bx, by - h); g.lineTo(bx, by + h * 0.2); g.stroke();
      }
    }

    // vignette
    grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    return c;
  }

  /* ------------------------- AI helpers (demo/tests) --------------------- */
  /** Score every free tile by how much path is inside a given range. */
  TD.spotScores = function (game, range) {
    const samples = [];
    for (const p of game.paths) {
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        const d = U.dist(a.x, a.y, b.x, b.y);
        for (let s = 0; s < d; s += 20) {
          const x = a.x + (b.x - a.x) * (s / d), y = a.y + (b.y - a.y) * (s / d);
          if (x >= 0 && y >= 0 && x <= W && y <= H) samples.push(x, y);
        }
      }
    }
    const out = [];
    const r2 = range * range;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!game.canBuild(c, r)) continue;
      const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
      let n = 0;
      for (let i = 0; i < samples.length; i += 2) if (U.dist2(x, y, samples[i], samples[i + 1]) <= r2) n++;
      out.push({ c, r, score: n });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  /** Places a nice mix of towers for the menu background demo. */
  TD.autoPlaceDemo = function (game) {
    const mix = ['pulse', 'cannon', 'frost', 'laser', 'tesla', 'pulse', 'rail', 'cannon', 'laser', 'pulse', 'tesla', 'frost'];
    for (const type of mix) {
      const def = TD.TOWERS[type];
      const spots = TD.spotScores(game, def.range);
      if (!spots.length) break;
      const s = spots[Math.floor(Math.random() * Math.min(4, spots.length))];
      game.gold = 99999;
      const t = game.placeTower(type, s.c, s.r);
      if (t) { t.level = 1 + Math.floor(Math.random() * 3); t.refresh(); t.buildT = 1; }
    }
    game.particles.list.length = 0;
  };

  TD.Game = Game;
  TD.renderBackground = renderBackground;
})(window.TD);
