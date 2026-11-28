import { describe, expect, it } from 'vitest';
import { generateEcho } from '../../src/core/echo/generate.ts';
import type { EchoDef, EchoKind, Tier } from '../../src/core/echo/generate.ts';
import { initialState, parsePuzzle, simulate, solve } from '../../src/core/light/index.ts';
import { checkFold, initialFoldState, parseFold, solveFold } from '../../src/core/fold/index.ts';
import { checkShadow, parseShadow, shadowSearch, solveShadow, startState } from '../../src/core/shadow/index.ts';
import { parseTilt, solveTilt } from '../../src/core/tilt/index.ts';
import { checkRoots, parseRoots, solveRoots } from '../../src/core/roots/index.ts';
import { isSolved as vasesSolved, parseVases, solveVases } from '../../src/core/vases/index.ts';

const KINDS: EchoKind[] = ['lumiere', 'pliage', 'ombres', 'inclinaison', 'racines', 'vases'];
const TIERS: Tier[] = [0, 1, 2];

/** Chaque énigme générée : pas résolue au départ, une solution (unique), atteignable. */
function validate(e: EchoDef): { moves: number } {
  switch (e.kind) {
    case 'lumiere': {
      const p = parsePuzzle(e.def);
      const init = initialState(p);
      expect(simulate(p, init).solved).toBe(false);
      const r = solve(p, { keep: 2, initial: init });
      expect(r.distinct).toBe(1);
      return { moves: r.minClicks };
    }
    case 'pliage': {
      const p = parseFold(e.def);
      expect(checkFold(p, initialFoldState(p)).solved).toBe(false);
      const r = solveFold(p);
      expect(r.solvedStates).toBe(1);
      return { moves: r.minFolds! };
    }
    case 'ombres': {
      const p = parseShadow(e.def);
      expect(checkShadow(p, startState(e.def)).solved).toBe(false);
      expect(solveShadow(p).count).toBe(1);
      const path = shadowSearch(p, startState(e.def)).path;
      expect(path).not.toBeNull();
      return { moves: path!.length };
    }
    case 'inclinaison': {
      const r = solveTilt(parseTilt(e.def));
      expect(r.minMoves).not.toBeNull();
      return { moves: r.minMoves! };
    }
    case 'racines': {
      const { puzzle, start } = parseRoots(e.def);
      expect(checkRoots(puzzle, start).solved).toBe(false);
      expect(solveRoots(puzzle, 2).count).toBe(1);
      return { moves: 0 };
    }
    case 'vases': {
      const p = parseVases(e.def);
      expect(vasesSolved(p, p.start)).toBe(false);
      const r = solveVases(p);
      expect(r.minMoves).not.toBeNull();
      return { moves: r.minMoves! };
    }
  }
}

describe('Grotte des Échos : énigmes tirées au hasard', () => {
  for (const kind of KINDS) {
    for (const tier of TIERS) {
      it(`${kind}, taille ${tier} : valides, variées, reproductibles, vite tirées`, () => {
        const seen = new Set<string>();
        const moves: number[] = [];
        for (let seed = 1; seed <= 6; seed++) {
          const t0 = performance.now();
          const e = generateEcho(kind, tier, seed * 101);
          expect(performance.now() - t0, 'trop lent pour être tiré en jouant').toBeLessThan(1500);
          expect(e, `aucune énigme (graine ${seed})`).not.toBeNull();
          moves.push(validate(e!).moves);
          seen.add(JSON.stringify(e!.def));
          // même graine, même énigme
          expect(JSON.stringify(generateEcho(kind, tier, seed * 101)!.def)).toBe(JSON.stringify(e!.def));
        }
        expect(seen.size, 'toujours la même énigme').toBeGreaterThanOrEqual(5);
      });
    }
  }

  it('plus grande, plus longue : la difficulté monte avec la taille', () => {
    for (const kind of ['vases', 'inclinaison', 'ombres'] as EchoKind[]) {
      const avg = (tier: Tier) => {
        let sum = 0;
        for (let seed = 1; seed <= 6; seed++) sum += validate(generateEcho(kind, tier, seed * 37)!).moves;
        return sum / 6;
      };
      const [a, b, c] = TIERS.map(avg);
      expect(a, kind).toBeLessThan(b!);
      expect(b, kind).toBeLessThan(c!);
    }
  });
});
