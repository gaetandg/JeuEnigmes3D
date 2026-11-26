import { describe, expect, it } from 'vitest';
import {
  BLUE, GREEN, RED, WHITE,
  initialState, interact, isValidState, leverCount, leverHint, objectPath, parsePuzzle, piecesUsed, reflect, simulate, solve, stateToGrid,
} from '../../src/core/light/index.ts';

const P = (grid: string, inventory = 0) => parsePuzzle({ id: 't', grid, inventory });

describe('analyse du format texte', () => {
  it('lit toutes les sortes de cases', () => {
    const p = P(String.raw`
      >R / M\ s/ S\ oM x fG P _ # .
    `);
    expect(p.cells.map((c) => c.kind)).toEqual([
      'source', 'mirror', 'mirror', 'splitter', 'splitter', 'target', 'dark', 'filter', 'prism', 'socket', 'wall', 'empty',
    ]);
    expect(p.interactive).toEqual([2, 4, 9]);
    expect(initialState(p)).toEqual([1, 1, -1]);
  });

  it('refuse une grille irrégulière ou une case inconnue', () => {
    expect(() => P('. .\n.')).toThrow();
    expect(() => P('. ?')).toThrow();
  });

  it("réécrit l'état sous forme de texte", () => {
    const p = P(String.raw`>R M/ oR`);
    expect(stateToGrid(p, [1]).replace(/\s+/g, ' ').trim()).toBe(String.raw`>R M\ oR`);
  });
});

describe('réflexions', () => {
  it('miroir « / » : est → nord, nord → est', () => {
    expect(reflect(1, 0)).toBe(0);
    expect(reflect(0, 0)).toBe(1);
    expect(reflect(3, 0)).toBe(2);
  });
  it('miroir « \\ » : est → sud, nord → ouest', () => {
    expect(reflect(1, 1)).toBe(2);
    expect(reflect(0, 1)).toBe(3);
  });
});

describe('simulation', () => {
  it('un rayon droit allume un cristal de sa couleur', () => {
    const p = P('>R . oR');
    const r = simulate(p, initialState(p));
    expect(r.solved).toBe(true);
    expect(r.received[2]).toBe(RED);
  });

  it("un cristal exige la couleur exacte : du blanc n'allume pas un cristal rouge", () => {
    const p = P('>W . oR');
    expect(simulate(p, []).solved).toBe(false);
  });

  it('un miroir dévie le rayon', () => {
    const p = P(String.raw`
      . oG
      >G M\
    `);
    expect(simulate(p, [1]).solved).toBe(false);
    expect(simulate(p, [0]).solved).toBe(true);
  });

  it('un bloc arrête le rayon', () => {
    const p = P('>R # oR');
    expect(simulate(p, []).solved).toBe(false);
  });

  it('les couleurs se mélangent sur un cristal', () => {
    const p = P(String.raw`
      .  vB .
      >R oM .
    `);
    const r = simulate(p, []);
    expect(r.received[4]).toBe(RED | BLUE);
    expect(r.solved).toBe(true);
  });

  it('un cristal noir touché empêche la résolution', () => {
    const p = P(String.raw`>R oR x`);
    expect(simulate(p, []).solved).toBe(true);
    const q = P(String.raw`>R x oR`);
    expect(simulate(q, []).solved).toBe(false);
  });

  it('un filtre ne garde que sa couleur', () => {
    const p = P('>W fR oR');
    expect(simulate(p, []).solved).toBe(true);
    const q = P('>B fR oR');
    expect(simulate(q, []).received[2]).toBe(0);
  });

  it('une lame divise le rayon', () => {
    const p = P(String.raw`
      .  oG .
      >G s/ oG
    `);
    expect(simulate(p, []).solved).toBe(true);
  });

  it('un prisme décompose la lumière blanche', () => {
    const p = P(String.raw`
      .  oR .
      >W P  oG
      .  oB .
    `);
    const r = simulate(p, []);
    expect(r.received[1]).toBe(RED);
    expect(r.received[5]).toBe(GREEN);
    expect(r.received[7]).toBe(BLUE);
    expect(r.solved).toBe(true);
  });

  it('les boucles de miroirs ne bloquent pas la simulation', () => {
    const p = P(String.raw`
      /  .  \
      >R s/ .
      \  .  /
    `);
    expect(() => simulate(p, [])).not.toThrow();
  });

  it('enregistre les demi-segments pour le rendu', () => {
    const p = P('>R . oR');
    const r = simulate(p, []);
    expect(r.halfEdges[0 * 4 + 1]).toBe(RED); // source → bord est
    expect(r.halfEdges[1 * 4 + 3]).toBe(RED); // case du milieu, côté ouest
    expect(r.halfEdges[1 * 4 + 1]).toBe(RED);
    expect(r.halfEdges[2 * 4 + 3]).toBe(RED); // cristal, côté ouest
    expect(r.halfEdges[2 * 4 + 1]).toBe(0); // absorbé
  });

  it('les sources blanches produisent les trois composantes', () => {
    const p = P('>W . oW');
    expect(simulate(p, []).received[2]).toBe(WHITE);
  });
});

