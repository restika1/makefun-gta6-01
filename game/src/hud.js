import { VIEW, COLORS, FONT, FONT_DISPLAY } from './config.js';
import { clamp, formatMoney, roundRect, starPath, TAU } from './util.js';
import { objectiveText, currentMission } from './missions.js';

export const START_BUTTONS = [
  { id: 'new', x: 92, y: 416, w: 296, h: 58 },
  { id: 'continue', x: 92, y: 488, w: 296, h: 58 },
];

export const PAUSE_BUTTONS = [
  { id: 'resume', x: 500, y: 392, w: 280, h: 52 },
  { id: 'title', x: 500, y: 456, w: 280, h: 52 },
];

export function buttonAt(buttons, x, y) {
  return buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ?? null;
}

export function drawHUD(ctx, game) {
  ctx.save();
  drawPlayerCard(ctx, game);
  drawWanted(ctx, game);
  drawMissionPanel(ctx, game);
  drawMinimap(ctx, game);
  drawNotifications(ctx, game);
  drawDialogue(ctx, game);
  drawBottomLeft(ctx, game);
  drawControlsHint(ctx, game);
  drawObjectiveArrow(ctx, game);
  drawCrosshair(ctx, game);
  ctx.restore();
}

function drawPlayerCard(ctx, game) {
  const p = game.player;
  const x = 22;
  const y = 20;
  const w = 312;
  const h = 100;
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = COLORS.hudLine;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 50, y + 50, 32, 0, TAU);
  ctx.fillStyle = '#12242b';
  ctx.fill();
  ctx.strokeStyle = 'rgba(79,214,192,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = COLORS.playerDark;
  ctx.fillRect(x + 18, y + 58, 64, 40);
  ctx.fillStyle = COLORS.player;
  roundRect(ctx, x + 34, y + 46, 32, 38, 12);
  ctx.fill();
  ctx.fillStyle = COLORS.skin;
  ctx.beginPath();
  ctx.arc(x + 50, y + 40, 14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#13231f';
  ctx.beginPath();
  ctx.arc(x + 47, y + 37, 14, -2.6, 2.2);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText('MARABEL “ROOK” VOSS', x + 92, y + 22);
  ctx.fillStyle = COLORS.money;
  ctx.font = `800 24px ${FONT_DISPLAY}`;
  ctx.fillText(formatMoney(game.money), x + 92, y + 48);

  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, x + 92, y + 58, 196, 11, 5);
  ctx.fill();
  const hp = clamp(p.health / 100, 0, 1);
  const hg = ctx.createLinearGradient(x + 92, 0, x + 288, 0);
  hg.addColorStop(0, hp < 0.35 ? COLORS.danger : COLORS.health);
  hg.addColorStop(1, hp < 0.35 ? '#ff8a6b' : '#9cf0a8');
  ctx.fillStyle = hg;
  roundRect(ctx, x + 92, y + 58, 196 * hp, 11, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 92 + 196 * (i / 5), y + 58);
    ctx.lineTo(x + 92 + 196 * (i / 5), y + 69);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, x + 92, y + 74, 196, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(79,214,192,0.72)';
  roundRect(ctx, x + 92, y + 74, 196 * clamp(p.stamina / 100, 0, 1), 5, 2.5);
  ctx.fill();

  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText('HEALTH', x + 92, y + 92);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(p.health)}`, x + 288, y + 92);
}

function drawWanted(ctx, game) {
  const stars = game.wanted.stars;
  const x = VIEW.width - 292;
  const y = 26;
  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, x - 8, y - 8, 278, 48, 12);
  ctx.fill();
  ctx.strokeStyle = COLORS.hudLine;
  ctx.lineWidth = 1;
  roundRect(ctx, x - 8, y - 8, 278, 48, 12);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText('VPD HEAT', x, y + 16);
  const pulse = 1 + game.wanted.flash * 0.12;
  for (let i = 0; i < 5; i++) {
    const cx = x + 74 + i * 34;
    const cy = y + 16;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    starPath(ctx, 0, 0, 13, 5.6);
    if (i < stars) {
      ctx.fillStyle = COLORS.wanted;
      ctx.shadowColor = COLORS.wanted;
      ctx.shadowBlur = 10 + game.wanted.flash * 12;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,191,63,0.35)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawMissionPanel(ctx, game) {
  const info = objectiveText(game);
  const mission = currentMission(game);
  const x = VIEW.width - 364;
  const y = 86;
  const w = 342;
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, x, y, w, mission ? 106 : 88, 12);
  ctx.fill();
  ctx.strokeStyle = COLORS.hudLine;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, mission ? 106 : 88, 12);
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x + 14, y + 16, 3, 18);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.gold;
  ctx.font = `700 9px ${FONT}`;
  ctx.fillText(mission && !game.mission.done ? `MISSION ${game.mission.index + 1} OF ${game.mission.total}` : 'STORY COMPLETE', x + 26, y + 22);
  ctx.fillStyle = COLORS.white;
  ctx.font = `800 18px ${FONT}`;
  ctx.fillText(info.title, x + 26, y + 42);
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = 'rgba(238,245,255,0.82)';
  wrapText(ctx, info.text, x + 26, y + 63, w - 50, 17);
  if (info.distance !== null) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `600 11px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(info.distance)} m`, x + w - 18, y + 42);
    ctx.textAlign = 'left';
  }
  if (mission && !game.mission.done) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 26, y + 92, w - 52, 4);
    const total = mission.steps.length;
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(x + 26, y + 92, (w - 52) * clamp((game.mission.step + 1) / total, 0, 1), 4);
  }
}

function drawMinimap(ctx, game) {
  const size = 204;
  const x = VIEW.width - size - 24;
  const y = VIEW.height - size - 24;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const span = 1850;
  const scale = size / span;
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;

  ctx.save();
  ctx.fillStyle = 'rgba(6,10,16,0.9)';
  roundRect(ctx, x, y, size, size, 18);
  ctx.fill();
  roundRect(ctx, x, y, size, size, 18);
  ctx.clip();

  ctx.fillStyle = '#0b1018';
  ctx.fillRect(x, y, size, size);
  const toMap = (wx, wy) => ({ x: cx + (wx - px) * scale, y: cy + (wy - py) * scale });

  ctx.strokeStyle = 'rgba(195,185,140,0.26)';
  ctx.lineWidth = 110 * scale;
  for (let k = 0; k <= 6; k++) {
    const hy = toMap(0, k * 620).y;
    const vx = toMap(k * 620, 0).x;
    if (hy > y - 30 && hy < y + size + 30) {
      ctx.beginPath();
      ctx.moveTo(x, hy);
      ctx.lineTo(x + size, hy);
      ctx.stroke();
    }
    if (vx > x - 30 && vx < x + size + 30) {
      ctx.beginPath();
      ctx.moveTo(vx, y);
      ctx.lineTo(vx, y + size);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(32,42,55,0.65)';
  for (const b of game.city.blocks) {
    const mx = cx + (b.x0 - px) * scale;
    const my = cy + (b.y0 - py) * scale;
    const mw = (b.x1 - b.x0) * scale;
    const mh = (b.y1 - b.y0) * scale;
    if (mx + mw < x || mx > x + size || my + mh < y || my > y + size) continue;
    if (b.type === 'park') ctx.fillStyle = 'rgba(41,79,58,0.72)';
    else if (b.type === 'lot') ctx.fillStyle = 'rgba(38,46,58,0.72)';
    else ctx.fillStyle = 'rgba(39,48,62,0.72)';
    ctx.fillRect(mx, my, mw, mh);
  }
  ctx.strokeStyle = 'rgba(90,200,220,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 46 + Math.sin(game.time * 2) * 4, 0, TAU);
  ctx.stroke();

  for (const car of game.cars) {
    if (car === p.car) continue;
    const m = toMap(car.x, car.y);
    if (m.x < x + 4 || m.x > x + size - 4 || m.y < y + 4 || m.y > y + size - 4) continue;
    if (car.kind === 'police') {
      ctx.fillStyle = Math.floor(game.time * 6) % 2 ? '#ff5a6e' : '#5c8cff';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3.2, 0, TAU);
      ctx.fill();
    } else if (car.kind === 'traffic') {
      ctx.fillStyle = 'rgba(210,220,235,0.42)';
      ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    }
  }
  for (const h of game.hostiles) {
    if (h.dead) continue;
    const m = toMap(h.x, h.y);
    if (m.x < x + 3 || m.x > x + size - 3 || m.y < y + 3 || m.y > y + size - 3) continue;
    ctx.fillStyle = COLORS.danger;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 2.5, 0, TAU);
    ctx.fill();
  }

  const marker = game.mission?.marker;
  if (marker) {
    const m = toMap(marker.x, marker.y);
    const pad = 10;
    let edge = false;
    if (m.x < x + pad) { m.x = x + pad; edge = true; }
    if (m.x > x + size - pad) { m.x = x + size - pad; edge = true; }
    if (m.y < y + pad) { m.y = y + pad; edge = true; }
    if (m.y > y + size - pad) { m.y = y + size - pad; edge = true; }
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = edge ? 'rgba(255,200,87,0.75)' : COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 10;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  const heading = p.inCar && p.car ? p.car.angle : p.angle;
  ctx.rotate(heading + Math.PI / 2);
  ctx.fillStyle = COLORS.player;
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6.5, 7);
  ctx.lineTo(0, 4);
  ctx.lineTo(-6.5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
  ctx.strokeStyle = 'rgba(79,214,192,0.34)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, size, size, 18);
  ctx.stroke();
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, x + 10, y + 9, 64, 22, 7);
  ctx.fill();
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', x + 18, y + 20);
  ctx.fillStyle = COLORS.gold;
  ctx.fillText('PORT VELA', x + 32, y + 20);
}

function drawNotifications(ctx, game) {
  const list = game.effects.notifications;
  let y = 24;
  for (const n of list) {
    const a = clamp(n.life / 0.5, 0, 1) * clamp((n.maxLife - n.life) / 0.25, 0, 1);
    const w = 360;
    const x = (VIEW.width - w) / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * -8);
    ctx.fillStyle = 'rgba(7,11,18,0.86)';
    roundRect(ctx, x, y, w, n.sub ? 54 : 40, 10);
    ctx.fill();
    ctx.fillStyle = n.color;
    ctx.fillRect(x, y + 8, 3, (n.sub ? 54 : 40) - 16);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = n.color;
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(n.text, x + 16, y + (n.sub ? 23 : 25));
    if (n.sub) {
      ctx.fillStyle = COLORS.muted;
      ctx.font = `500 11px ${FONT}`;
      ctx.fillText(n.sub, x + 16, y + 41);
    }
    ctx.restore();
    y += (n.sub ? 62 : 48);
  }
}

function drawDialogue(ctx, game) {
  if (!game.dialogue) return;
  const d = game.dialogue;
  const w = 680;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - 150;
  ctx.save();
  const a = clamp(d.time / 0.4, 0, 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(6,10,17,0.90)';
  roundRect(ctx, x, y, w, 90, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(79,214,192,0.26)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, 90, 12);
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(x + 16, y + 16, 3, 18);
  ctx.font = `800 12px ${FONT}`;
  ctx.fillStyle = COLORS.gold;
  ctx.textAlign = 'left';
  ctx.fillText(d.who.toUpperCase(), x + 30, y + 30);
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = COLORS.white;
  wrapText(ctx, d.text, x + 30, y + 55, w - 60, 20);
  ctx.restore();
}

function drawBottomLeft(ctx, game) {
  const p = game.player;
  const x = 24;
  const y = VIEW.height - 96;
  if (p.inCar && p.car) {
    const speed = Math.abs(p.car.speed);
    const kmh = Math.round(speed * 0.36);
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, x, y, 252, 72, 14);
    ctx.fill();
    ctx.strokeStyle = COLORS.hudLine;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, 252, 72, 14);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.muted;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText(p.car.name.toUpperCase(), x + 18, y + 20);
    ctx.fillStyle = COLORS.white;
    ctx.font = `800 34px ${FONT_DISPLAY}`;
    ctx.fillText(String(kmh).padStart(2, '0'), x + 18, y + 56);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText('KM/H', x + 70, y + 54);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x + 200, y + 38, 23, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    const t = clamp(speed / 440, 0, 1);
    ctx.strokeStyle = t > 0.8 ? COLORS.danger : COLORS.player;
    ctx.beginPath();
    ctx.arc(x + 200, y + 38, 23, Math.PI * 0.75, Math.PI * (0.75 + t * 1.5));
    ctx.stroke();
    ctx.fillStyle = p.car.hp < 45 ? COLORS.danger : COLORS.muted;
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HULL', x + 200, y + 68);
  } else {
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, x, y + 14, 172, 58, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.hudLine;
    ctx.lineWidth = 1;
    roundRect(ctx, x, y + 14, 172, 58, 12);
    ctx.stroke();
    ctx.fillStyle = COLORS.white;
    ctx.font = `800 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('9MM', x + 18, y + 44);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `700 9px ${FONT}`;
    ctx.fillText('SIDEARM · UNLIMITED', x + 18, y + 60);
  }
}

