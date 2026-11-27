import { describe, expect, it } from 'vitest';
import { E, N, S, W, checkRoots, distinctTurns, parseRoots, rotateMask, solveRoots, undecided } from '../../src/core/roots/index.ts';
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

describe('racines — deux lumières et des trous', () => {
  it('deux réseaux qui se touchent sont en conflit ; chaque cristal attend sa couleur', () => {
    // graine or → cristal or ; graine bleue → cristal bleu (séparés)
    const ok = parseRoots({ id: 't', grid: 'o*1 oc3\no*b1 ocb3' });
    expect(checkRoots(ok.puzzle, ok.start).solved).toBe(true);
    // les deux graines face à face : conflit
    const clash = parseRoots({ id: 't', grid: 'o*1 o*b3' });
    const c = checkRoots(clash.puzzle, clash.start);
    expect(c.conflicts.length).toBeGreaterThan(0);
    expect(c.solved).toBe(false);
    // un cristal bleu allumé par l'or : mauvaise couleur
    const wrong = parseRoots({ id: 't', grid: 'o*1 ocb3' });
    expect(checkRoots(wrong.puzzle, wrong.start).wrong).toBe(1);
  });
  it('un trou n\'a pas besoin de lumière, et l\'on ne peut pas y pointer', () => {
    const p = parseRoots({ id: 't', grid: 'o*1 oc3 .' });
    expect(checkRoots(p.puzzle, p.start).solved).toBe(true);
    const leak = parseRoots({ id: 't', grid: 'o*1 |1 .' });
    expect(checkRoots(leak.puzzle, leak.start).leaks).toBeGreaterThan(0);
  });
  it('déduction locale : un coin en L se déduit, une grille ouverte non', () => {
    expect(undecided(parseRoots({ id: 't', grid: 'L*1 oc0\noc0 o0' }).puzzle)).toBeLessThan(3);
  });
});

describe('zone 6 — les Racines, validées par le solveur', () => {
  const all = [...ZONE6, ZONE6_MERE];
  it('identifiants uniques, taille croissante', () => {
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length);
    const sizes = all.map((d) => parseRoots(d).puzzle.tiles.length);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[i - 1]!);
  });
  it('après la leçon, la déduction locale ne suffit jamais (il faut raisonner sur le réseau)', () => {
    for (const def of all.slice(1)) expect(undecided(parseRoots(def).puzzle), def.id).toBeGreaterThanOrEqual(8);
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
