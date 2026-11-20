export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const CITY = {
  name: 'PORT VELA',
  subtitle: 'NIGHTFALL',
  tagline: 'Three debts. One long night.',
  gameTitle: 'Port Vela: Nightfall',
};

export const CELL = 620;
export const ROAD = 150;
export const GRID = 6;
export const WORLD = { width: CELL * GRID, height: CELL * GRID };

export const PLAYER = {
  radius: 13,
  walk: 178,
  sprint: 286,
  maxHealth: 100,
  regenDelay: 7,
  regenRate: 3.2,
  fireDelay: 0.16,
  bulletSpeed: 1120,
  bulletDamage: 26,
};

export const VEHICLE = {
  radius: 30,
  accel: 690,
  brake: 1080,
  drag: 0.72,
  maxSpeed: 440,
  reverseSpeed: 150,
  steer: 2.5,
  handbrake: 0.55,
};

export const WANTED = {
  max: 5,
  decayDelay: 9,
  decayRate: 0.055,
  copShootRange: 560,
};

export const TRAFFIC = { target: 20, pedTarget: 26 };
export const SAVE_KEY = 'port-vela-nightfall.save.v1';
export const MUTE_KEY = 'port-vela-nightfall.muted';

// The story's chapter headings are shown on the title card and the pause menu.
export const STORY = {
  chapters: ['Wake Up Call', 'Hot Cargo', 'The Ledger'],
  finale: 'Port Vela is yours.',
};

export const COLORS = {
  void: '#0a1220',
  asphalt: '#2a323d',
  asphaltLight: '#333c49',
  patch: '#232a34',
  lane: '#c7b779',
  laneDim: '#857a4d',
  sidewalk: '#48515e',
  sidewalkEdge: '#5b6674',
  curb: '#6a7484',
  grass: '#2c4a3a',
  grassLight: '#3c624f',
  water: '#0d2433',
  roof: ['#414c60', '#4b5870', '#435452', '#564b5e', '#56503f', '#3d4a62'],
  wall: ['#333c4b', '#3a4557', '#354744', '#473b4b', '#484234', '#334156'],
  neon: ['#ff4f8b', '#45e2cb', '#ffc857', '#8a7dff', '#ff8747', '#6cd7ff'],
  player: '#4fd6c0',
  playerDark: '#1d6f68',
  skin: '#d9a277',
  ped: ['#c46b5a', '#7f8fa6', '#8c7bb0', '#b79a5b', '#5f9e86', '#a26a86', '#9aa7b4'],
  cop: '#3d5f9e',
  copLight: '#6f9be8',
  hostile: '#a43e4b',
  policeCar: '#d9e3f2',
  policeDark: '#1f2a3d',
  bullet: '#ffe29a',
  health: '#55d68a',
  armor: '#5aa9e6',
  wanted: '#ffbf3f',
  danger: '#ff4d67',
  money: '#a9ef7d',
  glass: '#1a2735',
  hudBg: 'rgba(7,11,18,0.78)',
  hudLine: 'rgba(131,217,255,0.22)',
  white: '#eef5ff',
  muted: '#8d9aab',
  gold: '#ffc857',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Segoe UI", system-ui, sans-serif';
