import { CELL, ROAD, GRID, WORLD, COLORS } from './config.js';
import { mulberry32, pick, chance, range, clamp, dist } from './util.js';

const SIGNS = [
  'NOODLE', 'VOLT', 'PAWN', 'HOTEL', '24H', 'MOTEL', 'ARCADE', 'LIQUOR',
  'TATTOO', 'DINER', 'GARAGE', 'LAUNDRY', 'PHARMACY', 'CINEMA', 'RECORDS',
];

const LANDMARKS = [
  { key: 'safehouse', label: "Rook's Safehouse", block: [2, 4], side: 'n', type: 'city' },
  { key: 'diner', label: 'Blue Heron Diner', block: [3, 2], side: 'w', type: 'city' },
  { key: 'docks', label: 'Dock 9', block: [5, 4], side: 'n', type: 'docks' },
  { key: 'pawn', label: 'Gold Tooth Pawn', block: [1, 3], side: 's', type: 'city' },
  { key: 'foundry', label: 'Foundry Row', block: [5, 1], side: 'w', type: 'industrial' },
  { key: 'garage', label: 'Arcadia Garage', block: [2, 0], side: 's', type: 'city' },
  { key: 'hospital', label: 'Mercy Hospital', block: [0, 5], side: 'e', type: 'city' },
  { key: 'police', label: 'Vela PD', block: [4, 0], side: 'w', type: 'city' },
];

const LANDMARK_SIGNS = {
  safehouse: 'ROOK',
  diner: 'BLUE HERON',
  docks: 'DOCK 9',
  pawn: 'GOLD TOOTH',
  foundry: 'FOUNDRY',
  garage: 'ARCADIA',
  hospital: 'MERCY',
  police: 'VPD',
};

function blockRect(i, j) {
  return {
    i,
    j,
    x0: i * CELL + ROAD / 2,
    y0: j * CELL + ROAD / 2,
    x1: (i + 1) * CELL - ROAD / 2,
    y1: (j + 1) * CELL - ROAD / 2,
  };
}

export function sidePoint(block, side, t = 0.5, inset = 22) {
  const x = block.x0 + (block.x1 - block.x0) * t;
  const y = block.y0 + (block.y1 - block.y0) * t;
  if (side === 'n') return { x, y: block.y0 - inset };
  if (side === 's') return { x, y: block.y1 + inset };
  if (side === 'w') return { x: block.x0 - inset, y };
  return { x: block.x1 + inset, y };
}

function makeBuilding(x, y, w, h, rng, height) {
  const roof = pick(rng, COLORS.roof);
  const wall = pick(rng, COLORS.wall);
  return {
    x, y, w, h,
    height,
    roof,
    wall,
    sign: null,
    signColor: null,
    lit: rng(),
    ac: [
      { x: x + w * range(rng, 0.15, 0.55), y: y + h * range(rng, 0.15, 0.55), w: range(rng, 10, 24), h: range(rng, 8, 18) },
      { x: x + w * range(rng, 0.55, 0.8), y: y + h * range(rng, 0.2, 0.7), w: range(rng, 8, 16), h: range(rng, 8, 14) },
    ],
  };
}

function cityBuildings(block, rng, forcedSign) {
  const out = [];
  const pad = 30;
  const inner = {
    x: block.x0 + pad,
    y: block.y0 + pad,
    w: block.x1 - block.x0 - pad * 2,
    h: block.y1 - block.y0 - pad * 2,
  };
  const cols = inner.w > 330 ? 2 : 1;
  const rows = inner.h > 330 ? 2 : 1;
  const gap = range(rng, 18, 34);
  const bw = (inner.w - gap * (cols - 1)) / cols;
  const bh = (inner.h - gap * (rows - 1)) / rows;
  let signPlaced = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (chance(rng, 0.07)) continue;
      const shrinkW = range(rng, 0, Math.min(18, bw * 0.16));
      const shrinkH = range(rng, 0, Math.min(18, bh * 0.16));
      const x = inner.x + c * (bw + gap) + range(rng, 0, 10);
      const y = inner.y + r * (bh + gap) + range(rng, 0, 10);
      const w = bw - shrinkW - range(rng, 0, 8);
      const h = bh - shrinkH - range(rng, 0, 8);
      if (w < 44 || h < 44) continue;
      const height = Math.floor(range(rng, 2, 13));
      const building = makeBuilding(x, y, w, h, rng, height);
      if (!signPlaced && chance(rng, 0.45)) {
        building.sign = pick(rng, SIGNS);
        building.signColor = pick(rng, COLORS.neon);
        signPlaced = true;
      }
      out.push(building);
    }
  }
  if (!signPlaced && out.length > 0 && forcedSign) {
    const b = out[Math.floor(rng() * out.length)];
    b.sign = forcedSign;
    b.signColor = pick(rng, COLORS.neon);
  }
  return out;
}

