/** Choix de la pièce à désigner par une aide : la première qui diffère de la solution la plus proche. */
export function nearestDiff(state: number[], solutions: number[][], dist: (a: number, b: number) => number = (a, b) => (a === b ? 0 : 1)): number | null {
  let best: number[] | null = null;
  let bestD = Infinity;
  for (const s of solutions) {
    let d = 0;
    for (let i = 0; i < s.length; i++) d += dist(state[i]!, s[i]!);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!best || bestD === 0) return null;
  const k = best.findIndex((v, i) => dist(state[i]!, v) > 0);
  return k < 0 ? null : k;
}

/** Pulsation douce (0..1) pour les aides. */
export const pulse = (t: number) => 0.5 + 0.5 * Math.sin(t * 3.2);
