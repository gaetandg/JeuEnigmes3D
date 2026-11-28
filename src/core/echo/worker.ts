/**
 * Le tirage des énigmes de la Grotte des Échos, hors du fil principal : même quand une grande
 * énigme demande quelques dizaines de millisecondes, l'image ne saute pas.
 */
import { generateEcho } from './generate.ts';
import type { EchoKind, Tier } from './generate.ts';

interface Request {
  req: number;
  kind: EchoKind;
  tier: Tier;
  seed: number;
}

const scope = self as unknown as { onmessage: ((e: MessageEvent<Request>) => void) | null; postMessage(m: unknown): void };
scope.onmessage = (e) => {
  const { req, kind, tier, seed } = e.data;
  scope.postMessage({ req, result: generateEcho(kind, tier, seed) });
};
