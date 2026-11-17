// Procedural sound effects with the Web Audio API: no audio files, everything is
// synthesized at runtime. The context is created lazily on the first user gesture
// (browsers block audio before one) and stays silent until then.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 0.07, 'square', 0.05, 320);
    },
    boom(big) {
      noise(big ? 0.5 : 0.28, big ? 0.35 : 0.2, big ? 900 : 1400);
      tone(big ? 90 : 140, big ? 0.4 : 0.22, 'sawtooth', 0.16, 40);
    },
    hurt() {
      tone(220, 0.3, 'sawtooth', 0.2, 55);
      noise(0.2, 0.16, 700);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.12);
      setTimeout(() => tone(990, 0.12, 'sine', 0.12), 70);
    },
    horn() {
      tone(196, 0.35, 'triangle', 0.16, 196);
      setTimeout(() => tone(294, 0.4, 'triangle', 0.16, 294), 160);
    },
    gameOver() {
      tone(330, 0.5, 'triangle', 0.16, 110);
      setTimeout(() => tone(220, 0.7, 'triangle', 0.14, 55), 320);
    },
  };
}
