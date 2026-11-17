// VOIDLIGHT's world: the player, the swarm, bullets, pickups, particles, waves and
// scoring. Everything gameplay-relevant runs on the seeded RNG, so the same seed
// replays the same game — the screenshot scenes depend on it. The renderer only
// paints this state; it never changes it.
import {
  COMBO,
  EBULLET,
  ENEMY,
  FIELD,
  PICKUP,
  PLAYER,
  STEP,
  WAVE,
  WEAPONS,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE = 4;
export const EVENT_PICKUP = 8;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function edgePoint(random) {
  const side = Math.floor(random() * 4);
  const m = 30;
  if (side === 0) return { x: random() * FIELD.width, y: -m };
  if (side === 1) return { x: FIELD.width + m, y: random() * FIELD.height };
  if (side === 2) return { x: random() * FIELD.width, y: FIELD.height + m };
  return { x: -m, y: random() * FIELD.height };
}

function pickWeighted(random, kinds, weights) {
  let roll = random();
  for (let i = 0; i < kinds.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return kinds[i];
  }
  return kinds[kinds.length - 1];
}

export function createWorld(random) {
  const state = {
    time: 0,
    score: 0,
    best: 0,
    combo: 0,
    comboT: 0,
    mult: 1,
    wave: 0,
    waveState: 'banner',
    waveT: 0,
    kills: 0,
    shake: 0,
    flash: 0,
    hitStop: 0,
    banner: '',
    bannerT: 0,
    player: null,
    bullets: [],
    enemies: [],
    ebullets: [],
    pickups: [],
    particles: [],
    popups: [],
    stars: [],
    nebulas: [],
    spawnQueue: [],
    spawnT: 0,
    ambientT: 0,
  };

  function makeStars() {
    state.stars = [];
    for (let i = 0; i < 130; i += 1) {
      state.stars.push({
        x: random() * FIELD.width,
        y: random() * FIELD.height,
        layer: 1 + Math.floor(random() * 3),
        size: 0.6 + random() * 1.6,
        tw: random() * TAU,
      });
    }
    state.nebulas = [
      { x: 220, y: 150, r: 260, hue: 268 },
      { x: 1050, y: 560, r: 300, hue: 205 },
      { x: 980, y: 110, r: 200, hue: 320 },
      { x: 180, y: 600, r: 220, hue: 240 },
    ];
  }

  function makePlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2,
      vx: 0,
      vy: 0,
      r: PLAYER.radius,
      hearts: PLAYER.hearts,
      invuln: 0,
      fireCd: 0,
      weapon: 'single',
      weaponT: 0,
      shieldT: 0,
      angle: -Math.PI / 2,
      thrust: 0,
    };
  }

  function spawnEnemy(type) {
    const def = ENEMY[type];
    // Spawn away from the player: re-roll the edge point (a few tries) if it
    // would land on top of them, so a spawn is never an unavoidable hit.
    let p = type === 'harbinger' ? { x: FIELD.width / 2, y: -60 } : edgePoint(random);
    if (type !== 'harbinger' && state.player) {
      for (let tries = 0; tries < 6; tries += 1) {
        if (Math.hypot(p.x - state.player.x, p.y - state.player.y) >= 260) break;
        p = edgePoint(random);
      }
    }
    const e = {
      type,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      r: def.radius,
      hp: def.hp,
      maxHp: def.hp,
      value: def.value,
      speed: def.speed * (1 + (state.wave - 1) * 0.045),
      phase: random() * TAU,
      shootCd: 1.5 + random() * 1.5,
      spawnCd: 5 + random() * 2,
      t: 0,
    };
    state.enemies.push(e);
    return e;
  }

  function buildWave(n) {
    const queue = [];
    const count = WAVE.baseCount + WAVE.perWave * n;
    const types = ['mote'];
    if (n >= 2) types.push('weaver');
    if (n >= 3) types.push('splitter');
    if (n >= 4) types.push('spitter');
    for (let i = 0; i < count; i += 1) {
      queue.push(types[Math.floor(random() * types.length)]);
    }
    if (n % WAVE.harbingerEvery === 0) queue.unshift('harbinger');
    return queue;
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = buildWave(n);
    state.spawnT = 0.6;
    state.waveState = 'banner';
    state.waveT = 1.6;
    state.banner = n % WAVE.harbingerEvery === 0 ? `WAVE ${n} — HARBINGER` : `WAVE ${n}`;
    state.bannerT = 1.6;
  }

  function burst(x, y, color, n, speed, size, life) {
    for (let i = 0; i < n; i += 1) {
      if (state.particles.length > 420) return;
      const a = random() * TAU;
      const s = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.5 + random() * 0.5),
        maxLife: life,
        size: size * (0.6 + random() * 0.8),
        color,
      });
    }
  }

  function popup(x, y, text, color, size) {
    state.popups.push({ x, y, text, life: 0.9, color, size: size || 15 });
  }

  function addScore(value, x, y) {
    const gained = value * state.mult;
    state.score += gained;
    popup(x, y, `+${gained}`, '#ffd166', 15);
    return gained;
  }

  function dropPickup(x, y) {
    if (random() >= PICKUP.dropChance) return;
    const kind = pickWeighted(random, PICKUP.kinds, PICKUP.weights);
    state.pickups.push({
      kind,
      x,
      y,
      vx: (random() - 0.5) * 60,
      vy: (random() - 0.5) * 60,
      t: PICKUP.life,
    });
  }

  function killEnemy(index, award) {
    const e = state.enemies[index];
    state.enemies.splice(index, 1);
    state.kills += 1;
    burst(e.x, e.y, ENEMY[e.type].color, e.type === 'harbinger' ? 60 : 16, 260, 3, 0.7);
    if (award) {
      state.combo += 1;
      state.comboT = COMBO.window;
      state.mult = Math.min(1 + Math.floor(state.combo / 4), COMBO.maxMult);
      addScore(e.value, e.x, e.y);
      state.hitStop = Math.max(state.hitStop, 0.03);
      if (e.type === 'harbinger') {
        state.shake = Math.max(state.shake, 14);
        dropPickup(e.x - 30, e.y);
        dropPickup(e.x + 30, e.y);
        state.pickups.push({ kind: 'bomb', x: e.x, y: e.y - 40, vx: 0, vy: 0, t: PICKUP.life });
      }
      if (e.type === 'splitter') {
        for (let i = 0; i < 2; i += 1) {
          const m = spawnEnemy('mote');
          m.x = e.x + (i === 0 ? -14 : 14);
          m.y = e.y;
        }
      }
      dropPickup(e.x, e.y);
    }
  }

  function applyPickup(kind) {
    const p = state.player;
    if (kind === 'heart') {
      p.hearts = Math.min(PLAYER.hearts, p.hearts + 1);
      popup(p.x, p.y - 24, '+1 HULL', '#ff5d73', 16);
    } else if (kind === 'rapid') {
      p.weapon = 'rapid';
      p.weaponT = WEAPONS.rapid.duration;
      popup(p.x, p.y - 24, 'RAPID FIRE', '#7df9ff', 16);
    } else if (kind === 'spread') {
      p.weapon = 'spread';
      p.weaponT = WEAPONS.spread.duration;
      popup(p.x, p.y - 24, 'SPREAD SHOT', '#c77dff', 16);
    } else if (kind === 'shield') {
      p.shieldT = 8;
      popup(p.x, p.y - 24, 'SHIELD', '#4de8ff', 16);
    } else if (kind === 'bomb') {
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) killEnemy(i, true);
      state.ebullets.length = 0;
      state.shake = Math.max(state.shake, 12);
      state.flash = Math.max(state.flash, 0.5);
      popup(p.x, p.y - 24, 'VOID BOMB', '#ffd166', 18);
    }
  }

  function hurtPlayer() {
    const p = state.player;
    if (p.invuln > 0) return 0;
    if (p.shieldT > 0) {
      p.shieldT = 0;
      p.invuln = 1.0;
      burst(p.x, p.y, '#4de8ff', 18, 240, 3, 0.5);
      state.shake = Math.max(state.shake, 8);
      return EVENT_HIT;
    }
    p.hearts -= 1;
    p.invuln = PLAYER.invulnerable;
    state.combo = 0;
    state.mult = 1;
    state.comboT = 0;
    state.shake = Math.max(state.shake, 12);
    state.flash = 0.7;
    burst(p.x, p.y, '#ff4d6d', 26, 300, 3.5, 0.8);
    if (p.hearts <= 0) return EVENT_HIT | EVENT_OVER;
    return EVENT_HIT;
  }

  function fireBullet(angle) {
    const p = state.player;
    state.bullets.push({
      x: p.x + Math.cos(angle) * (p.r + 6),
      y: p.y + Math.sin(angle) * (p.r + 6),
      vx: Math.cos(angle) * PLAYER.bulletSpeed + p.vx * 0.4,
      vy: Math.sin(angle) * PLAYER.bulletSpeed + p.vy * 0.4,
      r: PLAYER.bulletRadius,
      life: 1.1,
    });
    burst(p.x + Math.cos(angle) * (p.r + 4), p.y + Math.sin(angle) * (p.r + 4), '#7df9ff', 2, 90, 2, 0.25);
  }

  function stepPlayer(dt, ctrl) {
    const p = state.player;
    if (!p) return;
    p.invuln = Math.max(0, p.invuln - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    if (p.weaponT > 0) {
      p.weaponT -= dt;
      if (p.weaponT <= 0) p.weapon = 'single';
    }
    p.vx += ctrl.mx * PLAYER.accel * dt;
    p.vy += ctrl.my * PLAYER.accel * dt;
    const damp = Math.exp(-PLAYER.drag * dt);
    p.vx *= damp;
    p.vy *= damp;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > PLAYER.maxSpeed) {
      p.vx = (p.vx / sp) * PLAYER.maxSpeed;
      p.vy = (p.vy / sp) * PLAYER.maxSpeed;
    }
    p.x = Math.min(FIELD.width - p.r, Math.max(p.r, p.x + p.vx * dt));
    p.y = Math.min(FIELD.height - p.r, Math.max(p.r, p.y + p.vy * dt));
    p.angle = Math.atan2(ctrl.ay - p.y, ctrl.ax - p.x);
    p.thrust = Math.min(1, Math.hypot(ctrl.mx, ctrl.my));
    if (sp > 60 && random() < 0.6) {
      state.particles.push({
        x: p.x - Math.cos(p.angle) * p.r,
        y: p.y - Math.sin(p.angle) * p.r,
        vx: -p.vx * 0.2 + (random() - 0.5) * 40,
        vy: -p.vy * 0.2 + (random() - 0.5) * 40,
        life: 0.35,
        maxLife: 0.35,
        size: 2.5,
        color: '#4de8ff',
      });
    }
    p.fireCd -= dt;
    if (ctrl.firing && p.fireCd <= 0) {
      const interval = p.weapon === 'rapid' ? WEAPONS.rapid.fireInterval : PLAYER.fireInterval;
      p.fireCd = interval;
      if (p.weapon === 'spread') {
        fireBullet(p.angle - WEAPONS.spread.spread);
        fireBullet(p.angle);
        fireBullet(p.angle + WEAPONS.spread.spread);
      } else {
        fireBullet(p.angle);
      }
    }
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      e.t += dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.type === 'mote') {
        e.vx += (dx / d) * e.speed * 2.4 * dt;
        e.vy += (dy / d) * e.speed * 2.4 * dt;
      } else if (e.type === 'weaver') {
        const px = -dy / d;
        const py = dx / d;
        const wob = Math.sin(e.t * 4 + e.phase) * 0.9;
        e.vx += ((dx / d) + px * wob) * e.speed * 2.2 * dt;
        e.vy += ((dy / d) + py * wob) * e.speed * 2.2 * dt;
      } else if (e.type === 'splitter') {
        e.vx += (dx / d) * e.speed * 1.8 * dt;
        e.vy += (dy / d) * e.speed * 1.8 * dt;
      } else if (e.type === 'spitter') {
        const want = 260;
        const dir = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
        e.vx += (dx / d) * dir * e.speed * 2.0 * dt;
        e.vy += (dy / d) * dir * e.speed * 2.0 * dt;
        e.vx += (-dy / d) * Math.sin(e.t * 1.5 + e.phase) * 40 * dt;
        e.vy += (dx / d) * Math.sin(e.t * 1.5 + e.phase) * 40 * dt;
        e.shootCd -= dt;
        if (e.shootCd <= 0 && d < 560) {
          e.shootCd = 2.3;
          state.ebullets.push({
            x: e.x,
            y: e.y,
            vx: (dx / d) * EBULLET.speed,
            vy: (dy / d) * EBULLET.speed,
            r: EBULLET.radius,
            life: 4,
          });
        }
      } else if (e.type === 'harbinger') {
        e.vx += (dx / d) * e.speed * 1.6 * dt;
        e.vy += (dy / d) * e.speed * 1.6 * dt;
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = 2.8;
          for (let k = 0; k < 10; k += 1) {
            const a = (k / 10) * TAU + e.phase;
            state.ebullets.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * EBULLET.speed * 0.85,
              vy: Math.sin(a) * EBULLET.speed * 0.85,
              r: EBULLET.radius,
              life: 5,
            });
          }
          state.shake = Math.max(state.shake, 5);
        }
        e.spawnCd -= dt;
        if (e.spawnCd <= 0) {
          e.spawnCd = 6;
          for (let k = 0; k < 2; k += 1) {
            const m = spawnEnemy('mote');
            m.x = e.x + (k === 0 ? -30 : 30);
            m.y = e.y + 20;
          }
        }
      }
      const esp = Math.hypot(e.vx, e.vy);
      if (esp > e.speed) {
        e.vx = (e.vx / esp) * e.speed;
        e.vy = (e.vy / esp) * e.speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = b.r + e.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          state.bullets.splice(i, 1);
          e.hp -= 1;
          burst(b.x, b.y, '#bfefff', 4, 160, 2, 0.3);
          if (e.hp <= 0) killEnemy(j, true);
          break;
        }
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.ebullets.splice(i, 1);
      }
    }
  }

  function stepPickups(dt) {
    const p = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const k = state.pickups[i];
      k.t -= dt;
      if (k.t <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      const d = Math.hypot(p.x - k.x, p.y - k.y);
      if (d < PLAYER.pickupRadius) {
        k.vx += ((p.x - k.x) / (d || 1)) * 900 * dt;
        k.vy += ((p.y - k.y) / (d || 1)) * 900 * dt;
      } else {
        k.vx *= Math.exp(-2 * dt);
        k.vy *= Math.exp(-2 * dt);
      }
      const ks = Math.hypot(k.vx, k.vy);
      if (ks > PICKUP.magnetSpeed) {
        k.vx = (k.vx / ks) * PICKUP.magnetSpeed;
        k.vy = (k.vy / ks) * PICKUP.magnetSpeed;
      }
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (d < p.r + PICKUP.radius + 4) {
        state.pickups.splice(i, 1);
        applyPickup(k.kind);
        burst(k.x, k.y, '#ffd166', 10, 180, 2.5, 0.5);
      }
    }
  }

  function stepCollisions() {
    const p = state.player;
    if (!p || p.invuln > 0) return 0;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      const rr = p.r + e.r - 2;
      if (dist2(p.x, p.y, e.x, e.y) < rr * rr) {
        killEnemy(i, false);
        return hurtPlayer();
      }
    }
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      const rr = p.r + b.r - 2;
      if (dist2(p.x, p.y, b.x, b.y) < rr * rr) {
        state.ebullets.splice(i, 1);
        return hurtPlayer();
      }
    }
    return 0;
  }

  function stepFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-2.5 * dt);
      pt.vy *= Math.exp(-2.5 * dt);
    }
    for (let i = state.popups.length - 1; i >= 0; i -= 1) {
      const pp = state.popups[i];
      pp.life -= dt;
      pp.y -= 34 * dt;
      if (pp.life <= 0) state.popups.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - 30 * dt);
    state.flash = Math.max(0, state.flash - 1.6 * dt);
    state.bannerT = Math.max(0, state.bannerT - dt);
    if (state.comboT > 0) {
      state.comboT -= dt;
      if (state.comboT <= 0) {
        state.combo = 0;
        state.mult = 1;
      }
    }
  }

  function stepWaves(dt) {
    if (state.waveState === 'banner') {
      state.waveT -= dt;
      if (state.waveT <= 0) state.waveState = 'spawning';
      return 0;
    }
    if (state.waveState === 'spawning') {
      state.spawnT -= dt;
      if (state.spawnT <= 0 && state.spawnQueue.length > 0) {
        spawnEnemy(state.spawnQueue.shift());
        const base = Math.max(WAVE.minInterval, WAVE.spawnInterval - state.wave * 0.05);
        state.spawnT = base * (0.7 + random() * 0.6);
      }
      if (state.spawnQueue.length === 0) state.waveState = 'fighting';
      return 0;
    }
    if (state.waveState === 'fighting' && state.enemies.length === 0) {
      const bonus = state.wave * 50;
      state.score += bonus;
      popup(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE BONUS +${bonus}`, '#ffd166', 20);
      state.waveState = 'intermission';
      state.waveT = WAVE.intermission;
      return EVENT_WAVE;
    }
    if (state.waveState === 'intermission') {
      state.waveT -= dt;
      if (state.waveT <= 0) {
        startWave(state.wave + 1);
        return EVENT_WAVE;
      }
    }
    return 0;
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.combo = 0;
    state.comboT = 0;
    state.mult = 1;
    state.kills = 0;
    state.shake = 0;
    state.flash = 0;
    state.hitStop = 0;
    state.bullets = [];
    state.enemies = [];
    state.ebullets = [];
    state.pickups = [];
    state.particles = [];
    state.popups = [];
    state.player = makePlayer();
    makeStars();
    startWave(1);
  }

  return {
    state,
    reset,
    /** Replace the state with a snapshot (a plain-data deep copy, e.g. from
     *  JSON): the same object identity, so renderers keep reading it. Used by
     *  the screenshot scenes to show the busiest frame of a run. */
    restore(snap) {
      for (const k of Object.keys(state)) delete state[k];
      Object.assign(state, JSON.parse(JSON.stringify(snap)));
    },
    /** Advance the world one fixed step. ctrl: {mx,my,ax,ay,firing}. mode: 'title'|'play'. */
    step(dt, ctrl, mode) {
      state.time += dt;
      if (state.hitStop > 0) {
        state.hitStop -= dt;
        return 0;
      }
      let events = 0;
      if (mode === 'title') {
        state.ambientT -= dt;
        if (state.ambientT <= 0) {
          state.ambientT = 1.1;
          const e = spawnEnemy(random() < 0.7 ? 'mote' : 'weaver');
          e.x = random() * FIELD.width;
          e.y = -30;
          e.vy = 40 + random() * 40;
          e.vx = (random() - 0.5) * 30;
        }
        for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
          const e = state.enemies[i];
          e.t += dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.y > FIELD.height + 40) state.enemies.splice(i, 1);
        }
        stepFx(dt);
        return 0;
      }
      stepPlayer(dt, ctrl);
      stepEnemies(dt);
      stepBullets(dt);
      stepPickups(dt);
      events |= stepCollisions();
      events |= stepWaves(dt);
      stepFx(dt);
      return events;
    },
  };
}
