import { VIEW, STEP, PLAYER, SAVE_KEY, COLORS } from './config.js';
import { clamp, mulberry32, dist } from './util.js';
import { createCity } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects, updateEffects, notify } from './effects.js';
import { createPlayer, updateCombat, updatePeds, updateCops, updateHostiles, updateBullets, updateWanted, addHeat, handleVehicleKey, spawnPed } from './actors.js';
import { spawnTrafficCar, spawnParkedCar, updateCars } from './vehicles.js';
import { createRenderer, useCityForRenderer } from './render.js';
import { drawHUD, drawStartScreen, drawPause, drawEndOverlay, buttonAt, START_BUTTONS, PAUSE_BUTTONS } from './hud.js';
import { createMissionState, beginStep, updateMissions, updateDialogue, showSay, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 73021;

const city = createCity(seed);
useCityForRenderer(city);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
let saved = readSave();

const game = {
  city,
  renderer,
  input,
  audio,
  rng: mulberry32(seed + 17),
  time: 0,
  screen: 'start',
  weather: 'clear',
  cars: [],
  peds: [],
  cops: [],
  hostiles: [],
  bullets: [],
  effects: createEffects(),
  player: createPlayer(city.landmarks.safehouse.pos.x - 20, city.landmarks.safehouse.pos.y + 46),
  money: 320,
  kills: 0,
  wanted: { heat: 0, stars: 0, lastCrime: 0, flash: 0 },
  mission: createMissionState(),
  dialogue: null,
  dialogueQueue: [],
  camera: { x: city.landmarks.safehouse.pos.x, y: city.landmarks.safehouse.pos.y, zoom: 0.8 },
  policeSpawnTimer: 2,
  copSpawnTimer: 2,
  bustTimer: 0,
  overlay: null,
  overlayTime: 0,
  saveTimer: 0,
  ui: { hover: null, hoverPause: null },
  mouseWorld: { x: 0, y: 0 },
  mouseScreen: { x: VIEW.width / 2, y: VIEW.height / 2 },
  cameraFixed: false,
  shotName: null,
  startDrift: 0,
};

game.notify = (text, sub, color, seconds) => notify(game, text, sub, color, seconds);
game.addHeat = (amount, reason, silent) => addHeat(game, amount, reason, silent);
game.saveGame = () => saveGame(game);
game.hurtPlayer = (amount, x, y) => hurtPlayer(game, amount, x, y);
game.bust = () => startOverlay(game, 'busted');

function dropDriver(g, car) {
  const side = Math.random() < 0.5 ? 1 : -1;
  spawnPed(g, {
    x: car.x + Math.cos(car.angle + Math.PI / 2) * 38 * side,
    y: car.y + Math.sin(car.angle + Math.PI / 2) * 38 * side,
    minDist: 0,
  });
  const ped = g.peds[g.peds.length - 1];
  ped.state = 'flee';
  ped.stateTime = 6;
  ped.fleeFrom = { x: car.x, y: car.y };
}
game.dropDriver = (car) => dropDriver(game, car);

for (const spot of city.parkingSpots) {
  if (game.rng() < 0.72) spawnParkedCar(game, spot);
}
for (let i = 0; i < 16; i++) spawnTrafficCar(game, game.player);
for (let i = 0; i < 24; i++) spawnPed(game, { minDist: 100, maxDist: 920 });
for (let i = 0; i < 8; i++) spawnPed(game, { minDist: 500, maxDist: 1500 });

addEventListener('pointerdown', () => audio.unlock());
addEventListener('keydown', () => audio.unlock());

if (shotName) {
  stageShot(game, shotName);
  game.cameraFixed = true;
  game.effects.notifications.length = 0;
} else {
  beginStep(game, true);
  game.screen = 'start';
  game.camera.x = game.player.x;
  game.camera.y = game.player.y - 130;
  game.camera.zoom = 0.74;
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

function saveInfo() {
  if (!saved) return null;
  const mission = MISSIONS[clamp(saved.missionIndex ?? 0, 0, MISSIONS.length - 1)];
  return {
    mission: saved.missionIndex >= MISSIONS.length ? 'Free roam' : mission?.title ?? 'Port Vela',
    money: saved.money ?? 0,
  };
}

function writeSave(g) {
  try {
    const data = {
      version: 1,
      money: Math.round(g.money),
      missionIndex: g.mission.index,
      missionStep: g.mission.step,
      health: Math.round(g.player.health),
      x: Math.round(g.player.x),
      y: Math.round(g.player.y),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {}
}

function saveGame(g) {
  if (g.screen !== 'play' || g.shotName) return;
  writeSave(g);
}

function loadGame(g) {
  const save = readSave();
  if (!save) return false;
  g.money = save.money ?? 320;
  g.player.health = clamp(save.health ?? 100, 20, 100);
  g.player.x = clamp(save.x ?? g.player.x, 60, g.city.bounds.w);
  g.player.y = clamp(save.y ?? g.player.y, 60, g.city.bounds.h);
  g.player.inCar = false;
  g.player.car = null;
  g.mission = createMissionState();
  g.mission.index = clamp(save.missionIndex ?? 0, 0, MISSIONS.length);
  g.mission.step = clamp(save.missionStep ?? 0, 0, 5);
  if (g.mission.index >= MISSIONS.length) {
    g.mission.done = true;
    g.mission.marker = null;
  } else {
    beginStep(g, true);
  }
  g.wanted.heat = 0;
  g.wanted.stars = 0;
  g.cops.length = 0;
  g.hostiles.length = 0;
  g.bullets.length = 0;
  g.cars = g.cars.filter((c) => c.kind === 'parked');
  for (let i = 0; i < 14; i++) spawnTrafficCar(g, g.player);
  for (let i = 0; i < 20; i++) spawnPed(g, { minDist: 100, maxDist: 900 });
  g.dialogue = null;
  g.dialogueQueue.length = 0;
  g.screen = 'play';
  g.effects.notifications.length = 0;
  notify(g, 'Welcome back to Port Vela', saveInfo()?.mission ?? 'The night is young', COLORS.player, 3.4);
  audio.mission();
  return true;
}

function newGame(g) {
  const sp = g.city.landmarks.safehouse.pos;
  g.money = 320;
  g.kills = 0;
  g.time = 0;
  g.player = createPlayer(sp.x - 20, sp.y + 46);
  g.wanted = { heat: 0, stars: 0, lastCrime: 0, flash: 0 };
  g.mission = createMissionState();
  g.dialogue = null;
  g.dialogueQueue.length = 0;
  g.cops.length = 0;
  g.hostiles.length = 0;
  g.bullets.length = 0;
  g.cars = g.cars.filter((c) => c.kind === 'parked');
  g.peds.length = 0;
  g.effects = createEffects();
  g.bustTimer = 0;
  g.overlay = null;
  g.cameraFixed = false;
  for (let i = 0; i < 16; i++) spawnTrafficCar(g, g.player);
  for (let i = 0; i < 24; i++) spawnPed(g, { minDist: 100, maxDist: 900 });
  beginStep(g, true);
  showSay(g, MISSIONS[0].intro);
  g.screen = 'play';
  g.saveTimer = 0;
  g.camera.x = g.player.x;
  g.camera.y = g.player.y;
  g.camera.zoom = 1;
  audio.unlock();
  audio.mission();
  notify(g, 'Wake Up Call', 'Meet Sable at the Blue Heron', COLORS.gold, 5);
}

function startOverlay(g, kind) {
  if (g.overlay) return;
  g.overlay = kind;
  g.overlayTime = 0;
  g.screen = 'overlay';
  g.audio.fail();
  g.effects.shake = 10;
  g.effects.flash = 0.7;
  g.effects.flashColor = kind === 'busted' ? '#2c4b8a' : '#701e2a';
}

function respawn(g) {
  const kind = g.overlay;
  const stars = Math.max(1, g.wanted.stars);
  const fine = Math.min(g.money, 120 * stars);
  g.money -= fine;
  g.player.health = PLAYER.maxHealth;
  g.player.inCar = false;
  g.player.car = null;
  const lm = kind === 'busted' ? g.city.landmarks.police.pos : g.city.landmarks.hospital.pos;
  g.player.x = lm.x - 40;
  g.player.y = lm.y + 40;
  g.wanted.heat = 0;
  g.wanted.stars = 0;
  g.wanted.lastCrime = 0;
  g.cops.length = 0;
  g.bullets.length = 0;
  for (const car of g.cars) {
    if (car.kind === 'police') car.kind = 'wreck';
  }
  g.bustTimer = 0;
  g.overlay = null;
  g.screen = 'play';
  g.effects.notifications.length = 0;
  g.camera.x = g.player.x;
  g.camera.y = g.player.y;
  notify(g, kind === 'busted' ? 'Bailed out' : 'Patched up', `$${fine} in fees. Get back to work.`, COLORS.wanted, 4);
  g.saveGame();
}

function hurtPlayer(g, amount, x, y) {
  if (g.overlay || g.player.health <= 0) return;
  g.player.health = Math.max(0, g.player.health - amount);
  g.player.lastDamage = g.time;
  g.effects.shake = Math.min(12, g.effects.shake + amount * 0.25);
  g.effects.flash = Math.min(0.6, g.effects.flash + 0.12);
  g.effects.flashColor = '#7a1b28';
  g.audio.hit();
  const px = x ?? g.player.x;
  const py = y ?? g.player.y;
  for (let i = 0; i < 5; i++) {
    g.effects.particles.push({
      x: px, y: py,
      vx: (Math.random() - 0.5) * 130,
      vy: (Math.random() - 0.5) * 130,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.7,
      color: '#8f2e37',
      size: 2 + Math.random() * 2,
      gravity: 160,
      glow: false,
      kind: 'spark',
    });
  }
  if (g.player.health <= 0) startOverlay(g, 'wasted');
}

function updateCamera(g, dt) {
  if (g.cameraFixed) return;
  const target = g.player.inCar && g.player.car ? g.player.car : g.player;
  const angle = g.player.inCar && g.player.car ? g.player.car.angle : g.player.angle;
  const speed = g.player.inCar && g.player.car ? g.player.car.speed : 0;
  const lead = g.player.inCar ? clamp(speed * 0.42, -80, 140) : 0;
  const tx = target.x + Math.cos(angle) * lead;
  const ty = target.y + Math.sin(angle) * lead;
  const zoomTarget = g.player.inCar ? clamp(0.84 - Math.abs(speed) / 440 * 0.07, 0.74, 0.86) : 1;
  const k = 1 - Math.exp(-dt * 5.4);
  g.camera.x += (tx - g.camera.x) * k;
  g.camera.y += (ty - g.camera.y) * k;
  g.camera.zoom += (zoomTarget - g.camera.zoom) * (1 - Math.exp(-dt * 3));
  const halfW = VIEW.width / (2 * g.camera.zoom);
  const halfH = VIEW.height / (2 * g.camera.zoom);
  g.camera.x = clamp(g.camera.x, halfW - 40, g.city.bounds.w - halfW + 40);
  g.camera.y = clamp(g.camera.y, halfH - 40, g.city.bounds.h - halfH + 40);
}

function updateMouse(g) {
  const z = g.camera.zoom;
  const wx = g.camera.x + (g.input.mouse.x - VIEW.width / 2) / z;
  const wy = g.camera.y + (g.input.mouse.y - VIEW.height / 2) / z;
  g.mouseWorld = { x: wx, y: wy };
  g.mouseScreen = { x: g.input.mouse.x, y: g.input.mouse.y };
}

function managePopulation(g, dt) {
  g.popTimer = (g.popTimer ?? 0) - dt;
  const traffic = g.cars.filter((c) => c.kind === 'traffic');
  for (const car of g.cars) {
    if (car.kind === 'wreck' && dist(car.x, car.y, g.player.x, g.player.y) > 2200) car.remove = true;
  }
  g.cars = g.cars.filter((c) => !c.remove);
  for (let i = g.cars.length - 1; i >= 0; i--) {
    const car = g.cars[i];
    if (car.kind === 'traffic' && dist(car.x, car.y, g.player.x, g.player.y) > 2700) g.cars.splice(i, 1);
  }
  for (let i = g.peds.length - 1; i >= 0; i--) {
    const p = g.peds[i];
    if (dist(p.x, p.y, g.player.x, g.player.y) > 1700) g.peds.splice(i, 1);
  }
  if (g.popTimer > 0) return;
  g.popTimer = 0.7;
  if (traffic.length < 18) spawnTrafficCar(g, g.player);
  if (g.peds.length < 22) spawnPed(g, { minDist: 420, maxDist: 1150 });
  if (g.cars.length > 46) {
    const excess = g.cars.filter((c) => c.kind === 'traffic').slice(0, g.cars.length - 46);
    for (const c of excess) c.remove = true;
    g.cars = g.cars.filter((c) => !c.remove);
  }
}

function updateAudio(g) {
  if (g.screen !== 'play') {
    g.audio.engine(false, 0);
    g.audio.siren(false, 0, g.time);
    return;
  }
  if (g.player.inCar && g.player.car) {
    const ratio = clamp(Math.abs(g.player.car.speed) / 440, 0, 1);
    g.audio.engine(true, ratio);
  } else {
    g.audio.engine(false, 0);
  }
  const policeNear = g.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, g.player.x, g.player.y) < 1100);
  g.audio.siren(g.wanted.stars > 0 && policeNear, 0.7, g.time * 1.6);
}

function updatePlaying(g, dt) {
  updateMouse(g);
  if (g.input.anyPressed('Escape')) {
    g.screen = 'paused';
    g.audio.engine(false, 0);
    g.audio.siren(false, 0, g.time);
    g.input.endFrame();
    return;
  }
  if (g.input.anyPressed('KeyM')) {
    const muted = g.audio.toggleMute();
    g.notify(muted ? 'Audio muted' : 'Audio on', '', muted ? COLORS.muted : COLORS.player, 1.8);
  }
  if (g.input.anyPressed('KeyE')) handleVehicleKey(g);
  updateCombat(g, dt);
  updateCars(g, dt);
  updatePeds(g, dt);
  updateCops(g, dt);
  updateHostiles(g, dt);
  updateBullets(g, dt);
  updateMissions(g, dt);
  updateWanted(g, dt);
  updateDialogue(g, dt);
  updateEffects(g, dt);
  managePopulation(g, dt);
  updateCamera(g, dt);
  updateAudio(g);
  g.saveTimer += dt;
  if (g.saveTimer > 9) {
    g.saveTimer = 0;
    g.saveGame();
  }
}

function updateStart(g, dt) {
  updateMouse(g);
  g.time += dt;
  g.startDrift += dt;
  const mouse = g.input.mouse;
  const hover = buttonAt(START_BUTTONS, mouse.x, mouse.y);
  g.ui.hover = hover?.id ?? null;
  const click = g.input.takeClick();
  if (click) {
    const hit = buttonAt(START_BUTTONS, click.x, click.y);
    if (hit?.id === 'new') newGame(g);
    else if (hit?.id === 'continue' && saved) loadGame(g);
  }
  if (g.input.anyPressed('Enter') || g.input.anyPressed('NumpadEnter')) {
    if (saved) loadGame(g);
    else newGame(g);
  }
  if (g.input.anyPressed('KeyN')) newGame(g);
  if (g.input.anyPressed('KeyC') && saved) loadGame(g);

  updateCars(g, dt);
  updatePeds(g, dt);
  updateEffects(g, dt);
  if (!g.cameraFixed) {
    g.camera.x = g.player.x + Math.sin(g.startDrift * 0.055) * 260;
    g.camera.y = g.player.y - 150 + Math.cos(g.startDrift * 0.043) * 130;
    g.camera.zoom = 0.74;
  }
}

function updateOverlay(g, dt) {
  g.overlayTime += dt;
  updateEffects(g, dt);
  if (g.overlayTime > 2.8) respawn(g);
}

function updatePaused(g) {
  updateMouse(g);
  const hover = buttonAt(PAUSE_BUTTONS, g.input.mouse.x, g.input.mouse.y);
  g.ui.hoverPause = hover?.id ?? null;
  const click = g.input.takeClick();
  if (click) {
    const hit = buttonAt(PAUSE_BUTTONS, click.x, click.y);
    if (hit?.id === 'resume') g.screen = 'play';
    if (hit?.id === 'title') {
      g.saveGame();
      saved = readSave();
      g.screen = 'start';
      g.camera.x = g.player.x;
      g.camera.y = g.player.y - 130;
      g.camera.zoom = 0.74;
    }
  }
  if (g.input.anyPressed('Escape')) g.screen = 'play';
}

let last = performance.now();
let acc = 0;
let shotFrames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min((now - last) / 1000, 0.12);
  last = now;
  acc += delta;

  if (shotName) {
    game.time += delta;
    updateEffects(game, delta * 0.4);
    shotFrames += 1;
    renderer.draw(game);
    if (game.screen === 'start') drawStartScreen(renderer.ctx, game, saveInfo(), game.ui.hover);
    else {
      drawHUD(renderer.ctx, game);
      if (game.dialogue) {
        game.dialogue.time = Math.max(0.5, game.dialogue.time - delta * 0.05);
      }
    }
    if (shotFrames > 3) window.__shotReady = true;
    input.endFrame();
    return;
  }

  while (acc >= STEP) {
    if (game.screen === 'play') updatePlaying(game, STEP);
    else if (game.screen === 'start') updateStart(game, STEP);
    else if (game.screen === 'overlay') updateOverlay(game, STEP);
    else if (game.screen === 'paused') updatePaused(game);
    acc -= STEP;
    // A key pressed once must be acted on by exactly one fixed step. Without this a frame that
    // catches up several steps toggles E (enter/exit) or Escape (pause/resume) once per step.
    input.endFrame();
  }

  if (game.screen === 'start') {
    renderer.draw(game);
    drawStartScreen(renderer.ctx, game, saveInfo(), game.ui.hover);
  } else {
    renderer.draw(game);
    drawHUD(renderer.ctx, game);
    if (game.screen === 'paused') drawPause(renderer.ctx, game, game.ui.hoverPause);
    if (game.screen === 'overlay') drawEndOverlay(renderer.ctx, game, game.overlay);
  }
  input.endFrame();
}

requestAnimationFrame(frame);

window.__game = game;
