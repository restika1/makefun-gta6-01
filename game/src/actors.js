import { PLAYER, WANTED, COLORS } from './config.js';
import { clamp, dist, angleTo, angleDelta, pick, range } from './util.js';
import { collideCircle, pedSpawn, roadSpawn } from './world.js';
import { burst, floatText, notify, shockwave } from './effects.js';
import { enterVehicle, exitVehicle, nearestCar, damageVehicle, spawnPoliceCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    health: PLAYER.maxHealth,
    stamina: 100,
    inCar: false,
    car: null,
    lastDamage: -99,
    fireCooldown: 0,
    punchCooldown: 0,
    walkPhase: 0,
    moving: false,
    sprinting: false,
  };
}

export function createPed(game, opts = {}) {
  const pos = opts.x !== undefined ? { x: opts.x, y: opts.y } : pedSpawn(game.city, game.rng, game.player, opts.minDist ?? 240, opts.maxDist ?? 900);
  return {
    x: pos.x,
    y: pos.y,
    angle: opts.angle ?? Math.random() * Math.PI * 2,
    speed: range(game.rng, 34, 58),
    state: 'walk',
    stateTime: range(game.rng, 1, 5),
    hp: 30,
    dead: false,
    color: pick(game.rng, COLORS.ped),
    skin: pick(game.rng, ['#d9a277', '#b67a52', '#8d5a3b', '#e5bb95']),
    phase: Math.random() * 10,
    fleeFrom: null,
  };
}

export function spawnPed(game, opts = {}) {
  const ped = createPed(game, opts);
  game.peds.push(ped);
  return ped;
}

export function dropDriver(game, car) {
  const side = Math.random() < 0.5 ? 1 : -1;
  const x = car.x + Math.cos(car.angle + Math.PI / 2) * 38 * side;
  const y = car.y + Math.sin(car.angle + Math.PI / 2) * 38 * side;
  const ped = createPed(game, { x, y, minDist: 0 });
  ped.state = 'flee';
  ped.stateTime = 6;
  ped.fleeFrom = { x: car.x, y: car.y };
  game.peds.push(ped);
}

export function startlePeds(game, x, y, radius = 600) {
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.stateTime = range(game.rng, 5, 8);
      ped.fleeFrom = { x, y };
    }
  }
}

