import type { TiltCell, TiltColor, TiltPuzzle } from './engine.ts';

/**
 * Format texte (une ligne = une rangée, cases séparées par des espaces) :
 *   .   sol            #   mur            x   puits noir
 *   oR  creux rouge (oG, oB, oY)          R   bille rouge posée sur le sol (G, B, Y)
 */
export interface TiltPuzzleDef {
  id: string;
  note?: string;
  grid: string;
}

const COLORS = new Set(['R', 'G', 'B', 'Y']);

export function parseTilt(def: TiltPuzzleDef): TiltPuzzle {
  const rows = def.grid.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/));
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const cells: TiltCell[] = [];
  const balls: TiltPuzzle['balls'] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${def.id} : rangée ${y} de longueur ${row.length}, attendu ${width}`);
    row.forEach((t, x) => {
      if (t === '.') cells.push({ kind: 'floor' });
      else if (t === '#') cells.push({ kind: 'wall' });
      else if (t === 'x') cells.push({ kind: 'pit' });
      else if (t.length === 2 && t[0] === 'o' && COLORS.has(t[1]!)) cells.push({ kind: 'hole', color: t[1] as TiltColor });
      else if (t.length === 1 && COLORS.has(t)) {
        cells.push({ kind: 'floor' });
        balls.push({ color: t as TiltColor, x, y });
      } else throw new Error(`${def.id} : case inconnue « ${t} » en (${x},${y})`);
    });
  });
  for (const c of new Set(balls.map((b) => b.color))) {
    const n = balls.filter((b) => b.color === c).length;
    const holes = cells.filter((k) => k.kind === 'hole' && k.color === c).length;
    if (holes < n) throw new Error(`${def.id} : ${n} bille(s) ${c} pour ${holes} creux`);
  }
  return { id: def.id, width, height, cells, balls };
}
