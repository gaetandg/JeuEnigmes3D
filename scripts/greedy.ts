/**
 * Agent « glouton » : à chaque pas, il essaie toutes les actions possibles et garde celle
 * qui améliore le plus la situation visible (cristaux allumés, points réunis, ombre qui
 * colle à la silhouette). Sur un plateau, il fait un pas au hasard parmi les meilleurs.
 *
 * S'il échoue souvent alors qu'une solution existe, l'énigme ne se résout pas par
 * améliorations successives : il faut une IDÉE (passer par un état moins bon, anticiper).
 * C'est notre mesure du « déclic ».
 */
import { interact, pieceCount, simulate } from '../src/core/light/index.ts';
import type { LightPuzzle, LightState } from '../src/core/light/index.ts';
import { applyFold, checkFold, initialFoldState, legalFolds, litCells } from '../src/core/fold/index.ts';
import type { FoldPuzzle, FoldState } from '../src/core/fold/index.ts';
import { checkShadow, shadowLevers, shadowOn, turnShadow } from '../src/core/shadow/index.ts';
import type { ShadowPuzzle } from '../src/core/shadow/index.ts';

let seed = 777;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const RUNS = 120;
const PATIENCE = 6; // pas sans amélioration avant d'abandonner

/** Taux de réussite (0..1) d'une descente gloutonne générique. */
function greedy<S>(start: S, moves: (s: S) => S[], value: (s: S) => number, solved: (s: S) => boolean, maxSteps: number): number {
  let ok = 0;
  for (let run = 0; run < RUNS; run++) {
    let s = start;
    let v = value(s);
    let flat = 0;
    for (let step = 0; step < maxSteps && !solved(s); step++) {
      const next = moves(s);
      if (!next.length) break;
      const scored = next.map((n) => ({ n, v: value(n) }));
      const best = Math.max(...scored.map((e) => e.v));
      if (best < v) break; // tout empire : bloqué
      const pool = scored.filter((e) => e.v === best);
      const pick = pool[Math.floor(rnd() * pool.length)]!;
      if (best === v) flat++;
      else flat = 0;
      if (flat > PATIENCE) break;
      s = pick.n;
      v = best;
    }
    if (solved(s)) ok++;
  }
  return ok / RUNS;
}

// ── lumière ──────────────────────────────────────────────────────────────
function lightValue(p: LightPuzzle, s: LightState): number {
  const r = simulate(p, s);
  // cristaux satisfaits, et pour les autres, part de la bonne couleur reçue sans excès
  let v = 0;
  for (const c of r.crystals) {
    if (c.ok) v += 1;
    else if (c.wanted && c.received && (c.received & ~c.wanted) === 0) v += 0.3;
  }
  return v;
}

export function greedyLight(p: LightPuzzle, init: LightState): number {
  const n = pieceCount(p);
  return greedy(
    init,
    (s) => {
      const out: LightState[] = [];
      for (let k = 0; k < n; k++) for (const rev of [false, true]) {
        const t = interact(p, s, k, rev);
        if (t) out.push(t);
      }
      return out;
    },
    (s) => lightValue(p, s),
    (s) => simulate(p, s).solved,
    40,
  );
}

// ── pliage ───────────────────────────────────────────────────────────────
function foldValue(p: FoldPuzzle, s: FoldState): number {
  const c = checkFold(p, s);
  let v = -(c.badDots.length + c.badStains.length + c.badStars.length);
  if (p.light) {
    const lit = litCells(p, s);
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
      const k = `${x},${y}`;
      if (lit.has(k) !== p.light.has(k)) v -= 1;
    }
  }
  return v;
}

export function greedyFold(p: FoldPuzzle): number {
  return greedy(
    initialFoldState(p),
    (s) => legalFolds(s, p.maxFolds).map((f) => applyFold(s, f)),
    (s) => foldValue(p, s),
    (s) => checkFold(p, s).solved,
    p.maxFolds,
  );
}

// ── ombres ───────────────────────────────────────────────────────────────
function shadowValue(p: ShadowPuzzle, s: number[]): number {
  let v = 0;
  for (const w of p.walls) {
    const sh = shadowOn(p, s, w);
    const t = p.targets[w]!;
    for (const k of sh) v += t.has(k) ? 1 : -1;
    for (const k of t) if (!sh.has(k)) v -= 1;
  }
  return v;
}

export function greedyShadow(p: ShadowPuzzle, start: number[]): number {
  return greedy(
    start,
    // un geste = un levier (objet seul ou manivelle couplée), dans un sens ou dans l'autre
    (s) => shadowLevers(p).flatMap((_, k) => [false, true].map((rev) => turnShadow(p, s, k, rev))),
    (s) => shadowValue(p, s),
    (s) => checkShadow(p, s).solved,
    30,
  );
}
