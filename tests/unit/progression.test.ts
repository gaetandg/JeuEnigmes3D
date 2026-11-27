import { describe, expect, it } from 'vitest';
import {
  CADRAN, FINAL_PANELS, FOLD_PANELS, GATES, GRAND_PLATEAU, GRAND_PLI, PANELS, RACINE_MERE, ROOT_PANELS, SHADOW_PANELS, SKY_PANELS, TOWERS,
  reqMet,
} from '../../src/world/layout.ts';
import type { Req } from '../../src/world/layout.ts';

/** Toutes les énigmes principales, dans l'ordre de progression (comme dans le jeu). */
const ALL: { id: string; requires: Req[] }[] = [
  ...PANELS, TOWERS, ...FOLD_PANELS, GRAND_PLI, ...SHADOW_PANELS, CADRAN, ...FINAL_PANELS, ...SKY_PANELS, GRAND_PLATEAU, ...ROOT_PANELS, RACINE_MERE,
];

/** Grandes énigmes de zone : on ne peut pas les contourner. */
const FINALES = new Set(['tours', 'grand-pli', 'cadran', 'f6', 'grand-plateau', 'racine-mere']);

/** Le joueur résout tout ce qui s'allume, sauf les énigmes « skip » ; que reste-t-il ? */
function play(skip: Set<string>): Set<string> {
  const solved = new Set<string>();
  for (let progress = true; progress; ) {
    progress = false;
    for (const p of ALL) {
      if (solved.has(p.id) || skip.has(p.id)) continue;
      if (reqMet(p.requires, (id) => solved.has(id))) {
        solved.add(p.id);
        progress = true;
      }
    }
  }
  return solved;
}

/** Les leçons obligatoires : les deux premières de chaque suite (la troisième s'allume après elles, mais la quatrième peut s'en passer). */
function lessons(): Set<string> {
  const out = new Set<string>();
  for (const chain of [PANELS.filter((p) => p.id.startsWith('a')), PANELS.filter((p) => p.id.startsWith('b')), PANELS.filter((p) => p.id.startsWith('c')),
    PANELS.filter((p) => p.id.startsWith('d')), FOLD_PANELS, SHADOW_PANELS, FINAL_PANELS, SKY_PANELS, ROOT_PANELS]) {
    for (const p of chain.slice(0, 2)) out.add(p.id);
  }
  return out;
}

describe('progression souple', () => {
  it('sans rien laisser de côté, tout se résout, jusqu\'à la Racine-mère', () => {
    expect(play(new Set()).size).toBe(ALL.length);
  });

  it('au départ, seule a1 est allumée', () => {
    expect(ALL.filter((p) => reqMet(p.requires, () => false)).map((p) => p.id)).toEqual(['a1']);
  });

  it('on peut laisser de côté n\'importe quelle énigme (hors leçons et grandes énigmes) et tout finir', () => {
    const blocking: string[] = [];
    const learn = lessons();
    for (const p of ALL) {
      if (FINALES.has(p.id) || learn.has(p.id)) continue;
      const solved = play(new Set([p.id]));
      if (solved.size !== ALL.length - 1) blocking.push(p.id);
    }
    expect(blocking).toEqual([]);
  });

  it('les leçons et les grandes énigmes, elles, sont obligatoires', () => {
    for (const id of ['a2', 'p2', 'o2', 'r2', 'tours', 'grand-pli', 'cadran', 'f6', 'grand-plateau', 'racine-mere']) {
      expect(play(new Set([id])).has('racine-mere'), id).toBe(false);
    }
  });

  it('deux énigmes de suite laissées de côté bloquent la suite de la zone', () => {
    const solved = play(new Set(['p6', 'p7']));
    expect(solved.has('p8')).toBe(false);
    expect(solved.has('grand-pli')).toBe(false);
  });

  it('les portes s\'ouvrent même si l\'on a laissé une énigme de côté', () => {
    const solved = play(new Set(['a5', 'b6', 'c5']));
    const isSolved = (id: string) => solved.has(id);
    for (const g of GATES) expect(reqMet(g.requires, isSolved), g.id).toBe(true);
  });
});
