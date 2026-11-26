import { describe, expect, it } from 'vitest';
import { N, parseShadow, parseShape, rotateOnce, rotated, shadowLevers, shadowOn, shadowSearch, turnShadow } from '../../src/core/shadow/index.ts';

describe('ombres — formes et rotations', () => {
  it('lit une forme étage par étage', () => {
    const s = parseShape('#.. ... ... | ... ... ... | ... ... ..#');
    expect(s).toEqual([[0, 0, 0], [2, 2, 2]]);
  });

  it('quatre quarts de tour reviennent au départ', () => {
    const v: [number, number, number] = [0, 1, 2];
    for (const axis of ['x', 'y'] as const) {
      let w = v;
      for (let i = 0; i < 4; i++) w = rotateOnce(w, axis);
      expect(w).toEqual(v);
    }
  });

  it('les cubes restent dans la boîte', () => {
    const shape = parseShape('### ### ### | ### ### ### | ### ### ###');
    for (const axis of ['x', 'y'] as const) {
      for (const [x, y, z] of rotated(shape, axis, 1)) {
        for (const c of [x, y, z]) expect(c >= 0 && c < N).toBe(true);
      }
    }
  });
});

describe('ombres — projections', () => {
  it("l'ombre du fond ignore la profondeur, celle de droite ignore la largeur", () => {
    const p = parseShadow({ id: 't', note: '', walls: ['back', 'right'], objects: [{ shape: 'coin', slot: [0, 0], start: 0, solution: 0 }] });
    const back = shadowOn(p, [0], 'back');
    const right = shadowOn(p, [0], 'right');
    // coin : (0,0,0) (1,0,0) (0,0,1) (0,1,0)
    expect([...back].sort()).toEqual(['0,0', '0,1', '1,0']);
    expect([...right].sort()).toEqual(['0,0', '0,1', '1,0']);
  });

  it('les ombres de deux objets s\'additionnent selon leur position', () => {
    const p = parseShadow({
      id: 't', note: '', walls: ['back'],
      objects: [
        { shape: 'L', slot: [0, 0], start: 0, solution: 0 },
        { shape: 'L', slot: [1, 0], start: 0, solution: 0 },
      ],
    });
    expect(p.width).toBe(6);
    const back = shadowOn(p, [0, 0], 'back');
    expect(back.has('3,0')).toBe(true);
    expect(back.has('0,0')).toBe(true);
  });
});

describe('manivelles couplées', () => {
  const def = {
    id: 'm', note: '', walls: ['back' as const], cranks: [[0, 1], [1]],
    objects: [
      { shape: 'zigzag', slot: [0, 0] as [number, number], start: 0, solution: 1 },
      { shape: 'zigzag', slot: [1, 0] as [number, number], start: 0, solution: 0 },
    ],
  };
  it('une manivelle tourne ensemble tous ses objets, dans les deux sens', () => {
    const p = parseShadow(def);
    expect(shadowLevers(p)).toEqual([[0, 1], [1]]);
    expect(turnShadow(p, [0, 0], 0)).toEqual([1, 1]);
    expect(turnShadow(p, [0, 0], 0, true)).toEqual([3, 3]);
    expect(turnShadow(p, [1, 1], 1, true)).toEqual([1, 0]);
  });
  it('sans manivelles, chaque objet est son propre levier', () => {
    const p = parseShadow({ ...def, cranks: undefined });
    expect(shadowLevers(p)).toEqual([[0], [1]]);
    expect(turnShadow(p, [0, 0], 1)).toEqual([0, 1]);
  });
  it('le plus court chemin passe par un état moins bon (le voisin entraîné se rattrape)', () => {
    const p = parseShadow(def);
    const r = shadowSearch(p, [0, 0]);
    expect(r.reachable).toBe(16);
    expect(r.path).toEqual([{ lever: 0, reverse: false }, { lever: 1, reverse: true }]);
    expect(shadowSearch(p, [1, 0]).path).toEqual([]);
  });
});