function drawControlsHint(ctx, game) {
  if (game.dialogue) return;
  const text = game.player.inCar
    ? 'WASD DRIVE · SPACE HANDBRAKE · E EXIT · ESC PAUSE · M MUTE'
    : 'WASD MOVE · SHIFT SPRINT · E VEHICLE · LMB FIRE · F STRIKE · ESC PAUSE';
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(210,225,240,0.38)';
  ctx.fillText(text, VIEW.width / 2, VIEW.height - 18);
}

function drawObjectiveArrow(ctx, game) {
  const m = game.mission?.marker;
  if (!m) return;
  const zoom = game.camera.zoom;
  const sx = (m.x - game.camera.x) * zoom + VIEW.width / 2;
  const sy = (m.y - game.camera.y) * zoom + VIEW.height / 2;
  if (sx > 40 && sx < VIEW.width - 40 && sy > 110 && sy < VIEW.height - 90) return;
  const cx = VIEW.width / 2;
  const cy = VIEW.height / 2;
  const angle = Math.atan2(sy - cy, sx - cx);
  const rx = VIEW.width / 2 - 56;
  const ry = VIEW.height / 2 - 66;
  const px = cx + Math.cos(angle) * rx;
  const py = cy + Math.sin(angle) * ry;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(255,200,87,0.9)';
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -9);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCrosshair(ctx, game) {
  if (game.player.inCar || !game.mouseScreen) return;
  const { x, y } = game.mouseScreen;
  const pulse = 1 + Math.sin(game.time * 7) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(200,245,255,0.72)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 8 * pulse, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,245,255,0.9)';
  ctx.fillRect(-1, -13, 2, 6);
  ctx.fillRect(-1, 7, 2, 6);
  ctx.fillRect(-13, -1, 6, 2);
  ctx.fillRect(7, -1, 6, 2);
  ctx.fillRect(-1.5, -1.5, 3, 3);
  ctx.restore();
}

