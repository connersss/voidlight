// VOIDLIGHT — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 340,
  drag: 4.2,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletRadius: 5,
  hearts: 3,
  invulnerable: 2.0,
  pickupRadius: 110,
};

export const WEAPONS = {
  rapid: { fireInterval: 0.085, duration: 9 },
  spread: { shots: 3, spread: 0.34, duration: 9 },
};

export const ENEMY = {
  mote: { radius: 13, speed: 95, hp: 1, value: 10, color: '#ff4d6d' },
  weaver: { radius: 13, speed: 130, hp: 1, value: 15, color: '#c77dff' },
  splitter: { radius: 17, speed: 70, hp: 2, value: 20, color: '#ff9e00' },
  spitter: { radius: 15, speed: 80, hp: 2, value: 30, color: '#ff5da2' },
  harbinger: { radius: 42, speed: 42, hp: 22, value: 200, color: '#e0aaff' },
};

export const EBULLET = { radius: 6, speed: 210 };

export const PICKUP = {
  radius: 12,
  magnetSpeed: 320,
  life: 10,
  dropChance: 0.16,
  kinds: ['heart', 'rapid', 'spread', 'shield', 'bomb'],
  weights: [0.2, 0.26, 0.26, 0.18, 0.1],
};

export const COMBO = { window: 2.5, maxMult: 8 };

export const WAVE = {
  intermission: 2.2,
  baseCount: 7,
  perWave: 3,
  spawnInterval: 0.7,
  minInterval: 0.28,
  harbingerEvery: 5,
};

export const PALETTE = {
  backdrop: '#070512',
  nebulaA: '#2b0a4a',
  nebulaB: '#0a2a4a',
  nebulaC: '#3d0a2e',
  star: '#e8f4ff',
  player: '#4de8ff',
  playerCore: '#eafcff',
  bullet: '#7df9ff',
  ebullet: '#ff5da2',
  heart: '#ff5d73',
  pickup: '#ffd166',
  text: '#eef4ff',
  muted: '#8b93b8',
  panel: '#12102a',
  wave: '#ffd166',
  danger: '#ff4d6d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'voidlight.best';