function parkProps(block, rng) {
  const trees = [];
  const benches = [];
  const inner = { x: block.x0 + 30, y: block.y0 + 30, w: block.x1 - block.x0 - 60, h: block.y1 - block.y0 - 60 };
  for (let i = 0; i < 13; i++) {
    trees.push({
      x: inner.x + rng() * inner.w,
      y: inner.y + rng() * inner.h,
      r: range(rng, 13, 26),
      tone: rng(),
    });
  }
  for (let i = 0; i < 4; i++) {
    benches.push({ x: inner.x + rng() * inner.w, y: inner.y + rng() * inner.h, a: rng() * Math.PI });
  }
  return { trees, benches };
}

function lotParking(block) {
  const spots = [];
  const inset = 54;
  const x0 = block.x0 + inset;
  const y0 = block.y0 + inset;
  const x1 = block.x1 - inset;
  const y1 = block.y1 - inset;
  const bw = (x1 - x0) / 5;
  for (let i = 0; i < 5; i++) {
    spots.push({ x: x0 + bw * (i + 0.5), y: y0 + 28, a: Math.PI / 2 });
    spots.push({ x: x0 + bw * (i + 0.5), y: y1 - 28, a: -Math.PI / 2 });
  }
  return spots;
}

export function createCity(seed = 73021) {
  const rng = mulberry32(seed);
  const blocks = [];
  const buildings = [];
  const lamps = [];
  const trees = [];
  const benches = [];
  const parkingSpots = [];
  const crates = [];
  const landmarks = {};

  const byKey = new Map(LANDMARKS.map((l) => [`${l.block[0]},${l.block[1]}`, l]));

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const rect = blockRect(i, j);
      const lm = byKey.get(`${i},${j}`);
      const type = lm?.type ?? (chance(rng, 0.13) ? 'park' : chance(rng, 0.22) ? 'lot' : 'city');
      const block = { ...rect, type, landmark: lm?.key ?? null, name: lm?.label ?? null };
      blocks.push(block);

      if (type === 'park') {
        const props = parkProps(block, rng);
        trees.push(...props.trees);
        benches.push(...props.benches);
      } else if (type === 'lot') {
        parkingSpots.push(...lotParking(block));
      } else {
        const forced = lm ? LANDMARK_SIGNS[lm.key] : null;
        buildings.push(...cityBuildings(block, rng, forced));
      }

      if (lm) {
        landmarks[lm.key] = {
          key: lm.key,
          label: lm.label,
          block: [i, j],
          pos: sidePoint(block, lm.side, 0.5, 22),
        };
      }

      trees.push({ x: block.x0 + range(rng, 10, 24), y: block.y0 + range(rng, 18, 40), r: range(rng, 8, 13), tone: rng() });
      trees.push({ x: block.x1 - range(rng, 10, 24), y: block.y1 - range(rng, 18, 40), r: range(rng, 8, 13), tone: rng() });
      benches.push({ x: block.x0 + range(rng, 30, 60), y: block.y1 - 12, a: 0 });
      lamps.push({ x: block.x0 - 6, y: block.y0 - 6, r: range(rng, 130, 176), tone: rng() });
      lamps.push({ x: block.x1 + 6, y: block.y1 + 6, r: range(rng, 130, 176), tone: rng() });
      if (rng() < 0.5) lamps.push({ x: block.x1 + 6, y: block.y0 - 6, r: range(rng, 120, 160), tone: rng() });
    }
  }

  for (const b of buildings) {
    if (b.sign) continue;
    if (chance(rng, 0.18)) {
      b.sign = pick(rng, SIGNS);
      b.signColor = pick(rng, COLORS.neon);
    }
  }

  const docks = landmarks.docks;
  if (docks) {
    for (let i = 0; i < 10; i++) {
      crates.push({
        x: docks.pos.x + range(rng, -120, 120),
        y: docks.pos.y + range(rng, -30, 90),
        s: range(rng, 12, 24),
      });
    }
  }

  const solidRects = buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));

  const city = {
    seed,
    blocks,
    buildings,
    lamps,
    trees,
    benches,
    parkingSpots,
    crates,
    landmarks,
    solidRects,
    bounds: { x: 26, y: 26, w: WORLD.width - 52, h: WORLD.height - 52 },
  };
  city.grid = buildSolidGrid(solidRects);
  return city;
}

