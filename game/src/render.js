// VOIDLIGHT's renderer: paints the world state onto the canvas. The playfield is a
// fixed 1280x720 logical area scaled to the window (letterboxed); nothing here
// changes the world, it only reads it.
import { ENEMY, FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

const TAU = Math.PI * 2;

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.6, y - s * 0.9, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.9);
  ctx.closePath();
}

function poly(ctx, x, y, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const a = rot + (i / n) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function spiky(ctx, x, y, r, spikes, rot) {
  ctx.beginPath();
  const n = spikes * 2;
  for (let i = 0; i < n; i += 1) {
    const a = rot + (i / n) * TAU;
    const rr = i % 2 === 0 ? r : r * 0.55;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view = {
      scale,
      ox: (canvas.width - FIELD.width * scale) / 2,
      oy: (canvas.height - FIELD.height * scale) / 2,
      w: canvas.width,
      h: canvas.height,
    };
  }
  window.addEventListener('resize', resize);
  resize();

  function toLogical(cx, cy) {
    return { x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale };
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() {
    ctx.shadowBlur = 0;
  }

  function drawBackground(state) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const n of state.nebulas) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `hsla(${n.hue}, 80%, 32%, 0.55)`);
      g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    for (const s of state.stars) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(state.time * 0.8 + s.tw));
      ctx.globalAlpha = tw * (0.35 + s.layer * 0.2);
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p) return;
    if (p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    glow(PALETTE.player, 18);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    noGlow();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(2, 0, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (p.shieldT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(state.time * 6);
      ctx.strokeStyle = PALETTE.player;
      ctx.lineWidth = 2.5;
      glow(PALETTE.player, 12);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 10, 0, TAU);
      ctx.stroke();
      ctx.restore();
      noGlow();
    }
  }

  function drawEnemy(e, state) {
    const def = ENEMY[e.type];
    const color = def.color;
    ctx.save();
    ctx.translate(e.x, e.y);
    glow(color, 14);
    ctx.fillStyle = color;
    if (e.type === 'mote') {
      spiky(ctx, 0, 0, e.r, 8, e.t * 1.2);
      ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.42, 0, TAU);
      ctx.fill();
    } else if (e.type === 'weaver') {
      ctx.rotate(e.t * 2);
      poly(ctx, 0, 0, e.r, 4, 0);
      ctx.fill();
      noGlow();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.5;
      poly(ctx, 0, 0, e.r * 0.5, 4, 0);
      ctx.stroke();
    } else if (e.type === 'splitter') {
      ctx.rotate(e.t * 0.8);
      poly(ctx, 0, 0, e.r, 6, 0);
      ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.45, 0, TAU);
      ctx.fill();
    } else if (e.type === 'spitter') {
      const p = state.player;
      ctx.rotate(Math.atan2(p.y - e.y, p.x - e.x));
      poly(ctx, 0, 0, e.r + 3, 3, 0);
      ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.4, 0, TAU);
      ctx.fill();
    } else {
      // Harbinger: big ringed star with a pulsing core.
      const pulse = 1 + 0.06 * Math.sin(e.t * 3);
      ctx.rotate(e.t * 0.5);
      spiky(ctx, 0, 0, e.r * pulse, 10, 0);
      ctx.fill();
      noGlow();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 12, e.t, e.t + Math.PI * 1.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.3, 0, TAU);
      ctx.fill();
      // HP bar above the Harbinger.
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(-e.r, -e.r - 16, e.r * 2, 5);
      ctx.fillStyle = color;
      ctx.fillRect(-e.r, -e.r - 16, e.r * 2 * (e.hp / e.maxHp), 5);
    }
    ctx.restore();
  }

  function drawPickups(state) {
    for (const k of state.pickups) {
      const blink = k.t < 3 ? (Math.floor(state.time * 8) % 2 === 0 ? 0.35 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(k.x, k.y);
      const bob = Math.sin(state.time * 4 + k.x) * 2;
      ctx.translate(0, bob);
      glow('#ffd166', 14);
      ctx.fillStyle = '#1a1430';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
      noGlow();
      ctx.fillStyle = '#ffd166';
      if (k.kind === 'heart') {
        heartPath(ctx, 0, 1, 7);
        ctx.fill();
      } else if (k.kind === 'rapid') {
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(-4, 1);
        ctx.lineTo(0, 1);
        ctx.lineTo(-2, 8);
        ctx.lineTo(5, -2);
        ctx.lineTo(1, -2);
        ctx.closePath();
        ctx.fill();
      } else if (k.kind === 'spread') {
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.arc(i * 5, i === 0 ? -4 : 2, 2.2, 0, TAU);
          ctx.fill();
        }
      } else if (k.kind === 'shield') {
        ctx.strokeStyle = '#4de8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = '#4de8ff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, TAU);
        ctx.fill();
      } else {
        // bomb
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 1, 6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(4, -4);
        ctx.quadraticCurveTo(8, -9, 10, -7);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawHud(state, screen, best) {
    ctx.textBaseline = 'alphabetic';
    // Score, top-left.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score}`, 24, 44);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 24, 68);
    if (state.mult > 1) {
      ctx.font = `700 20px ${FONT}`;
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`COMBO x${state.mult}`, 24, 96);
      ctx.fillStyle = 'rgba(255,209,102,0.35)';
      ctx.fillRect(24, 104, 120, 5);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(24, 104, 120 * (state.comboT / 2.5), 5);
    }
    // Wave, top-center.
    ctx.font = `700 24px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${Math.max(1, state.wave)}`, FIELD.width / 2, 44);
    ctx.font = `500 14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const left = state.enemies.length + state.spawnQueue.length;
    ctx.fillText(left > 0 ? `${left} HOSTILES` : 'CLEAR', FIELD.width / 2, 66);
    // Hearts, top-right.
    const p = state.player;
    if (p) {
      for (let i = 0; i < 3; i += 1) {
        ctx.save();
        ctx.translate(FIELD.width - 32 - i * 34, 34);
        if (i < p.hearts) {
          glow('#ff5d73', 10);
          ctx.fillStyle = '#ff5d73';
        } else {
          ctx.fillStyle = 'rgba(255,93,115,0.18)';
        }
        heartPath(ctx, 0, 0, 11);
        ctx.fill();
        ctx.restore();
        noGlow();
      }
      // Weapon timer.
      if (p.weapon !== 'single' && p.weaponT > 0) {
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = p.weapon === 'rapid' ? '#7df9ff' : '#c77dff';
        ctx.fillText(`${p.weapon === 'rapid' ? 'RAPID FIRE' : 'SPREAD SHOT'} ${Math.ceil(p.weaponT)}s`, FIELD.width - 24, 96);
      }
      if (p.shieldT > 0) {
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#4de8ff';
        ctx.fillText(`SHIELD ${Math.ceil(p.shieldT)}s`, FIELD.width - 24, 118);
      }
    }
    if (screen === SCREEN_PLAY) {
      ctx.textAlign = 'center';
      ctx.font = `500 13px ${FONT}`;
      ctx.fillStyle = 'rgba(238,244,255,0.4)';
      ctx.fillText('WASD move · mouse aim · hold click / Space to fire · P pause · M mute', FIELD.width / 2, FIELD.height - 14);
    }
  }

  function drawBanner(state) {
    if (state.bannerT <= 0 || !state.banner) return;
    const a = Math.min(1, state.bannerT / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `800 54px ${FONT}`;
    glow('#ffd166', 24);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(state.banner, FIELD.width / 2, FIELD.height / 2 - 80);
    ctx.restore();
    noGlow();
  }

  function drawTitle(state, best) {
    ctx.textAlign = 'center';
    const cx = FIELD.width / 2;
    glow('#4de8ff', 30);
    ctx.fillStyle = '#4de8ff';
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText('VOIDLIGHT', cx, 250);
    ctx.restore();
    noGlow();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText('LAST WISP OF THE LUMEN', cx, 292);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 17px ${FONT}`;
    ctx.fillText('The Void Swarm is coming for the Heart Core. Hold the light.', cx, 330);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('WASD / ARROWS — move      MOUSE — aim      HOLD CLICK / SPACE — fire', cx, 420);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText('P — pause      M — mute      R — restart      Grab pickups: heart · rapid · spread · shield · bomb', cx, 452);
    if (best > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(`BEST SCORE ${best}`, cx, 500);
    }
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#eafcff';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('CLICK OR PRESS SPACE TO START', cx, 566);
    ctx.restore();
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4,2,12,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 19px ${FONT}`;
    ctx.fillText('P or click to resume', FIELD.width / 2, FIELD.height / 2 + 34);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(4,2,12,0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    const cx = FIELD.width / 2;
    glow('#ff4d6d', 24);
    ctx.fillStyle = '#ff4d6d';
    ctx.font = `800 60px ${FONT}`;
    ctx.fillText('THE LIGHT FADES', cx, 250);
    ctx.restore();
    noGlow();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText(`The swarm took the wisp on wave ${Math.max(1, state.wave)}.`, cx, 300);
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`SCORE ${state.score}`, cx, 356);
    ctx.font = `500 19px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Best ${best}   ·   ${state.kills} void motes shattered`, cx, 392);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#eafcff';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', cx, 462);
    ctx.restore();
  }

  return {
    toLogical,
    draw(state, screen, best) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
      // Screen shake.
      if (state.shake > 0.2) {
        const s = state.shake;
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      }
      drawBackground(state);
      // Player bullets.
      for (const b of state.bullets) {
        glow(PALETTE.bullet, 10);
        ctx.fillStyle = PALETTE.bullet;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
      }
      noGlow();
      // Enemies.
      for (const e of state.enemies) drawEnemy(e, state);
      // Enemy bullets.
      for (const b of state.ebullets) {
        glow(PALETTE.ebullet, 12);
        ctx.fillStyle = PALETTE.ebullet;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
      }
      noGlow();
      drawPickups(state);
      // Particles.
      for (const pt of state.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;
      if (screen !== SCREEN_TITLE) drawPlayer(state);
      // Score popups.
      ctx.textAlign = 'center';
      for (const pp of state.popups) {
        ctx.globalAlpha = Math.min(1, pp.life / 0.4);
        ctx.font = `700 ${pp.size}px ${FONT}`;
        ctx.fillStyle = pp.color;
        ctx.fillText(pp.text, pp.x, pp.y);
      }
      ctx.globalAlpha = 1;
      // Damage vignette.
      if (state.flash > 0) {
        const g = ctx.createRadialGradient(
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
          FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75,
        );
        g.addColorStop(0, 'rgba(255,40,70,0)');
        g.addColorStop(1, `rgba(255,40,70,${0.5 * state.flash})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      drawBanner(state);
      if (screen !== SCREEN_TITLE) drawHud(state, screen, best);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      noGlow();
    },
  };
}
