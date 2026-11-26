import { describe, expect, it } from 'vitest';
import { nearestDiff } from '../../src/render/hints.ts';

describe('aides — pièce à désigner', () => {
  it('choisit la solution la plus proche et sa première différence', () => {
    expect(nearestDiff([0, 0, 0], [[1, 1, 1], [0, 1, 0]])).toBe(1);
  });
  it("ne désigne rien si l'état est déjà une solution", () => {
    expect(nearestDiff([1, 0], [[1, 0]])).toBeNull();
  });
  it('accepte une distance personnalisée (quarts de tour)', () => {
    const turns = (a: number, b: number) => Math.min((a - b + 4) % 4, (b - a + 4) % 4);
    // [3, 0] est à 1 quart de tour de [0, 0] et à 2 de [3, 2] : on vise le premier objet
    expect(nearestDiff([3, 0], [[0, 0], [3, 2]], turns)).toBe(0);
  });
});