export function updatePeds(game, dt) {
  for (const ped of game.peds) {
    if (ped.dead) {
      ped.deadTime = (ped.deadTime ?? 0) + dt;
      continue;
    }
    ped.phase += dt * 7;
    ped.stateTime -= dt;
    if (ped.state === 'flee') {
      const from = ped.fleeFrom ?? game.player;
      ped.angle = angleTo(from.x, from.y, ped.x, ped.y) + Math.sin(ped.phase * 0.7) * 0.18;
      const speed = 128;
      const nx = ped.x + Math.cos(ped.angle) * speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * speed * dt;
      const c = collideCircle(game.city, nx, ny, 9);
      ped.x = c.x;
      ped.y = c.y;
      if (ped.stateTime <= 0 && game.wanted.heat <= 0) {
        ped.state = 'walk';
        ped.stateTime = range(game.rng, 2, 6);
      }
      continue;
    }
    if (ped.stateTime <= 0) {
      ped.angle += (game.rng() - 0.5) * 2.4;
      ped.stateTime = range(game.rng, 2.5, 6);
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    const c = collideCircle(game.city, nx, ny, 9);
    if (c.hit) ped.angle += Math.PI * 0.6;
    ped.x = c.x;
    ped.y = c.y;

    for (const car of game.cars) {
      if (car.kind === 'parked' || car.kind === 'police' || car.kind === 'wreck') continue;
      if (Math.abs(car.speed) < 80) continue;
      if (dist(car.x, car.y, ped.x, ped.y) > 31) continue;
      ped.dead = true;
      ped.deadTime = 0;
      ped.state = 'dead';
      burst(game.effects, ped.x, ped.y, 12, {
        speed: 170, life: 0.6, color: '#8f2e37', size: 2.6, gravity: 180, glow: false,
      });
      if (car.kind === 'player') {
        game.addHeat(0.75, 'Civilian struck');
        game.audio.hit();
      }
      break;
    }
  }
  for (let i = game.peds.length - 1; i >= 0; i--) {
    const p = game.peds[i];
    if (p.dead && (p.deadTime ?? 0) > 18) game.peds.splice(i, 1);
  }
}

export function spawnCop(game, opts = {}) {
  let x = opts.x;
  let y = opts.y;
  if (x === undefined) {
    const p = pedSpawn(game.city, game.rng, game.player, opts.minDist ?? 380, opts.maxDist ?? 720);
    x = p.x;
    y = p.y;
  }
  const cop = {
    x, y,
    angle: 0,
    hp: 68,
    fire: range(game.rng, 0.4, 1.2),
    state: 'chase',
    phase: Math.random() * 10,
    radius: 12,
    dead: false,
  };
  game.cops.push(cop);
  return cop;
}

export function spawnHostile(game, opts = {}) {
  const hostile = {
    x: opts.x,
    y: opts.y,
    angle: opts.angle ?? Math.random() * Math.PI * 2,
    hp: 62,
    fire: range(game.rng, 0.5, 1.4),
    state: 'guard',
    anchor: { x: opts.x, y: opts.y },
    phase: Math.random() * 10,
    dead: false,
    tag: opts.tag ?? 'enforcer',
  };
  game.hostiles.push(hostile);
  return hostile;
}

export function updateCops(game, dt) {
  const player = game.player;
  for (const cop of game.cops) {
    if (cop.dead) continue;
    cop.phase += dt * 8;
    const d = dist(cop.x, cop.y, player.x, player.y);
    cop.angle = angleTo(cop.x, cop.y, player.x, player.y);
    if (d > 240) {
      const speed = 162;
      const nx = cop.x + Math.cos(cop.angle) * speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * speed * dt;
      const c = collideCircle(game.city, nx, ny, 11);
      cop.x = c.x;
      cop.y = c.y;
    }
    cop.fire -= dt;
    if (game.wanted.heat > 0 && d < WANTED.copShootRange && cop.fire <= 0) {
      cop.fire = range(game.rng, 0.65, 1.35);
      fireBullet(game, cop.x, cop.y, cop.angle + (game.rng() - 0.5) * 0.12, 'cop', 13);
      game.audio.enemyShot();
    }
    if (d < 74 && !player.inCar) game.bustTimer += dt;
  }
  for (let i = game.cops.length - 1; i >= 0; i--) {
    const cop = game.cops[i];
    if (cop.dead && (cop.deadTime ?? 0) > 20) game.cops.splice(i, 1);
    else if (cop.dead) cop.deadTime += dt;
  }
}

export function updateHostiles(game, dt) {
  for (const h of game.hostiles) {
    if (h.dead) {
      h.deadTime = (h.deadTime ?? 0) + dt;
      continue;
    }
    h.phase += dt * 7;
    const d = dist(h.x, h.y, game.player.x, game.player.y);
    h.angle = angleTo(h.x, h.y, game.player.x, game.player.y);
    if (d > 270) {
      const nx = h.x + Math.cos(h.angle) * 128 * dt;
      const ny = h.y + Math.sin(h.angle) * 128 * dt;
      const c = collideCircle(game.city, nx, ny, 11);
      h.x = c.x;
      h.y = c.y;
    }
    h.fire -= dt;
    if (d < 620 && h.fire <= 0 && game.player.health > 0) {
      h.fire = range(game.rng, 0.8, 1.6);
      fireBullet(game, h.x, h.y, h.angle + (game.rng() - 0.5) * 0.18, 'hostile', 10);
      game.audio.enemyShot();
    }
  }
}

export function fireBullet(game, x, y, angle, owner, damage) {
  const speed = owner === 'player' ? PLAYER.bulletSpeed : 820;
  game.bullets.push({
    x: x + Math.cos(angle) * 18,
    y: y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.78,
    owner,
    damage,
  });
  burst(game.effects, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, 4, {
    speed: 140, life: 0.16, color: '#ffe29a', size: 2, angle, spread: 0.7, glow: true,
  });
}

export function updateBullets(game, dt) {
  const p = game.player;
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) {
      game.bullets.splice(i, 1);
      continue;
    }
    const c = collideCircle(game.city, b.x, b.y, 1);
    if (c.hit) {
      burst(game.effects, b.x, b.y, 4, { speed: 90, life: 0.25, color: '#ffcf7a', size: 1.8 });
      game.bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    if (b.owner === 'player') {
      for (const cop of game.cops) {
        if (cop.dead) continue;
        if (dist(b.x, b.y, cop.x, cop.y) < 18) {
          cop.hp -= b.damage;
          burst(game.effects, b.x, b.y, 6, { speed: 130, life: 0.4, color: '#7fb0ff', size: 2 });
          if (cop.hp <= 0) {
            cop.dead = true;
            cop.deadTime = 0;
            game.addHeat(1.5, 'Officer down');
            game.audio.hit();
            shockwave(game.effects, cop.x, cop.y, 50, COLORS.danger);
          }
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const h of game.hostiles) {
          if (h.dead) continue;
          if (dist(b.x, b.y, h.x, h.y) < 19) {
            h.hp -= b.damage;
            burst(game.effects, b.x, b.y, 6, { speed: 130, life: 0.4, color: '#ff7b6e', size: 2 });
            if (h.hp <= 0) {
              h.dead = true;
              h.deadTime = 0;
              game.kills += 1;
              floatText(game.effects, h.x, h.y - 16, '+$40', COLORS.money);
              game.money += 40;
              game.audio.pickup();
            }
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const ped of game.peds) {
          if (ped.dead) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.dead = true;
            ped.deadTime = 0;
            ped.state = 'dead';
            burst(game.effects, ped.x, ped.y, 10, {
              speed: 160, life: 0.55, color: '#8f2e37', size: 2.4, gravity: 170, glow: false,
            });
            game.addHeat(0.8, 'Civilian shot');
            hit = true;
            break;
          }
        }
      }
    } else {
      if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 20) {
        game.hurtPlayer(b.damage, b.x, b.y);
        hit = true;
      } else if (p.inCar && p.car && dist(b.x, b.y, p.car.x, p.car.y) < 34) {
        game.hurtPlayer(b.damage * 0.6, b.x, b.y);
        hit = true;
      }
    }
    if (!hit) {
      for (const car of game.cars) {
        if (car === p.car || car.kind === 'parked' || car.kind === 'wreck') continue;
        if (dist(b.x, b.y, car.x, car.y) < 30) {
          damageVehicle(game, car, b.damage * (b.owner === 'player' ? 1 : 0.4), b.x, b.y);
          burst(game.effects, b.x, b.y, 5, { speed: 110, life: 0.35, color: '#ffd97a', size: 1.8 });
          hit = true;
          break;
        }
      }
    }
    if (hit) game.bullets.splice(i, 1);
  }
}

