import { describe, expect, it } from 'vitest';
import { isSolved, parseVases, pour, solveVases } from '../../src/core/vases/index.ts';
import { ZONE7, ZONE7_GRANDE } from '../../src/puzzles/zone7.ts';

describe('vases — verser', () => {
  const p = parseVases({ id: 't', caps: [8, 5, 3], start: [8, 0, 0], targets: [4, null, null], pipes: '0-1 1-2 2>0' });
  it('on verse jusqu\'à ce que la source soit vide ou la cible pleine', () => {
    expect(pour(p, [8, 0, 0], { pipe: 0, reverse: false })).toEqual([3, 5, 0]);
    expect(pour(p, [3, 5, 0], { pipe: 1, reverse: false })).toEqual([3, 2, 3]);
    // rien ne coule : source vide, ou cible pleine
    expect(pour(p, [8, 0, 0], { pipe: 0, reverse: true })).toBeNull();
    expect(pour(p, [3, 5, 0], { pipe: 0, reverse: false })).toBeNull();
  });
  it('un tuyau à sens unique ne verse que dans son sens', () => {
    expect(pour(p, [0, 5, 3], { pipe: 2, reverse: false })).toEqual([3, 5, 0]);
    expect(pour(p, [8, 0, 0], { pipe: 2, reverse: true })).toBeNull();
  });
  it('le classique 8-5-3 : 4 litres dans le grand tube en 7 gestes', () => {
    const q = parseVases({ id: 't', caps: [8, 5, 3], start: [8, 0, 0], targets: [4, null, null], pipes: '0-1 1-2 0-2' });
    const r = solveVases(q);
    expect(r.minMoves).toBe(7);
    let s = q.start;
    for (const m of r.path!) s = pour(q, s, m)!;
    expect(isSolved(q, s)).toBe(true);
  });
});

describe('zone 7 — la Bulle, validée par le solveur', () => {
  const all = [...ZONE7, ZONE7_GRANDE];
  it('identifiants uniques, difficulté croissante', () => {
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length);
    for (let i = 1; i < all.length; i++) expect(all[i]!.moves).toBeGreaterThan(all[i - 1]!.moves);
  });
  for (const def of all) {
    it(`${def.id} : soluble en exactement ${def.moves} gestes, pas résolue au départ`, () => {
      const p = parseVases(def);
      expect(isSolved(p, p.start)).toBe(false);
      expect(solveVases(p).minMoves).toBe(def.moves);
    });
  }
});
