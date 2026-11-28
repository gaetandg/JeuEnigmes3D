import { test, expect, type Page } from '@playwright/test';

import './api.ts';

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
  expect(panels).toHaveLength(88);
  expect(panels.filter((p) => p.powered && !p.id.startsWith('eclat-')).map((p) => p.id)).toEqual(['a1']);
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
  // le guide lumineux désigne la prochaine énigme (a2, plus loin)
  expect(await page.evaluate(() => window.__game.guides())).toBeGreaterThanOrEqual(1);
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

test('toutes les énigmes (zones 1 à 4) se résolvent dans l\'ordre et ouvrent les portes', async ({ page }) => {
  test.setTimeout(360_000);
  await boot(page);
  const solved = await page.evaluate(() => window.__game.solveAll());
  expect(solved).toHaveLength(56); // zones 1 à 4 (le ciel vient après la fin)
  await page.evaluate(() => window.__game.advance(4));
  for (const gate of ['porte-plage', 'porte-place', 'porte-nord', 'porte-sortie']) {
    expect(await page.evaluate((g) => window.__game.gateOpen(g), gate)).toBe(1);
  }
  expect(await page.evaluate(() => window.__game.ended())).toBe(true);
  for (const id of ['grand-pli', 'cadran', 'f6']) {
    await page.evaluate((i) => window.__game.view(i), id);
    await waitFrames(page, 3);
    await page.screenshot({ path: `test-results/panneau-${id}.png` });
  }
  expect(errors).toEqual([]);
});

test('les Tours-Miroirs se tournent en visant la tour', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'c1', 'c2', 'c3', 'c4', 'c5', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6']) window.__game.solve(id);
    // tour (2, 2) de la grille, en x = -8, z = -7 : pièce n° 4
    window.__game.teleport(-11, -4, Math.PI / 2);
    window.__game.aim('tours', 4);
  });
  await waitFrames(page, 3);
  const h = await page.evaluate(() => window.__game.hovered());
  expect(h?.id).toBe('tours');
  expect(await page.evaluate((k) => window.__game.interact('tours', k), h!.k)).toBe('ok');
});

const ZONE1 = ['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'c1', 'c2', 'c3', 'c4', 'c5', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'tours'];

test('le Grand Pli se manipule de loin (portée propre à chaque énigme)', async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    // à 16 m devant le chevalet (bien au-delà des 5 m des pupitres)
    window.__game.teleport(-50, -40, 0);
    window.__game.aim('grand-pli', 2);
  }, [...ZONE1, 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13']);
  await waitFrames(page, 3);
  expect(await page.evaluate(() => window.__game.hovered())).toEqual({ id: 'grand-pli', k: 2 });
  await page.screenshot({ path: 'test-results/grand-pli-de-loin.png' });
  expect(errors).toEqual([]);
});

test('une feuille de pliage se plie en visant une ligne de pli', async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('p1');
    window.__game.aim('p1', 1);
  }, ZONE1);
  await waitFrames(page, 3);
  expect(await page.evaluate(() => window.__game.hovered())).toEqual({ id: 'p1', k: 1 });
  expect(await page.evaluate(() => window.__game.interact('p1', 1))).toBe('ok');
  // l'animation du pli se joue, puis la feuille est vérifiée
  await page.evaluate(() => window.__game.advance(1));
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'p1')!.solved).toBe(true);
  await page.screenshot({ path: 'test-results/p1-plie.png' });
  expect(errors).toEqual([]);
});

test('un mauvais pliage se déplie tout seul quand la réserve est vide', async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of [...ids, 'p1']) window.__game.solve(id);
    window.__game.view('p2');
  }, ZONE1);
  // p2 : « R . . R », un seul pli permis ; plier au premier tiers est une erreur
  expect(await page.evaluate(() => window.__game.interact('p2', 1))).toBe('ok');
  expect(await page.evaluate(() => window.__game.state('p2'))).toEqual([0, 1, -1]);
  await page.evaluate(() => window.__game.advance(1));
  // les marques fautives clignotent, puis la feuille se déplie
  expect(await page.evaluate(() => window.__game.state('p2'))).toEqual([0, 1, -1]);
  await page.evaluate(() => window.__game.advance(2));
  expect(await page.evaluate(() => window.__game.state('p2'))).toEqual([]);
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'p2')!.solved).toBe(false);
});