export function updateCombat(game, dt) {
  const p = game.player;
  if (p.inCar) return;
  const input = game.input;
  const dx = (input.anyDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.anyDown('KeyA', 'ArrowLeft') ? 1 : 0);
  const dy = (input.anyDown('KeyS', 'ArrowDown') ? 1 : 0) - (input.anyDown('KeyW', 'ArrowUp') ? 1 : 0);
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  p.sprinting = p.moving && input.down('ShiftLeft') && p.stamina > 1 && !input.mouse.down;
  const speed = p.sprinting ? PLAYER.sprint : PLAYER.walk;
  if (p.sprinting) p.stamina = Math.max(0, p.stamina - 26 * dt);
  else p.stamina = Math.min(100, p.stamina + 17 * dt);
  if (len > 0) {
    const mx = (dx / len) * speed * dt;
    const my = (dy / len) * speed * dt;
    const cx = collideCircle(game.city, p.x + mx, p.y, p.radius);
    const cy = collideCircle(game.city, cx.x, p.y + my, p.radius);
    p.x = cy.x;
    p.y = cy.y;
    p.walkPhase += dt * (p.sprinting ? 13 : 8);
  }
  if (game.mouseWorld) {
    p.angle = angleTo(p.x, p.y, game.mouseWorld.x, game.mouseWorld.y);
  }

  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (input.mouse.down && p.fireCooldown <= 0) {
    p.fireCooldown = PLAYER.fireDelay;
    fireBullet(game, p.x, p.y, p.angle + (Math.random() - 0.5) * 0.045, 'player', PLAYER.bulletDamage);
    game.audio.shot();
    game.effects.shake = Math.min(7, game.effects.shake + 1.4);
    game.addHeat(0.11, null, true);
    startlePeds(game, p.x, p.y, 520);
  }
  if (input.anyPressed('KeyF') && p.punchCooldown <= 0) {
    p.punchCooldown = 0.38;
    game.audio.punch();
    burst(game.effects, p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, 5, {
      speed: 110, life: 0.25, color: '#cfe6ff', size: 2, angle: p.angle, spread: 1.2,
    });
    const hitPed = game.peds.find((ped) => !ped.dead && dist(ped.x, ped.y, p.x, p.y) < 54 && Math.abs(angleDelta(p.angle, angleTo(p.x, p.y, ped.x, ped.y))) < 1.1);
    if (hitPed) {
      hitPed.dead = true;
      hitPed.deadTime = 0;
      game.addHeat(0.7, 'Assault');
      burst(game.effects, hitPed.x, hitPed.y, 8, { speed: 140, life: 0.4, color: '#8f2e37', size: 2.2, gravity: 180 });
    } else {
      const target = game.cops.find((c) => !c.dead && dist(c.x, c.y, p.x, p.y) < 56);
      if (target) {
        target.hp -= 30;
        game.addHeat(0.4, 'Assaulting an officer');
        if (target.hp <= 0) {
          target.dead = true;
          target.deadTime = 0;
          game.addHeat(1.0, 'Officer down');
        }
      }
    }
  }

  if (game.time - p.lastDamage > PLAYER.regenDelay && p.health > 0 && p.health < PLAYER.maxHealth) {
    p.health = Math.min(PLAYER.maxHealth, p.health + PLAYER.regenRate * dt);
  }
}

