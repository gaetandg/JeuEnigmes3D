import { test, expect } from '@playwright/test';

test('le jeu démarre et rend une image WebGL', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/smoke.png' });
  expect(errors).toEqual([]);
});
