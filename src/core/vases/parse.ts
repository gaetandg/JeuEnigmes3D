import type { VasePipe, VasePuzzle } from './engine.ts';

/**
 * Définition d'une énigme des Vases.
 *   caps    : capacité de chaque tube (sa hauteur, en graduations)
 *   start   : eau au départ
 *   targets : niveau visé par tube (null : pas d'anneau)
 *   pipes   : « 0-1 1-2 2>0 » : tuyaux entre tubes (« - » dans les deux sens, « > » sens unique)
 */
export interface VasePuzzleDef {
  id: string;
  note?: string;
  caps: number[];
  start: number[];
  targets: (number | null)[];
  pipes: string;
}

export function parseVases(def: VasePuzzleDef): VasePuzzle {
  const n = def.caps.length;
  if (def.start.length !== n || def.targets.length !== n) throw new Error(`${def.id} : tailles incohérentes`);
  def.start.forEach((v, i) => {
    if (v < 0 || v > def.caps[i]!) throw new Error(`${def.id} : tube ${i} trop rempli`);
  });
  const pipes: VasePipe[] = def.pipes.trim().split(/\s+/).map((tok) => {
    const m = /^(\d+)([->])(\d+)$/.exec(tok);
    if (!m) throw new Error(`${def.id} : tuyau inconnu « ${tok} »`);
    const a = Number(m[1]);
    const b = Number(m[3]);
    if (a >= n || b >= n || a === b) throw new Error(`${def.id} : tuyau ${tok} hors des tubes`);
    return m[2] === '>' ? { a, b, oneWay: true } : { a, b };
  });
  return { id: def.id, caps: def.caps.slice(), start: def.start.slice(), targets: def.targets.slice(), pipes };
}
