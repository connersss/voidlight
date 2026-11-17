// Keyboard and mouse input. Held keys give a movement vector; one-shot presses
// (start, restart, pause, mute) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse
// position is kept in logical field coordinates and the fire button is held.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas, toLogical) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    const p = toLogical(event.clientX - rect.left, event.clientY - rect.top);
    mouse.x = p.x;
    mouse.y = p.y;
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      keys.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    mouse.down = true;
    actions |= ACTION_CONFIRM;
    // Keep the pointer's events on the canvas while held, so firing survives
    // the mouse leaving the window and releasing anywhere still stops it.
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable: firing then ends at the canvas edge.
    }
  });
  canvas.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function has(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    mouse,
    /** Normalised movement vector from the held keys. */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Is the player holding fire (mouse button or Space)? */
    firing() {
      return mouse.down || keys.has('Space');
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
