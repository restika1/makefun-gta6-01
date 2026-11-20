// Port Vela: Nightfall — a make.fun gta6-01 entry.
//
// The game is the static folder beside this file, game/: game/index.html plus ES modules and no
// network request, no build step and no library outside the repo. It is an original open-world
// crime story: a hand-built night city with roads, blocks and neon, on-foot movement and shooting,
// a driveable car (steal any parked or moving car), traffic, pedestrians, a five-star wanted level
// with responding VPD cruisers and officers, a three-mission story with dialogue, combat, HUD,
// minimap, start screen and a localStorage save. Every pixel is drawn by this game's own canvas
// renderer; the screenshots/ folder holds real Chromium renders captured with Playwright.
//
// This program copies game/ and screenshots/ beside it into /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library. Only the plumbing is the kit's;
// the world and the game are ours. Serve it locally with `node serve.ts`, then open
// http://localhost:8080. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
const shots = readdirSync(join(out, 'screenshots'));
const shotBytes = shots.reduce((sum, name) => sum + statSync(join(out, 'screenshots', name)).size, 0);
const sourceBytes = readdirSync(join(out, 'game', 'src')).reduce(
  (sum, name) => sum + statSync(join(out, 'game', 'src', name)).size,
  0,
);
console.log(`Port Vela: Nightfall -> ${out}`);
console.log(`  game entries: ${gameFiles}, screenshots: ${shots.length} (${shotBytes} bytes)`);
console.log(`  game source under src/: ${sourceBytes} bytes`);
console.log(`  dossier.json: ${dossier.length} bytes`);
