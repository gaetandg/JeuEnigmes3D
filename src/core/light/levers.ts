import type { LightPuzzle, LightState } from './types.ts';

/**
 * Leviers du joueur sur une énigme de lumière : d'abord les cases manipulables (miroirs, lames,
 * socles), puis les objets en cubes. Avec des manivelles couplées (zone finale), chaque levier
 * d'objet est une manivelle qui fait tourner ensemble plusieurs objets.
 */
export function objectLevers(p: LightPuzzle): number[][] {
  return p.cranks ?? p.objects.map((_, j) => [j]);
}

/** Nombre total de leviers (cases manipulables + objets ou manivelles). */
export function leverCount(p: LightPuzzle): number {
  return p.interactive.length + objectLevers(p).length;
}

export interface ObjectMove {
  /** index de la manivelle (ou de l'objet) parmi les leviers d'objets */
  lever: number;
  reverse: boolean;
}

/** Plus court chemin (en gestes) entre deux positions des objets, ou null s'il n'en existe pas. */
export function objectPath(p: LightPuzzle, from: number[], to: number[]): ObjectMove[] | null {
  const levers = objectLevers(p);
  const enc = (s: number[]) => s.reduce((a, t) => a * 4 + t, 0);
  const goal = enc(to);
  const start = enc(from);
  if (start === goal) return [];
  const prev = new Map<number, { parent: number; move: ObjectMove }>();
  const seen = new Set<number>([start]);
  const queue: number[][] = [from.slice()];
  for (let qi = 0; qi < queue.length; qi++) {
    const s = queue[qi]!;
    const key = enc(s);
    for (let k = 0; k < levers.length; k++) {
      for (const reverse of [false, true]) {
        const n = s.slice();
        for (const j of levers[k]!) n[j] = (((n[j]! + (reverse ? -1 : 1)) % 4) + 4) % 4;
        const nk = enc(n);
        if (seen.has(nk)) continue;
        seen.add(nk);
        prev.set(nk, { parent: key, move: { lever: k, reverse } });
        if (nk === goal) {
          const path: ObjectMove[] = [];
          for (let c = nk; c !== start; c = prev.get(c)!.parent) path.unshift(prev.get(c)!.move);
          return path;
        }
        queue.push(n);
      }
    }
  }
  return null;
}

/** Gestes minimum d'un état à un autre : clics sur les cases + gestes sur les objets. */
export function movesBetween(p: LightPuzzle, a: LightState, b: LightState): number {
  const n = p.interactive.length;
  let d = 0;
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  if (!p.cranks) {
    // un objet tourne d'un quart de tour par geste, dans un sens ou dans l'autre
    for (let i = n; i < a.length; i++) {
      const t = (((a[i]! - b[i]!) % 4) + 4) % 4;
      d += Math.min(t, 4 - t);
    }
    return d;
  }
  const path = objectPath(p, a.slice(n), b.slice(n));
  return path ? d + path.length : Infinity;
}

/**
 * Aide : le levier à actionner pour se rapprocher de la solution la plus proche
 * (une case d'abord, sinon le premier geste du plus court chemin des objets).
 */
export function leverHint(p: LightPuzzle, s: LightState, solutions: LightState[]): number | null {
  let best: LightState | null = null;
  let bestD = Infinity;
  for (const sol of solutions) {
    const d = movesBetween(p, s, sol);
    if (d < bestD) {
      bestD = d;
      best = sol;
    }
  }
  if (!best || bestD === 0 || bestD === Infinity) return null;
  const n = p.interactive.length;
  for (let i = 0; i < n; i++) if (s[i] !== best[i]) return i;
  if (!p.cranks) {
    for (let i = n; i < s.length; i++) if (s[i] !== best[i]) return i;
    return null;
  }
  const path = objectPath(p, s.slice(n), best.slice(n));
  return path && path.length ? n + path[0]!.lever : null;
}
