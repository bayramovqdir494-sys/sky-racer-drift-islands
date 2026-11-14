# Sky Racer: Drift Islands

Arcade 3D browser racer across floating sky islands. Drift to charge nitro, jump the gaps, beat rival AI, and take on each world's champion.

## Play
Open `index.html` (or this folder on GitHub Pages / CrazyGames). Landscape on a phone; keyboard works too (arrows/WASD, Space drift, Shift nitro).

## Modes
- **Race** — 3 laps vs 6 AI on 8 themed tracks
- **Time Trial** — solo, 2 laps, ghost of your best run
- **Champion** — unlock by starring both tracks in a world, then duel that world's rival

## Features
- Hunyuan3D cars (wheels spin and steer) plus island props (rocks, crystals)
- Touch controls in the bottom corners, spaced and semi-transparent
- Drift smoke, tire marks, nitro flames, landing camera shake, jump slow-mo
- Wrong-way warning, anti-shortcut checks, safe respawn
- Daily streak, garage upgrades, CrazyGames SDK v3 (ads + cloud save with local fallback)

## Build
No build step. Static ES modules + Three.js. Tested in Chromium.

Save key: `skyRacerSaveV1`. QA hook: `window.__qa`.
