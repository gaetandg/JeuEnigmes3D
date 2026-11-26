import type { FoldCellDef, FoldPuzzle, Mark, MarkColor } from './engine.ts';

/**
 * Format texte d'une feuille (une ligne = une rangée, cases séparées par des espaces).
 * Un caractère = face avant ; deux caractères = face avant puis face arrière.
 *
 *   .   papier vierge          _   pas de papier
 *   O   trou                   R B G Y   point de couleur
 *   s   tache (à cacher)       *   étoile (à laisser visible)
 *
 * Exemple : « R. .s » = point rouge devant, puis tache au dos.
 */
export interface FoldPuzzleDef {
  id: string;
  grid: string;
  note: string;
  /** nombre de plis permis */
  folds: number;
  /** pochoir : motif de lumière attendu (o = éclairé, . = sombre), mêmes dimensions que la feuille */
  light?: string;
}

function mark(ch: string | undefined, token: string): Mark {
  switch (ch) {
    case undefined:
    case '.':
      return { kind: 'none' };
    case 's':
      return { kind: 'stain' };
    case '*':
      return { kind: 'star' };
    case 'R':
    case 'B':
    case 'G':
    case 'Y':
      return { kind: 'dot', color: ch as MarkColor };
    default:
      throw new Error(`marque inconnue dans « ${token} »`);
  }
}

export function parseFold(def: FoldPuzzleDef): FoldPuzzle {
  const rows = def.grid
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s+/));
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells: FoldCellDef[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${def.id} : rangée ${y} irrégulière`);
    row.forEach((token, x) => {
      if (token === '_') return;
      if (token === 'O') {
        cells.push({ x, y, front: { kind: 'none' }, back: { kind: 'none' }, hole: true });
        return;
      }
      cells.push({ x, y, front: mark(token[0], token), back: mark(token[1], token), hole: false });
    });
  });
  if (!cells.length) throw new Error(`${def.id} : feuille vide`);
  let light: Set<string> | undefined;
  if (def.light) {
    light = new Set();
    const lrows = def.light.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/));
    if (lrows.length !== height || lrows.some((r) => r.length !== width)) throw new Error(`${def.id} : motif de lumière mal dimensionné`);
    lrows.forEach((r, y) => r.forEach((t, x) => {
      if (t === 'o') light!.add(`${x},${y}`);
    }));
  }
  return { id: def.id, width, height, cells, maxFolds: def.folds, light };
}
