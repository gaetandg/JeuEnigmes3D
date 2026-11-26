// Captures d'écran de développement : node scripts/shots.mjs <url> <dossier> '[{"name":"vue","view":"a1"}]'
import { chromium } from '@playwright/test';
const url = process.argv[2] || 'http://localhost:4173/?test';
const out = process.argv[3] || '/tmp/claude-0/-home-user/05a426b5-9e4a-5974-bc92-00dc6716e185/scratchpad';
const views = JSON.parse(process.argv[4] || '[]');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.__game?.ready, null, { timeout: 60000 });
console.log('ready in', Date.now() - t0, 'ms');
for (const v of views) {
  await page.evaluate((v) => {
    const g = window.__game;
    if (v.solve) for (const id of v.solve) g.solve(id);
    if (v.solveAll) g.solveAll();
    if (v.advance) g.advance(v.advance);
    if (v.view) g.view(v.view);
    if (v.tp) g.teleport(...v.tp);
    if (v.cam) g.camera(...v.cam); else g.freeCamera();
  }, v);
  const f0 = await page.evaluate(() => window.__game.frames());
  await page.waitForFunction((f) => window.__game.frames() > f + 3, f0, { timeout: 60000 });
  await page.screenshot({ path: `${out}/${v.name}.png` });
  console.log("shot", v.name, "drawcalls", await page.evaluate(() => window.__game.drawCalls()), "hover", JSON.stringify(await page.evaluate(() => window.__game.hovered())));
}
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
