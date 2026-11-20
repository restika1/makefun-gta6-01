import { dist, clamp } from './util.js';
import { spawnHostile } from './actors.js';
import { notify } from './effects.js';
import { COLORS } from './config.js';

export const MISSIONS = [
  {
    id: 'wake-up-call',
    title: 'Wake Up Call',
    contact: 'Sable',
    reward: 260,
    intro: [
      { who: 'Sable', text: "Rook. You're late, you're broke, and the harbor job left three people owing me." },
      { who: 'Rook', text: "I brought my car. It's not exactly mine." },
      { who: 'Sable', text: 'Then keep it. Meet me at the Blue Heron before the coffee goes cold.' },
    ],
    steps: [
      {
        type: 'goto', at: 'diner', r: 62,
        text: 'Meet Sable at the Blue Heron',
        say: [{ who: 'Sable', text: 'There she is. The ledger from Dock 9 is still out there, and so is the man who took it.' }],
      },
      {
        type: 'steal',
        text: 'Steal a car and get moving',
        say: [{ who: 'Sable', text: 'Take something with four wheels. Try not to bleed on the upholstery.' }],
      },
      {
        type: 'goto', at: 'docks', r: 78, needCar: true,
        text: 'Drive to Dock 9',
        say: [{ who: 'Rook', text: 'Dock 9. Of course it is.' }],
      },
      {
        type: 'goto', at: 'docks', r: 54,
        text: 'Search the dock for the crate',
        say: [{ who: 'Sable', text: 'Crate nineteen. Bring it to the pawn shop and we call the first debt settled.' }],
      },
    ],
    outro: [
      { who: 'Sable', text: 'One down. The Gold Tooth is holding something of mine. Go remind him who pays for his neon.' },
    ],
  },
  {
    id: 'hot-cargo',
    title: 'Hot Cargo',
    contact: 'Sable',
    reward: 420,
    intro: [
      { who: 'Sable', text: 'The crate is bait. I need the courier who follows it to show his face.' },
      { who: 'Rook', text: 'You want me to be the worm on the hook.' },
    ],
    steps: [
      {
        type: 'goto', at: 'pawn', r: 66,
        text: 'Lean on the Gold Tooth pawnbroker',
        say: [{ who: 'Pawnbroker', text: "Sable's case? It went to the docks with a man in a grey coat. Don't shoot the mirrors." }],
      },
      {
        type: 'goto', at: 'docks', r: 74, needCar: true,
        text: 'Pick up the case at Dock 9',
        say: [{ who: 'Sable', text: 'Case secured. You picked up a tail. Lose them before you reach the pawn shop.' }],
      },
      {
        type: 'goto', at: 'pawn', r: 72, needCar: true, heat: 1.35,
        text: 'Deliver the case to the pawn shop',
        say: [{ who: 'Sable', text: 'Delivered. The case has a name inside it: Marlow. He runs the foundry on Foundry Row.' }],
      },
    ],
    outro: [
      { who: 'Sable', text: 'Marlow took the last debt. The foundry is where he keeps his books. And his people.' },
      { who: 'Rook', text: "I'll bring a receipt." },
    ],
  },
  {
    id: 'the-ledger',
    title: 'The Ledger',
    contact: 'Sable',
    reward: 680,
    intro: [
      { who: 'Sable', text: 'Marlow is careful. Five enforcers, one ledger, no witnesses. Be the last thing he expects.' },
    ],
    steps: [
      {
        type: 'goto', at: 'foundry', r: 74,
        text: 'Enter the foundry yard',
        say: [{ who: 'Marlow', text: "Sable sent a courier to do a cleaner's work. Boys, show her the floor." }],
      },
      {
        type: 'kill', at: 'foundry', r: 120, count: 5, tag: 'ledger',
        text: "Take down Marlow's enforcers",
        heat: 0.6,
      },
      {
        type: 'goto', at: 'foundry', r: 46,
        text: 'Grab the ledger',
        heat: 2.1,
        say: [{ who: 'Sable', text: "Ledger's in your hands. VPD is already on the payroll. Run, Rook." }],
      },
      {
        type: 'heat0',
        text: 'Lose the VPD and disappear',
      },
    ],
    outro: [
      { who: 'Sable', text: 'Ledger delivered. Three debts settled in one night. There is a room above the Blue Heron with your name on it.' },
      { who: 'Rook', text: 'Keep the coffee warm.' },
      { who: 'Sable', text: 'The city is yours now. Try not to spend it all before sunrise.' },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    done: false,
    stepTime: 0,
    delay: 0,
    marker: null,
    markerRadius: 50,
    spawned: false,
    tag: '',
    total: MISSIONS.length,
  };
}

export function currentMission(game) {
  return MISSIONS[game.mission.index] ?? null;
}

export function showSay(game, lines) {
  if (!lines || lines.length === 0) return;
  for (const line of lines) game.dialogueQueue.push({ ...line, time: 4.2 });
}

function stepPosition(game, step) {
  const lm = step.at ? game.city.landmarks[step.at] : null;
  if (!lm) return null;
  return { x: lm.pos.x + (step.offset?.x ?? 0), y: lm.pos.y + (step.offset?.y ?? 0) };
}

export function beginStep(game, silent = false) {
  const mission = currentMission(game);
  if (!mission) {
    game.mission.done = true;
    game.mission.marker = null;
    return;
  }
  const step = mission.steps[game.mission.step];
  if (!step) {
    finishMission(game);
    return;
  }
  game.mission.stepTime = 0;
  game.mission.spawned = false;
  game.mission.markerRadius = step.r ?? 60;
  const pos = stepPosition(game, step);
  game.mission.marker = pos ? { ...pos, label: mission.title } : null;
  if (!silent) showSay(game, step.say);
  if (step.type === 'kill') {
    spawnEnforcers(game, step, pos);
  }
  if (step.heat && !silent) game.addHeat(step.heat, `${mission.title}`, false);
  if (step.type === 'heat0' && game.wanted.heat < 2) game.addHeat(2.2, 'VPD lockdown', false);
}

function spawnEnforcers(game, step, pos) {
  const tag = step.tag ?? `m${game.mission.index}`;
  game.mission.tag = tag;
  const already = game.hostiles.some((h) => h.tag === tag && !h.dead);
  if (already) return;
  const count = step.count ?? 4;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.4;
    const radius = 95 + (i % 3) * 42;
    const x = clamp(pos.x + Math.cos(angle) * radius, 60, game.city.bounds.w);
    const y = clamp(pos.y + Math.sin(angle) * radius, 60, game.city.bounds.h);
    spawnHostile(game, { x, y, tag });
  }
}