export function handleVehicleKey(game) {
  const p = game.player;
  if (p.inCar) {
    exitVehicle(game);
    return;
  }
  const car = nearestCar(game, p.x, p.y, 115, null);
  if (car && car.kind !== 'wreck') enterVehicle(game, car);
}

export function addHeat(game, amount, reason, silent = false) {
  const w = game.wanted;
  const before = Math.ceil(w.heat - 0.0001);
  w.heat = clamp(w.heat + amount, 0, WANTED.max);
  w.lastCrime = 0;
  w.flash = 1;
  const after = Math.ceil(w.heat - 0.0001);
  if (after > before && !silent) {
    game.audio.ui();
    notify(game, `Wanted level ${after}`, reason ?? 'The VPD is responding', COLORS.wanted, 3.4);
    game.effects.flash = 0.35;
    game.effects.flashColor = '#5f1a2a';
  }
}

export function updateWanted(game, dt) {
  const w = game.wanted;
  w.flash = Math.max(0, w.flash - dt * 2);
  const oldStars = w.stars;
  w.stars = Math.ceil(w.heat - 0.0001);
  if (w.stars !== oldStars && w.stars === 0) {
    notify(game, 'Heat cleared', 'You lost the VPD', COLORS.health, 3);
  }

  if (w.heat > 0) {
    w.lastCrime += dt;
    const copNear = game.cops.some((c) => !c.dead && dist(c.x, c.y, game.player.x, game.player.y) < 820)
      || game.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, game.player.x, game.player.y) < 900);
    if (w.lastCrime > WANTED.decayDelay && !copNear) {
      w.heat = Math.max(0, w.heat - WANTED.decayRate * dt);
    }
  }

  const policeCars = game.cars.filter((c) => c.kind === 'police').length;
  const wantedCars = w.stars <= 0 ? 0 : w.stars + (w.stars >= 3 ? 1 : 0);
  const wantedCops = w.stars >= 2 ? Math.min(6, w.stars + 1) : 0;
  game.policeSpawnTimer -= dt;
  game.copSpawnTimer -= dt;

  if (w.stars > 0 && policeCars < wantedCars && game.policeSpawnTimer <= 0) {
    const s = roadSpawn(game.city, game.rng, game.player, 620, 1150);
    spawnPoliceCar(game, s.x, s.y, angleTo(s.x, s.y, game.player.x, game.player.y));
    game.policeSpawnTimer = Math.max(2.4, 5.4 - w.stars * 0.55);
  }
  const liveCops = game.cops.filter((c) => !c.dead).length;
  if (w.stars >= 2 && liveCops < wantedCops && game.copSpawnTimer <= 0) {
    spawnCop(game, { minDist: 330, maxDist: 700 });
    game.copSpawnTimer = Math.max(2.8, 6 - w.stars * 0.55);
  }

  if (w.stars <= 0) {
    for (let i = game.cars.length - 1; i >= 0; i--) {
      const c = game.cars[i];
      if (c.kind === 'police' && dist(c.x, c.y, game.player.x, game.player.y) > 1300) game.cars.splice(i, 1);
    }
    for (let i = game.cops.length - 1; i >= 0; i--) {
      const c = game.cops[i];
      if (!c.dead && dist(c.x, c.y, game.player.x, game.player.y) > 1200) game.cops.splice(i, 1);
    }
  }

  if (w.stars > 0 && !game.player.inCar) {
    const close = game.cops.some((c) => !c.dead && dist(c.x, c.y, game.player.x, game.player.y) < 78);
    if (close) {
      game.bustTimer += dt;
      if (game.bustTimer > 2.4) game.bust();
    } else {
      game.bustTimer = Math.max(0, game.bustTimer - dt * 1.8);
    }
  } else {
    game.bustTimer = Math.max(0, game.bustTimer - dt * 2);
  }
}