test('p6, leçon du clic droit : seule la moitié droite se replie sans montrer la tache', async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('p6');
  }, [...ZONE1, 'p1', 'p2', 'p3', 'p4', 'p5']);
  expect(await page.evaluate(() => window.__game.hint('p6'))).toBe(2);
  expect(await page.evaluate(() => window.__game.hintMove('p6'))).toEqual({ k: 2, reverse: true });
  expect(await page.evaluate(() => window.__game.interact('p6', 2))).toBe('ok');
  await page.evaluate(() => window.__game.advance(3));
  expect(await page.evaluate(() => window.__game.state('p6'))).toEqual([]);
  expect(await page.evaluate(() => window.__game.interact('p6', 2, true))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'p6')!.solved).toBe(true);
  expect(errors).toEqual([]);
});

test("p8 : la ligne du milieu plie dans les deux sens ; seul le clic droit fait voir l'étoile par le trou", async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('p8');
  }, [...ZONE1, 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
  // l'aide désigne la ligne du milieu, avec le clic droit
  expect(await page.evaluate(() => window.__game.hint('p8'))).toBe(2);
  expect(await page.evaluate(() => window.__game.hintMove('p8'))).toEqual({ k: 2, reverse: true });
  // clic gauche : la moitié gauche se rabat, l'étoile se cache, la feuille se déplie
  expect(await page.evaluate(() => window.__game.interact('p8', 2))).toBe('ok');
  await page.evaluate(() => window.__game.advance(3));
  expect(await page.evaluate(() => window.__game.state('p8'))).toEqual([]);
  // clic droit : la moitié droite se rabat, le trou tombe sur l'étoile
  expect(await page.evaluate(() => window.__game.interact('p8', 2, true))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'p8')!.solved).toBe(true);
  expect(errors).toEqual([]);
});

const ZONE2 = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'grand-pli'];

test("un objet tourne sur son plateau et son ombre épouse la silhouette", async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('o1');
    window.__game.aim('o1', 0);
  }, [...ZONE1, ...ZONE2]);
  await waitFrames(page, 3);
  expect(await page.evaluate(() => window.__game.hovered())).toEqual({ id: 'o1', k: 0 });
  // o1 commence à un quart de tour de la solution : clic droit
  expect(await page.evaluate(() => window.__game.interact('o1', 0, true))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect(await page.evaluate(() => window.__game.state('o1'))).toEqual([0]);
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'o1')!.solved).toBe(true);
  await page.screenshot({ path: 'test-results/o1-resolu.png' });
  expect(errors).toEqual([]);
});

test('une manivelle entraîne deux objets ; on rattrape le voisin avec la seconde', async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('o11');
    window.__game.aim('o11', 0);
  }, [...ZONE1, ...ZONE2, 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10']);
  await waitFrames(page, 3);
  // on vise la manivelle, pas l'objet
  expect(await page.evaluate(() => window.__game.hovered())).toEqual({ id: 'o11', k: 0 });
  expect(await page.evaluate(() => window.__game.interact('o11', 0))).toBe('ok');
  // les deux zigzags tournent ensemble
  expect(await page.evaluate(() => window.__game.state('o11'))).toEqual([1, 1]);
  // pendant qu'ils tournent, la seconde manivelle attend
  expect(await page.evaluate(() => window.__game.interact('o11', 1, true))).toBe('denied');
  await page.evaluate(() => window.__game.advance(1));
  expect(await page.evaluate(() => window.__game.interact('o11', 1, true))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect(await page.evaluate(() => window.__game.state('o11'))).toEqual([1, 0]);
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'o11')!.solved).toBe(true);
  await page.screenshot({ path: 'test-results/o11-manivelles.png' });
  expect(errors).toEqual([]);
});

