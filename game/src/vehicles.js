import { CELL, GRID, VEHICLE, COLORS } from './config.js';
import { clamp, dist, angleDelta, angleTo, pick, range } from './util.js';
import { roadSpawn, collideCircle } from './world.js';
import { burst, trafficColor, shockwave } from './effects.js';

const CAR_NAMES = [
  'Vireo LX', 'Corsa 88', 'Manta GT', 'Talon RS', 'Kite S', 'Bison V8',
  'Marlin 5', 'Heron 300', 'Sable Cab', 'Driftline R',
];

export function makeCar(opts) {
  return {
    x: opts.x,
    y: opts.y,
    angle: opts.angle ?? 0,
    speed: 0,
    kind: opts.kind ?? 'parked',
    color: opts.color ?? '#9aa7b4',
    name: opts.name ?? 'Vireo LX',
    radius: VEHICLE.radius,
    length: 92,
    width: 44,
    hp: opts.hp ?? 100,
    cruise: opts.cruise ?? range(Math.random, 128, 190),
    dir: opts.dir ?? { x: Math.cos(opts.angle ?? 0), y: Math.sin(opts.angle ?? 0) },
    target: null,
    wheel: 0,
    stuck: 0,
    siren: opts.siren ?? false,
    lights: Math.random(),
  };
}

function dirIndex(dir) {
  if (dir.x > 0.5) return 0;
  if (dir.y > 0.5) return 1;
  if (dir.x < -0.5) return 2;
  return 3;
}

const DIRS = [
  { x: 1, y: 0, a: 0 },
  { x: 0, y: 1, a: Math.PI / 2 },
  { x: -1, y: 0, a: Math.PI },
  { x: 0, y: -1, a: -Math.PI / 2 },
];

function laneOffset(dir) {
  const d = DIRS[dirIndex(dir)];
  return { x: -d.y * 24, y: d.x * 24 };
}

function nextNode(x, y, dir) {
  const d = DIRS[dirIndex(dir)];
  let ni = Math.round(x / CELL);
  let nj = Math.round(y / CELL);
  if (d.x > 0) ni = Math.floor(x / CELL) + 1;
  else if (d.x < 0) ni = Math.ceil(x / CELL) - 1;
  else if (d.y > 0) nj = Math.floor(y / CELL) + 1;
  else nj = Math.ceil(y / CELL) - 1;
  return { i: clamp(ni, 0, GRID), j: clamp(nj, 0, GRID) };
}

function waypointFor(node, dir) {
  const d = DIRS[dirIndex(dir)];
  const off = laneOffset(dir);
  return {
    x: node.i * CELL + off.x,
    y: node.j * CELL + off.y,
    a: d.a,
  };
}

function chooseDir(node, current) {
  const back = (dirIndex(current) + 2) % 4;
  const options = [0, 1, 2, 3].filter((d) => {
    if (d === back) return false;
    const dir = DIRS[d];
    const ni = node.i + dir.x;
    const nj = node.j + dir.y;
    return ni >= 0 && ni <= GRID && nj >= 0 && nj <= GRID;
  });
  if (options.length === 0) return DIRS[back];
  const straight = dirIndex(current);
  if (options.includes(straight) && Math.random() < 0.57) return DIRS[straight];
  return DIRS[pick(Math.random, options)];
}

export function spawnTrafficCar(game, near) {
  const s = roadSpawn(game.city, game.rng, near, 320, 1900);
  const angle = s.angle;
  const car = makeCar({
    x: s.x,
    y: s.y,
    angle,
    kind: 'traffic',
    color: trafficColor(game.rng),
    name: pick(game.rng, CAR_NAMES),
    cruise: range(game.rng, 118, 188),
  });
  car.dir = { x: Math.cos(angle), y: Math.sin(angle) };
  car.target = waypointFor(nextNode(s.x, s.y, car.dir), car.dir);
  game.cars.push(car);
  return car;
}

export function spawnParkedCar(game, spot) {
  const car = makeCar({
    x: spot.x,
    y: spot.y,
    angle: spot.a,
    kind: 'parked',
    color: trafficColor(game.rng),
    name: CAR_NAMES[Math.floor(game.rng() * CAR_NAMES.length) % CAR_NAMES.length],
  });
  game.cars.push(car);
  return car;
}

export function spawnPoliceCar(game, x, y, angle) {
  const car = makeCar({
    x,
    y,
    angle,
    kind: 'police',
    color: COLORS.policeCar,
    name: 'VPD Cruiser',
    hp: 160,
    siren: true,
  });
  car.dir = { x: Math.cos(angle), y: Math.sin(angle) };
  car.speed = 0;
  game.cars.push(car);
  return car;
}

