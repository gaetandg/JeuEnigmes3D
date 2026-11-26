import { describe, expect, it } from 'vitest';
import { analyze, initialState, parsePuzzle, simulate } from '../../src/core/light/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../../src/puzzles/zone1.ts';
import { ZONE2, ZONE2_GRAND_PLI } from '../../src/puzzles/zone2.ts';
import { checkFold, initialFoldState, parseFold, solveFold } from '../../src/core/fold/index.ts';

describe('zone 1 — validation de toutes les énigmes par le solveur', () => {
  it('les identifiants sont uniques', () => {
    const ids = ZONE1.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const def of [...ZONE1, ZONE1_TOWERS]) {
    it(`${def.id} : solvable, solution unique, aucune pièce inutile, non résolue au départ`, () => {
      const p = parsePuzzle(def);
      const init = initialState(p);
      expect(simulate(p, init).solved, 'déjà résolue au départ').toBe(false);
      const a = analyze(p, init);
      expect(a.count, 'insoluble').toBeGreaterThan(0);
      expect(a.distinct, 'plusieurs solutions réellement différentes').toBe(1);
      expect(a.dead, 'pièces jamais atteintes par la lumière').toEqual([]);
      expect(a.space).toBeLessThan(100_000);
    });
  }
});

describe('zone 2 — validation des énigmes de pliage par le solveur', () => {
  const all = [...ZONE2, ZONE2_GRAND_PLI];
  it('les identifiants sont uniques', () => {
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  });
  for (const def of all) {
    it(`${def.id} : non résolue au départ, solvable avec exactement le nombre de plis permis`, () => {
      const p = parseFold(def);
      expect(checkFold(p, initialFoldState(p)).solved).toBe(false);
      const r = solveFold(p);
      expect(r.solution, 'insoluble').not.toBeNull();
      expect(r.minFolds).toBe(def.folds);
    });
  }
});
