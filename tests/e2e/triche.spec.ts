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
  await page.evaluate(() => {
    window.__game.teleport(9, -93, 3.14);
    window.__game.aimNote('mer');
  });
  await page.waitForFunction(() => window.__game.hoveredNote() === 'mer', null, { timeout: 15_000 });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('.note-card')).toBeVisible();
  await expect(page.locator('.note-card')).toContainText('regarde la mer');
  await page.screenshot({ path: 'test-results/billet-carte.png' });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('.note-card')).toBeHidden();
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator('.journal-count')).toHaveText('(1 / 12)');
  await expect(page.locator('.journal-list')).toContainText('regarde la mer');
  expect(errors).toEqual([]);
});