test("o10 : l'objet du fond se sélectionne en visant ses cubes, même derrière un autre objet", async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('o10');
  }, [...ZONE1, ...ZONE2, 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9']);
  // les trois objets, dont le T bleu (n° 2) placé derrière le T vert (n° 1)
  for (const k of [0, 1, 2]) {
    await page.evaluate((kk) => window.__game.aim('o10', kk), k);
    await waitFrames(page, 3);
    expect(await page.evaluate(() => window.__game.hovered())).toEqual({ id: 'o10', k });
  }
  await page.screenshot({ path: 'test-results/o10-bleu.png' });
  expect(errors).toEqual([]);
});

const ZONE3 = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10', 'o11', 'o12', 'cadran'];

test("f5 : la lame entre les deux objets se sélectionne (les objets se visent par leurs cubes)", async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('f5');
  }, [...ZONE1, ...ZONE2, ...ZONE3, 'f1', 'f2', 'f3', 'f4']);
  // pièce 0 : la lame orientable ; 1 et 2 : l'anneau et le pont
  for (const k of [0, 1, 2]) {
    await page.evaluate((kk) => window.__game.aim('f5', kk), k);
    await waitFrames(page, 3);
    expect(await page.evaluate(() => window.__game.hovered())).toEqual({ id: 'f5', k });
  }
  // vue de biais, côté anneau (comme le joueur qui l'a signalé) : la lame reste sélectionnable
  // (avant, la grande boîte invisible de l'anneau la masquait sous cet angle)
  const yaw = -0.6286;
  for (const deg of [-30, -45, -60]) {
    const a = yaw + (deg * Math.PI) / 180;
    await page.evaluate(([x, z]) => {
      window.__game.teleport(x, z, 0);
      window.__game.aim('f5', 0);
    }, [-7.65 + Math.sin(a) * 1.8, -101.49 + Math.cos(a) * 1.8]);
    await waitFrames(page, 3);
    expect(await page.evaluate(() => window.__game.hovered())).toEqual({ id: 'f5', k: 0 });
  }
  expect(errors).toEqual([]);
});

test("zone finale : tourner un objet sur un panneau de lumière change l'empreinte qui arrête les rayons", async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('f1');
  }, [...ZONE1, ...ZONE2, ...ZONE3]);
  // f1 : l'anneau (pièce 0) doit faire un demi-tour
  expect(await page.evaluate(() => window.__game.interact('f1', 0))).toBe('ok');
  expect(await page.evaluate(() => window.__game.interact('f1', 0))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect((await page.evaluate(() => window.__game.panels())).find((p) => p.id === 'f1')!.solved).toBe(true);
  expect(await page.evaluate(() => window.__game.ended())).toBe(false);
  await page.screenshot({ path: 'test-results/f1-resolu.png' });
  expect(errors).toEqual([]);
});

test('pochoir raté : les cases mal éclairées clignotent en rouge, puis la feuille se déplie', async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('f4');
  }, [...ZONE1, ...ZONE2, ...ZONE3, 'f1', 'f2', 'f3']);
  // trois plis qui ne donnent pas le motif : moitié gauche, puis moitié haute, puis moitié gauche
  for (const k of [2, 102, 3]) {
    expect(await page.evaluate((kk) => window.__game.interact('f4', kk), k)).toBe('ok');
    await page.evaluate(() => window.__game.advance(0.8));
  }
  expect(await page.evaluate(() => window.__game.state('f4'))).toHaveLength(9);
  expect(await page.evaluate(() => window.__game.lightErrors('f4'))).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/f4-erreurs.png' });
  await page.evaluate(() => window.__game.advance(3));
  expect(await page.evaluate(() => window.__game.state('f4'))).toEqual([]);
  expect(await page.evaluate(() => window.__game.lightErrors('f4'))).toBe(0);
  expect(errors).toEqual([]);
});