export function nearestCar(game, x, y, maxDist = 110, exclude = null) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car === exclude) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function updatePlayerCar(game, dt) {
  const car = game.player.car;
  if (!car) return;
  const input = game.input;
  const throttle = input.anyDown('KeyW', 'ArrowUp');
  const brake = input.anyDown('KeyS', 'ArrowDown');
  const steer = (input.anyDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.anyDown('KeyA', 'ArrowLeft') ? 1 : 0);
  const handbrake = input.down('Space');

  if (throttle) {
    car.speed += VEHICLE.accel * dt * (1 - Math.max(0, car.speed) / (VEHICLE.maxSpeed * 1.08));
  }
  if (brake) {
    if (car.speed > 12) car.speed -= VEHICLE.brake * dt;
    else car.speed -= VEHICLE.accel * 0.62 * dt;
  }
  if (!throttle && !brake) {
    const drag = (34 + Math.abs(car.speed) * 0.65) * dt;
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag);
  }
  if (handbrake) {
    car.speed *= 1 - 2.8 * dt;
    if (Math.abs(car.speed) > 120 && Math.random() < 0.6) {
      burst(game.effects, car.x - Math.cos(car.angle) * 28, car.y - Math.sin(car.angle) * 28, 1, {
        speed: 30, life: 0.45, color: '#8b8f96', size: 5, gravity: -10, glow: false, kind: 'smoke',
      });
    }
  }
  car.speed = clamp(car.speed, -VEHICLE.reverseSpeed, VEHICLE.maxSpeed);

  const grip = Math.abs(car.speed) < 20 ? 0 : clamp(Math.abs(car.speed) / 145, 0.1, 1);
  const turn = steer * VEHICLE.steer * dt * grip * (handbrake ? 1.62 : 1) * (car.speed < 0 ? -1 : 1);
  car.angle += turn;
  if (steer !== 0) car.wheel += turn * 3;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const corrected = collideCircle(game.city, nx, ny, 29);
  if (corrected.hit) {
    const impact = Math.abs(car.speed);
    if (impact > 150) {
      game.effects.shake = Math.min(16, game.effects.shake + impact * 0.035);
      burst(game.effects, car.x, car.y, Math.min(18, 4 + impact * 0.05), {
        speed: 150, life: 0.5, color: '#ffd27a', size: 2.4, gravity: 150,
      });
      game.audio.hit();
      car.hp -= impact * 0.03;
    }
    car.speed *= -0.18;
  }
  car.x = corrected.x;
  car.y = corrected.y;

  if (Math.abs(car.speed) > 80 && Math.random() < 0.25) {
    burst(game.effects, car.x - Math.cos(car.angle) * 34, car.y - Math.sin(car.angle) * 34, 1, {
      speed: 18, life: 0.5, color: '#7d8694', size: 4.5, gravity: -8, glow: false, kind: 'smoke',
    });
  }
}

export function updateTrafficCar(car, game, dt) {
  if (!car.target) {
    car.target = waypointFor(nextNode(car.x, car.y, car.dir), car.dir);
  }
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 34) {
    const node = nextNode(car.x, car.y, car.dir);
    const dir = chooseDir(node, car.dir);
    car.dir = { x: dir.x, y: dir.y };
    car.target = waypointFor(nextNode(car.x, car.y, car.dir), car.dir);
  }
  const desired = angleTo(car.x, car.y, car.target.x, car.target.y);
  const delta = angleDelta(car.angle, desired);
  car.angle += clamp(delta, -1.9 * dt, 1.9 * dt);
  const targetSpeed = car.cruise * (Math.abs(delta) > 0.8 ? 0.5 : 1);
  car.speed += clamp(targetSpeed - car.speed, -220 * dt, 160 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const c = collideCircle(game.city, nx, ny, 24);
  car.x = c.x;
  car.y = c.y;
  if (c.hit) car.speed *= 0.5;
  car.wheel += car.speed * dt * 0.08;

  const p = game.player;
  const pd = dist(car.x, car.y, p.x, p.y);
  if (!p.inCar && pd < p.radius + 22 && car.speed > 70) {
    car.speed *= 0.75;
    game.hurtPlayer(14, car.x, car.y);
    burst(game.effects, p.x, p.y, 10, { speed: 150, life: 0.5, color: '#b54747', size: 2.2, gravity: 220 });
  }
}

