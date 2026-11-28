import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidState, movesBetween, parsePuzzle } from '../../src/core/light/index.ts';
import { loadSave } from '../../src/game/progress.ts';
import { GamepadInput } from '../../src/game/gamepad.ts';
import type { Player } from '../../src/game/player.ts';

describe('moteur de lumière : objets', () => {
  const grid = String.raw`
    .  .  .  .  .  .
    >R .  .  .  .  oR
    .  .  .  .  .  .
  `;
  it("refuse un objet qui dépasse de la grille (au lieu de déborder sur la rangée suivante)", () => {
    expect(() => parsePuzzle({ id: 't', grid, objects: [{ shape: 'L', at: [4, 0], start: 0 }] })).toThrow(/dépasse/);
    expect(() => parsePuzzle({ id: 't', grid, objects: [{ shape: 'L', at: [2, 0], start: 0 }] })).not.toThrow();
  });
  it('un demi-tour d\'objet compte deux gestes', () => {
    const p = parsePuzzle({ id: 't', grid, objects: [{ shape: 'L', at: [1, 0], start: 0 }] });
    expect(movesBetween(p, [0], [2])).toBe(2);
    expect(movesBetween(p, [0], [3])).toBe(1);
  });
  it('avec des manivelles, une position inatteignable est refusée', () => {
    const p = parsePuzzle({
      id: 't', grid: String.raw`
        .  .  .  .  .  .  .  .  .
        >R .  .  .  .  .  .  .  oR
        .  .  .  .  .  .  .  .  .
      `,
      cranks: [[0, 1]],
      objects: [{ shape: 'L', at: [1, 0], start: 0 }, { shape: 'L', at: [4, 0], start: 0 }],
    });
    expect(isValidState(p, [1, 1])).toBe(true);
    expect(isValidState(p, [1, 0])).toBe(false); // les deux objets tournent toujours ensemble
  });
});

describe('sauvegarde abîmée mais lisible', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (raw: string) => vi.stubGlobal('localStorage', { getItem: () => raw, setItem: () => undefined, removeItem: () => undefined });
  it('les champs de mauvais type retombent sur des valeurs sûres', () => {
    stub(JSON.stringify({ solved: 'd1', states: [], player: { x: 'a', z: 1, yaw: 0 }, playTime: 'x' }));
    const s = loadSave();
    expect(s.solved).toEqual([]);
    expect(s.states).toEqual({});
    expect(s.player).toBeUndefined();
    expect(s.playTime).toBeUndefined();
  });
  it('null et les identifiants non textuels sont ignorés', () => {
    stub('null');
    expect(loadSave().solved).toEqual([]);
    stub(JSON.stringify({ solved: ['a1', 3, null], states: { a1: [0] } }));
    const s = loadSave();
    expect(s.solved).toEqual(['a1']);
    expect(s.states).toEqual({ a1: [0] });
  });
  it("chaque étape de l'histoire survit au rechargement (ciel, grotte, Bulle, barque partie)", () => {
    stub(JSON.stringify({ solved: [], states: {}, sky: true, deep: true, bubble: true, departed: true }));
    const s = loadSave();
    expect([s.sky, s.deep, s.bubble, s.departed]).toEqual([true, true, true, true]);
    stub(JSON.stringify({ solved: [], states: {}, departed: 'oui' }));
    expect(loadSave().departed).toBe(false);
  });
  it('la Grotte des Échos : comptes et tailles gardés, valeurs abîmées écartées', () => {
    stub(JSON.stringify({ solved: [], states: {}, echo: { counts: { lumiere: 3, vases: -1, pliage: 'x' }, tiers: { lumiere: 2, ombres: 1.5 } } }));
    const e = loadSave().echo!;
    expect(e.counts).toEqual({ lumiere: 3 });
    expect(e.tiers).toEqual({ lumiere: 2 });
    stub(JSON.stringify({ solved: [], states: {}, echo: 'non' }));
    expect(loadSave().echo).toBeUndefined();
  });
});

describe('manette', () => {
  afterEach(() => vi.unstubAllGlobals());
  const fakePlayer = () => ({ move: { forward: 0, right: 0, run: false }, lookRadians: () => undefined }) as unknown as Player;
  const pad = (lx: number, ly: number) => ({ connected: true, axes: [lx, ly, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) });

  it('une manette posée au repos ne remet pas à zéro le déplacement au clavier', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [pad(0, 0)] });
    const player = fakePlayer();
    const g = new GamepadInput(player);
    g.poll(0.016, true);
    player.move.forward = 1; // touche Z enfoncée
    g.poll(0.016, true);
    g.poll(0.016, true);
    expect(player.move.forward).toBe(1);
  });
  it('le stick pilote, puis rend la main en revenant au centre ; débranchée, plus de course', () => {
    let current = pad(0, -1);
    vi.stubGlobal('navigator', { getGamepads: () => (current ? [current] : []) });
    const player = fakePlayer();
    const g = new GamepadInput(player);
    g.poll(0.016, true);
    expect(player.move.forward).toBe(1);
    expect(player.move.run).toBe(true);
    current = pad(0, 0);
    g.poll(0.016, true);
    expect(player.move.forward).toBe(0);
    expect(player.move.run).toBe(false);
    current = pad(0, -1);
    g.poll(0.016, true);
    current = null as unknown as ReturnType<typeof pad>;
    g.poll(0.016, true);
    expect(player.move.run).toBe(false);
    expect(player.move.forward).toBe(0);
  });
});