export function drawStartScreen(ctx, game, saveInfo, hoverId) {
  const t = game.time;
  const grad = ctx.createLinearGradient(0, 0, VIEW.width * 0.82, 0);
  grad.addColorStop(0, 'rgba(4,7,13,0.96)');
  grad.addColorStop(0.45, 'rgba(4,7,13,0.82)');
  grad.addColorStop(0.78, 'rgba(4,7,13,0.24)');
  grad.addColorStop(1, 'rgba(4,7,13,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const top = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  top.addColorStop(0, 'rgba(2,4,9,0.55)');
  top.addColorStop(0.6, 'rgba(2,4,9,0.05)');
  top.addColorStop(1, 'rgba(2,4,9,0.7)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(79,214,192,0.86)';
  ctx.font = `700 11px ${FONT}`;
  ctx.letterSpacing = '5px';
  ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME STORY', 96, 122);
  ctx.letterSpacing = '0px';

  ctx.save();
  ctx.shadowColor = 'rgba(255,79,139,0.55)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#f3f7ff';
  ctx.font = `900 92px ${FONT_DISPLAY}`;
  ctx.fillText('PORT', 88, 230);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(69,226,203,0.7)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = COLORS.player;
  ctx.font = `900 92px ${FONT_DISPLAY}`;
  ctx.fillText('VELA', 88, 312);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `800 34px ${FONT_DISPLAY}`;
  ctx.letterSpacing = '16px';
  ctx.fillText('NIGHTFALL', 94, 362);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'rgba(210,225,240,0.62)';
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('Three debts. One long night. The harbor never sleeps.', 96, 392);

  for (const b of START_BUTTONS) {
    const disabled = b.id === 'continue' && !saveInfo;
    const hover = hoverId === b.id && !disabled;
    ctx.fillStyle = disabled ? 'rgba(26,32,42,0.55)' : hover ? 'rgba(79,214,192,0.22)' : 'rgba(10,16,24,0.78)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.strokeStyle = disabled ? 'rgba(120,134,150,0.18)' : hover ? COLORS.player : 'rgba(79,214,192,0.45)';
    ctx.lineWidth = hover ? 2 : 1;
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.stroke();
    ctx.fillStyle = disabled ? 'rgba(140,154,171,0.4)' : hover ? COLORS.player : COLORS.white;
    ctx.font = `800 15px ${FONT}`;
    ctx.letterSpacing = '2px';
    ctx.fillText(b.id === 'new' ? 'NEW GAME' : 'CONTINUE', b.x + 24, b.y + 27);
    ctx.letterSpacing = '0px';
    ctx.font = `500 10px ${FONT}`;
    ctx.fillStyle = disabled ? 'rgba(140,154,171,0.35)' : COLORS.muted;
    ctx.fillText(b.id === 'new' ? 'Start from the Blue Heron' : saveInfo ? `Resume · ${saveInfo.mission}` : 'No saved run', b.x + 24, b.y + 43);
    ctx.fillStyle = disabled ? 'rgba(140,154,171,0.25)' : 'rgba(79,214,192,0.5)';
    ctx.fillRect(b.x + b.w - 34, b.y + 25, 14, 2);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(96, 576, 508, 1);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `700 9px ${FONT}`;
  ctx.letterSpacing = '2px';
  ctx.fillText('CONTROLS', 96, 600);
  ctx.letterSpacing = '0px';
  const controls = [
    ['WASD / ARROWS', 'Move · drive'],
    ['MOUSE + LMB', 'Aim · fire'],
    ['E', 'Enter / exit vehicle'],
    ['SPACE', 'Handbrake'],
    ['F', 'Strike'],
    ['ESC / M', 'Pause · mute'],
  ];
  ctx.font = `500 11px ${FONT}`;
  controls.forEach(([key, label], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 96 + col * 258;
    const y = 622 + row * 22;
    ctx.fillStyle = COLORS.white;
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText(key, x, y);
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 11px ${FONT}`;
    ctx.fillText(label, x + 96, y);
  });

  ctx.fillStyle = 'rgba(79,214,192,0.72)';
  ctx.font = `700 10px ${FONT}`;
  ctx.letterSpacing = '2px';
  ctx.fillText('PORT VELA MUNICIPAL NETWORK · NIGHT SHIFT', 96, 700);
  ctx.letterSpacing = '0px';
  ctx.restore();

  const live = 0.5 + 0.5 * Math.sin(t * 2.4);
  ctx.save();
  ctx.fillStyle = `rgba(255,79,139,${0.45 + live * 0.35})`;
  ctx.beginPath();
  ctx.arc(VIEW.width - 62, 46, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(230,240,255,0.5)';
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('LIVE FROM THE HARBOR', VIEW.width - 78, 50);
  ctx.restore();
}

export function drawPause(ctx, game, hoverId) {
  ctx.fillStyle = 'rgba(3,6,12,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.white;
  ctx.font = `900 48px ${FONT_DISPLAY}`;
  ctx.fillText('PAUSED', VIEW.width / 2, 280);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('Port Vela keeps moving without you.', VIEW.width / 2, 312);
  for (const b of PAUSE_BUTTONS) {
    const hover = hoverId === b.id;
    ctx.fillStyle = hover ? 'rgba(79,214,192,0.22)' : 'rgba(10,16,24,0.82)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.strokeStyle = hover ? COLORS.player : 'rgba(79,214,192,0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.stroke();
    ctx.fillStyle = hover ? COLORS.player : COLORS.white;
    ctx.font = `800 14px ${FONT}`;
    ctx.letterSpacing = '2px';
    ctx.fillText(b.id === 'resume' ? 'RESUME' : 'QUIT TO TITLE', VIEW.width / 2, b.y + 32);
    ctx.letterSpacing = '0px';
  }
}

export function drawEndOverlay(ctx, game, kind) {
  const t = clamp((game.overlayTime ?? 0) / 0.5, 0, 1);
  ctx.fillStyle = `rgba(4,3,6,${0.55 + t * 0.3})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const color = kind === 'busted' ? '#7fb0ff' : COLORS.danger;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  ctx.fillStyle = color;
  ctx.font = `900 76px ${FONT_DISPLAY}`;
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', VIEW.width / 2, 340);
  ctx.restore();
  ctx.fillStyle = COLORS.white;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(kind === 'busted' ? 'The VPD has your name. For now.' : 'The harbor spits you back out.', VIEW.width / 2, 380);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText('Respawning at the nearest safehouse…', VIEW.width / 2, 410);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let row = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      line = word;
      row++;
      if (row > 2) break;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight);
}
