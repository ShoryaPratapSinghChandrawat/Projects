/* ============================================================
   Neon Bastion - headless simulation test
   Runs the real game logic from index.html in Node (no browser) with a simple
   AI player on every map, checking for crashes / bad states and
   reporting how far the AI gets (balance check).

   Usage:  node tests/simulate.js [runsPerMap]
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGame() {
  const ctx = {
    console, Math, JSON, Date, Set, Map, Array, Object, Number, String, Infinity, NaN,
    setTimeout: (fn) => fn(), // run immediately in tests
    localStorage: (() => { const s = {}; return { getItem: (k) => s[k] || null, setItem: (k, v) => { s[k] = String(v); } }; })()
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  // The whole game lives in index.html. Pull out the game-logic <script> blocks by id
  // (the UI / audio / main-loop blocks need a real browser, so they are skipped).
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['utils', 'data', 'particles', 'entities', 'game']) {
    const m = html.match(new RegExp('<script id="js-' + id + '">([\\s\\S]*?)</script>'));
    if (!m) throw new Error('Could not find <script id="js-' + id + '"> in index.html');
    vm.runInContext(m[1], ctx, { filename: 'index.html#' + id });
  }
  ctx.TD.sfxBlocked = true;
  return ctx.TD;
}

const TD = loadGame();
const assert = (cond, msg) => { if (!cond) throw new Error('ASSERTION FAILED: ' + msg); };

/* ---------------- unit checks ---------------- */
function unitTests() {
  // every map: path tiles are connected, in bounds where expected, and waypoints are axis-aligned
  TD.MAPS.forEach((m, i) => {
    for (const p of m.paths) {
      for (let j = 0; j < p.length - 1; j++) {
        const [c0, r0] = p[j], [c1, r1] = p[j + 1];
        assert(c0 === c1 || r0 === r1, m.name + ' segment ' + j + ' is diagonal');
      }
    }
    const g = new TD.Game(i, 'campaign');
    let free = 0;
    for (const row of g.grid) for (const v of row) if (v === 0) free++;
    assert(free > 200, m.name + ' has enough buildable tiles');
    // waves are generated and sorted
    for (let w = 1; w <= m.waves + 10; w++) {
      const ev = TD.makeWave(m, w);
      assert(ev.length > 0, 'wave ' + w + ' non-empty');
      for (let k = 1; k < ev.length; k++) assert(ev[k].t >= ev[k - 1].t, 'wave events sorted');
      for (const e of ev) {
        assert(TD.ENEMIES[e.type], 'enemy type exists: ' + e.type);
        assert(e.path >= 0 && e.path < m.paths.length, 'path index valid');
      }
      if (w % 10 === 0) assert(ev.some((e) => e.type === 'boss'), 'boss on wave ' + w);
    }
  });

  // economy actions
  const g = new TD.Game(0, 'campaign');
  const spot = TD.spotScores(g, 130)[0];
  const startGold = g.gold;
  const t = g.placeTower('pulse', spot.c, spot.r);
  assert(t && g.gold === startGold - 100, 'placing costs gold');
  assert(!g.placeTower('pulse', spot.c, spot.r), 'cannot stack towers');
  const pathTile = TD.MAPS[0].paths[0][1];
  assert(!g.placeTower('pulse', pathTile[0], pathTile[1]), 'cannot build on path');
  assert(!g.placeTower('pulse', -1, 0), 'cannot build out of bounds');
  g.gold = 10;
  assert(!g.placeTower('rail', 0, 0), 'cannot build without gold');
  g.gold = 10000;
  assert(g.upgradeTower(t) && t.level === 2, 'upgrade to 2');
  assert(g.upgradeTower(t) && t.level === 3, 'upgrade to 3');
  assert(!g.upgradeTower(t) && t.level === 3, 'max level 3');
  const inv = t.invested, before = g.gold;
  g.sellTower(t);
  assert(g.gold === before + Math.floor(inv * 0.7), 'sell refunds 70%');
  assert(g.canBuild(spot.c, spot.r), 'tile free after sell');
  assert(g.towers.length === 0, 'tower removed');

  // wave calling rules
  const g2 = new TD.Game(0, 'campaign');
  assert(g2.startNextWave(), 'can start wave 1');
  assert(!g2.startNextWave(), 'cannot call next while spawning');

  // damage rules
  const g3 = new TD.Game(0, 'campaign');
  const brute = new TD.Enemy(g3, 'brute', 0, 1);
  g3.enemies.push(brute);
  const hp0 = brute.hp;
  brute.damage(100, {});
  assert(Math.abs(hp0 - brute.hp - 70) < 1e-6, 'armor reduces damage by 30%');
  brute.damage(100, { pierce: true });
  assert(Math.abs(hp0 - brute.hp - 170) < 1e-6, 'pierce ignores armor');
  const sh = new TD.Enemy(g3, 'shield', 0, 1);
  const s0 = sh.shield, h0 = sh.hp;
  sh.damage(10, {});
  assert(sh.shield === s0 - 10 && sh.hp === h0, 'shield absorbs first');
  sh.damage(10, { ignoreShield: true });
  assert(sh.hp === h0 - 10, 'tesla ignores shield');

  // splitter spawns children on death
  const g4 = new TD.Game(0, 'campaign');
  const sp = new TD.Enemy(g4, 'splitter', 0, 1);
  g4.enemies.push(sp);
  sp.damage(1e9, {});
  assert(!sp.alive && g4.enemies.filter((e) => e.type === 'swarm').length === 3, 'splitter splits into 3');

  // leaking ends the game
  const g5 = new TD.Game(0, 'campaign');
  g5.lives = 1;
  const d = new TD.Enemy(g5, 'drone', 0, 1);
  g5.enemies.push(d);
  for (let i = 0; i < 60 * 120 && g5.state === 'playing'; i++) g5.update(1 / 60);
  assert(g5.state === 'lost' && g5.lives === 0, 'game lost when lives run out');

  console.log('Unit tests: all passed');
}

