# Neon Bastion (Tower Defense Game)

A neon sci‑fi **tower defense game** built from scratch with **HTML5 Canvas, CSS and plain JavaScript**, all in **one single HTML file** (`index.html`).
It uses no game engine, no libraries, no image files and no sound files. Every tower, enemy, explosion, sound effect and music note is drawn or synthesised in code.

![Main menu](screenshots/menu.png)
![Gameplay](screenshots/gameplay.png)
![Sector select](screenshots/levels.png)

## How to run

1. Download `neon-bastion-tower-defense/index.html` (or clone the repository).
2. Double‑click it to open it in any modern browser (Chrome, Edge, Firefox).

That's all. There is nothing to install and nothing to build.
(Optional: to serve it locally, run `python -m http.server` inside the folder and open http://localhost:8000.)

## Features

- **Full game flow**: animated main menu (with a live demo battle in the background), sector select, how‑to‑play, settings, credits, pause menu, victory and defeat screens.
- **4 maps (sectors)** with increasing difficulty: Easy, Medium, Hard (two enemy entrances) and Expert.
- **Campaign** (20–30 waves) and **Endless** mode, plus a star rating (1–3 ★) based on lives left.
- **6 towers**, each with 3 upgrade levels and 4 targeting modes (First / Last / Strongest / Closest):

  | Tower | Special |
  |---|---|
  | Pulse Blaster | Cheap, rapid fire |
  | Nova Cannon | Splash damage (ground only) |
  | Cryo Spire | Slows groups of enemies |
  | Prism Laser | Beam that heats up to 3× damage |
  | Arc Tesla | Chain lightning, ignores shields |
  | Rail Lancer | Huge range, pierces every enemy in a line, ignores armor |

- **9 enemy types**: fast runners, armored brutes, flying wraiths, shielded units, healers, splitters and the **Titan boss** every 10 waves.
- **Graphics**: glow and bloom effects, particles, lightning, laser beams, screen shake, animated paths and portals, and crisp rendering on high‑DPI screens. A LOW quality mode (switched on automatically when FPS drops) helps slower PCs.
- **Audio**: sound effects and adaptive music generated live with the Web Audio API.
- Game speed 1× / 2× / 3×, auto‑wave, early‑call bonus gold, keyboard shortcuts.
- Progress, records and settings are saved in the browser (localStorage).

## Controls

| Key / Mouse | Action |
|---|---|
| `1`–`6` or click the shop | Pick a tower, then click a free tile to build |
| `Shift` + click | Keep building the same tower |
| Click a tower | Select it |
| `U` / `S` / `T` | Upgrade / Sell / Change targeting |
| `Space` | Start wave / call next wave early (bonus gold) |
| `F` / `A` | Game speed / Auto‑wave |
| `P` or `Esc` | Pause |
| Right‑click | Cancel |

## Project structure

Everything is in **one file**, `index.html`, split into clearly labelled sections:

```
neon-bastion-tower-defense/
├── index.html                 # THE WHOLE GAME (HTML + CSS + JavaScript)
│   ├── <style>                # neon UI styling and animations
│   ├── HTML                   # canvas, menus, sidebar HUD
│   ├── <script id="js-utils">     math helpers, seeded random, glow sprites
│   ├── <script id="js-data">      towers, enemies, maps, wave generator, save data
│   ├── <script id="js-audio">     synthesised sound effects and music (Web Audio API)
│   ├── <script id="js-particles"> particle system
│   ├── <script id="js-entities">  Enemy, Tower, Projectile classes and drawing code
│   ├── <script id="js-game">      Game class: grid, waves, economy, update and render
│   ├── <script id="js-ui">        menus, HUD, shop, input handling
│   └── <script id="js-main">      boot, screen scaling, main loop
├── tests/simulate.js          # automated tests (read the code from index.html)
└── screenshots/
```

## Testing

`tests/simulate.js` loads the game code straight out of `index.html` and runs it in Node.js, without a browser:

- **Unit tests**: building rules, gold costs, upgrades, selling refunds, armor, shields, splitting enemies, losing the game, and wave generation for every map.
- **AI balance simulation**: a bot plays every map from wave 1 to the end while the script checks that the game never reaches an invalid state (no NaN values, gold/lives always valid, no crashes).

```bash
node tests/simulate.js
```

The game was also tested end‑to‑end in headless Chrome, both from a web server and opened directly as a file (double‑click): every menu, building, upgrading, selling, waves, pause, defeat, victory, Endless mode and all 4 maps.

## What I learned

- Game loop with fixed time steps, delta time and a speed multiplier
- Object‑oriented design (classes for towers, enemies, projectiles)
- 2D rendering with the Canvas API (additive blending, cached backgrounds, sprite glow)
- Targeting algorithms, splash and chain damage, point‑to‑line distance for piercing shots
- Procedural wave generation with a seeded random number generator
- Web Audio API synthesis, localStorage, responsive scaling

---
Made by **Shorya Pratap Singh Chandrawat**
