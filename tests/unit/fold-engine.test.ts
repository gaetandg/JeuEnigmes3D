import { describe, expect, it } from 'vitest';
import {
  applyFold, checkFold, foldSequence, initialFoldState, legalFolds, parseFold, solveFold,
} from '../../src/core/fold/index.ts';

const P = (grid: string, folds = 6) => parseFold({ id: 't', grid, note: '', folds });

describe('pliage — géométrie', () => {
  it('rabat la petite moitié et retourne les cases', () => {
    const p = P('. . .');
    const s = applyFold(initialFoldState(p), { axis: 'x', at: 1, side: -1 });
    expect(s.poses[0]).toEqual({ x: 1, y: 0, layer: 1, flipped: true });
    expect(s.bounds).toEqual({ x0: 1, x1: 3, y0: 0, y1: 1 });
  });

  it("n'autorise que la petite moitié sur la grande (les deux à égalité)", () => {
    const p = P('. . . .');
    const folds = legalFolds(initialFoldState(p));
    expect(folds).toEqual([
      { axis: 'x', at: 1, side: -1 },
      { axis: 'x', at: 2, side: -1 },
      { axis: 'x', at: 2, side: 1 },
      { axis: 'x', at: 3, side: 1 },
    ]);
  });

  it("empile les couches dans l'ordre physique (le dessus du rabat finit en dessous)", () => {
    const p = P('. . . .');
    let s = applyFold(initialFoldState(p), { axis: 'x', at: 2, side: -1 }); // 0,1 sur 3,2
    expect(s.poses.map((q) => q.layer)).toEqual([1, 1, 0, 0]);
    s = applyFold(s, { axis: 'x', at: 3, side: 1 }); // la colonne 3 (cases 3 et 0) se rabat sur la 2
    const at2 = s.poses.map((q, i) => ({ i, ...q })).filter((q) => q.x === 2).sort((a, b) => a.layer - b.layer);
    // en bas : 2 puis 1 ; au-dessus, la pile (3 puis 0) retournée : 0 puis 3
    expect(at2.map((q) => q.i)).toEqual([2, 1, 0, 3]);
  });

  it('refuse un pli interdit', () => {
    const p = P('. . .');
    expect(() => foldSequence(p, [{ axis: 'x', at: 1, side: 1 }])).toThrow();
  });
});

describe('pliage — règles', () => {
  it('deux points de même couleur doivent se rejoindre', () => {
    const p = P('R . . R');
    expect(checkFold(p, initialFoldState(p)).solved).toBe(false);
    expect(checkFold(p, foldSequence(p, [{ axis: 'x', at: 2, side: -1 }])).solved).toBe(true);
    expect(checkFold(p, foldSequence(p, [{ axis: 'x', at: 1, side: -1 }])).solved).toBe(false);
  });

  it('deux couleurs différentes ne peuvent pas partager une pile', () => {
    const p = P('R B');
    expect(checkFold(p, foldSequence(p, [{ axis: 'x', at: 1, side: -1 }])).solved).toBe(false);
  });

  it('une tache doit être cachée, une étoile visible', () => {
    const p = P('s *');
    expect(checkFold(p, initialFoldState(p)).solved).toBe(false);
    // la tache se rabat face cachée sur l'étoile : l'étoile est couverte
    expect(checkFold(p, foldSequence(p, [{ axis: 'x', at: 1, side: -1 }])).solved).toBe(false);
    // l'étoile se rabat sur la tache : la tache est couverte mais l'étoile est face contre le papier
    expect(checkFold(p, foldSequence(p, [{ axis: 'x', at: 1, side: 1 }])).solved).toBe(false);
  });

  it("un trou laisse voir l'étoile en dessous", () => {
    const p = P('O *');
    const s = foldSequence(p, [{ axis: 'x', at: 1, side: -1 }]);
    expect(checkFold(p, s).solved).toBe(true);
  });

  it('une marque au dos apparaît quand la case est retournée', () => {
    const p = P('.s .');
    expect(checkFold(p, initialFoldState(p)).solved).toBe(true); // tache face contre la table
    const s = foldSequence(p, [{ axis: 'x', at: 1, side: -1 }]);
    expect(checkFold(p, s).badStains).toEqual([0]);
  });
});

describe('pliage — limite de plis', () => {
  it('plus aucun pli possible une fois la réserve épuisée', () => {
    const p = P('. . . .', 1);
    const s = foldSequence(p, [{ axis: 'x', at: 2, side: -1 }]);
    expect(legalFolds(s, p.maxFolds)).toEqual([]);
  });
});

describe('pliage — solveur', () => {
  it('trouve la séquence la plus courte', () => {
    const p = P(`
      R . . .
      . . . R
    `);
    const r = solveFold(p);
    expect(r.minFolds).toBe(2);
    expect(checkFold(p, foldSequence(p, r.solution!)).solved).toBe(true);
  });
});