/* ---------------- AI simulation ---------------- */
const BUILD_CYCLE = ['pulse', 'pulse', 'cannon', 'frost', 'laser', 'pulse', 'tesla', 'cannon', 'rail', 'laser', 'frost', 'tesla', 'rail'];

function aiSpend(g, st) {
  for (let guard = 0; guard < 20; guard++) {
    const nextType = BUILD_CYCLE[st.i % BUILD_CYCLE.length];
    const nextCost = TD.TOWERS[nextType].cost;
    // cheapest upgrade
    let up = null;
    for (const t of g.towers) if (t.level < 3 && (!up || t.upgradeCost < up.upgradeCost)) up = t;
    const preferUpgrade = up && g.towers.length >= 5 && up.upgradeCost <= nextCost * 1.1;
    if (preferUpgrade) {
      if (g.gold >= up.upgradeCost) { g.upgradeTower(up); continue; }
      return;
    }
    if (g.gold < nextCost) return;
    const spots = TD.spotScores(g, TD.TOWERS[nextType].range);
    if (!spots.length) return;
    if (g.placeTower(nextType, spots[0].c, spots[0].r)) st.i++;
    else return;
  }
}

function simulate(mapIndex, mode, maxWaves) {
  const g = new TD.Game(mapIndex, mode);
  const st = { i: 0 };
  const dt = 1 / 60;
  let steps = 0, maxEnemies = 0, maxProj = 0;
  const limit = 60 * 60 * 60; // 60 minutes of game time
  while (g.state === 'playing' && steps < limit) {
    if (steps % 30 === 0) aiSpend(g, st);
    if (!g.waveActive && g.canCallWave()) {
      if (maxWaves && g.wave >= maxWaves) break;
      g.startNextWave();
    }
    g.update(dt);
    steps++;
    maxEnemies = Math.max(maxEnemies, g.enemies.length);
    maxProj = Math.max(maxProj, g.projectiles.length);
    // sanity checks
    if (steps % 120 === 0) {
      assert(Number.isFinite(g.gold) && g.gold >= 0, 'gold valid');
      assert(g.lives >= 0 && g.lives <= g.maxLives, 'lives valid');
      for (const e of g.enemies) {
        assert(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp), 'enemy state finite');
      }
    }
  }
  return {
    map: g.map.name, mode, state: g.state, wave: g.wave, lives: g.lives + '/' + g.maxLives,
    towers: g.towers.length, avgLvl: (g.towers.reduce((a, t) => a + t.level, 0) / Math.max(1, g.towers.length)).toFixed(1),
    minutes: (steps / 3600).toFixed(1), maxEnemies, maxProj, kills: g.kills, score: g.score
  };
}

unitTests();
const runs = Number(process.argv[2] || 1);
const rows = [];
for (let i = 0; i < TD.MAPS.length; i++) for (let r = 0; r < runs; r++) rows.push(simulate(i, 'campaign'));
rows.push(simulate(0, 'endless', 45));
console.table(rows);
console.log('Simulation finished without errors.');
