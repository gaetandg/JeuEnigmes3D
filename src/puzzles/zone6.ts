import type { RootPuzzleDef } from '../core/roots/parse.ts';

/**
 * Zone 6 : les Racines du Phare, sous la colline où le phare s'est enfoncé. Cinquième langage :
 * on tourne des tuiles de racines pour conduire la lumière de la graine à tous les cristaux, sans
 * qu'aucune racine ne s'ouvre dans le vide. Générées par scripts/roots-gen.ts (arbre couvrant,
 * solution unique), validées par le solveur (tests/unit/puzzles.test.ts).
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
    id: 'r2', note: 'Aucune racine ne doit s\'ouvrir dans le vide.',
    grid: `
      L0   |0   T2   L*2
      |3   oc2  T3   |3
      oc1  oc0  L2   oc1
    `,
  },
  {
    id: 'r3', note: 'Commencer par les bords : une racine ne peut pas y pointer.',
    grid: `
      L0   |0   T2   oc0
      |3   oc2  T0   oc3
      |3   oc0  T*3  T3
      oc2  oc0  |0   L2
    `,
  },
  {
    id: 'r4', note: 'La croix ne tourne pas : elle oblige ses quatre voisines.',
    grid: `
      oc2  |*1  |0   T0   oc2
      L2   T2   T0   +0   oc0
      |3   oc1  |3   T1   oc0
      oc1  oc3  L2   L1   oc0
    `,
  },
  {
    id: 'r5', note: 'Deux croix au cœur.',
    grid: `
      L2   |0   |0   oc0  oc1
      T1   oc0  oc1  oc0  |3
      T3   |0   +0   +0   L2
      T3   L3   |*0  L3   oc2
      oc1  oc2  L2   |0   oc2
    `,
  },
  {
    id: 'r6', note: 'Une forêt de tés.',
    grid: `
      L2   oc2  L2   oc1  L0   oc0
      T3   T2   T0   T3   T0   oc0
      |3   T2   L3   L3   |0   oc1
      oc2  oc3  |*0  L0   |0   oc1
      oc0  |0   T2   T0   |0   oc1
    `,
  },
];

/** La Racine-mère, sous le phare : tout le réseau d'un coup. */
export const ZONE6_MERE: RootPuzzleDef = {
  id: 'racine-mere', note: 'La Racine-mère : la lumière remonte jusqu\'au phare.',
  grid: `
    oc2  |*1  T0   T2   T0   oc0  oc3
    oc3  T3   L1   |3   oc3  oc1  |3
    L2   T1   L3   +0   T3   +0   T3
    oc3  |3   |3   |3   |3   oc3  |3
    oc0  T0   oc3  oc1  |3   oc3  T1
    oc2  L2   oc3  |0   L0   oc3  L1
  `,
};