function buildSolidGrid(rects) {
  const size = 180;
  const map = new Map();
  const key = (x, y) => `${x},${y}`;
  for (const r of rects) {
    const x0 = Math.floor(r.x / size);
    const x1 = Math.floor((r.x + r.w) / size);
    const y0 = Math.floor(r.y / size);
    const y1 = Math.floor((r.y + r.h) / size);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = key(x, y);
        let list = map.get(k);
        if (!list) map.set(k, (list = []));
        list.push(r);
      }
    }
  }
  return { size, map };
}

export function nearbySolids(city, x, y, r) {
  const { size, map } = city.grid;
  const x0 = Math.floor((x - r) / size);
  const x1 = Math.floor((x + r) / size);
  const y0 = Math.floor((y - r) / size);
  const y1 = Math.floor((y + r) / size);
  const out = [];
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const list = map.get(`${gx},${gy}`);
      if (list) for (const rect of list) if (!out.includes(rect)) out.push(rect);
    }
  }
  return out;
}

export function collideCircle(city, x, y, r) {
  let px = x;
  let py = y;
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const rects = nearbySolids(city, px, py, r + 2);
    for (const rect of rects) {
      const nx = clamp(px, rect.x, rect.x + rect.w);
      const ny = clamp(py, rect.y, rect.y + rect.h);
      let dx = px - nx;
      let dy = py - ny;
      let d = Math.hypot(dx, dy);
      if (d >= r) continue;
      hit = true;
      if (d < 0.0001) {
        const left = px - rect.x;
        const right = rect.x + rect.w - px;
        const top = py - rect.y;
        const bottom = rect.y + rect.h - py;
        const m = Math.min(left, right, top, bottom);
        if (m === left) {
          px = rect.x - r;
          dy = 0;
          dx = -1;
        } else if (m === right) {
          px = rect.x + rect.w + r;
          dx = 1;
          dy = 0;
        } else if (m === top) {
          py = rect.y - r;
          dx = 0;
          dy = -1;
        } else {
          py = rect.y + rect.h + r;
          dx = 0;
          dy = 1;
        }
        d = 1;
      }
      px = nx + (dx / d) * (r + 0.4);
      py = ny + (dy / d) * (r + 0.4);
    }
  }
  const b = city.bounds;
  px = clamp(px, b.x + r, b.x + b.w - r);
  py = clamp(py, b.y + r, b.y + b.h - r);
  return { x: px, y: py, hit };
}

export function roadSpawn(city, rng, near = null, minDist = 0, maxDist = Infinity) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const horizontal = rng() < 0.5;
    const line = Math.floor(rng() * GRID);
    const along = range(rng, ROAD, WORLD.width - ROAD);
    const side = rng() < 0.5 ? 1 : -1;
    const lane = 26 * side;
    let x;
    let y;
    let angle;
    if (horizontal) {
      x = along;
      y = line * CELL + lane;
      angle = side > 0 ? 0 : Math.PI;
    } else {
      x = line * CELL + lane;
      y = along;
      angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    if (near) {
      const d = dist(x, y, near.x, near.y);
      if (d < minDist || d > maxDist) continue;
    }
    return { x, y, angle };
  }
  return { x: WORLD.width / 2, y: WORLD.height / 2, angle: 0 };
}

export function pedSpawn(city, rng, near = null, minDist = 160, maxDist = 980) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const block = pick(rng, city.blocks);
    const side = pick(rng, ['n', 's', 'e', 'w']);
    const p = sidePoint(block, side, range(rng, 0.12, 0.88), -10);
    const x = clamp(p.x, block.x0 + 6, block.x1 - 6);
    const y = clamp(p.y, block.y0 + 6, block.y1 - 6);
    if (near) {
      const d = dist(x, y, near.x, near.y);
      if (d < minDist || d > maxDist) continue;
    }
    return { x, y };
  }
  return { x: WORLD.width / 2, y: WORLD.height / 2 };
}

export function isRoad(x, y) {
  const mx = ((x % CELL) + CELL) % CELL;
  const my = ((y % CELL) + CELL) % CELL;
  return mx < ROAD / 2 || mx > CELL - ROAD / 2 || my < ROAD / 2 || my > CELL - ROAD / 2;
}

export function nearestLandmark(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const lm of Object.values(city.landmarks)) {
    const d = dist(x, y, lm.pos.x, lm.pos.y);
    if (d < bestD) {
      bestD = d;
      best = lm;
    }
  }
  return { landmark: best, distance: bestD };
}
