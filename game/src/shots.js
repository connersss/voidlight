// The screenshot scenes behind ?shot=start|play|surge|end. Each one plays the real
// rules forward from a fresh world, steered by a simple autopilot (aim at the nearest
// enemy, keep a fighting distance, dodge incoming fire), so the frame is what a real
// game looks like and the same seed always gives the same frame. The pilot is
// deliberately human-like — its aim wobbles and it fires in bursts — so the swarm
// builds up instead of being cleared instantly. An action scene does not stop at a
// fixed second (which might land between waves): it plays to its time limit, keeps
// the busiest frame it saw, and shows that one. The end scene's pilot rams the
// swarm, so it is caught out and the game-over screen is what the frame shows.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_LIMIT_SECONDS = 45;
const SURGE_LIMIT_SECONDS = 110;
const END_LIMIT_SECONDS = 600;

/** Nearest enemy to the player, or null. */
function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/**
 * Steering for one step. `brave` pilots fight at range and dodge; a ramming pilot
 * (the end scene) charges the nearest enemy and never dodges.
 */
function autopilot(state, brave) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  let ax = p.x + Math.cos(p.angle) * 100;
  let ay = p.y + Math.sin(p.angle) * 100;
  // Aim wobble + burst fire: the brave pilot hits often but not always, so the
  // swarm has time to build up and the frame shows bullets in flight. The ramming
  // pilot (end scene) is dead accurate — it still dies, it just takes longer.
  let firing = brave ? Math.floor(state.time * 4) % 4 !== 3 : true;
  const target = nearestEnemy(state);
  if (target) {
    const wob = brave ? Math.sin(state.time * 2.3 + target.phase) * 30 : 0;
    ax = target.x + wob;
    ay = target.y + (brave ? Math.cos(state.time * 1.9 + target.phase) * 30 : 0);
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (brave) {
      // Hold a fighting distance: close in when far, back off when crowded.
      const want = 170;
      const dir = d > want + 40 ? 1 : d < want - 60 ? -1 : 0;
      mx += (dx / d) * dir * 0.8;
      my += (dy / d) * dir * 0.8;
      // Dodge incoming enemy fire: strafe away from its path.
      for (const b of state.ebullets) {
        const bx = b.x - p.x;
        const by = b.y - p.y;
        const bd = Math.hypot(bx, by);
        if (bd < 90) {
          mx += (-by / (bd || 1)) * 0.9;
          my += (bx / (bd || 1)) * 0.9;
        }
      }
      // Keep off the walls.
      if (p.x < 90) mx += 0.8;
      if (p.x > FIELD.width - 90) mx -= 0.8;
      if (p.y < 90) my += 0.8;
      if (p.y > FIELD.height - 90) my -= 0.8;
    } else {
      mx += dx / d;
      my += dy / d;
    }
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  return { mx, my, ax, ay, firing };
}

/**
 * How busy a frame is: enemies closing in on the player count most, then the
 * whole swarm, bullets in flight and particles. A dead player scores -1 (never
 * the shot). Surge frames only count while the Harbinger is in view.
 */
function frameScore(state, name) {
  if (!state.player || state.player.hearts <= 0) return -1;
  if (name === 'play' && state.wave < 2) return -1;
  let near = 0;
  let harbingerInFrame = false;
  for (const e of state.enemies) {
    if (Math.hypot(e.x - state.player.x, e.y - state.player.y) < 400) near += 1;
    if (e.type === 'harbinger' && e.y > 60 && e.y < 560) harbingerInFrame = true;
  }
  if (name === 'surge') {
    if (state.wave < 5 || !harbingerInFrame) return -1;
    return near * 3 + state.enemies.length + state.bullets.length * 0.5 + state.particles.length * 0.05 + 50;
  }
  return near * 3 + state.enemies.length + state.bullets.length * 0.5 + state.particles.length * 0.05;
}

/**
 * Set `world` to the named scene (start, play, surge or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'surge' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { mx: 0, my: 0, ax: FIELD.width / 2, ay: FIELD.height / 2, firing: false }, 'title');
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const seconds = name === 'surge' ? SURGE_LIMIT_SECONDS : name === 'end' ? END_LIMIT_SECONDS : PLAY_LIMIT_SECONDS;
  const brave = name !== 'end';
  let bestSnap = null;
  let bestScore = -1;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world.state, brave), 'play');
    if (events & EVENT_OVER) break;
    if (brave) {
      const score = frameScore(world.state, name);
      if (score > bestScore) {
        bestScore = score;
        bestSnap = JSON.parse(JSON.stringify(world.state));
      }
    }
  }
  if (brave && bestSnap) world.restore(bestSnap);
  const over = world.state.player.hearts <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
