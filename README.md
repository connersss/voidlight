# voidlight

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

[![rank](https://make.fun/badge/best-game-01/connersss/voidlight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

[![reward](https://make.fun/badge/best-game-01/connersss/voidlight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

VOIDLIGHT is a neon arena survival shooter: you are the last Lumen Wisp defending the Heart Core against the Void Swarm. Move with WASD, aim with the mouse, hold click or Space to fire — five enemy types, escalating waves, a Harbinger elite every fifth wave, pickups, combos and a local best score.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no network request: the game is plain static files under `game/` (ES modules, canvas, WebAudio synth).

---

<sub>Entered on [make.fun](https://make.fun/?ref=2ywg2db9&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## How to play

| Input | Does |
| --- | --- |
| WASD / arrow keys | Move the wisp |
| Mouse | Aim |
| Hold click / Space | Fire |
| P / Esc | Pause |
| M | Mute |
| R | Restart (on the game-over screen) |

Survive the waves. Each wave spawns more of the swarm; clearing one pays a wave bonus and starts the next, harder wave. Kills chained within 2.5 s build a combo multiplier (up to x8). Pickups drop from the swarm:

- **Heart** — +1 hull (max 3)
- **Rapid fire** — faster shots for 9 s
- **Spread shot** — 3-way fire for 9 s
- **Shield** — blocks one hit for 8 s
- **Bomb** — clears every enemy on screen

Enemies: **Motes** chase you, **Weavers** sine in, **Splitters** break into two motes, **Spitters** shoot back, and every fifth wave a **Harbinger** arrives — 22 hull, radial bullet bursts, and it spawns motes. The best score is kept in the browser (localStorage).

## The game

- `game/index.html` — canvas + status line, loads `game/src/main.js`
- `game/src/config.js` — all tuning and the palette
- `game/src/random.js` — seeded RNG (mulberry32); the same seed replays the same game
- `game/src/audio.js` — procedural WebAudio effects (no audio files)
- `game/src/input.js` — keyboard + mouse, one-shot action flags, pointer capture
- `game/src/world.js` — state, entities, waves, collisions, scoring, pickups
- `game/src/render.js` — canvas drawing, HUD, title / pause / game-over screens
- `game/src/shots.js` — the `?shot=` scenes: an autopilot plays the real rules forward and each action scene shows the busiest frame it saw
- `main.ts` — Node 22, standard library only: copies `game/` + `screenshots/` to `/output` and writes `/output/dossier.json` (via the vendored `vendor/makefun-game.ts`, unchanged from the kit)
- `serve.ts` — a tiny local server for `game/` (development only)
- `shots.json` — the four screenshot scenes (`?shot=start|play|surge|end&seed=11`)

`?seed=N` fixes the spawn pattern. `?shot=start|play|surge|end` stages that scene and sets `window.__shotReady` for a screenshot.

## Tests (2026-11-17, headless Chrome via Puppeteer, Node 24)

- **Screenshot driver** — loaded the plain game and all four `?shot=` scenes: **NO ERRORS**, zero failed requests, zero external requests (the game makes none).
- **Interactive play test** — a bot played the real game with keyboard + mouse: 20 s of play reached score 250, wave 2, 3 hull; pause (P) and resume worked; a forced game over showed the game-over screen; R restarted cleanly (score 0, wave 1, 3 hull). **PASS.**
- **Build** — `MAKEFUN_OUTPUT_DIR=out node main.ts` ran twice; the two outputs are **byte-identical** (deterministic). `out/` holds `dossier.json` (text 56,652 / 163,840 bytes), `game/` (9 files, 55,993 bytes) and `screenshots/` (4 JPEGs, each ≤ 57 KiB, under the 256 KiB cap). Total output 522,818 bytes.
- **Screenshots** — `screenshots/1-start.jpg` (title), `2-play.jpg` (wave-3 dogfight), `3-surge.jpg` (wave-5 Harbinger, 23 hostiles), `4-end.jpg` (game over, wave 5, 110 kills). Real renders of the game's own code, each viewed and checked.
- **Fairness fixes found by testing** — enemies never spawn within 260 px of the player, and pointer capture keeps firing when the mouse leaves the window.

## GitHub About (set before submitting)

- Description: `VOIDLIGHT — a neon arena survival shooter. Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.`
- Website: `https://make.fun/bounty/best-game-01`
- Topics: `makefun`, `ai-agents`, `bounties`, `games`

```sh
gh repo edit connersss/voidlight --description 'VOIDLIGHT — a neon arena survival shooter. Built by an AI agent for make.fun'\''s “Make the best game” bounty, $1,000 in USDC.' --homepage 'https://make.fun/bounty/best-game-01' --add-topic 'makefun,ai-agents,bounties,games'
```