test("finale : les manivelles mènent les objets du panneau, le phare ne s'allume qu'après f6", async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
    window.__game.view('f4');
  }, [...ZONE1, ...ZONE2, ...ZONE3, 'f1', 'f2', 'f3']);
  // le pochoir en trois plis se résout en suivant les aides
  const folds = await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 20; i++) {
      if (g.panels().find((p) => p.id === 'f4')!.solved) return i;
      const k = g.hint('f4');
      if (k === null) return -1;
      g.interact('f4', k);
      g.advance(1.2);
    }
    return -2;
  });
  expect(folds).toBe(3);
  await page.screenshot({ path: 'test-results/f4-pochoir.png' });
  await page.waitForFunction(() => window.__game.panels().find((p) => p.id === 'f5')!.powered, null, { timeout: 15_000 });
  await page.evaluate(() => {
    window.__game.solve('f5');
    window.__game.view('f6');
  });
  expect(await page.evaluate(() => window.__game.ended())).toBe(false);
  // la première manivelle (levier 0 : aucune case manipulable) tourne les deux premiers objets
  expect(await page.evaluate(() => window.__game.state('f6'))).toEqual([2, 2, 2]);
  expect(await page.evaluate(() => window.__game.interact('f6', 0))).toBe('ok');
  expect(await page.evaluate(() => window.__game.state('f6'))).toEqual([3, 3, 2]);
  expect(await page.evaluate(() => window.__game.interact('f6', 2, true))).toBe('ok');
  expect(await page.evaluate(() => window.__game.state('f6'))).toEqual([3, 3, 1]);
  // en suivant les aides, on arrive au bout
  const steps = await page.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 40; i++) {
      if (g.panels().find((p) => p.id === 'f6')!.solved) return i;
      const k = g.hint('f6');
      if (k === null) return -1;
      g.interact('f6', k);
      g.advance(0.5);
    }
    return -2;
  });
  expect(steps).toBeGreaterThan(0);
  // l'alimentation suit le câble (court délai réel), puis le phare s'allume
  await page.waitForFunction(() => window.__game.ended(), null, { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/f6-finale.png' });
  expect(errors).toEqual([]);
});

test('en suivant les aides discrètes, on résout une énigme de chaque langage', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  const follow = async (id: string) =>
    page.evaluate(async (pid) => {
      const g = window.__game;
      for (let i = 0; i < 40; i++) {
        if (g.panels().find((p) => p.id === pid)!.solved) return i;
        const k = g.hint(pid);
        if (k === null) return -1;
        g.interact(pid, k, g.hintMove(pid)?.reverse ?? false);
        g.advance(1.2); // laisse finir les animations (plis, rotations)
      }
      return -2;
    }, id);
  await page.evaluate(() => {
    for (const id of ['a1', 'a2', 'a3', 'a4']) window.__game.solve(id);
  });
  expect(await follow('a5')).toBeGreaterThan(0);
  // (solve() remet aussi à jour l'alimentation, que le jeu fait sinon après un court délai)
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
  }, ['a5', ...ZONE1.slice(5), 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
  expect(await follow('p9')).toBeGreaterThan(0);
  await page.evaluate((ids) => {
    for (const id of ids) window.__game.solve(id);
  }, ['p9', ...ZONE2.slice(9), 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9']);
  expect(await follow('o10')).toBeGreaterThan(0);
  // les manivelles : l'aide désigne la bonne roue, même quand il faut passer par un état moins bon
  // (o10 vient d'être résolue à la main : son câble allume o11 après un court délai réel)
  await page.waitForFunction(() => window.__game.panels().find((p) => p.id === 'o11')!.powered, null, { timeout: 15_000 });
  await page.evaluate(() => {
    window.__game.solve('o11');
  });
  expect(await follow('o12')).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('les sept énigmes secrètes donnent sept éclats', async ({ page }) => {
  await boot(page);
  const ids = ['eclat-plage', 'eclat-bosquet', 'eclat-voile', 'eclat-statues', 'eclat-belvedere', 'eclat-dunes', 'eclat-gardiens'];
  // allumées dès le départ, sans câble : on peut les résoudre sans avoir fini le jeu
  const powered = await page.evaluate((list) => window.__game.panels().filter((p) => list.includes(p.id) && p.powered).length, ids);
  expect(powered).toBe(7);
  await page.evaluate((list) => {
    for (const id of list) window.__game.solve(id);
    window.__game.advance(7);
  }, ids);
  expect(await page.evaluate(() => window.__game.shards())).toBe(7);
  // les secrets n'ont pas de guide lumineux
  await page.evaluate(() => window.__game.teleport(0, 104, 0));
  expect(errors).toEqual([]);
});

test('pas de fuite de mémoire : survoler et plier ne crée pas de géométries', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(() => {
    window.__game.solveAll();
    window.__game.view('eclat-voile');
  });
  await waitFrames(page, 2);
  const before = await page.evaluate(() => window.__game.memory().geometries);
  for (let i = 0; i < 12; i++) {
    await page.evaluate((k) => window.__game.hover('eclat-voile', k), i % 2 ? 1 : 101);
    await waitFrames(page, 1);
  }
  // plier puis remettre à plat (pierre dorée), plusieurs fois
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      window.__game.interact('eclat-voile', 1);
      window.__game.advance(1);
      window.__game.interact('eclat-voile', 1000);
      window.__game.advance(0.2);
    });
    await waitFrames(page, 1);
  }
  const after = await page.evaluate(() => window.__game.memory().geometries);
  expect(after - before).toBeLessThanOrEqual(2);
});

