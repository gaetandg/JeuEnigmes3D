import { test, expect, type Page } from '@playwright/test';

type Api = {
  ready: boolean;
  frames: () => number;
  panels: () => { id: string; powered: boolean; solved: boolean }[];
  view: (id: string) => void;
  teleport: (x: number, z: number, yaw: number, pitch?: number) => void;
  solve: (id: string) => boolean;
  solveAll: () => string[];
  interact: (id: string, k: number, reverse?: boolean) => string | undefined;
  aim: (id: string, k: number) => void;
  state: (id: string) => number[];
  gateOpen: (id: string) => number;
  advance: (s: number) => void;
  player: () => { x: number; y: number; z: number };
  move: (f: number, r: number, s: number) => void;
  hovered: () => { id: string; k: number } | null;
  drawCalls: () => number;
};
declare global {
  interface Window { __game: Api }
}

const errors: string[] = [];

async function boot(page: Page, query = '?test') {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('./' + query);
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 60_000 });
  await waitFrames(page, 3);
}

async function waitFrames(page: Page, n: number) {
  const f0 = await page.evaluate(() => window.__game.frames());
  await page.waitForFunction((f) => window.__game.frames() >= f, f0 + n, { timeout: 60_000 });
}

test.beforeEach(async ({ page }) => {
  // partie neuve à chaque test
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('keep')) localStorage.clear();
  });
});

test('le jeu démarre sans erreur et seul le premier panneau est allumé', async ({ page }) => {
  await boot(page);
  const panels = await page.evaluate(() => window.__game.panels());
  expect(panels).toHaveLength(19);
  expect(panels.filter((p) => p.powered).map((p) => p.id)).toEqual(['a1']);
  await page.screenshot({ path: 'test-results/depart.png' });
  expect(errors).toEqual([]);
});

test('viser une pièce puis cliquer résout le premier panneau et ouvre la porte', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__game.view('a1');
    window.__game.aim('a1', 0);
  });
  await waitFrames(page, 3);
  const hovered = await page.evaluate(() => window.__game.hovered());
  expect(hovered).toEqual({ id: 'a1', k: 0 });
  expect(await page.evaluate(() => window.__game.interact('a1', 0))).toBe('ok');
  const panels = await page.evaluate(() => window.__game.panels());
  expect(panels.find((p) => p.id === 'a1')!.solved).toBe(true);
  // l'alimentation suit le câble après un court délai
  await page.waitForFunction(() => window.__game.panels().find((p) => p.id === 'a2')!.powered, null, { timeout: 5000 });
  await page.evaluate(() => window.__game.advance(3));
  expect(await page.evaluate(() => window.__game.gateOpen('porte-plage'))).toBe(1);
  await page.screenshot({ path: 'test-results/a1-resolu.png' });
  expect(errors).toEqual([]);
});

test('une porte fermée bloque le joueur, ouverte elle le laisse passer', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__game.teleport(0, 89.5, 0));
  await page.evaluate(() => window.__game.move(1, 0, 3));
  expect((await page.evaluate(() => window.__game.player())).z).toBeGreaterThan(86.3);
  await page.evaluate(() => {
    window.__game.solve('a1');
    window.__game.advance(3);
  });
  await page.evaluate(() => window.__game.move(1, 0, 3));
  expect((await page.evaluate(() => window.__game.player())).z).toBeLessThan(84);
});

test('toutes les énigmes se résolvent dans l\'ordre et ouvrent les portes du jardin', async ({ page }) => {
  await boot(page);
  const solved = await page.evaluate(() => window.__game.solveAll());
  expect(solved).toHaveLength(19);
  await page.evaluate(() => window.__game.advance(4));
  for (const gate of ['porte-plage', 'porte-place', 'porte-nord']) {
    expect(await page.evaluate((g) => window.__game.gateOpen(g), gate)).toBe(1);
  }
  expect(await page.evaluate(() => window.__game.gateOpen('porte-sortie'))).toBe(0);
  for (const id of ['a5', 'b3', 'c4', 'd5']) {
    await page.evaluate((i) => window.__game.view(i), id);
    await waitFrames(page, 3);
    await page.screenshot({ path: `test-results/panneau-${id}.png` });
  }
  expect(errors).toEqual([]);
});

test('la progression est sauvegardée et restaurée', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__game.solve('a1');
    window.__game.interact('a2', 0);
    sessionStorage.setItem('keep', '1');
  });
  const state = await page.evaluate(() => window.__game.state('a2'));
  await page.reload();
  await page.waitForFunction(() => window.__game?.ready === true);
  const panels = await page.evaluate(() => window.__game.panels());
  expect(panels.find((p) => p.id === 'a1')!.solved).toBe(true);
  expect(panels.find((p) => p.id === 'a2')!.powered).toBe(true);
  expect(await page.evaluate(() => window.__game.state('a2'))).toEqual(state);
  expect(await page.evaluate(() => window.__game.gateOpen('porte-plage'))).toBe(1);
});