describe('interaction et réserve', () => {
  it('un miroir orientable bascule', () => {
    const p = P(String.raw`>R M/ oR`);
    expect(interact(p, [0], 0)).toEqual([1]);
  });

  it('les socles respectent la réserve', () => {
    const p = P(String.raw`>R _ _ oR`, 1);
    let s = initialState(p);
    s = interact(p, s, 0)!;
    expect(s).toEqual([0, -1]);
    expect(piecesUsed(p, s)).toBe(1);
    expect(interact(p, s, 1)).toBeNull();
    s = interact(p, s, 0, true)!; // retour à vide
    expect(s).toEqual([-1, -1]);
  });
});

describe('manivelles couplées sur un panneau de lumière', () => {
  const def = {
    id: 'm', inventory: 0, cranks: [[0, 1], [1]],
    objects: [
      { shape: 'anneau', at: [1, 0] as [number, number], start: 0 },
      { shape: 'anneau', at: [4, 0] as [number, number], start: 0 },
    ],
    grid: String.raw`
      .  .  .  .  .  .  .  .
      >R .  .  .  .  .  .  oR
      .  .  .  .  .  .  .  .
    `,
  };
  it('les leviers d\'objets sont les manivelles', () => {
    const p = parsePuzzle(def);
    expect(leverCount(p)).toBe(2);
    expect(interact(p, [0, 0], 0)).toEqual([1, 1]);
    expect(interact(p, [1, 1], 1, true)).toEqual([1, 0]);
    expect(interact(p, [0, 0], 2)).toBeNull();
  });
  it('plus court chemin et aide passent par les manivelles', () => {
    const p = parsePuzzle(def);
    expect(objectPath(p, [0, 0], [1, 0])).toEqual([{ lever: 0, reverse: false }, { lever: 1, reverse: true }]);
    expect(leverHint(p, [0, 0], [[1, 0]])).toBe(0);
    expect(leverHint(p, [1, 1], [[1, 0]])).toBe(1);
    expect(leverHint(p, [1, 0], [[1, 0]])).toBeNull();
  });
});

describe('validation des états (sauvegardes abîmées)', () => {
  it('accepte les états du jeu et refuse les valeurs hors domaine', () => {
    const p = P(String.raw`>R M/ _ _ oR`, 1);
    expect(isValidState(p, initialState(p))).toBe(true);
    expect(isValidState(p, [1, 0, -1])).toBe(true);
    expect(isValidState(p, [1, 0])).toBe(false); // longueur
    expect(isValidState(p, [2, -1, -1])).toBe(false); // miroir : 0 ou 1
    expect(isValidState(p, [-1, -1, -1])).toBe(false);
    expect(isValidState(p, [0.5, -1, -1])).toBe(false);
    expect(isValidState(p, [Number.NaN, -1, -1])).toBe(false);
    expect(isValidState(p, [0, 2, -1])).toBe(false); // socle : -1, 0 ou 1
    expect(isValidState(p, [0, 0, 1])).toBe(false); // deux miroirs posés pour une réserve de 1
  });
});

describe('solveur', () => {
  it('trouve la solution et compte les configurations', () => {
    const p = P(String.raw`
      .  oG
      >G M\
    `);
    const r = solve(p);
    expect(r.distinct).toBe(1);
    expect(r.space).toBe(2);
    expect(r.count).toBe(1);
    expect(r.solutions[0]).toEqual([0]);
  });

  it('respecte la réserve de miroirs', () => {
    const p = P(String.raw`
      .  .  .
      >R _  _
      .  oR .
    `, 1);
    const r = solve(p);
    // socles : 3 états chacun, mais au plus 1 miroir → 1 + 2 + 2 = 5
    expect(r.space).toBe(5);
    expect(r.count).toBe(1);
  });
});