test('un pliage en cours est sauvegardé et restauré', async ({ page }) => {
  await boot(page);
  await page.evaluate((ids) => {
    for (const id of [...ids, 'p1', 'p2', 'p3', 'p4']) window.__game.solve(id);
    sessionStorage.setItem('keep', '1');
  }, ZONE1);
  // p5 « s . R R » : deux plis permis, un seul pli laisse la feuille en cours
  expect(await page.evaluate(() => window.__game.interact('p5', 2))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  const state = await page.evaluate(() => window.__game.state('p5'));
  expect(state.length).toBe(3);
  await page.reload();
  await page.waitForFunction(() => window.__game?.ready === true);
  expect(await page.evaluate(() => window.__game.state('p5'))).toEqual(state);
  // une sauvegarde abîmée ne casse rien : chaque vue retombe sur un état valide
  await page.evaluate(() => {
    const key = 'lueur-sauvegarde-v2';
    const save = JSON.parse(localStorage.getItem(key)!);
    save.states.p5 = [0, 9, 1, 7, 7, 7];
    save.states.a2 = [5, 0.5, Number.NaN];
    save.states.o1 = ['x'];
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.ready === true);
  expect(await page.evaluate(() => window.__game.state('p5'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('un billet du gardien se vise, se lit et reste lu après rechargement', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    sessionStorage.setItem('keep', '1');
    window.__game.teleport(4, 103, 0);
    window.__game.aimNote('arrivee');
  });
  await waitFrames(page, 3);
  expect(await page.evaluate(() => window.__game.hoveredNote())).toBe('arrivee');
  await page.evaluate(() => window.__game.readNote('arrivee'));
  expect(await page.evaluate(() => window.__game.notes())).toEqual(['arrivee']);
  await page.screenshot({ path: 'test-results/billet.png' });
  await page.reload();
  await page.waitForFunction(() => window.__game?.ready === true);
  expect(await page.evaluate(() => window.__game.notes())).toEqual(['arrivee']);
  expect(errors).toEqual([]);
});

test('la fin : la mer répond ; avec les sept éclats, les lanternes rentrent', async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(() => window.__game.solveAll());
  await page.evaluate(() => window.__game.advance(2));
  expect(await page.evaluate(() => window.__game.ended())).toBe(true);
  expect(await page.evaluate(() => window.__game.answered())).toBe(true);
  expect(await page.evaluate(() => window.__game.homecoming())).toBe(false);
  // les éclats trouvés après la fin : les lanternes partent à leur tour
  await page.evaluate(() => {
    for (const id of ['eclat-plage', 'eclat-bosquet', 'eclat-voile', 'eclat-statues', 'eclat-belvedere', 'eclat-dunes', 'eclat-gardiens']) window.__game.solve(id);
    window.__game.advance(3);
  });
  expect(await page.evaluate(() => window.__game.homecoming())).toBe(true);
  expect(errors).toEqual([]);
});

test("la suite : l'Île du Ciel surgit de la mer, le pont de lumière y mène, on y résout t1", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  await page.evaluate(() => {
    sessionStorage.setItem('keep', '1');
    window.__game.solveAll();
    window.__game.advance(2);
  });
  expect(await page.evaluate(() => window.__game.ended())).toBe(true);
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(false);
  // la transformation : l'île monte, le pont s'allume, on revient au pied du phare
  await page.evaluate(() => {
    window.__game.startRise();
    window.__game.advance(16);
  });
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(true);
  expect(await page.evaluate(() => window.__game.sequences().rise)).toBe(false);
  // la pierre d'envol : on entre dans le rai de lumière, le pont nous emporte sur l'île
  await page.evaluate(() => {
    window.__game.teleport(0, -91, 0);
    window.__game.advance(0.2);
  });
  expect(await page.evaluate(() => window.__game.sequences().lift)).toBe('montée');
  await page.evaluate(() => window.__game.advance(7));
  const p = await page.evaluate(() => window.__game.player());
  expect(p.y).toBeGreaterThan(100);
  // t1 (allumée par f6) : ouest, puis sud
  await page.evaluate(() => window.__game.view('t1'));
  expect((await page.evaluate(() => window.__game.panels())).find((q) => q.id === 't1')!.powered).toBe(true);
  expect(await page.evaluate(() => window.__game.hint('t1'))).toBe(3);
  expect(await page.evaluate(() => window.__game.interact('t1', 3))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect(await page.evaluate(() => window.__game.interact('t1', 2))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect((await page.evaluate(() => window.__game.panels())).find((q) => q.id === 't1')!.solved).toBe(true);
  await page.screenshot({ path: 'test-results/ciel-t1.png' });
  // l'île reste montée après rechargement
  await page.reload();
  await page.waitForFunction(() => window.__game?.ready === true);
  expect(await page.evaluate(() => window.__game.skyRisen())).toBe(true);
  // et le pont ramène au phare
  await page.evaluate(() => {
    window.__game.teleport(263, -20, 0);
    window.__game.advance(0.2);
  });
  expect(await page.evaluate(() => window.__game.sequences().lift)).toBe('descente');
  await page.evaluate(() => window.__game.advance(7));
  expect((await page.evaluate(() => window.__game.player())).y).toBeLessThan(80);
  expect(errors).toEqual([]);
});

test("la bascule : l'île penche, on tombe, le phare s'enfonce ; réveil dans la grotte des Racines", async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  await page.evaluate(() => {
    sessionStorage.setItem('keep', '1');
    window.__game.cheat('upto', 'grand-plateau');
    window.__game.advance(1);
  });
  expect(await page.evaluate(() => window.__game.deep())).toBe(false);
  const top = await page.evaluate(() => window.__game.lighthouseY());
  // l'île bascule : on glisse vers le bord…
  await page.evaluate(() => {
    window.__game.startBascule();
    window.__game.advance(6);
  });
  expect((await page.evaluate(() => window.__game.sequences())).bascule).toBe(true);
  await page.screenshot({ path: 'test-results/bascule.png' });
  // … on tombe, le phare s'enfonce dans sa colline, on se réveille sous la mer
  await page.evaluate(() => window.__game.advance(13));
  expect((await page.evaluate(() => window.__game.sequences())).bascule).toBe(false);
  expect(await page.evaluate(() => window.__game.deep())).toBe(true);
  expect(await page.evaluate(() => window.__game.lighthouseY())).toBeLessThan(top - 20);
  const p = await page.evaluate(() => window.__game.player());
  expect(p.y).toBeLessThan(-50);
  // sous le niveau de la mer, mais à pied sec : on marche
  await page.evaluate(() => window.__game.move(1, 0, 1));
  const q = await page.evaluate(() => window.__game.player());
  expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThan(1.5);
  // r1 (allumé par le Grand Plateau) : on tourne les tuiles en suivant les aides
  await page.evaluate(() => window.__game.view('r1'));
  expect((await page.evaluate(() => window.__game.panels())).find((x) => x.id === 'r1')!.powered).toBe(true);
  const turns = await page.evaluate(() => {
    const g = window.__game;
    let n = 0;
    for (; n < 40; n++) {
      const k = g.hint('r1');
      if (k === null) break;
      g.interact('r1', k, g.hintMove('r1')!.reverse);
      g.advance(0.3);
    }
    return n;
  });
  expect(turns).toBeGreaterThan(0);
  expect((await page.evaluate(() => window.__game.panels())).find((x) => x.id === 'r1')!.solved).toBe(true);
  await page.waitForFunction(() => window.__game.panels().find((x) => x.id === 'r2')!.powered);
  await page.screenshot({ path: 'test-results/racines-r1.png' });
  // la grotte reste ouverte (et le phare enfoncé) après rechargement
  await page.reload();
  await page.waitForFunction(() => window.__game?.ready === true);
  expect(await page.evaluate(() => window.__game.deep())).toBe(true);
  expect((await page.evaluate(() => window.__game.player())).y).toBeLessThan(-50);
  expect(await page.evaluate(() => window.__game.lighthouseY())).toBeLessThan(top - 20);
  // la pierre de passage remonte au pied du phare…
  await page.evaluate(() => {
    window.__game.teleport(-308, -24, 0);
    window.__game.advance(0.1);
  });
  expect((await page.evaluate(() => window.__game.sequences())).passage).toBe(true);
  await page.evaluate(() => window.__game.advance(2));
  const up = await page.evaluate(() => window.__game.player());
  expect(up.y).toBeGreaterThan(5);
  expect(Math.hypot(up.x, up.z + 103.6)).toBeLessThan(8);
  await page.screenshot({ path: 'test-results/phare-enfonce.png' });
  // … et sa sœur, au pied du phare, redescend
  await page.evaluate(() => {
    window.__game.teleport(0, -103.6, 0);
    window.__game.advance(0.1);
    window.__game.advance(2);
  });
  expect((await page.evaluate(() => window.__game.player())).y).toBeLessThan(-50);
  // la Racine-mère reliée : le phare remonte
  await page.evaluate(() => {
    window.__game.cheat('before', 'racine-mere');
    window.__game.solve('racine-mere');
    window.__game.advance(1);
  });
  expect(await page.evaluate(() => window.__game.lighthouseY())).toBeCloseTo(top, 3);
  await page.screenshot({ path: 'test-results/racine-mere.png' });
  expect(errors).toEqual([]);
});

test('une bille tombée dans un puits : le plateau revient à son départ', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__game.solveAll();
    window.__game.startRise();
    window.__game.advance(16);
    window.__game.solve('t1');
    window.__game.view('t2');
  });
  // t2 : la bille (à droite, 3e rangée) roule vers l'ouest… droit dans le puits du milieu
  const start = await page.evaluate(() => window.__game.state('t2'));
  expect(await page.evaluate(() => window.__game.interact('t2', 3))).toBe('ok');
  await page.evaluate(() => window.__game.advance(3));
  expect(await page.evaluate(() => window.__game.state('t2'))).toEqual(start);
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

test("l'aide se demande, par paliers : où regarder, puis la pièce, puis le geste", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    window.__game.solve('a1');
    window.__game.view('a2');
  });
  await waitFrames(page, 2);
  // trop tôt : rien
  await page.evaluate(() => window.__game.requestHelp());
  expect(await page.evaluate(() => window.__game.goalRings())).toBe(false);
  expect((await page.evaluate(() => window.__game.help('a2'))).level).toBe(0);
  // après un moment devant l'énigme : d'abord, où regarder (des anneaux sur les cristaux)
  await page.evaluate(() => {
    window.__game.help('a2', 60);
    window.__game.requestHelp();
  });
  expect(await page.evaluate(() => window.__game.goalRings())).toBe(true);
  expect(await page.evaluate(() => window.__game.help('a2'))).toMatchObject({ level: 1, gesture: false });
  // pas deux demandes de suite
  await page.evaluate(() => window.__game.requestHelp());
  expect((await page.evaluate(() => window.__game.help('a2'))).level).toBe(1);
  // ensuite la pièce (sans le geste), puis la pièce et le bon bouton
  await page.evaluate(() => {
    window.__game.advance(9);
    window.__game.requestHelp();
  });
  expect(await page.evaluate(() => window.__game.help('a2'))).toMatchObject({ level: 2, gesture: false });
  expect(await page.evaluate(() => window.__game.hintMove('a2'))).not.toBeNull();
  await page.evaluate(() => {
    window.__game.advance(9);
    window.__game.requestHelp();
  });
  expect(await page.evaluate(() => window.__game.help('a2'))).toMatchObject({ level: 2, gesture: true });
  expect(errors).toEqual([]);
});

