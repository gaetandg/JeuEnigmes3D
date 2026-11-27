import type { RootPuzzleDef } from '../core/roots/parse.ts';

/**
 * Zone 6 : les Racines du Phare, sous la colline où le phare s'est enfoncé. Cinquième langage :
 * on tourne des tuiles de racines pour conduire la lumière de la graine à tous les cristaux, sans
 * qu'aucune racine ne s'ouvre dans le vide. Puis deux lumières (or et bleue) dont les réseaux ne
 * doivent jamais se toucher, et des trous. Générées par scripts/roots-gen.ts (forêt couvrante,
 * solution unique) et choisies pour que la déduction locale ne suffise pas (undecided) ;
 * validées par le solveur (tests/unit/roots-engine.test.ts).
 */
export const ZONE6: RootPuzzleDef[] = [
  {
    // leçon : presque tout est déjà en place, trois tuiles à tourner (les points rouges les désignent)
    id: 'r1', note: 'Tourner les racines pour que la lumière de la graine atteigne les cristaux.',
    grid: `
      L1   T1   oc0
      |*0  T1   oc3
      oc3  L0   oc3
    `,
  },
  {
    id: 'r2', note: 'Les bouts ne se touchent pas entre eux : on raisonne sur le réseau entier.',
    grid: `
      L*1   L0    oc1   oc1
      |3    T2    T0    L2
      oc2   T2    T0    L0
      oc2   L1    oc1   oc3
    `,
  },
  {
    id: 'r3', note: 'Deux lumières, or et bleue : chaque cristal attend la sienne, et les deux réseaux ne se touchent jamais.',
    grid: `
      L0    |0    ocb2  oc3
      o*b0  L3    T*1   L2
      oc2   T0    T3    oc1
      oc3   L1    L3    oc2
    `,
  },
  {
    id: 'r4', note: 'Un trou dans la grille : on ne peut pas y pointer.',
    grid: `
      oc2   T0    T*1   |0    L0
      oc0   T0    T2    oc0   |3
      L3    T3    L1    L3    oc2
      oc3   L1    oc2   oc3   .
    `,
  },
  {
    id: 'r5', note: 'Deux lumières, un trou, une croix.',
    grid: `
      oc2   L3    oc3   ocb0  L0
      L0    +0    T1    ocb3  |3
      oc2   oc2   |*0   L1    T*b2
      ocb0  L1    L2    oc2   |3
      .     L2    |0    |0    L2
    `,
  },
  {
    id: 'r6', note: 'Deux lumières, trois trous.',
    grid: `
      L2    oc2   .     L2    |*b1  L3
      |3    .     ocb2  T2    ocb0  ocb3
      L3    T*1   T2    |0    |0    oc2
      oc3   T0    T3    |0    T2    oc1
      .     oc3   L1    oc2   L3    oc0
    `,
  },
];

/** La Racine-mère, sous le phare : tout le réseau d'un coup. */
export const ZONE6_MERE: RootPuzzleDef = {
  id: 'racine-mere', note: 'La Racine-mère : les deux lumières remontent jusqu\'au phare.',
  grid: `
    .     ocb1  .     ocb0  L0    ocb2  ocb3
    ocb2  T0    L3    T0    T1    T3    L0
    ocb2  T*b3  T0    |0    L3    T1    ocb2
    .     L*1   T3    oc1   ocb3  T1    ocb0
    oc3   T3    L2    T3    oc2   L3    ocb1
    oc3   L0    .     L1    |0    |0    oc2
  `,
};
