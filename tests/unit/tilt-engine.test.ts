import { describe, expect, it } from 'vitest';
import { isSolved, parseTilt, solveTilt, startTilt, tilt } from '../../src/core/tilt/index.ts';

const P = (grid: string) => parseTilt({ id: 't', grid });

describe('inclinaison — billes, creux et puits', () => {
  it('une bille roule jusqu\'au mur', () => {
    const p = P(`R . . # oR`);
    const r = tilt(p, startTilt(p), 1);
    expect(r.state.balls[0]).toMatchObject({ x: 2, y: 0, home: false });
    expect(r.moves[0]!.path.length).toBe(3);
  });
  it('les billes se bloquent entre elles : la plus avancée part d\'abord', () => {
    const p = P(`R B . . # oR oB`);
    const s = tilt(p, startTilt(p), 1).state;
    expect(s.balls.map((b) => b.x)).toEqual([2, 3]);
  });
  it('une bille tombe dans le creux de sa couleur, pas dans celui d\'une autre', () => {
    const p = P(`R . oB oR .`);
    const s = tilt(p, startTilt(p), 1).state;
    expect(s.balls[0]).toMatchObject({ x: 3, home: true });
    expect(isSolved(s)).toBe(true);
    const q = P(`B . oR oB`);
    expect(tilt(q, startTilt(q), 1).state.balls[0]).toMatchObject({ x: 3, home: true });
  });
  it('un creux plein : les autres billes roulent par-dessus', () => {
    const p = P(`
      .  R  R  oR .
      #  #  #  #  oR
    `);
    const s = tilt(p, startTilt(p), 1).state;
    expect(s.balls.filter((b) => b.home)).toHaveLength(1);
    expect(s.balls.find((b) => !b.home)!.x).toBe(4);
  });
  it('un puits noir avale la bille : c\'est perdu', () => {
    const p = P(`R . x oR`);
    const r = tilt(p, startTilt(p), 1);
    expect(r.state.lost).toBe(true);
    expect(r.moves[0]!.end).toBe('pit');
  });
  it('le solveur trouve le plus court chemin et contourne les puits (sud d\'abord : le puits)', () => {
    const p = P(`
      R  .  .  #
      .  #  .  .
      x  .  .  oR
    `);
    const r = solveTilt(p);
    expect(r.minMoves).toBe(3); // est, sud, est
    let s = startTilt(p);
    for (const d of r.path!) s = tilt(p, s, d).state;
    expect(isSolved(s)).toBe(true);
  });
  it('insoluble : null', () => {
    const p = P(`R # oR`);
    expect(solveTilt(p).minMoves).toBeNull();
  });
});
