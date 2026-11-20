import { VIEW, COLORS, FONT, FONT_DISPLAY, WORLD, CELL, ROAD } from './config.js';
import { clamp, rgba, roundRect, TAU, hash01, shade } from './util.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const cityCanvas = buildCityCanvas();
  const rainSeed = 1;

  function visible(game) {
    const zoom = game.camera.zoom;
    const w = VIEW.width / zoom;
    const h = VIEW.height / zoom;
    return {
      x: game.camera.x - w / 2,
      y: game.camera.y - h / 2,
      w,
      h,
      zoom,
    };
  }

  function draw(game) {
    const v = visible(game);
    const shakeX = (Math.random() - 0.5) * game.effects.shake;
    const shakeY = (Math.random() - 0.5) * game.effects.shake;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(VIEW.width / 2 + shakeX, VIEW.height / 2 + shakeY);
    ctx.scale(v.zoom, v.zoom);
    ctx.translate(-game.camera.x, -game.camera.y);

    const sx = clamp(Math.floor(v.x), 0, WORLD.width);
    const sy = clamp(Math.floor(v.y), 0, WORLD.height);
    const sw = clamp(Math.ceil(v.w) + 2, 1, WORLD.width - sx);
    const sh = clamp(Math.ceil(v.h) + 2, 1, WORLD.height - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(cityCanvas, sx, sy, sw, sh, sx, sy, sw, sh);

    const g = ctx.createLinearGradient(v.x, v.y, v.x, v.y + v.h);
    g.addColorStop(0, 'rgba(6,10,22,0.30)');
    g.addColorStop(0.55, 'rgba(4,7,16,0.22)');
    g.addColorStop(1, 'rgba(2,4,10,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(v.x, v.y, v.w, v.h);

    drawGroundGlow(game, v);
    drawMissionMarker(game, v);
    drawCars(game, v);
    drawActors(game, v);
    drawBullets(game);
    drawParticles(game);
    drawFloats(game);
    ctx.restore();
    drawRain(game);
    drawVignette(game);
  }

  function drawGroundGlow(game, v) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of game.city.lamps) {
      if (lamp.x < v.x - 190 || lamp.x > v.x + v.w + 190 || lamp.y < v.y - 190 || lamp.y > v.y + v.h + 190) continue;
      const grad = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, lamp.r);
      const warm = lamp.tone > 0.55 ? '255,190,110' : '130,210,255';
      grad.addColorStop(0, `rgba(${warm},0.28)`);
      grad.addColorStop(0.45, `rgba(${warm},0.11)`);
      grad.addColorStop(1, `rgba(${warm},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, lamp.r, 0, TAU);
      ctx.fill();
    }
    for (const car of game.cars) {
      if (car.kind === 'wreck') continue;
      if (car.x < v.x - 100 || car.x > v.x + v.w + 100 || car.y < v.y - 100 || car.y > v.y + v.h + 100) continue;
      const front = car.kind === 'player' || Math.abs(car.speed) > 4;
      if (!front) continue;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      const beam = ctx.createLinearGradient(30, 0, 250, 0);
      beam.addColorStop(0, 'rgba(255,236,180,0.20)');
      beam.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(30, -14);
      ctx.lineTo(240, -80);
      ctx.lineTo(240, 80);
      ctx.lineTo(30, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMissionMarker(game, v) {
    const m = game.mission?.marker;
    if (!m) return;
    if (m.x < v.x - 80 || m.x > v.x + v.w + 80 || m.y < v.y - 80 || m.y > v.y + v.h + 80) return;
    const t = game.time;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, 62 + pulse * 18);
    grad.addColorStop(0, 'rgba(255,200,87,0.38)');
    grad.addColorStop(0.55, 'rgba(255,200,87,0.12)');
    grad.addColorStop(1, 'rgba(255,200,87,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 62 + pulse * 18, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,214,120,${0.55 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, game.mission.markerRadius + pulse * 5, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(m.x, m.y - 76 - pulse * 10);
    ctx.fillStyle = 'rgba(8,12,20,0.82)';
    roundRect(ctx, -13, -13, 26, 26, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    roundRect(ctx, -13, -13, 26, 26, 6);
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }

  function drawCars(game, v) {
    for (const car of game.cars) {
      if (car.x < v.x - 80 || car.x > v.x + v.w + 80 || car.y < v.y - 80 || car.y > v.y + v.h + 80) continue;
      drawCar(ctx, car, game);
    }
  }

  function drawActors(game, v) {
    for (const ped of game.peds) {
      if (ped.x < v.x - 40 || ped.x > v.x + v.w + 40 || ped.y < v.y - 40 || ped.y > v.y + v.h + 40) continue;
      drawPerson(ctx, ped, 'ped', ped.dead ? 0 : Math.sin(ped.phase));
    }
    for (const cop of game.cops) {
      if (cop.x < v.x - 40 || cop.x > v.x + v.w + 40 || cop.y < v.y - 40 || cop.y > v.y + v.h + 40) continue;
      drawPerson(ctx, cop, 'cop', cop.dead ? 0 : Math.sin(cop.phase));
    }
    for (const h of game.hostiles) {
      if (h.x < v.x - 40 || h.x > v.x + v.w + 40 || h.y < v.y - 40 || h.y > v.y + v.h + 40) continue;
      drawPerson(ctx, h, 'hostile', h.dead ? 0 : Math.sin(h.phase));
    }
    if (!game.player.inCar) drawPlayer(ctx, game);
  }

  function drawBullets(game) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of game.bullets) {
      const len = 18;
      const nx = b.x - (b.vx / Math.hypot(b.vx, b.vy)) * len;
      const ny = b.y - (b.vy / Math.hypot(b.vx, b.vy)) * len;
      const grad = ctx.createLinearGradient(nx, ny, b.x, b.y);
      grad.addColorStop(0, 'rgba(255,226,154,0)');
      grad.addColorStop(1, b.owner === 'player' ? 'rgba(255,239,180,0.95)' : 'rgba(255,150,120,0.85)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(game) {
    for (const p of game.effects.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      if (p.kind === 'smoke') {
        ctx.save();
        ctx.globalAlpha = a * 0.28;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2.2 - a), 0, TAU);
        ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.save();
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const r of game.effects.ring) {
      const a = clamp(r.life / r.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFloats(game) {
    for (const f of game.effects.floats) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `700 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  function drawRain(game) {
    if (game.weather !== 'rain') return;
    ctx.save();
    ctx.strokeStyle = 'rgba(160,196,230,0.20)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 150; i++) {
      const x = (hash01(i + rainSeed * 0.01) * VIEW.width + game.time * (90 + (i % 7) * 8)) % VIEW.width;
      const y = (hash01(i * 2.7 + 4) * VIEW.height + game.time * (420 + (i % 5) * 55)) % VIEW.height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + 18);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVignette(game) {
    const grad = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.34, VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.76);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    if (game.effects.flash > 0) {
      ctx.fillStyle = game.effects.flashColor;
      ctx.globalAlpha = game.effects.flash * 0.22;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.globalAlpha = 1;
    }
    const scan = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    scan.addColorStop(0, 'rgba(90,140,190,0.05)');
    scan.addColorStop(0.5, 'rgba(0,0,0,0)');
    scan.addColorStop(1, 'rgba(160,70,120,0.05)');
    ctx.fillStyle = scan;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  return { ctx, draw, visible };
}

function drawCar(ctx, car, game) {
  const wreck = car.kind === 'wreck';
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.save();
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(-2, 7, 50, 24, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.rotate(car.angle);
  const w = car.width;
  const l = car.length;
  ctx.fillStyle = wreck ? '#1a1b1f' : shade(car.color, -28);
  roundRect(ctx, -l / 2, -w / 2, l, w, 12);
  ctx.fill();
  ctx.fillStyle = wreck ? '#25262c' : car.color;
  roundRect(ctx, -l / 2 + 4, -w / 2 + 4, l - 8, w - 8, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, -l / 2 + 8, -w / 2 + 7, l - 16, 5, 3);
  ctx.fill();

  ctx.fillStyle = wreck ? '#121317' : COLORS.glass;
  roundRect(ctx, -2, -w / 2 + 7, 24, w - 14, 4);
  ctx.fill();
  roundRect(ctx, -24, -w / 2 + 8, 15, w - 16, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,220,255,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (!wreck) {
    if (car.kind === 'police') {
      const flash = Math.floor(game.time * 7) % 2 === 0;
      ctx.fillStyle = flash ? '#ff4a4a' : '#3a5fff';
      ctx.shadowColor = flash ? '#ff4a4a' : '#4a6bff';
      ctx.shadowBlur = 14;
      ctx.fillRect(-8, -w / 2 + 5, 16, 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f0f4ff';
      ctx.font = `700 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('VPD', -15, 3);
      ctx.fillStyle = '#16213b';
      ctx.fillRect(12, -w / 2 + 6, 16, w - 12);
    }
    ctx.fillStyle = 'rgba(255,244,200,0.95)';
    ctx.fillRect(l / 2 - 5, -w / 2 + 7, 4, 8);
    ctx.fillRect(l / 2 - 5, w / 2 - 15, 4, 8);
    ctx.fillStyle = 'rgba(255,70,70,0.8)';
    ctx.fillRect(-l / 2 + 1, -w / 2 + 8, 3, 7);
    ctx.fillRect(-l / 2 + 1, w / 2 - 15, 3, 7);
  }
  if (car.kind === 'player') {
    ctx.strokeStyle = `rgba(79,214,192,${0.25 + Math.sin(game.time * 3) * 0.08})`;
    ctx.lineWidth = 1.5;
    roundRect(ctx, -l / 2, -w / 2, l, w, 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, person, kind, bob) {
  let swayBob = bob;
  const dead = person.dead;
  if (dead) swayBob = 0;
  const color = kind === 'cop' ? COLORS.cop : kind === 'hostile' ? COLORS.hostile : person.color;
  const skin = kind === 'cop' ? '#c08f68' : kind === 'hostile' ? '#b7865d' : person.skin;
  ctx.save();
  ctx.translate(person.x, person.y);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 11, 6, 0, 0, TAU);
  ctx.fill();
  if (dead) {
    ctx.rotate(person.angle);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    roundRect(ctx, -10, -6, 24, 12, 4);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(15, 0, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(person.angle);
  const sway = swayBob * 2;
  ctx.fillStyle = color;
  roundRect(ctx, -7, -8 + sway * 0.2, 13, 16, 5);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(2, 0, 5.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,30,0.85)';
  ctx.fillRect(-9, -5 + sway * 0.3, 4, 4);
  ctx.fillRect(-9, 2 - sway * 0.3, 4, 4);
  if (kind === 'cop') {
    ctx.fillStyle = '#cfe2ff';
    ctx.fillRect(1, -6, 4, 3);
    ctx.fillStyle = '#dfe8ff';
    ctx.fillRect(10, -1.5, 12, 3);
  }
  if (kind === 'hostile') {
    ctx.fillStyle = '#2c1c1f';
    ctx.fillRect(10, -1.5, 13, 3);
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 6, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(p.angle);
  const bob = Math.sin(p.walkPhase) * 2.2;
  const moving = p.moving ? 1 : 0;
  ctx.fillStyle = COLORS.playerDark;
  roundRect(ctx, -8, -9, 14, 18, 6);
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  roundRect(ctx, -5, -8, 12, 16, 5);
  ctx.fill();
  ctx.fillStyle = '#23303a';
  ctx.fillRect(-10, -6 + bob * moving, 4, 5);
  ctx.fillRect(-10, 1 - bob * moving, 4, 5);
  ctx.fillStyle = COLORS.skin;
  ctx.beginPath();
  ctx.arc(3, 0, 5.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#12241f';
  ctx.beginPath();
  ctx.arc(0, 0, 5.4, -2.3, 2.3);
  ctx.fill();
  ctx.fillStyle = '#1a2028';
  ctx.fillRect(9, -2, 15, 4);
  ctx.fillStyle = '#8fa6b8';
  ctx.fillRect(21, -1.2, 5, 2.4);
  if (game.input.mouse.down) {
    ctx.fillStyle = 'rgba(255,226,154,0.9)';
    ctx.beginPath();
    ctx.arc(27, 0, 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function buildCityCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const c = canvas.getContext('2d');
  c.fillStyle = COLORS.asphalt;
  c.fillRect(0, 0, WORLD.width, WORLD.height);
  const rng = mulberry(99117);

  for (let i = 0; i < 500; i++) {
    const x = rng() * WORLD.width;
    const y = rng() * WORLD.height;
    const s = 18 + rng() * 90;
    c.fillStyle = rng() < 0.5 ? 'rgba(10,13,18,0.35)' : 'rgba(40,48,60,0.18)';
    c.fillRect(x, y, s, s * (0.3 + rng()));
  }

  drawRoadMarkings(c);

  for (const block of blocksForRender()) {
    if (block.type === 'park') {
      c.fillStyle = COLORS.grass;
      c.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
      c.fillStyle = COLORS.grassLight;
      c.globalAlpha = 0.25;
      for (let i = 0; i < 20; i++) {
        c.beginPath();
        c.arc(block.x0 + rng() * (block.x1 - block.x0), block.y0 + rng() * (block.y1 - block.y0), 10 + rng() * 26, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
      c.fillStyle = '#34372f';
      c.fillRect(block.x0 + (block.x1 - block.x0) / 2 - 14, block.y0, 28, block.y1 - block.y0);
      c.fillRect(block.x0, block.y0 + (block.y1 - block.y0) / 2 - 14, block.x1 - block.x0, 28);
    } else if (block.type === 'lot') {
      c.fillStyle = '#1b2028';
      c.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
      c.strokeStyle = 'rgba(190,190,160,0.22)';
      c.lineWidth = 2;
      const inset = 54;
      for (let i = 0; i < 6; i++) {
        const x = block.x0 + inset + ((block.x1 - block.x0 - inset * 2) / 5) * i;
        c.beginPath();
        c.moveTo(x - 8, block.y0 + inset - 8);
        c.lineTo(x - 8, block.y0 + inset + 64);
        c.moveTo(x - 8, block.y1 - inset + 8);
        c.lineTo(x - 8, block.y1 - inset - 64);
        c.stroke();
      }
    } else {
      c.fillStyle = '#262b34';
      c.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
      c.fillStyle = 'rgba(255,255,255,0.025)';
      for (let i = 0; i < 10; i++) c.fillRect(block.x0 + rng() * (block.x1 - block.x0), block.y0 + rng() * (block.y1 - block.y0), 30 + rng() * 80, 2);
    }
    c.strokeStyle = COLORS.sidewalkEdge;
    c.lineWidth = 6;
    c.strokeRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 2;
    c.strokeRect(block.x0 + 5, block.y0 + 5, block.x1 - block.x0 - 10, block.y1 - block.y0 - 10);
  }

  for (const b of buildingsForRender()) drawBuilding(c, b);
  for (const tree of treesForRender()) drawTree(c, tree);
  for (const bench of benchesForRender()) drawBench(c, bench);
  for (const lamp of lampsForRender()) drawLamp(c, lamp);
  for (const crate of cratesForRender()) drawCrate(c, crate);

  return canvas;
}

function blocksForRender() {
  return CITY_CACHE.blocks;
}

function buildingsForRender() {
  return CITY_CACHE.buildings;
}

function treesForRender() {
  return CITY_CACHE.trees;
}

function benchesForRender() {
  return CITY_CACHE.benches;
}

function lampsForRender() {
  return CITY_CACHE.lamps;
}

function cratesForRender() {
  return CITY_CACHE.crates;
}

export const CITY_CACHE = { blocks: [], buildings: [], trees: [], benches: [], lamps: [], crates: [] };

export function useCityForRenderer(city) {
  CITY_CACHE.blocks = city.blocks;
  CITY_CACHE.buildings = city.buildings;
  CITY_CACHE.trees = city.trees;
  CITY_CACHE.benches = city.benches;
  CITY_CACHE.lamps = city.lamps;
  CITY_CACHE.crates = city.crates;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawRoadMarkings(c) {
  c.save();
  c.lineCap = 'butt';
  for (let k = 0; k <= 6; k++) {
    const y = k * CELL;
    c.strokeStyle = 'rgba(199,183,121,0.52)';
    c.lineWidth = 3;
    c.setLineDash([26, 26]);
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(WORLD.width, y);
    c.stroke();
    c.strokeStyle = 'rgba(210,214,220,0.16)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, y - 42);
    c.lineTo(WORLD.width, y - 42);
    c.moveTo(0, y + 42);
    c.lineTo(WORLD.width, y + 42);
    c.stroke();
    c.setLineDash([]);

    const x = k * CELL;
    c.strokeStyle = 'rgba(199,183,121,0.52)';
    c.lineWidth = 3;
    c.setLineDash([26, 26]);
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, WORLD.height);
    c.stroke();
    c.strokeStyle = 'rgba(210,214,220,0.16)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - 42, 0);
    c.lineTo(x - 42, WORLD.height);
    c.moveTo(x + 42, 0);
    c.lineTo(x + 42, WORLD.height);
    c.stroke();
    c.setLineDash([]);
  }
  c.fillStyle = 'rgba(235,238,242,0.34)';
  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      const x = i * CELL;
      const y = j * CELL;
      for (let n = 0; n < 5; n++) {
        c.fillRect(x - ROAD / 2 + 12 + n * 28, y - ROAD / 2 - 46, 15, 26);
        c.fillRect(x - ROAD / 2 + 12 + n * 28, y + ROAD / 2 + 20, 15, 26);
        c.fillRect(x - ROAD / 2 - 46, y - ROAD / 2 + 12 + n * 28, 26, 15);
        c.fillRect(x + ROAD / 2 + 20, y - ROAD / 2 + 12 + n * 28, 26, 15);
      }
    }
  }
  c.restore();
}

function drawBuilding(c, b) {
  const shadow = 8 + b.height * 2.4;
  c.fillStyle = 'rgba(0,0,0,0.46)';
  c.fillRect(b.x + shadow * 0.5, b.y + shadow * 0.55, b.w, b.h);
  c.fillStyle = b.wall;
  c.fillRect(b.x, b.y, b.w, b.h);
  c.fillStyle = b.roof;
  c.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.lineWidth = 3;
  c.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
  c.strokeStyle = 'rgba(170,210,255,0.08)';
  c.lineWidth = 1;
  c.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);

  const rows = Math.max(1, Math.floor((b.h - 20) / 16));
  const cols = Math.max(1, Math.floor((b.w - 20) / 17));
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const lit = hash01(r * 17 + q * 3 + b.x + b.y + b.lit * 40) > 0.68;
      c.fillStyle = lit ? `rgba(255,214,145,${0.14 + hash01(q + r) * 0.18})` : 'rgba(8,14,24,0.42)';
      c.fillRect(b.x + 14 + q * 17, b.y + 14 + r * 16, 8, 6);
    }
  }

  c.fillStyle = 'rgba(255,255,255,0.06)';
  c.fillRect(b.x + 6, b.y + 6, b.w - 12, 2);
  for (const ac of b.ac) {
    c.fillStyle = 'rgba(12,16,22,0.6)';
    c.fillRect(ac.x, ac.y, ac.w, ac.h);
    c.fillStyle = 'rgba(120,140,160,0.16)';
    c.fillRect(ac.x + 2, ac.y + 2, ac.w - 4, 3);
  }

  if (b.sign) {
    c.save();
    const neon = b.signColor;
    const fontSize = clamp(b.w / (b.sign.length * 0.62), 9, 22);
    c.font = `800 ${fontSize}px ${FONT_DISPLAY}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const tw = Math.min(b.w - 20, c.measureText(b.sign).width + 16);
    const sx = b.x + b.w / 2;
    const sy = b.y + b.h - 17;
    c.fillStyle = 'rgba(8,10,16,0.78)';
    roundRect(c, sx - tw / 2, sy - fontSize * 0.75, tw, fontSize * 1.5, 3);
    c.fill();
    c.shadowColor = neon;
    c.shadowBlur = 18;
    c.fillStyle = neon;
    c.fillText(b.sign, sx, sy + 1);
    c.shadowBlur = 0;
    c.strokeStyle = rgba(neon, 0.55);
    c.lineWidth = 1;
    roundRect(c, sx - tw / 2, sy - fontSize * 0.75, tw, fontSize * 1.5, 3);
    c.stroke();
    c.restore();
  }
}

function drawTree(c, tree) {
  c.fillStyle = 'rgba(0,0,0,0.38)';
  c.beginPath();
  c.ellipse(tree.x + 7, tree.y + 8, tree.r * 1.15, tree.r * 0.8, 0, 0, TAU);
  c.fill();
  c.fillStyle = tree.tone > 0.5 ? '#274b38' : '#22412f';
  c.beginPath();
  c.arc(tree.x, tree.y, tree.r, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(115,170,110,0.18)';
  c.beginPath();
  c.arc(tree.x - tree.r * 0.22, tree.y - tree.r * 0.24, tree.r * 0.62, 0, TAU);
  c.fill();
}

function drawBench(c, bench) {
  c.save();
  c.translate(bench.x, bench.y);
  c.rotate(bench.a);
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(-11, -4, 24, 9);
  c.fillStyle = '#4a3b2b';
  c.fillRect(-10, -3, 20, 5);
  c.fillStyle = '#2b241c';
  c.fillRect(-8, -5, 2, 2);
  c.fillRect(6, -5, 2, 2);
  c.restore();
}

function drawLamp(c, lamp) {
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.beginPath();
  c.arc(lamp.x + 3, lamp.y + 4, 5, 0, TAU);
  c.fill();
  c.fillStyle = '#3d4550';
  c.beginPath();
  c.arc(lamp.x, lamp.y, 3.4, 0, TAU);
  c.fill();
  c.fillStyle = lamp.tone > 0.55 ? '#ffd79a' : '#a8ddff';
  c.beginPath();
  c.arc(lamp.x, lamp.y, 1.7, 0, TAU);
  c.fill();
}

function drawCrate(c, crate) {
  c.save();
  c.translate(crate.x, crate.y);
  c.fillStyle = 'rgba(0,0,0,0.4)';
  c.fillRect(-crate.s / 2 + 4, -crate.s / 2 + 4, crate.s, crate.s);
  c.fillStyle = '#6a5233';
  c.fillRect(-crate.s / 2, -crate.s / 2, crate.s, crate.s);
  c.strokeStyle = 'rgba(230,200,150,0.3)';
  c.lineWidth = 1;
  c.strokeRect(-crate.s / 2 + 2, -crate.s / 2 + 2, crate.s - 4, crate.s - 4);
  c.restore();
}