test("la Bulle : la pierre de la plage, la plongée, les vases, et la pierre du retour", async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  await page.evaluate(() => {
    sessionStorage.setItem('keep', '1');
    window.__game.cheat('upto', 'racine-mere');
    window.__game.teleport(7, 101, 0);
    window.__game.advance(0.1);
  });
  // la plongée : une bulle nous emporte au fond de l'océan
  expect((await page.evaluate(() => window.__game.bubble())).dive).toBe(true);
  await page.evaluate(() => window.__game.advance(8));
  await page.screenshot({ path: 'test-results/bulle-plongee.png' });
  await page.evaluate(() => window.__game.advance(5));
  const b = await page.evaluate(() => window.__game.bubble());
  expect(b.dive).toBe(false);
  expect(b.visited).toBe(true);
  expect((await page.evaluate(() => window.__game.player())).y).toBeLessThan(-40);
  // sous la Bulle, à pied sec : on marche
  const p0 = await page.evaluate(() => window.__game.player());
  await page.evaluate(() => window.__game.move(1, 0, 1));
  const p1 = await page.evaluate(() => window.__game.player());
  expect(Math.hypot(p1.x - p0.x, p1.z - p0.z)).toBeGreaterThan(1.5);
  // un billet de la Bulle se vise et se lit (il manquait à la liste des billets visables)
  await page.evaluate(() => window.__game.teleport(94, 361, Math.PI));
  const aimed = await page
    .waitForFunction(() => {
      window.__game.aimNote('reponse');
      return window.__game.hoveredNote() === 'reponse';
    }, null, { timeout: 15_000 })
    .then(() => true, () => false);
  expect(aimed).toBe(true);
  await page.evaluate(() => window.__game.readNote('reponse'));
  expect(await page.evaluate(() => window.__game.notes())).toContain('reponse');
  // v1 : verser le grand tube dans le petit
  await page.evaluate(() => window.__game.view('v1'));
  expect((await page.evaluate(() => window.__game.panels())).find((x) => x.id === 'v1')!.powered).toBe(true);
  expect(await page.evaluate(() => window.__game.interact('v1', 0, true))).toBe('denied');
  expect(await page.evaluate(() => window.__game.interact('v1', 0))).toBe('ok');
  await page.evaluate(() => window.__game.advance(1));
  expect((await page.evaluate(() => window.__game.panels())).find((x) => x.id === 'v1')!.solved).toBe(true);
  await page.screenshot({ path: 'test-results/bulle-v1.png' });
  // la pierre du retour ramène sur la plage ; la suivante plonge d'un fondu
  await page.evaluate(() => {
    window.__game.teleport(107, 353, 0);
    window.__game.advance(0.1);
    window.__game.advance(2);
  });
  expect((await page.evaluate(() => window.__game.player())).y).toBeGreaterThan(1);
  await page.evaluate(() => {
    window.__game.teleport(7, 101, 0);
    window.__game.advance(0.1);
  });
  expect((await page.evaluate(() => window.__game.bubble())).dive).toBe(false);
  await page.evaluate(() => window.__game.advance(2));
  expect((await page.evaluate(() => window.__game.player())).y).toBeLessThan(-40);
  // la Grande Écluse (via le mode test) : la Bulle s'illumine
  await page.evaluate(() => {
    window.__game.cheat('before', 'grande-ecluse');
    window.__game.solve('grande-ecluse');
    window.__game.advance(1);
  });
  expect((await page.evaluate(() => window.__game.panels())).find((x) => x.id === 'grande-ecluse')!.solved).toBe(true);
  await page.screenshot({ path: 'test-results/bulle-ecluse.png' });
  expect(errors).toEqual([]);
});
