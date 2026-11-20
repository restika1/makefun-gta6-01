import { TAU, clamp, range, pick } from './util.js';
import { COLORS } from './config.js';

export function createEffects() {
  return {
    particles: [],
    floats: [],
    shake: 0,
    flash: 0,
    flashColor: '#ffffff',
    notifications: [],
    ring: [],
  };
}

export function burst(effects, x, y, count, opts = {}) {
  const {
    speed = 120,
    life = 0.6,
    color = COLORS.bullet,
    size = 2,
    spread = TAU,
    angle = 0,
    gravity = 0,
    glow = true,
    kind = 'spark',
  } = opts;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.35 + Math.random() * 0.75);
    effects.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.5 + Math.random() * 0.7),
      maxLife: life,
      color,
      size: size * (0.6 + Math.random() * 0.8),
      gravity,
      glow,
      kind,
    });
  }
}

export function dust(effects, x, y, count = 4, color = '#6f7784') {
  burst(effects, x, y, count, {
    speed: 42, life: 0.5, color, size: 4, gravity: -8, glow: false, kind: 'smoke',
  });
}

export function floatText(effects, x, y, text, color = COLORS.money) {
  effects.floats.push({ x, y, text, color, life: 1.3, maxLife: 1.3 });
}

export function shockwave(effects, x, y, radius, color = COLORS.wanted) {
  effects.ring.push({ x, y, r: 8, max: radius, life: 0.7, maxLife: 0.7, color });
}

export function notify(game, text, sub = '', color = COLORS.white, seconds = 3.5) {
  game.effects.notifications.unshift({ text, sub, color, life: seconds, maxLife: seconds });
  if (game.effects.notifications.length > 4) game.effects.notifications.length = 4;
}

export function updateEffects(game, dt) {
  const fx = game.effects;
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy = p.vy * (1 - 2.2 * dt) + p.gravity * dt;
  }
  for (let i = fx.floats.length - 1; i >= 0; i--) {
    const f = fx.floats[i];
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) fx.floats.splice(i, 1);
  }
  for (let i = fx.ring.length - 1; i >= 0; i--) {
    const r = fx.ring[i];
    r.life -= dt;
    r.r = 8 + (r.max - 8) * (1 - r.life / r.maxLife);
    if (r.life <= 0) fx.ring.splice(i, 1);
  }
  for (let i = fx.notifications.length - 1; i >= 0; i--) {
    const n = fx.notifications[i];
    n.life -= dt;
    if (n.life <= 0) fx.notifications.splice(i, 1);
  }
  fx.shake = Math.max(0, fx.shake - dt * 18);
  fx.flash = Math.max(0, fx.flash - dt * 4);
}

export function trafficColor(rng) {
  return pick(rng, ['#b8494f', '#3d6f9e', '#d9d2bd', '#5b8a6e', '#8e7ca8', '#c08a3e', '#65717f', '#a34f2f']);
}