export function advanceStep(game) {
  game.mission.step += 1;
  game.mission.marker = null;
  beginStep(game, false);
}

export function finishMission(game) {
  const mission = currentMission(game);
  if (!mission) return;
  game.money += mission.reward;
  game.mission.index += 1;
  game.mission.step = 0;
  game.mission.marker = null;
  game.mission.delay = 5;
  showSay(game, mission.outro);
  notify(game, 'Mission complete', `${mission.title} · +$${mission.reward}`, COLORS.money, 5);
  game.audio.mission();
  game.saveGame();
  if (game.mission.index >= MISSIONS.length) {
    game.mission.done = true;
    game.completedAt = game.time;
    notify(game, 'Story complete', 'Port Vela is yours. Free roam unlocked.', COLORS.gold, 7);
  }
}

export function updateMissions(game, dt) {
  const mission = currentMission(game);
  if (!mission || game.mission.done) return;
  if (game.mission.delay > 0) {
    game.mission.delay -= dt;
    if (game.mission.delay <= 0) beginStep(game, false);
    return;
  }
  const step = mission.steps[game.mission.step];
  if (!step) {
    finishMission(game);
    return;
  }
  game.mission.stepTime += dt;
  const px = game.player.inCar && game.player.car ? game.player.car.x : game.player.x;
  const py = game.player.inCar && game.player.car ? game.player.car.y : game.player.y;

  if (step.type === 'steal') {
    if (game.player.inCar && game.player.car && game.player.car.kind === 'player') advanceStep(game);
    return;
  }
  if (step.type === 'heat0') {
    if (game.wanted.stars === 0 && game.mission.stepTime > 1.2) advanceStep(game);
    return;
  }
  if (step.type === 'kill') {
    const tag = step.tag ?? game.mission.tag;
    if (!game.mission.spawned) {
      game.mission.spawned = true;
    }
    const left = game.hostiles.filter((h) => h.tag === tag && !h.dead).length;
    if (left === 0 && game.mission.stepTime > 0.8) advanceStep(game);
    return;
  }
  if (game.mission.marker) {
    const d = dist(px, py, game.mission.marker.x, game.mission.marker.y);
    if (d < game.mission.markerRadius) {
      if (step.needCar && !game.player.inCar) {
        if (game.mission.stepTime > 2 && !game.mission.warnedCar) {
          game.mission.warnedCar = true;
          notify(game, 'You need a vehicle', 'Find a car and press E', COLORS.wanted, 3);
        }
        return;
      }
      game.mission.warnedCar = false;
      if (step.heat) game.addHeat(step.heat, mission.title, false);
      if (step.type === 'kill') return;
      advanceStep(game);
    }
  }
}

export function objectiveText(game) {
  const mission = currentMission(game);
  if (!mission || game.mission.done) {
    return { title: 'Free Roam', text: 'The city is yours. Keep your head down.', distance: null };
  }
  const step = mission.steps[game.mission.step];
  if (!step) return { title: mission.title, text: 'Return to Sable', distance: null };
  let text = step.text;
  if (step.type === 'kill') {
    const tag = step.tag ?? game.mission.tag;
    const left = game.hostiles.filter((h) => h.tag === tag && !h.dead).length;
    text = `${step.text} (${left} left)`;
  }
  let distance = null;
  if (game.mission.marker) {
    const px = game.player.inCar && game.player.car ? game.player.car.x : game.player.x;
    const py = game.player.inCar && game.player.car ? game.player.car.y : game.player.y;
    distance = dist(px, py, game.mission.marker.x, game.mission.marker.y);
  }
  return { title: mission.title, text, distance };
}

export function updateDialogue(game, dt) {
  if (game.dialogue) {
    game.dialogue.time -= dt;
    if (game.dialogue.time <= 0) game.dialogue = null;
  }
  if (!game.dialogue && game.dialogueQueue.length > 0) {
    const line = game.dialogueQueue.shift();
    game.dialogue = { ...line, time: line.time ?? 4.2 };
  }
}
