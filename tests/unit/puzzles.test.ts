import { describe, expect, it } from 'vitest';
import { analyze, initialState, parsePuzzle, simulate } from '../../src/core/light/index.ts';
import { ZONE1 } from '../../src/puzzles/zone1.ts';

describe('zone 1 — validation de toutes les énigmes par le solveur', () => {
  it('les identifiants sont uniques', () => {
    const ids = ZONE1.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const def of ZONE1) {
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
