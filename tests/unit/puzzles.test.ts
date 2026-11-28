import { describe, expect, it } from 'vitest';
import { analyze, initialState, parsePuzzle, simulate } from '../../src/core/light/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../../src/puzzles/zone1.ts';
import { ZONE2, ZONE2_GRAND_PLI } from '../../src/puzzles/zone2.ts';
import { checkFold, initialFoldState, parseFold, solveFold } from '../../src/core/fold/index.ts';
import { ZONE3, ZONE3_CADRAN } from '../../src/puzzles/zone3.ts';
import { ZONE4_FOLD, ZONE4_LIGHT } from '../../src/puzzles/zone4.ts';
import { ZONE5, ZONE5_GRAND } from '../../src/puzzles/zone5.ts';
import { isSolved, parseTilt, solveTilt, startTilt } from '../../src/core/tilt/index.ts';
import { SECRET_FOLD, SECRET_IDS, SECRET_LIGHT, SECRET_SHADOW, ISLAND_SECRET_IDS, SECRET_ROOTS, SECRET_TILT } from '../../src/puzzles/secrets.ts';
import { checkRoots, parseRoots, solveRoots, undecided } from '../../src/core/roots/index.ts';
import { checkShadow, parseShadow, shadowSearch, solveShadow, startState } from '../../src/core/shadow/index.ts';

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

describe('zone 3 — validation des énigmes d\'ombres par le solveur', () => {
  const all = [...ZONE3, ZONE3_CADRAN];
  it('les identifiants sont uniques', () => {
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
  });
  for (const def of all) {
    it(`${def.id} : non résolue au départ, peu de solutions`, () => {
      const p = parseShadow(def);
      expect(checkShadow(p, startState(def)).solved).toBe(false);
      const r = solveShadow(p);
      expect(r.count).toBeGreaterThan(0);
      expect(r.count).toBeLessThanOrEqual(2);
      // la solution doit être atteignable avec les leviers donnés (manivelles couplées comprises)
      expect(shadowSearch(p, startState(def)).path, 'inatteignable').not.toBeNull();
    });
  }
  for (const def of all.filter((d) => d.cranks)) {
    it(`${def.id} (manivelles) : une seule solution, toutes les positions atteignables`, () => {
      const p = parseShadow(def);
      expect(solveShadow(p).count).toBe(1);
      const r = shadowSearch(p, startState(def));
      expect(r.reachable).toBe(4 ** p.objects.length);
      // les manivelles entraînent chacune au moins un objet, et chaque objet est entraîné
      const driven = new Set(def.cranks!.flat());
      expect(driven.size).toBe(p.objects.length);
    });
  }
});

describe('zone 4 — énigmes combinées', () => {
  for (const def of ZONE4_LIGHT.filter((d) => d.cranks)) {
    it(`${def.id} (lumière + objets + manivelles) : solution unique, chemin long, chaque objet compte`, () => {
      const p = parsePuzzle(def);
      const init = initialState(p);
      expect(simulate(p, init).solved).toBe(false);
      const a = analyze(p, init, 100);
      expect(a.distinct).toBe(1);
      expect(a.dead).toEqual([]);
      // toutes les positions des objets sont atteignables avec les manivelles
      expect(a.minClicks).toBe(6);
      // chaque objet compte : le tourner seul défait la solution
      for (const sol of a.solutions) {
        for (let j = 0; j < p.objects.length; j++) {
          const t = sol.slice();
          t[p.interactive.length + j] = (t[p.interactive.length + j]! + 1) % 4;
          expect(simulate(p, t).solved).toBe(false);
        }
      }
    });
  }
  for (const def of ZONE4_LIGHT.filter((d) => !d.cranks)) {
    it(`${def.id} (lumière + objets) : solution unique, aucun objet inutile`, () => {
      const p = parsePuzzle(def);
      const init = initialState(p);
      expect(simulate(p, init).solved).toBe(false);
      const a = analyze(p, init);
      expect(a.count).toBeGreaterThan(0);
      expect(a.distinct).toBe(1);
      expect(a.dead).toEqual([]);
    });
  }
  for (const def of ZONE4_FOLD) {
    it(`${def.id} (pliage + lumière) : solvable avec exactement le nombre de plis permis`, () => {
      const p = parseFold(def);
      expect(checkFold(p, initialFoldState(p)).solved).toBe(false);
      const r = solveFold(p);
      expect(r.solution).not.toBeNull();
      expect(r.minFolds).toBe(def.folds);
    });
  }
});

describe('les Éclats — énigmes secrètes', () => {
  it('neuf secrets aux identifiants uniques (sept sur l\'île, un dans le ciel, un dans la grotte)', () => {
    expect(SECRET_IDS).toHaveLength(9);
    expect(new Set(SECRET_IDS).size).toBe(9);
    expect(ISLAND_SECRET_IDS).toHaveLength(7);
  });
  it('les éclats de la suite : solution unique (racines), soluble en 12 gestes (billes)', () => {
    for (const def of SECRET_ROOTS) {
      const { puzzle, start } = parseRoots(def);
      expect(checkRoots(puzzle, start).solved).toBe(false);
      expect(solveRoots(puzzle, 2).count).toBe(1);
      expect(undecided(puzzle)).toBeGreaterThanOrEqual(12);
    }
    for (const def of SECRET_TILT) {
      const r = solveTilt(parseTilt(def));
      expect(r.minMoves).toBe(def.moves);
    }
  });
  for (const def of SECRET_LIGHT) {
    it(`${def.id} : solution unique, aucune pièce inutile`, () => {
      const p = parsePuzzle(def);
      const init = initialState(p);
      expect(simulate(p, init).solved).toBe(false);
      const a = analyze(p, init);
      expect(a.distinct).toBe(1);
      expect(a.dead).toEqual([]);
    });
  }
  for (const def of SECRET_FOLD) {
    it(`${def.id} : solvable avec exactement le nombre de plis permis`, () => {
      const p = parseFold(def);
      expect(checkFold(p, initialFoldState(p)).solved).toBe(false);
      expect(solveFold(p).minFolds).toBe(def.folds);
    });
  }
  for (const def of SECRET_SHADOW) {
    it(`${def.id} : une seule orientation convient`, () => {
      const p = parseShadow(def);
      expect(checkShadow(p, startState(def)).solved).toBe(false);
      expect(solveShadow(p).count).toBe(1);
    });
  }
});

describe('zone 5 — l\'Île du Ciel (inclinaison)', () => {
  const all = [...ZONE5, ZONE5_GRAND];
  it('identifiants uniques, difficulté croissante', () => {
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length);
    for (let i = 1; i < all.length; i++) expect(all[i]!.moves).toBeGreaterThanOrEqual(all[i - 1]!.moves);
  });
  for (const def of all) {
    it(`${def.id} : soluble en exactement ${def.moves} gestes, non résolue au départ`, () => {
      const p = parseTilt(def);
      expect(isSolved(startTilt(p))).toBe(false);
      expect(solveTilt(p).minMoves).toBe(def.moves);
    });
  }
});
