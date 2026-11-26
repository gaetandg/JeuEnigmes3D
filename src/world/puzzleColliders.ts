import type { Colliders } from '../game/colliders.ts';
import { CADRAN, FINAL_PANELS, FOLD_PANELS, GRAND_PLI, PANELS, SECRETS, SECRET_VOILE_CELL, SHADOW_PANELS } from './layout.ts';
import { SECRET_FOLD } from '../puzzles/secrets.ts';
import { ZONE2_GRAND_PLI } from '../puzzles/zone2.ts';
import { ZONE3_CADRAN } from '../puzzles/zone3.ts';
import { parseFold } from '../core/fold/index.ts';
import { parseShadow } from '../core/shadow/index.ts';

/** Inclinaison du chevalet du Grand Pli (partagée avec le rendu). */
export const EASEL_TILT = 1.05;

function rect(c: Colliders, x: number, z: number, hw: number, hd: number): void {
  for (const [ax, az, bx, bz] of [
    [x - hw, z - hd, x + hw, z - hd], [x + hw, z - hd, x + hw, z + hd],
    [x + hw, z + hd, x - hw, z + hd], [x - hw, z + hd, x - hw, z - hd],
  ] as const) {
    c.addSegment({ ax, az, bx, bz, r: 0.3 });
  }
}

/**
 * Obstacles des pupitres, du chevalet et du Cadran. Utilisé par le jeu ET par le test
 * de navigation (qui vérifie qu'on peut marcher jusqu'à chaque énigme).
 */
export function addPuzzleColliders(c: Colliders): void {
  for (const s of [...PANELS, ...FOLD_PANELS, ...FINAL_PANELS]) c.addCircle(s.x, s.z, 0.45);
  for (const s of SHADOW_PANELS) c.addCircle(s.x, s.z, 0.75);
  const pli = parseFold(ZONE2_GRAND_PLI);
  rect(c, GRAND_PLI.x, GRAND_PLI.z, (pli.width * GRAND_PLI.cell) / 2 + 1, (pli.height * GRAND_PLI.cell * Math.cos(EASEL_TILT)) / 2 + 0.8);
  for (const s of SECRETS) {
    if (s.kind === 'light' || s.kind === 'fold-desk') c.addCircle(s.x, s.z, 0.45);
    if (s.kind === 'shadow') c.addCircle(s.x, s.z, 0.85);
    if (s.kind === 'fold-easel') {
      const v = parseFold(SECRET_FOLD.find((d) => d.id === s.id)!);
      // chevalet tourné : on borne par un cercle de la demi-largeur
      c.addCircle(s.x, s.z, (v.width * SECRET_VOILE_CELL) / 2 + 0.6);
    }
  }
  const cad = parseShadow(ZONE3_CADRAN);
  rect(c, CADRAN.x, CADRAN.z, (cad.width * CADRAN.voxel) / 2 + 1, (cad.depth * CADRAN.voxel) / 2 + 1);
}
