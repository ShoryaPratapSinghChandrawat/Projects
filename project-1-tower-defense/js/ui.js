/* ============================================================
   Neon Bastion - ui.js
   Menus, HUD, shop, tower panel, keyboard & mouse input.
   ============================================================ */
(function (TD) {
  'use strict';
  const U = TD.U;
  const { TILE, W, H } = TD.C;
  const $ = (id) => document.getElementById(id);
  const click = () => TD.Audio.play('click');

  const UI = {
    screen: 'menu-main',
    stack: [],
    levelMode: 'campaign',
    endShown: false,
    shopButtons: {},
    cache: new Map()
  };

  /* ------------------------------ helpers ------------------------------ */
  // Only touch the DOM when content really changes (one shared cache for text & html).
  function setText(el, v) {
    const key = 't:' + v;
    if (el._c !== key) { el._c = key; el.textContent = String(v); }
  }
  function setHTML(el, v) {
    const key = 'h:' + v;
    if (el._c !== key) { el._c = key; el.innerHTML = v; }
  }
  function flashClass(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart animation
    el.classList.add(cls);
  }
  function drawTowerIcon(canvas, type, level) {
    const g = canvas.getContext('2d');
    const k = canvas.width / 48;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, 48, 48);
    TD.drawTower(g, TD.TOWERS[type], level || 1, 24, 24, -Math.PI / 4, 0.5, 0, true, 1);
  }
  function drawEnemyIcon(canvas, type) {
    const def = TD.ENEMIES[type];
    const g = canvas.getContext('2d');
    const k = canvas.width / 40;
    const fit = Math.min(1, 13 / def.size);
    g.setTransform(k * fit, 0, 0, k * fit, 0, 0);
    g.clearRect(0, 0, 40 / fit, 40 / fit);
    const e = Object.create(TD.Enemy.prototype);
    Object.assign(e, {
      def: def, size: def.size, air: false, x: 20 / fit, y: 20 / fit, dirX: 0.7, dirY: -0.7,
      rot: 0.6, bob: 0, flashT: 0, slowAmt: 0, shield: def.shield ? 1 : 0, maxShield: 1
    });
    e.draw(g, 0.3, true);
  }
  function starsHTML(n) {
    let s = '';
    for (let i = 0; i < 3; i++) s += '<i class="star' + (i < n ? ' on' : '') + '"></i>';
    return s;
  }
  const diffColor = (lvl) => ['#7dffb0', '#35e0ff', '#ff9a3c', '#ff3c6e'][lvl - 1] || '#fff';

  /** Stats rows for a tower at a level (and optional next level). */
  function statRows(def, level) {
    const s = TD.towerStats(def, level);
    const n = level < TD.MAX_LEVEL ? TD.towerStats(def, level + 1) : null;
    const row = (label, a, b, fmt) => {
      fmt = fmt || ((v) => Math.round(v));
      const next = b !== undefined && b !== null && fmt(b) !== fmt(a) ? ' <i>&rsaquo; ' + fmt(b) + '</i>' : '';
      return '<div>' + label + ' <b>' + fmt(a) + '</b>' + next + '</div>';
    };
    const f1 = (v) => v.toFixed(1);
    const pct = (v) => Math.round(v * 100) + '%';
    let out = '';
    switch (def.kind) {
      case 'bullet':
        out += row('DMG', s.damage, n && n.damage);
        out += row('RATE', s.rate, n && n.rate, f1);
        out += row('DPS', s.damage * s.rate, n && n.damage * n.rate);
        break;
      case 'shell':
        out += row('DMG', s.damage, n && n.damage);
        out += row('SPLASH', s.splash, n && n.splash);
        out += row('RATE', s.rate, n && n.rate, f1);
        break;
      case 'frost':
        out += row('SLOW', s.slow, n && n.slow, pct);
        out += row('DMG', s.damage, n && n.damage);
        out += row('AREA', s.splash, n && n.splash);
        break;
      case 'beam':
        out += row('DPS', s.dps, n && n.dps);
        out += row('MAX', s.dps * 3, n && n.dps * 3);
        break;
      case 'chain':
        out += row('DMG', s.damage, n && n.damage);
        out += row('CHAINS', s.chains, n && n.chains);
        out += row('RATE', s.rate, n && n.rate, f1);
        break;
      case 'rail':
        out += row('DMG', s.damage, n && n.damage);
        out += row('RATE', s.rate, n && n.rate, (v) => v.toFixed(2));
        out += '<div>PIERCE <b>&infin;</b></div>';
        break;
    }
    out += row('RANGE', s.range, n && n.range);
    out += '<div>AIR <b>' + (def.air ? 'YES' : 'NO') + '</b></div>';
    return out;
  }

  /* ------------------------------- screens ----------------------------- */
  const OVERLAYS = ['menu-main', 'menu-levels', 'menu-howto', 'menu-settings', 'menu-credits', 'menu-pause', 'menu-end'];

  UI.showScreen = function (id) {
    for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id);
    UI.screen = id;
    if (id === 'menu-levels') UI.buildLevelCards();
    if (id === 'menu-settings') UI.syncSettings();
    if (id === 'menu-main') UI.buildRecords();
  };
  UI.navigate = function (id) {
    if (UI.screen) UI.stack.push(UI.screen);
    UI.showScreen(id);
  };
  UI.back = function () {
    const prev = UI.stack.pop();
    UI.showScreen(prev || (TD.game ? 'menu-pause' : 'menu-main'));
  };
  UI.hideAll = function () {
    for (const o of OVERLAYS) $(o).classList.add('hidden');
    UI.screen = null;
    UI.stack = [];
  };
  UI.overlayOpen = function () {
    return UI.screen !== null || !$('menu-confirm').classList.contains('hidden');
  };

  UI.confirm = function (title, text, onYes) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('menu-confirm').classList.remove('hidden');
    UI._confirmYes = onYes;
  };
  UI.closeConfirm = function () {
    $('menu-confirm').classList.add('hidden');
    UI._confirmYes = null;
  };

  UI.toast = function (msg, color) {
    const box = $('toast');
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.style.color = color || '#ff6b7a';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
  };

  /* ------------------------------- game flow --------------------------- */
  UI.startGame = function (mapIndex, mode) {
    TD.game = new TD.Game(mapIndex, mode, false);
    TD.demo = null;
    UI.endShown = false;
    UI.hideAll();
    $('sb-menu').classList.add('hidden');
    $('sb-game').classList.remove('hidden');
    $('sidebar').classList.remove('locked');
    setText($('hud-map'), TD.game.map.name.toUpperCase());
    UI.lastLives = TD.game.lives;
    UI.lastWave = -1;
    TD.resize();
  };
  UI.quitToMenu = function () {
    TD.game = null;
    TD.makeDemo();
    $('sb-menu').classList.remove('hidden');
    $('sb-game').classList.add('hidden');
    $('sidebar').classList.remove('locked');
    UI.stack = [];
    UI.showScreen('menu-main');
  };
  UI.pause = function () {
    const g = TD.game;
    if (!g || g.state !== 'playing' || UI.screen) return;
    g.paused = true;
    UI.stack = [];
    UI.showScreen('menu-pause');
    $('sidebar').classList.add('locked');
  };
  UI.resume = function () {
    const g = TD.game;
    if (!g) return;
    g.paused = false;
    UI.hideAll();
    $('sidebar').classList.remove('locked');
  };
  UI.showEnd = function () {
    const g = TD.game;
    UI.endShown = true;
    const won = g.state === 'won';
    const title = $('end-title');
    title.textContent = won ? 'SECTOR CLEARED' : 'CORE DESTROYED';
    title.className = won ? 'win' : 'lose';
    $('end-stars').innerHTML = won ? starsHTML(g.stars) : '';
    $('end-stars').classList.toggle('hidden', !won);
    const r = g.result || { wave: g.wave, kills: g.kills, score: g.score };
    setText($('end-waves'), r.wave + (g.mode === 'campaign' ? ' / ' + g.map.waves : ''));
    setText($('end-kills'), g.kills);
    setText($('end-score'), U.fmt(g.score));
    $('end-best').classList.toggle('hidden', !(r.newBest));
    $('btn-endless').classList.toggle('hidden', !(won && g.mode === 'campaign'));
    UI.stack = [];
    UI.showScreen('menu-end');
    $('sidebar').classList.add('locked');
  };
  UI.continueEndless = function () {
    const g = TD.game;
    if (!g || g.state !== 'won') return;
    g.mode = 'endless';
    g.totalWaves = Infinity;
    g.state = 'playing';
    g.result = null;
    UI.endShown = false;
    UI.hideAll();
    $('sidebar').classList.remove('locked');
    UI.toast('Endless mode: how long can you last?', '#35e0ff');
  };

  /* --------------------------- tower actions --------------------------- */
  UI.selectShop = function (type) {
    const g = TD.game;
    if (!g || g.state !== 'playing') return;
    if (g.placing === type) { g.placing = null; return; }
    g.placing = type;
    g.selected = null;
    click();
  };
  UI.upgradeSelected = function () {
    const g = TD.game;
    if (g && g.selected) g.upgradeTower(g.selected);
  };
  UI.sellSelected = function () {
    const g = TD.game;
    if (g && g.selected) g.sellTower(g.selected);
  };
  UI.cycleTarget = function () {
    const g = TD.game;
    if (g && g.selected) { g.selected.cycleMode(); click(); }
  };
  UI.callWave = function () {
    const g = TD.game;
    if (g && g.startNextWave()) click();
  };
  UI.cycleSpeed = function () {
    const g = TD.game;
    if (!g) return;
    g.speed = g.speed >= 3 ? 1 : g.speed + 1;
    click();
  };
  UI.toggleAuto = function () {
    const g = TD.game;
    if (!g) return;
    g.autoWave = !g.autoWave;
    if (g.autoWave && !g.waveActive && g.canCallWave()) g.autoTimer = 1.2;
    if (!g.autoWave) g.autoTimer = -1;
    click();
  };

  /* ------------------------------- building ---------------------------- */
  UI.buildShop = function () {
    const shop = $('shop');
    shop.innerHTML = '';
    for (const type of TD.TOWER_ORDER) {
      const def = TD.TOWERS[type];
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.style.setProperty('--c', def.color);
      b.title = def.name + ' - ' + def.desc;
      b.innerHTML = '<span class="s-key">' + def.key + '</span><canvas width="96" height="96"></canvas>' +
        '<span class="s-name">' + def.name.split(' ')[0] + '</span><span class="s-cost"><i class="gem"></i> ' + def.cost + '</span>';
      drawTowerIcon(b.querySelector('canvas'), type, 1);
      b.addEventListener('click', () => UI.selectShop(type));
      b.addEventListener('mouseenter', () => { UI.hoverShop = type; });
      b.addEventListener('mouseleave', () => { if (UI.hoverShop === type) UI.hoverShop = null; });
      shop.appendChild(b);
      UI.shopButtons[type] = b;
    }
  };

  UI.buildHowTo = function () {
    const tw = $('howto-towers');
    tw.innerHTML = '';
    for (const type of TD.TOWER_ORDER) {
      const def = TD.TOWERS[type];
      const d = document.createElement('div');
      d.className = 'howto-item';
      d.innerHTML = '<canvas width="80" height="80"></canvas><div><b>' + def.name + ' <small style="color:#ffd34d"><i class="gem"></i>' + def.cost + '</small></b><span>' + def.desc + '</span></div>';
      drawTowerIcon(d.querySelector('canvas'), type, 2);
      tw.appendChild(d);
    }
    const en = $('howto-enemies');
    en.innerHTML = '';
    for (const type of Object.keys(TD.ENEMIES)) {
      const def = TD.ENEMIES[type];
      const d = document.createElement('div');
      d.className = 'howto-item';
      d.innerHTML = '<canvas width="80" height="80"></canvas><div><b>' + def.name + '</b><span>' + def.desc + '</span></div>';
      drawEnemyIcon(d.querySelector('canvas'), type);
      en.appendChild(d);
    }
  };

  UI.buildLevelCards = function () {
    const box = $('level-cards');
    box.innerHTML = '';
    TD.MAPS.forEach((m, i) => {
      const rec = TD.save.records[m.id + ':' + UI.levelMode];
      const card = document.createElement('button');
      card.className = 'level-card';
      card.style.setProperty('--c', diffColor(m.diffLevel));
      let recLine;
      if (UI.levelMode === 'campaign') {
        recLine = '<div class="lc-stars">' + starsHTML(rec ? rec.stars : 0) + '</div>';
      } else {
        recLine = '<div class="lc-info">Best: <b style="color:#fff">wave ' + (rec ? rec.bestWave : 0) + '</b></div>';
      }
      card.innerHTML = '<canvas width="320" height="180"></canvas><div class="lc-body">' +
        '<div class="lc-name">' + m.name + '</div>' +
        '<span class="lc-diff">' + m.diff.toUpperCase() + '</span>' +
        '<div class="lc-info">' + (UI.levelMode === 'campaign' ? m.waves + ' waves' : 'Endless waves') +
        ' &middot; <i class="ico-heart"></i> ' + m.lives + ' &middot; <i class="gem"></i> ' + m.gold + (m.paths.length > 1 ? '<br>Two enemy entrances!' : '') + '</div>' +
        recLine + '</div>';
      const cv = card.querySelector('canvas');
      UI.drawThumb(cv, i);
      card.addEventListener('click', () => { click(); UI.startGame(i, UI.levelMode); });
      box.appendChild(card);
    });
  };
  UI.drawThumb = function (canvas, i) {
    let bg = UI.cache.get('thumb' + i);
    if (!bg) {
      const g = new TD.Game(i, 'campaign', true);
      bg = TD.renderBackground(g, canvas.width / W);
      // draw the path entrances & core
      const ctx = bg.getContext('2d');
      ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of g.paths) {
        const s = p[0], e = p[p.length - 1];
        U.glow(ctx, '#ff3c6e', U.clamp(s.x, 0, W), U.clamp(s.y, 0, H), 70, 1);
        U.glow(ctx, g.map.theme.accent, U.clamp(e.x, 0, W), U.clamp(e.y, 0, H), 90, 1);
      }
      UI.cache.set('thumb' + i, bg);
    }
    canvas.getContext('2d').drawImage(bg, 0, 0, canvas.width, canvas.height);
  };

  UI.buildRecords = function () {
    const box = $('records');
    let html = '';
    TD.MAPS.forEach((m) => {
      const c = TD.save.records[m.id + ':campaign'];
      const e = TD.save.records[m.id + ':endless'];
      html += '<div class="record" style="--c:' + diffColor(m.diffLevel) + '">' +
        '<div class="r-line"><b>' + m.name + '</b><span class="r-stars">' + starsHTML(c ? c.stars : 0) + '</span></div>' +
        '<div class="r-line"><span>Best wave ' + (c ? c.bestWave : 0) + '/' + m.waves + '</span><span>Endless ' + (e ? e.bestWave : 0) + '</span></div></div>';
    });
    box.innerHTML = html;
  };

  UI.syncSettings = function () {
    const s = TD.settings;
    $('set-music').value = s.music;
    $('set-sfx').value = s.sfx;
    for (const b of $('set-quality').children) b.classList.toggle('active', b.dataset.v === s.quality);
    $('set-shake').textContent = s.shake ? 'ON' : 'OFF';
    $('set-shake').classList.toggle('active', s.shake);
    $('set-texts').textContent = s.texts ? 'ON' : 'OFF';
    $('set-texts').classList.toggle('active', s.texts);
  };

  /* ---------------------------- per-frame HUD --------------------------- */
  UI.update = function () {
    const g = TD.game;
    TD.Audio.intensity = g && g.state === 'playing' ? (g.enemies.some((e) => e.def.boss) ? 2 : g.waveActive ? 1 : 0) : 0;
    if (!g) return;

    // stats
    setText($('hud-lives'), g.lives);
    setText($('hud-gold'), U.fmt(g.gold));
    setText($('hud-wave'), g.wave + (g.totalWaves === Infinity ? '' : '/' + g.totalWaves));
    setText($('hud-score'), U.fmt(g.score));
    if (g.lives < UI.lastLives) flashClass($('hud-lives').parentNode, 'hurt');
    UI.lastLives = g.lives;
    if (UI.lastGold !== undefined && g.gold > UI.lastGold + 15) flashClass($('hud-gold').parentNode, 'bump');
    UI.lastGold = g.gold;

    // shop
    for (const type of TD.TOWER_ORDER) {
      const b = UI.shopButtons[type];
      b.classList.toggle('poor', g.gold < TD.TOWERS[type].cost);
      b.classList.toggle('active', g.placing === type);
    }

    // info panel
    const sel = g.selected;
    $('info-sel').classList.toggle('hidden', !sel);
    $('info-hint').classList.toggle('hidden', !!sel);
    if (sel) {
      const key = sel.id + ':' + sel.level;
      if (UI.selKey !== key) {
        UI.selKey = key;
        drawTowerIcon($('sel-icon'), sel.type, sel.level);
        setText($('sel-name'), sel.def.name);
        setText($('sel-level'), 'LEVEL ' + sel.level + (sel.level >= TD.MAX_LEVEL ? ' (MAX)' : ''));
      }
      setHTML($('sel-stats'), statRows(sel.def, sel.level) + '<div>KILLS <b>' + sel.kills + '</b></div><div>DEALT <b>' + U.fmt(sel.dealt) + '</b></div>');
      setText($('btn-target'), 'TARGET: ' + sel.mode.toUpperCase());
      const up = $('btn-upgrade');
      if (sel.level >= TD.MAX_LEVEL) {
        setHTML(up, 'MAX LEVEL');
        up.disabled = true;
      } else {
        setHTML(up, 'UPGRADE <i class="gem"></i>' + sel.upgradeCost);
        up.disabled = g.gold < sel.upgradeCost;
      }
      setHTML($('btn-sell'), 'SELL <i class="gem"></i>' + sel.sellValue);
    } else {
      UI.selKey = null;
      const type = g.placing || UI.hoverShop;
      if (type) {
        const def = TD.TOWERS[type];
        setHTML($('hint-title'), def.name + ' &nbsp;<i class="gem"></i>' + def.cost);
        setText($('hint-desc'), def.desc);
        setHTML($('hint-stats'), statRows(def, 1).replace(/<i>.*?<\/i>/g, ''));
      } else {
        setText($('hint-title'), 'Pick a tower');
        setText($('hint-desc'), 'Select a tower from the shop (or press 1-6), then click a free tile to build it. Click a built tower to upgrade or sell it.');
        setHTML($('hint-stats'), '');
      }
    }

    // next wave preview
    if (UI.lastWave !== g.wave) {
      UI.lastWave = g.wave;
      const nw = g.wave + 1;
      let html = '';
      if (nw <= g.totalWaves) {
        const sum = TD.waveSummary(g.map, nw);
        for (const type of Object.keys(sum)) {
          const def = TD.ENEMIES[type];
          html += '<span class="np-chip' + (def.boss ? ' boss' : '') + '" style="--c:' + def.color + '" title="' + def.name + ': ' + def.desc + '"><i></i>' + sum[type] + ' ' + def.name + '</span>';
        }
      } else html = '<span class="np-chip">Final wave!</span>';
      setHTML($('next-preview'), html);
    }

    // wave button
    const wb = $('btn-wave');
    let label, enabled = true, pulse = false;
    if (g.state !== 'playing') { label = g.state === 'won' ? 'VICTORY!' : 'DEFEATED'; enabled = false; }
    else if (g.spawners.length > 0) { label = 'WAVE ' + g.wave + ' INCOMING...'; enabled = false; }
    else if (g.wave >= g.totalWaves) { label = 'FINAL WAVE'; enabled = false; }
    else if (g.waveActive) { label = '<i class="ico-ff"></i>CALL EARLY +' + TD.earlyBonus(g.wave); }
    else if (g.autoTimer > 0) { label = 'NEXT WAVE IN ' + Math.ceil(g.autoTimer); pulse = true; }
    else { label = '<i class="ico-play"></i>START WAVE ' + (g.wave + 1); pulse = true; }
    setHTML(wb, label);
    wb.disabled = !enabled;
    wb.classList.toggle('pulse', pulse && enabled);

    setText($('btn-speed'), g.speed + '\u00D7');
    $('btn-speed').classList.toggle('on', g.speed > 1);
    setText($('btn-auto'), g.autoWave ? 'AUTO ON' : 'AUTO');
    $('btn-auto').classList.toggle('on', g.autoWave);

    if (g.state !== 'playing' && !UI.endShown && g.endTimer <= 0) UI.showEnd();
  };

  /* -------------------------------- input ------------------------------ */
  function tileFromEvent(e) {
    const cv = $('game');
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    return { x, y, c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  }

  function onPointerMove(e) {
    const g = TD.game;
    if (!g) return;
    const t = tileFromEvent(e);
    g.hover = { c: t.c, r: t.r };
  }
  function onPointerDown(e) {
    TD.Audio.init();
    const g = TD.game;
    if (!g || UI.overlayOpen() || g.state !== 'playing') return;
    const t = tileFromEvent(e);
    g.hover = { c: t.c, r: t.r };
    if (e.button === 2) { g.placing = null; g.selected = null; return; }
    if (e.button !== 0) return;
    if (g.placing) {
      const existing = g.towerAtTile(t.c, t.r);
      if (existing) { g.placing = null; g.selected = existing; click(); return; }
      const type = g.placing;
      const ok = g.placeTower(type, t.c, t.r);
      if (ok && (!e.shiftKey || g.gold < TD.TOWERS[type].cost)) g.placing = null;
      return;
    }
    const tw = g.towerAtTile(t.c, t.r);
    g.selected = tw || null;
    if (tw) click();
  }

  function onKey(e) {
    TD.Audio.init();
    const g = TD.game;
    const k = e.key;
    if (!$('menu-confirm').classList.contains('hidden')) {
      if (k === 'Escape') UI.closeConfirm();
      return;
    }
    if (k === 'Escape') {
      if (UI.screen === 'menu-pause') { UI.resume(); return; }
      if (UI.screen && UI.screen !== 'menu-main' && UI.screen !== 'menu-end') { click(); UI.back(); return; }
      if (g && !UI.screen) {
        if (g.placing || g.selected) { g.placing = null; g.selected = null; return; }
        UI.pause();
      }
      return;
    }
    if (!g || UI.screen) return;
    if (e.target && (e.target.tagName === 'INPUT')) return;
    const lower = k.toLowerCase();
    if (lower === 'p') { UI.pause(); return; }
    if (g.state !== 'playing') return;
    const idx = ['1', '2', '3', '4', '5', '6'].indexOf(k);
    if (idx >= 0) { UI.selectShop(TD.TOWER_ORDER[idx]); return; }
    if (k === ' ') { e.preventDefault(); UI.callWave(); return; }
    if (lower === 'u') UI.upgradeSelected();
    else if (lower === 's' || k === 'Delete' || k === 'Backspace') UI.sellSelected();
    else if (lower === 't') UI.cycleTarget();
    else if (lower === 'f') UI.cycleSpeed();
    else if (lower === 'a') UI.toggleAuto();
  }

  /* -------------------------------- init ------------------------------- */
  UI.init = function () {
    UI.buildShop();
    UI.buildHowTo();
    UI.buildRecords();
    UI.syncSettings();

    // generic data-action buttons
    document.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('click', () => {
        click();
        const a = b.dataset.action;
        const g = TD.game;
        switch (a) {
          case 'play': UI.navigate('menu-levels'); break;
          case 'howto': UI.navigate('menu-howto'); break;
          case 'settings': UI.navigate('menu-settings'); break;
          case 'credits': UI.navigate('menu-credits'); break;
          case 'back': UI.back(); break;
          case 'resume': UI.resume(); break;
          case 'restart':
            UI.confirm('RESTART?', 'Your current progress in this sector will be lost.', () => UI.startGame(g.mapIndex, g.startMode));
            break;
          case 'quit':
            UI.confirm('QUIT?', 'Return to the main menu? Progress in this sector will be lost.', () => UI.quitToMenu());
            break;
          case 'retry': UI.startGame(g.mapIndex, g.startMode); break;
          case 'endless': UI.continueEndless(); break;
          case 'levels': UI.quitToMenu(); UI.navigate('menu-levels'); break;
          case 'menu': UI.quitToMenu(); break;
        }
      });
    });
    $('confirm-yes').addEventListener('click', () => { click(); const f = UI._confirmYes; UI.closeConfirm(); if (f) f(); });
    $('confirm-no').addEventListener('click', () => { click(); UI.closeConfirm(); });

    // level mode toggle
    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.addEventListener('click', () => {
        click();
        UI.levelMode = b.dataset.mode;
        document.querySelectorAll('[data-mode]').forEach((o) => o.classList.toggle('active', o === b));
        UI.buildLevelCards();
      });
    });

    // settings
    $('set-music').addEventListener('input', (e) => { TD.settings.music = +e.target.value; TD.Audio.apply(); TD.persist(); });
    $('set-sfx').addEventListener('input', (e) => { TD.settings.sfx = +e.target.value; TD.Audio.apply(); TD.persist(); });
    $('set-sfx').addEventListener('change', () => TD.Audio.play('coin'));
    for (const b of $('set-quality').children) {
      b.addEventListener('click', () => { click(); TD.settings.quality = b.dataset.v; TD.persist(); UI.syncSettings(); TD.resize(); });
    }
    $('set-shake').addEventListener('click', () => { click(); TD.settings.shake = !TD.settings.shake; TD.persist(); UI.syncSettings(); });
    $('set-texts').addEventListener('click', () => { click(); TD.settings.texts = !TD.settings.texts; TD.persist(); UI.syncSettings(); });
    $('set-reset').addEventListener('click', () => {
      click();
      UI.confirm('RESET PROGRESS?', 'All stars and records will be deleted.', () => { TD.resetProgress(); UI.buildRecords(); UI.toast('Progress reset', '#35e0ff'); });
    });

    // sidebar controls
    $('btn-wave').addEventListener('click', UI.callWave);
    $('btn-speed').addEventListener('click', UI.cycleSpeed);
    $('btn-auto').addEventListener('click', UI.toggleAuto);
    $('btn-pause').addEventListener('click', () => { click(); UI.pause(); });
    $('btn-upgrade').addEventListener('click', UI.upgradeSelected);
    $('btn-sell').addEventListener('click', UI.sellSelected);
    $('btn-target').addEventListener('click', UI.cycleTarget);

    // canvas input
    const cv = $('game');
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointerleave', () => { if (TD.game) TD.game.hover = null; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);

    // audio unlock (browsers need a user gesture)
    const unlock = () => {
      TD.Audio.init();
      document.querySelector('.menu-hint').style.visibility = 'hidden';
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        UI.pause();
        TD.Audio.suspend();
      } else {
        TD.Audio.resume();
      }
    });

    UI.showScreen('menu-main');
  };

  TD.UI = UI;
})(window.TD);
