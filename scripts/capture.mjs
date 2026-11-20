// Capture the entry's screenshots from the real game in a real browser: serve game/ with
// serve.ts, drive headless Chromium (Playwright) to each staged scene in shots.json and save
// the browser's own 1280x720 JPEG render to screenshots/. No compositing, no mock frames.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';

const here = fileURLToPath(new URL('..', import.meta.url));
const port = 8123;
const base = `http://127.0.0.1:${port}/`;
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const outDir = join(here, 'screenshots');
mkdirSync(outDir, { recursive: true });

// Only real renders belong in screenshots/: clear earlier captures before this run.
for (const name of readdirSync(outDir)) {
  if (/\.(?:jpe?g|png)$/i.test(name)) rmSync(join(outDir, name), { force: true });
}

const server = spawn(process.execPath, [join(here, 'serve.ts'), '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('serve.ts did not start in time')), 10000);
  server.stdout.on('data', (buf) => {
    if (buf.toString().includes('http://localhost:')) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.on('exit', (code) => reject(new Error(`serve.ts exited with ${code}`)));
});

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  for (const shot of shots) {
    await page.goto(base + shot.query, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
    await page.waitForTimeout(350);
    const bytes = await page.screenshot({ type: 'jpeg', quality: 88 });
    writeFileSync(join(outDir, shot.name), bytes);
    console.log(`captured screenshots/${shot.name} (${bytes.length} bytes) from ${shot.query}`);
    if (bytes.length > 262144) throw new Error(`${shot.name} is over the 256 KiB screenshot cap`);
  }

  if (errors.length > 0) {
    console.error('browser errors:');
    for (const err of errors) console.error('  ' + err);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
