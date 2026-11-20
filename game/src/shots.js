import { makeCar, spawnTrafficCar, spawnPoliceCar } from './vehicles.js';
import { spawnPed, spawnCop, spawnHostile, startlePeds, fireBullet } from './actors.js';
import { beginStep } from './missions.js';
import { CELL } from './config.js';
import { burst } from './effects.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearActors(game) {
  game.cars = game.cars.filter((c) => c.kind === 'parked');
  game.peds.length = 0;
  game.cops.length = 0;
  game.hostiles.length = 0;
  game.bullets.length = 0;
  game.effects.particles.length = 0;
  game.effects.notifications.length = 0;
  game.effects.floats.length = 0;
  game.dialogue = null;
  game.dialogueQueue.length = 0;
  game.wanted.heat = 0;
  game.wanted.stars = 0;
}

function spawnAmbient(game, near, cars = 7, peds = 12) {
  for (let i = 0; i < cars; i++) spawnTrafficCar(game, near);
  for (let i = 0; i < peds; i++) spawnPed(game, { minDist: 90, maxDist: 760 });
}

function playerCarAt(game, x, y, angle, color, name) {
  const car = makeCar({ x, y, angle, kind: 'player', color, name });
  game.cars.push(car);
  game.player.inCar = true;
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  car.speed = 230;
  return car;
}

export function stageShot(game, name) {
  game.rng = mulberry(4242);
  clearActors(game);
  game.mission.done = false;
  game.mission.delay = 0;
  game.time = 12;
  game.weather = 'clear';
  game.screen = 'play';
  game.ui.hover = null;
  game.shotName = name;

  if (name === 'start') {
    game.screen = 'start';
    game.camera.x = 3 * CELL + 40;
    game.camera.y = 2 * CELL + 80;
    game.camera.zoom = 0.72;
    game.mission.index = 0;
    game.mission.step = 0;
    game.mission.marker = null;
    game.player.x = 3 * CELL - 120;
    game.player.y = 3 * CELL + 120;
    game.player.inCar = false;
    game.player.car = null;
    game.player.health = 100;
    game.money = 1480;
    game.wanted.heat = 0;
    game.wanted.stars = 0;
    spawnAmbient(game, { x: game.camera.x, y: game.camera.y }, 10, 18);
    game.audio.engine(false, 0);
    return;
  }

  if (name === 'drive') {
    const car = playerCarAt(game, 2180, 2 * CELL + 28, 0, '#a13f4a', 'Corsa 88');
    game.camera.x = car.x + 90;
    game.camera.y = car.y - 30;
    game.camera.zoom = 0.82;
    game.mission.index = 0;
    game.mission.step = 2;
    beginStep(game, true);
    game.mission.marker = { ...game.city.landmarks.docks.pos, label: 'Dock 9' };
    game.money = 1840;
    game.player.health = 92;
    game.wanted.heat = 0;
    spawnAmbient(game, { x: car.x, y: car.y }, 9, 16);
    spawnPed(game, { x: car.x + 230, y: car.y + 108, minDist: 0 });
    spawnPed(game, { x: car.x + 340, y: car.y - 102, minDist: 0 });
    return;
  }

  if (name === 'chase') {
    const car = playerCarAt(game, 1850, 2 * CELL + 28, 0, '#1f4d5c', 'Manta GT');
    car.speed = 285;
    game.camera.x = car.x + 70;
    game.camera.y = car.y - 36;
    game.camera.zoom = 0.86;
    game.weather = 'rain';
    game.mission.index = 1;
    game.mission.step = 2;
    game.mission.marker = { ...game.city.landmarks.pawn.pos, label: 'Gold Tooth Pawn' };
    game.mission.markerRadius = 72;
    game.money = 2260;
    game.player.health = 76;
    game.wanted.heat = 2.62;
    game.wanted.stars = 3;
    game.wanted.flash = 0.8;
    const p1 = spawnPoliceCar(game, car.x - 138, car.y - 66, 0.04);
    p1.speed = 300;
    const p2 = spawnPoliceCar(game, car.x - 260, car.y + 58, 0.02);
    p2.speed = 315;
    const p3 = spawnPoliceCar(game, car.x + 240, car.y - 112, Math.PI);
    p3.speed = 240;
    for (let i = 0; i < 7; i++) spawnTrafficCar(game, { x: car.x + 260, y: car.y }, 0);
    for (let i = 0; i < 10; i++) spawnPed(game, { minDist: 140, maxDist: 700 });
    spawnCop(game, { x: car.x + 120, y: car.y - 120 });
    game.cops[0].fire = 0.4;
    for (let i = 0; i < 3; i++) {
      game.bullets.push({
        x: car.x - 60 + i * 20,
        y: car.y + 40 + i * 6,
        vx: 820,
        vy: -80,
        life: 0.4,
        owner: 'cop',
        damage: 6,
      });
    }
    burst(game.effects, car.x - 160, car.y - 60, 6, { speed: 160, life: 0.3, color: '#ffd27a', size: 2, angle: 0, spread: 0.8 });
    game.dialogue = { who: 'VPD Dispatch', text: 'All units, stolen vehicle heading east on Heron Avenue. Suspect is armed.', time: 9 };
    return;
  }

  if (name === 'mission') {
    const lm = game.city.landmarks.foundry.pos;
    game.player.inCar = false;
    game.player.car = null;
    game.player.x = lm.x + 10;
    game.player.y = lm.y + 26;
    game.player.angle = -0.35;
    game.player.health = 68;
    game.camera.x = game.player.x + 40;
    game.camera.y = game.player.y - 10;
    game.camera.zoom = 0.98;
    game.weather = 'rain';
    game.mission.index = 2;
    game.mission.step = 1;
    game.mission.tag = 'ledger';
    game.mission.marker = { ...lm, label: 'Foundry Row' };
    game.mission.markerRadius = 120;
    game.money = 3140;
    game.wanted.heat = 1.7;
    game.wanted.stars = 2;
    game.wanted.flash = 0.5;
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.7;
      spawnHostile(game, { x: lm.x + Math.cos(a) * (150 + i * 18), y: lm.y + Math.sin(a) * (120 + i * 14), tag: 'ledger' });
    }
    const dead = spawnHostile(game, { x: lm.x - 120, y: lm.y + 90, tag: 'ledger' });
    dead.dead = true;
    dead.deadTime = 2;
    spawnCop(game, { x: lm.x + 260, y: lm.y - 170 });
    spawnPed(game, { x: lm.x - 210, y: lm.y - 130, minDist: 0 });
    for (let i = 0; i < 8; i++) spawnPed(game, { minDist: 280, maxDist: 760 });
    for (let i = 0; i < 2; i++) spawnTrafficCar(game, { x: lm.x, y: lm.y });
    fireBullet(game, game.player.x, game.player.y, -0.4, 'player', 26);
    fireBullet(game, lm.x + 170, lm.y - 30, Math.PI + 0.15, 'hostile', 10);
    fireBullet(game, lm.x + 205, lm.y + 40, Math.PI - 0.1, 'hostile', 10);
    burst(game.effects, game.player.x + 24, game.player.y - 10, 10, { speed: 140, life: 0.4, color: '#ffd27a', size: 2.2, angle: -0.4, spread: 0.9 });
    startlePeds(game, lm.x, lm.y, 700);
    game.dialogue = { who: 'Marlow', text: "Sable's courier. You're standing on my floor, spending my money.", time: 9 };
    return;
  }
}