export function updatePoliceCar(car, game, dt) {
  const target = game.player.inCar ? game.player.car : game.player;
  if (!target) return;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const d = Math.hypot(dx, dy);
  const desired = Math.atan2(dy, dx);
  const delta = angleDelta(car.angle, desired);
  const aggro = game.wanted.heat >= 3 ? 1.25 : 1;
  car.angle += clamp(delta, -2.5 * dt * aggro, 2.5 * dt * aggro);
  let targetSpeed = 0;
  if (d > 150) targetSpeed = 350 * aggro;
  else if (d > 85) targetSpeed = 200;
  else targetSpeed = 20;
  if (Math.abs(delta) > 1.2) targetSpeed *= 0.45;
  car.speed += clamp(targetSpeed - car.speed, -520 * dt, 430 * dt);
  car.speed = clamp(car.speed, -100, 450);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const c = collideCircle(game.city, nx, ny, 29);
  car.x = c.x;
  car.y = c.y;
  if (c.hit) {
    car.speed = -70;
    car.stuck += dt;
    if (car.stuck > 1.2) {
      car.angle += (Math.random() - 0.5) * 1.4;
      car.stuck = 0;
    }
  } else car.stuck = Math.max(0, car.stuck - dt);
  car.wheel += car.speed * dt * 0.08;

  if (d < 62 && car.speed > 130 && !game.player.inCar) {
    game.hurtPlayer(9, car.x, car.y);
  }
}

export function updateCars(game, dt) {
  for (const car of game.cars) {
    if (car.kind === 'traffic') updateTrafficCar(car, game, dt);
    else if (car.kind === 'police') updatePoliceCar(car, game, dt);
    else if (car.kind === 'player') updatePlayerCar(game, dt);
  }
  resolveCarCollisions(game);
}

export function resolveCarCollisions(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 58 * 58 || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const overlap = (58 - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      const aMobile = a.kind !== 'parked';
      const bMobile = b.kind !== 'parked';
      if (a.kind === 'player' || b.kind === 'player') {
        const impact = Math.max(Math.abs(a.speed), Math.abs(b.speed));
        if (impact > 170) {
          game.effects.shake = Math.min(14, game.effects.shake + impact * 0.025);
          burst(game.effects, (a.x + b.x) / 2, (a.y + b.y) / 2, 12, {
            speed: 190, life: 0.5, color: '#ffe6a3', size: 2.5, gravity: 140,
          });
          game.audio.hit();
        }
        a.speed *= 0.45;
        b.speed *= 0.45;
      }
      if (aMobile) {
        a.x -= ux * overlap;
        a.y -= uy * overlap;
      }
      if (bMobile) {
        b.x += ux * overlap;
        b.y += uy * overlap;
      }
    }
  }
}

export function enterVehicle(game, car) {
  if (game.player.inCar) return false;
  if (car.kind === 'police') {
    game.addHeat(1.1, 'Police cruiser stolen');
  } else if (car.kind === 'traffic') {
    game.addHeat(0.45, 'Grand theft auto', true);
    game.dropDriver(car);
  }
  car.kind = 'player';
  car.speed = 0;
  game.player.inCar = true;
  game.player.car = car;
  game.player.x = car.x;
  game.player.y = car.y;
  game.audio.ui();
  game.notify('Vehicle acquired', `${car.name} · E to exit`, COLORS.white, 2.6);
  return true;
}

export function exitVehicle(game) {
  const car = game.player.car;
  if (!car) return;
  game.player.inCar = false;
  game.player.car = null;
  car.kind = 'parked';
  car.speed = 0;
  const a = car.angle + Math.PI / 2;
  game.player.x = car.x + Math.cos(a) * 48;
  game.player.y = car.y + Math.sin(a) * 48;
  const c = collideCircle(game.city, game.player.x, game.player.y, 13);
  game.player.x = c.x;
  game.player.y = c.y;
  game.player.angle = car.angle;
  game.audio.ui();
}

export function damageVehicle(game, car, amount, fromX, fromY) {
  if (car.kind === 'player') {
    game.hurtPlayer(amount * 0.55, fromX, fromY);
    game.effects.shake = Math.min(10, game.effects.shake + 2);
    return;
  }
  car.hp -= amount;
  if (car.hp <= 0) {
    burst(game.effects, car.x, car.y, 30, {
      speed: 260, life: 0.9, color: '#ff9b4a', size: 4, gravity: 0, glow: true,
    });
    shockwave(game.effects, car.x, car.y, 130, '#ffae5e');
    game.audio.explosion();
    car.kind = 'wreck';
    car.speed = 0;
    car.color = '#22242a';
  }
}
