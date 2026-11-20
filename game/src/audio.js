import { MUTE_KEY } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineGain = null;
  let engineOsc = null;
  let engineFilter = null;
  let sirenGain = null;
  let sirenOsc = null;
  let sirenOsc2 = null;
  let muted = false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 620;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 640;
      sirenOsc2 = ctx.createOscillator();
      sirenOsc2.type = 'sine';
      sirenOsc2.frequency.value = 960;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 1.4;
      const sirenLevel = ctx.createGain();
      sirenLevel.gain.value = 0.16;
      sirenOsc.connect(filter);
      sirenOsc2.connect(filter);
      filter.connect(sirenLevel);
      sirenLevel.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenOsc2.start();

      const padGain = ctx.createGain();
      padGain.gain.value = 0.035;
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 420;
      for (const [freq, detune] of [[55, -6], [82.41, 4], [110, 7]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(padFilter);
        osc.start();
      }
      padFilter.connect(padGain);
      padGain.connect(master);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain);
      lfoGain.connect(padFilter.frequency);
      lfo.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function ready() {
    if (!ensure()) return false;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  function noise(duration, volume, cutoff) {
    if (!ready()) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.55 + white * 0.45;
      data[i] = last * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    src.stop(ctx.currentTime + duration + 0.02);
  }

  function blip(freq, duration, type = 'square', volume = 0.08, slide = 0) {
    if (!ready()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  return {
    unlock: ready,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {}
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    engine(on, ratio) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const target = on ? 0.05 + ratio * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, t, 0.08);
      engineOsc.frequency.setTargetAtTime(44 + ratio * 155, t, 0.12);
      engineFilter.frequency.setTargetAtTime(500 + ratio * 1400, t, 0.12);
    },
    siren(on, level = 0.5, phase = 0) {
      if (!ready()) return;
      const t = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(on ? 0.16 + level * 0.22 : 0, t, 0.12);
      const freq = phase % 1 < 0.5 ? 660 : 920;
      sirenOsc.frequency.setTargetAtTime(freq, t, 0.03);
      sirenOsc2.frequency.setTargetAtTime(freq * 1.5, t, 0.03);
    },
    shot() {
      noise(0.16, 0.5, 1800);
      blip(120, 0.1, 'sawtooth', 0.12, -70);
    },
    enemyShot() {
      noise(0.11, 0.24, 1200);
    },
    hit() {
      blip(80, 0.13, 'sawtooth', 0.16, -40);
    },
    punch() {
      noise(0.09, 0.22, 500);
    },
    explosion() {
      noise(0.55, 0.7, 420);
      blip(70, 0.5, 'sawtooth', 0.2, -40);
    },
    ui() {
      blip(520, 0.06, 'square', 0.045, 120);
    },
    pickup() {
      blip(720, 0.09, 'triangle', 0.1, 260);
    },
    mission() {
      blip(392, 0.16, 'triangle', 0.12, 0);
      setTimeout(() => blip(587, 0.22, 'triangle', 0.11, 0), 110);
    },
    fail() {
      blip(220, 0.4, 'sawtooth', 0.14, -100);
    },
    sirenTick(on, phase) {
      this.siren(on, 0.5, phase);
    },
  };
}
