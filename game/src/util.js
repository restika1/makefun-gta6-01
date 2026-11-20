export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => (bx - ax) ** 2 + (by - ay) ** 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
export const chance = (rng, p) => rng() < p;
export const range = (rng, a, b) => a + rng() * (b - a);

export function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= TAU;
  while (r < -Math.PI) r += TAU;
  return r;
}

export const angleDelta = (from, to) => wrapAngle(to - from);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

export function circleRect(x, y, r, rect) {
  const nx = clamp(x, rect.x, rect.x + rect.w);
  const ny = clamp(y, rect.y, rect.y + rect.h);
  return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function shade(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function rgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function starPath(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export const formatMoney = (n) => `$${Math.max(0, Math.round(n)).toString().padStart(5, '0')}`;
export const formatTime = (s) => {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const hash01 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function segmentCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((cx - x1) * dx + (cy - y1) * dy) / len2, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}
