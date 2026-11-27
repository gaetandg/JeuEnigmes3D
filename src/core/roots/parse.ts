import { E, N, S, W, rotateMask } from './engine.ts';
import type { RootPuzzle, RootTile } from './engine.ts';

/**
 * Format texte des Racines (une ligne = une rangée, tuiles séparées par des espaces).
 * Chaque tuile : sa forme, puis un suffixe facultatif.
 *   formes : « o » bout (1 segment), « | » droite, « L » coude, « T » té, « + » croix
 *   suffixes : « * » graine, « c » cristal (sur un bout), « ! » fixe, « b » couleur bleue
 *   « . » seul : un trou (pas de tuile)
 *   chiffre final : rotation de départ (0..3) ; exemple « L2 », « oc1 », « T*0 »
 */
export interface RootPuzzleDef {
  id: string;
  note?: string;
  grid: string;
}

const SHAPES: Record<string, number> = { o: N, '|': N | S, L: N | E, T: N | E | S, '+': N | E | S | W };

export function parseRoots(def: RootPuzzleDef): { puzzle: RootPuzzle; start: number[] } {
  const rows = def.grid.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/));
  const height = rows.length;
  const width = rows[0]!.length;
  const tiles: RootTile[] = [];
  const start: number[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${def.id} : rangée ${y} de longueur ${row.length}`);
    for (const tok of row) {
      if (tok === '.') {
        tiles.push({ mask: 0, fixed: true });
        start.push(0);
        continue;
      }
      const m = /^([o|LT+])([*c!b]*)([0-3]?)$/.exec(tok);
      if (!m) throw new Error(`${def.id} : tuile inconnue « ${tok} »`);
      const t: RootTile = { mask: SHAPES[m[1]!]! };
      if (m[2]!.includes('*')) t.seed = true;
      if (m[2]!.includes('c')) t.crystal = true;
      if (m[2]!.includes('!')) t.fixed = true;
      if (m[2]!.includes('b')) t.color = 1;
      const turns = Number(m[3] || 0);
      // graine et tuiles fixes : leur orientation fait partie de la forme
      if (t.seed || t.fixed) {
        t.mask = rotateMask(t.mask, turns);
        start.push(0);
      } else start.push(turns);
      tiles.push(t);
    }
  });
  const seeds = tiles.filter((t) => t.seed);
  if (seeds.length < 1 || new Set(seeds.map((t) => t.color ?? 0)).size !== seeds.length) throw new Error(`${def.id} : il faut une graine par couleur`);
  void E;
  void W;
  return { puzzle: { id: def.id, width, height, tiles }, start };
}
