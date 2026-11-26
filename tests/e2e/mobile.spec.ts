import { test, expect, devices } from '@playwright/test';

// téléphone émulé : écran tactile, portrait
test.use({ ...devices['Pixel 7'] });

import './api.ts';

test('sur téléphone : joystick pour marcher, toucher pour agir', async ({ page, context }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('./?debug');
  await page.waitForFunction(() => window.__game?.ready === true, null, { timeout: 60_000 });
  // l'aide affichée est celle du tactile
  await expect(page.locator('.help')).toContainText('Pouce gauche');
  await page.tap('[data-action="start"]');
  await expect(page.locator('[data-action="pause"]')).toBeVisible();

  const cdp = await context.newCDPSession(page);
  const { width: W, height: H } = page.viewportSize()!;
  const z0 = (await page.evaluate(() => window.__game.player())).z;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W * 0.2, y: H * 0.75, id: 1 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: W * 0.2, y: H * 0.75 - i * 10, id: 1 }] });
    await page.waitForTimeout(100);
  }
  await expect(page.locator('.stick')).toBeVisible();
  await page.waitForTimeout(1500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await page.evaluate(() => window.__game.player())).z).toBeLessThan(z0 - 1);

  await page.evaluate(() => {
    window.__game.view('a1');
    window.__game.aim('a1', 0);
  });
  await page.waitForFunction(() => window.__game.hovered()?.id === 'a1', null, { timeout: 30_000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W * 0.75, y: H * 0.5, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => window.__game.panels().find((p) => p.id === 'a1')!.solved, null, { timeout: 10_000 });
  await page.screenshot({ path: 'test-results/mobile.png' });

  // pause pendant que le pouce tient le joystick : à la reprise, le joueur ne marche pas
  // tout seul et le joystick répond de nouveau
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W * 0.2, y: H * 0.75, id: 3 }] });
  for (let i = 1; i <= 4; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: W * 0.2, y: H * 0.75 - i * 12, id: 3 }] });
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-action="pause"]')!.click());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[data-action="start"]')!.click());
  const p0 = await page.evaluate(() => window.__game.player());
  await page.waitForTimeout(1200);
  const p1 = await page.evaluate(() => window.__game.player());
  expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeLessThan(0.2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W * 0.2, y: H * 0.75, id: 4 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: W * 0.2, y: H * 0.75 - 40, id: 4 }] });
  await expect(page.locator('.stick')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // l'aide montre le geste à faire : sur la ligne du milieu de p6, « appui long »
  await page.evaluate(() => {
    const ids = ['a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'c1', 'c2', 'c3', 'c4', 'c5', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'tours', 'p1', 'p2', 'p3', 'p4', 'p5'];
    for (const id of ids) window.__game.solve(id);
    window.__game.view('p6');
    window.__game.hint('p6');
    window.__game.aim('p6', 2);
  });
  await expect(page.locator('.mouse-hint')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.mouse-hint')).toContainText('appui long');
  expect(await page.evaluate(() => window.__game.interact('p6', 2, true))).toBe('ok');
  await expect(page.locator('.mouse-hint')).toBeHidden({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
