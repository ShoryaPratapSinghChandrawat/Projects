/* ============================================================
   Neon Bastion - data.js
   All game content: towers, enemies, maps, wave generator,
   plus settings / save data (localStorage).
   ============================================================ */
(function (TD) {
  'use strict';
  const U = TD.U;

  const TILE = 40, COLS = 32, ROWS = 18;
  TD.C = { TILE, COLS, ROWS, W: COLS * TILE, H: ROWS * TILE };

  /* ------------------------------ TOWERS ------------------------------ */
  TD.TOWERS = {
    pulse: {
      id: 'pulse', name: 'Pulse Blaster', key: '1', cost: 100, color: '#35e0ff',
      range: 135, rate: 2.6, damage: 11, air: true, kind: 'bullet', speed: 640,
      desc: 'Rapid-fire energy bolts. Cheap and reliable. Hits air.'
    },
    cannon: {
      id: 'cannon', name: 'Nova Cannon', key: '2', cost: 175, color: '#ff9a3c',
      range: 150, rate: 0.75, damage: 42, splash: 62, air: false, kind: 'shell', speed: 360,
      desc: 'Explosive shells deal splash damage. Cannot hit flying enemies.'
    },
    frost: {
      id: 'frost', name: 'Cryo Spire', key: '3', cost: 150, color: '#9fd0ff',
      range: 120, rate: 1.1, damage: 7, splash: 52, slow: 0.4, slowDur: 2.2, air: true, kind: 'frost', speed: 440,
      desc: 'Freezing blasts slow down groups of enemies. Hits air.'
    },
    laser: {
      id: 'laser', name: 'Prism Laser', key: '4', cost: 260, color: '#ff3cac',
      range: 165, dps: 34, air: true, kind: 'beam',
      desc: 'Continuous beam that heats up: up to 3x damage while locked on one target.'
    },
    tesla: {
      id: 'tesla', name: 'Arc Tesla', key: '5', cost: 300, color: '#c77dff',
      range: 130, rate: 0.9, damage: 30, chains: 4, chainRange: 95, air: true, kind: 'chain',
      desc: 'Lightning jumps between several enemies. Ignores energy shields.'
    },
    rail: {
      id: 'rail', name: 'Rail Lancer', key: '6', cost: 420, color: '#7dffb0',
      range: 330, rate: 0.33, damage: 200, air: true, kind: 'rail',
      desc: 'Huge range. Piercing slug hits every enemy in a line and ignores armor.'
    }
  };
  TD.TOWER_ORDER = ['pulse', 'cannon', 'frost', 'laser', 'tesla', 'rail'];
  TD.MAX_LEVEL = 3;
  TD.SELL_RATE = 0.7;

  TD.upgradeCost = function (def, level) {
    if (level === 1) return Math.round(def.cost * 0.85);
    if (level === 2) return Math.round(def.cost * 1.5);
    return Infinity;
  };

  TD.towerStats = function (def, level) {
    const i = U.clamp(level, 1, TD.MAX_LEVEL) - 1;
    const dm = [1, 1.65, 2.6][i], rm = [1, 1.12, 1.25][i], fm = [1, 1.12, 1.28][i];
    return {
      damage: (def.damage || 0) * dm,
      dps: (def.dps || 0) * dm,
      range: def.range * rm,
      rate: (def.rate || 0) * fm,
      splash: def.splash ? def.splash * (1 + 0.1 * i) : 0,
      slow: def.slow ? Math.min(0.7, def.slow + 0.08 * i) : 0,
      slowDur: def.slowDur || 0,
      chains: def.chains ? def.chains + i : 0,
      chainRange: def.chainRange || 0
    };
  };

  /* ------------------------------ ENEMIES ----------------------------- */
  TD.ENEMIES = {
    drone:    { name: 'Drone',     hp: 40,   speed: 62,  reward: 6,   color: '#4dfcff', size: 11, shape: 'square',  desc: 'Standard unit.' },
    runner:   { name: 'Runner',    hp: 28,   speed: 120, reward: 6,   color: '#fff04d', size: 9,  shape: 'tri',     desc: 'Very fast but fragile.' },
    swarm:    { name: 'Swarmling', hp: 15,   speed: 90,  reward: 2,   color: '#9dff4d', size: 7,  shape: 'tri',     desc: 'Attacks in big packs.' },
    brute:    { name: 'Brute',     hp: 230,  speed: 36,  reward: 16,  color: '#ff5e5e', size: 16, shape: 'hex',     armor: 0.3, lives: 2, desc: 'Slow, armored (-30% damage). Costs 2 lives.' },
    flyer:    { name: 'Wraith',    hp: 55,   speed: 80,  reward: 9,   color: '#ff7dfa', size: 12, shape: 'wing',    air: true, desc: 'Flying. Nova Cannons cannot hit it.' },
    shield:   { name: 'Aegis',     hp: 90,   speed: 54,  reward: 12,  color: '#4d9dff', size: 13, shape: 'circle',  shield: 80, desc: 'Regenerating energy shield.' },
    healer:   { name: 'Mender',    hp: 80,   speed: 52,  reward: 14,  color: '#4dff9d', size: 12, shape: 'cross',   heal: 0.05, healRange: 85, desc: 'Repairs nearby enemies.' },
    splitter: { name: 'Splitter',  hp: 120,  speed: 46,  reward: 8,   color: '#ffb14d', size: 14, shape: 'diamond', split: 'swarm', splitCount: 3, desc: 'Splits into swarmlings when destroyed.' },
    boss:     { name: 'Titan',     hp: 1600, speed: 26,  reward: 200, color: '#ff2e63', size: 28, shape: 'boss',    armor: 0.3, lives: 10, boss: true, desc: 'Massive armored boss (-30% damage). Costs 10 lives.' }
  };
  /** Wave at which each enemy type starts appearing. */
  TD.ENEMY_UNLOCK = { drone: 1, runner: 3, swarm: 4, brute: 6, flyer: 8, shield: 10, healer: 12, splitter: 14 };
  const BASE_COUNT = { drone: 8, runner: 7, swarm: 14, brute: 3, flyer: 6, shield: 5, healer: 3, splitter: 4 };
  const BASE_INTERVAL = { drone: 0.8, runner: 0.55, swarm: 0.22, brute: 1.6, flyer: 0.8, shield: 1.0, healer: 1.3, splitter: 1.2, boss: 5 };

  TD.hpScale = (w) => (1 + 0.1 * (w - 1)) * Math.pow(1.04, Math.max(0, w - 1));
  TD.rewardScale = (w) => 1 + 0.04 * (w - 1);
  TD.waveBonus = (w) => 20 + w * 4;
  TD.earlyBonus = (w) => 10 + w * 2;

  /* ------------------------------- MAPS ------------------------------- */
  // Paths are lists of grid waypoints [col,row]; segments must be straight.
  TD.MAPS = [
    {
      id: 'valley', name: 'Neon Valley', diff: 'Easy', diffLevel: 1, waves: 20,
      gold: 300, lives: 25, hpMul: 0.9, speedMul: 1, seed: 11,
      theme: { bg1: '#040817', bg2: '#0b1f45', accent: '#35e0ff', path: '#0a1530', decor: '#2a6bff' },
      paths: [[[-1, 3], [6, 3], [6, 13], [13, 13], [13, 4], [20, 4], [20, 14], [27, 14], [27, 8], [32, 8]]]
    },
    {
      id: 'canyon', name: 'Crystal Canyon', diff: 'Medium', diffLevel: 2, waves: 25,
      gold: 280, lives: 20, hpMul: 1.0, speedMul: 1, seed: 23,
      theme: { bg1: '#0d0416', bg2: '#2b0b45', accent: '#ff3cac', path: '#1a0a2b', decor: '#b44dff' },
      paths: [[[-1, 9], [4, 9], [4, 2], [11, 2], [11, 15], [17, 15], [17, 6], [23, 6], [23, 12], [28, 12], [28, 4], [32, 4]]]
    },
    {
      id: 'rift', name: 'Twin Rift', diff: 'Hard', diffLevel: 3, waves: 30,
      gold: 360, lives: 20, hpMul: 1.4, speedMul: 1.15, seed: 37,
      theme: { bg1: '#140703', bg2: '#45200b', accent: '#ff9a3c', path: '#241108', decor: '#ff5e3a' },
      paths: [
        [[-1, 3], [9, 3], [9, 8], [18, 8], [18, 3], [25, 3], [25, 11], [32, 11]],
        [[-1, 14], [14, 14], [14, 8], [18, 8], [18, 3], [25, 3], [25, 11], [32, 11]]
      ]
    },
    {
      id: 'spiral', name: 'Void Spiral', diff: 'Expert', diffLevel: 4, waves: 30,
      gold: 400, lives: 15, hpMul: 1.3, speedMul: 1.3, seed: 53,
      theme: { bg1: '#021009', bg2: '#073a2c', accent: '#7dffb0', path: '#05201a', decor: '#2dffc4' },
      paths: [[[-1, 2], [29, 2], [29, 15], [3, 15], [3, 6], [24, 6], [24, 11], [10, 11]]]
    }
  ];

  /* --------------------------- WAVE GENERATOR ------------------------- */
  /**
   * Returns a sorted list of spawn events: {t, type, path}.
   * Deterministic for a given map + wave number.
   */
  TD.makeWave = function (map, w) {
    const rng = U.mulberry32(map.seed * 1000 + w * 7919);
    const events = [];
    const nPaths = map.paths.length;
    let t = 0, pathCounter = 0;
    const ivMul = Math.max(0.45, 1 - w * 0.012);

    const add = (type, count, interval, gap) => {
      for (let i = 0; i < count; i++) {
        events.push({ t: t + i * interval, type: type, path: pathCounter++ % nPaths });
      }
      t += Math.max(0, count - 1) * interval + gap;
    };

    const types = Object.keys(TD.ENEMY_UNLOCK);
    const unlocked = types.filter((k) => TD.ENEMY_UNLOCK[k] <= w);
    const newType = w > 1 ? types.find((k) => TD.ENEMY_UNLOCK[k] === w) : null;

    if (w === 1) add('drone', 8, 1.0, 0);
    else if (w === 2) add('drone', 12, 0.85, 0);
    else {
      const groups = Math.min(2 + Math.floor(w / 5), 6);
      for (let g = 0; g < groups; g++) {
        const type = g === 0 && newType ? newType : unlocked[Math.floor(rng() * unlocked.length)];
        const count = Math.max(1, Math.round(BASE_COUNT[type] * (0.6 + w * 0.035) * (0.8 + rng() * 0.4)));
        add(type, count, BASE_INTERVAL[type] * ivMul, 1.2 + rng() * 1.0);
      }
    }
    if (w % 10 === 0) {
      const bosses = Math.floor(w / 20) + 1;
      t += 1.5;
      add('boss', bosses, BASE_INTERVAL.boss, 0);
    }
    events.sort((a, b) => a.t - b.t);
    return events;
  };

  /** Summary {type: count} for the "next wave" preview. */
  TD.waveSummary = function (map, w) {
    const out = {};
    for (const e of TD.makeWave(map, w)) out[e.type] = (out[e.type] || 0) + 1;
    return out;
  };

  /* ---------------------------- SAVE / SETTINGS ------------------------ */
  const SAVE_KEY = 'neonBastion.v1';
  const defaults = {
    settings: { music: 0.5, sfx: 0.7, quality: 'high', shake: true, texts: true },
    records: {}
  };
  function load() {
    try {
      const raw = window.localStorage && localStorage.getItem(SAVE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      const d = JSON.parse(raw);
      return {
        settings: Object.assign({}, defaults.settings, d.settings || {}),
        records: d.records || {}
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(defaults));
    }
  }
  TD.save = load();
  TD.settings = TD.save.settings;
  TD.persist = function () {
    try {
      if (window.localStorage) localStorage.setItem(SAVE_KEY, JSON.stringify(TD.save));
    } catch (e) { /* storage unavailable (private mode / file://) - ignore */ }
  };
  TD.resetProgress = function () {
    TD.save.records = {};
    TD.persist();
  };
  /** Record a finished game. Returns true if it was a new best. */
  TD.recordResult = function (mapId, mode, data) {
    const key = mapId + ':' + mode;
    const r = TD.save.records[key] || { bestWave: 0, bestScore: 0, stars: 0, wins: 0 };
    let best = false;
    if (data.wave > r.bestWave) { r.bestWave = data.wave; best = true; }
    if (data.score > r.bestScore) { r.bestScore = data.score; best = true; }
    if (data.stars > r.stars) r.stars = data.stars;
    if (data.won) r.wins++;
    TD.save.records[key] = r;
    TD.persist();
    return best;
  };
})(window.TD);
