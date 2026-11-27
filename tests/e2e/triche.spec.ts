import { test, expect } from '@playwright/test';

import './api.ts';

const solvedIds = async (page: import('@playwright/test').Page) =>
  (await page.evaluate(() => window.__game.panels())).filter((p) => p.solved).map((p) => p.id);

test('mode test : valider ce qui précède une énigme, puis jusqu\'à une autre', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('./?debug');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 60_000 });

  // le menu de triche est dans l'écran d'accueil / de pause
  await page.locator('details.cheat summary').click();
  await page.locator('[data-cheat="target"]').selectOption('p6');
  await page.locator('[data-cheat="before"]').click();
  // tout ce qui précède p6 est résolu, p6 attend, allumée
  const s1 = await solvedIds(page);
  for (const id of ['a1', 'd6', 'tours', 'p1', 'p5']) expect(s1).toContain(id);
  expect(s1).not.toContain('p6');
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'p6')!.powered).toBe(true);
  expect(await page.evaluate(() => window.__game.gateOpen('porte-sortie'))).toBe(1);
  // le joueur est devant p6, et la progression est sauvegardée
  const pos = await page.evaluate(() => window.__game.player());
  expect(Math.hypot(pos.x - -50, pos.z - -56)).toBeLessThan(25);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lueur-sauvegarde-v2')!).solved.length)).toBe(s1.length);

  // retour au menu, puis « valider jusqu'ici » sur le Cadran
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('.overlay')).toBeVisible();
  await page.locator('[data-cheat="target"]').selectOption('cadran');
  await page.locator('[data-cheat="upto"]').click();
  const s2 = await solvedIds(page);
  expect(s2).toContain('cadran');
  expect(s2).toContain('grand-pli');
  expect(s2).not.toContain('f1');
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'f1')!.powered).toBe(true);

  // un billet du gardien, lu d'un vrai clic : la carte s'affiche, le carnet le garde
  await page.evaluate(() => window.__game.teleport(9.4, -94, 3.14));
  // on revise à chaque vérification (un mouvement de souris résiduel peut tourner la caméra)
  const aimed = await page
    .waitForFunction(() => {
      window.__game.aimNote('mer');
      return window.__game.hoveredNote() === 'mer';
    }, null, { timeout: 15_000 })
    .then(() => true, () => false);
  expect(aimed, JSON.stringify(await page.evaluate(() => ({ p: window.__game.player(), note: window.__game.hoveredNote(), piece: window.__game.hovered() })))).toBe(true);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('.note-card')).toBeVisible();
  await expect(page.locator('.note-card')).toContainText('regarde la mer');
  await page.screenshot({ path: 'test-results/billet-carte.png' });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('.note-card')).toBeHidden();
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('.journal-count')).toHaveText('(1 / 15)');

  // la vraie fin : « valider ce qui précède » le Grand Plateau (l'île monte sans séquence),
  // puis on le résout : les lanternes montent aux étoiles
  await page.locator('[data-cheat="target"]').selectOption('grand-plateau');
  await page.locator('[data-cheat="before"]').click();
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(true);
  expect((await page.evaluate(() => window.__game.player())).y).toBeGreaterThan(100);
  await page.evaluate(() => window.__game.solve('grand-plateau'));
  expect(await page.evaluate(() => window.__game.sequences().finale)).toBe(true);
  await expect(page.locator('.journal-list')).toContainText('regarde la mer');
  expect(errors).toEqual([]);
});

test("mode test : revenir en arrière remet la progression exactement à ce point", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('keep')) localStorage.clear();
  });
  await page.goto('./?debug');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => sessionStorage.setItem('keep', '1'));
  // on avance jusqu'au ciel…
  await page.locator('details.cheat summary').click();
  await page.locator('[data-cheat="target"]').selectOption('t3');
  await page.locator('[data-cheat="before"]').click();
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(true);
  // … puis on revient avant p6 : la page se recharge à ce point exact
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('.overlay')).toBeVisible();
  await page.locator('details.cheat').evaluate((d) => ((d as HTMLDetailsElement).open = true));
  await page.locator('[data-cheat="target"]').selectOption('p6');
  await Promise.all([page.waitForEvent('load'), page.locator('[data-cheat="before"]').click()]);
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 60_000 });
  const panels = await page.evaluate(() => window.__game.panels());
  const st = (id: string) => panels.find((p) => p.id === id)!;
  expect(st('p5').solved).toBe(true);
  expect(st('p6').solved).toBe(false);
  expect(st('p6').powered).toBe(true);
  expect(st('cadran').solved).toBe(false);
  expect(st('t1').solved).toBe(false);
  expect(await page.evaluate(() => window.__game.ended())).toBe(false);
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(false);
  // devant p6 (atelier)
  const pos = await page.evaluate(() => window.__game.player());
  expect(Math.hypot(pos.x - -50, pos.z - -56)).toBeLessThan(25);
  expect(errors).toEqual([]);
});

test('mode test : voir une cinématique sans toucher à la progression', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('./?debug');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 60_000 });
  const before = await page.evaluate(() => window.__game.player());
  await page.locator('details.cheat summary').click();
  await page.locator('[data-cheat="cinematic"]').selectOption('ile');
  await page.locator('[data-cheat="watch"]').click();
  expect(await page.evaluate(() => window.__game.sequences().rise)).toBe(true);
  await page.evaluate(() => window.__game.advance(16));
  // la séquence est finie : rien n'a changé
  expect(await page.evaluate(() => window.__game.sequences().rise)).toBe(false);
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(false);
  expect((await page.evaluate(() => window.__game.panels())).filter((p) => p.solved)).toHaveLength(0);
  const after = await page.evaluate(() => window.__game.player());
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.5);

  // la vraie fin : l'île monte le temps de la séquence, la lettre s'affiche, puis tout redevient comme avant
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('.overlay').first()).toBeVisible();
  await page.locator('details.cheat').evaluate((d) => ((d as HTMLDetailsElement).open = true));
  await page.locator('[data-cheat="cinematic"]').selectOption('vraie');
  await page.locator('[data-cheat="watch"]').click();
  expect(await page.evaluate(() => window.__game.sequences().finale)).toBe(true);
  await page.evaluate(() => window.__game.advance(19));
  await expect(page.locator('.finale')).toBeVisible();
  await page.locator('.finale [data-action="continue"]').click();
  expect(await page.evaluate(() => window.__game.sequences().finale)).toBe(false);
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(false);
  expect(await page.evaluate(() => window.__game.ended())).toBe(false);
  expect(errors).toEqual([]);
});
