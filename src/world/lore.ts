/**
 * Le récit de l'île, en douze billets pliés laissés par le dernier gardien du phare à quelqu'un
 * parti en mer. Les énigmes restent sans un mot ; ces billets sont facultatifs : on les trouve
 * près des chemins, on les lit, et le carnet (menu pause) les rassemble.
 *
 * L'île parlait à la mer de trois façons : la lumière (les signaux), le papier plié (les
 * messages confiés aux bateaux de papier) et les ombres (les histoires jouées le soir).
 * Le phare ne brûle pas d'huile : il brûle de ce qu'on a compris.
 */
export interface LoreNote {
  id: string;
  /** zone où on le trouve (pour le carnet) */
  zone: 'plage' | 'jardin' | 'atelier' | 'cloître' | 'phare' | 'secret' | 'ciel' | 'racines';
  x: number;
  z: number;
  text: string;
}

export const NOTES: LoreNote[] = [
  {
    id: 'arrivee', zone: 'plage', x: 7, z: 101,
    text: "Si tu lis ceci, tu as retrouvé l'île. Le phare est éteint depuis l'hiver. Je n'ai pas su le rallumer sans toi.",
  },
  {
    id: 'rayons', zone: 'jardin', x: -6, z: 52,
    text: "Ici, on apprenait aux enfants à parler avec la lumière. Un rayon qu'on détourne, c'est une phrase qu'on corrige.",
  },
  {
    id: 'couleurs', zone: 'jardin', x: 28, z: 45,
    text: "Le rouge et le bleu font une troisième couleur, qui n'appartient à aucun des deux. C'est ce que nous étions, toi et moi.",
  },
  {
    id: 'bateaux', zone: 'atelier', x: -34, z: -44,
    text: "Chaque soir, je pliais un bateau de papier pour toi. Chaque pli cachait un mot. La mer les a tous gardés.",
  },
  {
    id: 'cacher', zone: 'atelier', x: -60, z: -42,
    text: "Plier, c'est choisir ce qu'on montre et ce qu'on cache. Je t'ai beaucoup caché, de peur que tu partes.",
  },
  {
    id: 'fenetre', zone: 'atelier', x: -64, z: -66,
    text: "Un trou dans le papier n'est pas un défaut. C'est une fenêtre, si l'on sait où la poser.",
  },
  {
    id: 'theatre', zone: 'cloître', x: 58, z: -48,
    text: "Au cloître, on jouait des histoires avec des ombres. Je reconnais encore la tienne sur chaque mur.",
  },
  {
    id: 'objet', zone: 'cloître', x: 42, z: -64,
    text: "Une ombre dépend de la lumière autant que de l'objet. Longtemps, j'ai cru être l'objet. J'étais la lumière.",
  },
  {
    id: 'roues', zone: 'cloître', x: 59, z: -64,
    text: "On ne tourne jamais une seule chose. Tout ce qu'on bouge en entraîne une autre : c'est vrai des roues, et des gens.",
  },
  {
    id: 'huile', zone: 'phare', x: -9, z: -95,
    text: "Le phare ne brûle pas d'huile. Il brûle de ce qu'on a compris. Il s'est éteint le jour où plus personne ne venait comprendre avec moi.",
  },
  {
    id: 'mer', zone: 'phare', x: 10, z: -96,
    text: "Si tu le rallumes, regarde la mer. Je ne promets rien. Mais regarde la mer.",
  },
  {
    id: 'eclats', zone: 'secret', x: -66, z: 22,
    text: "Quand la lumière s'est éteinte, sept éclats sont tombés du phare et se sont cachés dans l'île. Réunis-les : elle retrouvera toutes ses couleurs.",
  },
  // ── l'Île du Ciel (après la fin) ──
  {
    id: 'envol', zone: 'ciel', x: 271, z: -15,
    text: "Cette île dormait sous la mer. Je l'ai fait monter, un soir, pour voir plus loin. D'ici, on voit toutes les côtes du monde.",
  },
  {
    id: 'pencher', zone: 'ciel', x: 314, z: -32,
    text: "Ici, rien ne bouge seul. On penche le monde et tout glisse ensemble. Tout l'art est de savoir où les choses s'arrêteront.",
  },
  {
    id: 'attendre', zone: 'ciel', x: 291, z: -4,
    text: "J'ai appris à attendre comme on incline un plateau : doucement, en sachant que chaque chose finira par trouver sa place.",
  },
  // ── les Racines du Phare (après la bascule) ──
  {
    id: 'chute', zone: 'racines', x: -306, z: -8,
    text: "Toi aussi, tu viens de faire une longue chute. Moi, c'est d'ici que tout est reparti, la première fois : d'en bas, là où le phare plonge ses racines.",
  },
  {
    id: 'racines', zone: 'racines', x: -348, z: -36,
    text: "La lumière du phare ne vient pas d'en haut. Elle remonte d'ici, par les racines, comme la sève. Il suffit qu'une seule s'ouvre dans le vide pour que tout s'éteigne.",
  },
  {
    id: 'remonter', zone: 'racines', x: -341, z: -1,
    text: "Quand tout sera relié, le phare remontera. Il ne t'attendra plus : c'est toi qu'il éclairera, où que tu ailles.",
  },
];

/** Mots de la fin : une lumière répond au large ; avec les sept éclats, les lanternes reviennent. */
export const ENDING = {
  answer: 'Au large, une lumière a répondu.',
  full: 'Toutes les couleurs sont revenues. Sur la mer, des dizaines de lanternes rentrent vers l\'île.',
  /** après la Racine-mère : le post-scriptum du gardien (la « dernière lettre » ne l'était pas) */
  roots: "P.-S. Je t'ai écrit que je n'attendais plus. Ce n'était pas tout à fait vrai : j'attendais que tu descendes jusqu'ici. Le phare ne tenait que par sa lumière ; il tient maintenant par ses racines. Il ne s'éteindra plus.",
  /** après le Grand Plateau : la dernière lettre du gardien */
  final: "Tu as rallumé le phare, puis tu as trouvé le chemin du ciel. Je n'ai plus besoin d'attendre : la lumière est passée de mes mains aux tiennes. Garde-la allumée pour qui arrivera ensuite par la mer.",
};
