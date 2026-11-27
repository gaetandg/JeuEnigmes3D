import { describe, expect, it } from 'vitest';
import { E, N, S, W, checkRoots, distinctTurns, parseRoots, rotateMask, solveRoots } from '../../src/core/roots/index.ts';
import { ZONE6, ZONE6_MERE } from '../../src/puzzles/zone6.ts';

describe('racines — tuiles, lumière et fuites', () => {
  it('un quart de tour dans le sens horaire', () => {
    expect(rotateMask(N, 1)).toBe(E);
    expect(rotateMask(N | E, 1)).toBe(E | S);
    expect(rotateMask(W, 1)).toBe(N);
    expect(rotateMask(N | S, 2)).toBe(N | S);
    expect(distinctTurns(N | S)).toBe(2);
    expect(distinctTurns(15)).toBe(1);
    expect(distinctTurns(N | E)).toBe(4);
  });
  it('la lumière suit les racines raccordées ; une racine ouverte est une fuite', () => {
    // graine (vers l'est) — cristal (vers l'ouest)
    const ok = parseRoots({ id: 't', grid: 'o*1 oc3' });
    expect(checkRoots(ok.puzzle, ok.start).solved).toBe(true);
    const bad = parseRoots({ id: 't', grid: 'o*1 oc0' });
    const c = checkRoots(bad.puzzle, bad.start);
    expect(c.solved).toBe(false);
    expect(c.leaks).toBe(1);
    expect(c.lit).toEqual([true, false]);
  });
  it('la graine et les tuiles fixes gardent leur orientation (le solveur ne les tourne pas)', () => {
    const p = parseRoots({ id: 't', grid: 'o*1 oc0' });
    const r = solveRoots(p.puzzle);
    expect(r.count).toBe(1);
    expect(r.solution).toEqual([0, 3]);
  });
});

describe('zone 6 — les Racines, validées par le solveur', () => {
  const all = [...ZONE6, ZONE6_MERE];
  it('identifiants uniques, taille croissante', () => {
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length);
    const sizes = all.map((d) => parseRoots(d).puzzle.tiles.length);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[i - 1]!);
  });
  for (const def of all) {
    it(`${def.id} : une seule solution, non résolue au départ`, () => {
      const { puzzle, start } = parseRoots(def);
      expect(checkRoots(puzzle, start).solved).toBe(false);
      const r = solveRoots(puzzle, 2);
      expect(r.count).toBe(1);
      expect(checkRoots(puzzle, r.solution!).solved).toBe(true);
    });
  }
});
