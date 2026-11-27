# Lueur — document de conception

> Titre provisoire. Jeu d'exploration et d'énigmes visuelles en 3D, jouable dans le navigateur.

## 1. Intention

Le joueur arrive sur une petite île silencieuse, couverte de ruines de pierre blanche.
Au sommet se dresse un **phare éteint**. Pour le rallumer, il faut comprendre trois
« langages » d'énigmes, chacun enseigné **sans aucun mot**, dans une zone de l'île :

| Zone | Nom | Langage | Idée centrale |
|---|---|---|---|
| 1 | Le Jardin des Prismes | **Lumière** | guider des rayons colorés jusqu'à des cristaux |
| 2 | L'Atelier de Papier | **Pliage** | plier des feuilles pour superposer des marques |
| 3 | Le Cloître des Ombres | **Ombres** | orienter des objets pour que leurs ombres forment une silhouette |
| 4 | Le Phare | **Combinaison** | les trois langages se combinent |

## 2. Piliers

1. **Zéro texte dans le monde.** Chaque règle s'apprend par une suite d'énigmes : la
   première est presque impossible à rater, les suivantes isolent puis combinent la règle.
2. **Une règle à la fois**, puis des combinaisons. Une nouvelle règle n'arrive que quand la
   précédente est maîtrisée.
3. **Le déclic avant tout.** On préfère une énigme qui *a l'air simple* mais demande une
   vraie idée à une énigme longue. Pas de règles floues : l'état de l'énigme est toujours
   lisible (un cristal est allumé ou ne l'est pas).
4. **Le monde fait partie de l'énigme.** Chaque énigme résolue alimente quelque chose de
   visible (câble lumineux, porte, pont). À la fin de chaque zone, une énigme à l'échelle
   du paysage réutilise le langage appris.
5. **Liberté.** Plusieurs énigmes ouvertes en même temps ; on peut toujours aller voir
   ailleurs.
6. **Contemplation.** Palette forte, brouillard doux, sons naturels, aucune pression de temps.

## 3. Zone 1 — Lumière

### 3.1 Éléments (sur une grille)

| Élément | Rendu 3D | Règle |
|---|---|---|
| Émetteur | lanterne de pierre avec lentille colorée | émet un rayon dans une direction fixe |
| Miroir orientable | plaque argentée sur pivot | clic : bascule `/` ↔ `\` ; réfléchit à 90° |
| Miroir fixe | plaque sur socle sombre | idem, non manipulable |
| Bloc | cube de pierre | arrête le rayon |
| Cristal | octaèdre teinté | doit recevoir **exactement** sa couleur |
| Cristal noir | octaèdre d'obsidienne | ne doit recevoir **aucun** rayon |
| Filtre | vitrail coloré | ne laisse passer que sa couleur (ET logique) |
| Lame | verre semi-argenté | le rayon passe **et** se réfléchit |
| Prisme | pyramide de verre | décompose : rouge tourne à gauche, vert tout droit, bleu à droite |
| Socle vide | dalle avec encoche | on peut y poser un miroir (réserve limitée) |

**Couleurs** : synthèse additive (rouge + vert = jaune, rouge + bleu = magenta,
vert + bleu = cyan, les trois = blanc). Un cristal reçoit l'**union** des rayons qui le
touchent. Les rayons se croisent sans interagir. Un cristal absorbe le rayon.

**Accessibilité** : chaque couleur a aussi une forme gravée sur le cristal (option).

**Énigme résolue** quand tous les cristaux reçoivent leur couleur exacte et que les
cristaux noirs restent éteints.

### 3.2 Progression d'apprentissage (≈ 20 énigmes)

1. Un émetteur, un miroir, un cristal. *(apprendre : cliquer fait tourner)*
2. Deux miroirs en chaîne.
3. Des blocs qui forcent un détour.
4. Deux cristaux, un seul rayon ? Impossible → découvrir qu'il faut deux émetteurs.
5. Couleurs : deux émetteurs (rouge, bleu), deux cristaux de couleur.
6. **Déclic du mélange** : un cristal magenta exige que les deux rayons s'y rejoignent.
7. Cristal noir : le rayon « évident » est interdit.
8. Filtres : un émetteur blanc et un vitrail rouge produisent du rouge.
9. Lames : un seul émetteur pour deux cristaux.
10. Socles : poser soi-même ses miroirs (réserve affichée sur le bord du panneau).
11. Prisme : la lumière blanche se décompose.
12–20. Combinaisons croissantes.

### 3.3 Énigme d'environnement : les Tours-Miroirs

Au fond du jardin, de grands miroirs montés sur des tours renvoient un rayon de soleil
capté par une lentille sur la plage. Chaque tour se tourne à la main (volant à sa base).
Le paysage **est** un panneau géant : même moteur, même règles. Un belvédère permet de
voir le jardin de haut et de comprendre le trajet. Le rayon final allume le grand cristal
qui ouvre l'Atelier de Papier.

## 4. Zone 2 — Pliage (l'Atelier de Papier)

Une feuille quadrillée porte des marques **sur ses deux faces** (recto crème, verso bleuté).
On clique une ligne de pli : la plus petite moitié se rabat sur l'autre (à égalité,
clic gauche = côté gauche/haut, clic droit = côté droit/bas). Le nombre de plis est limité
(encoches sur le bord) ; une pierre dorée remet la feuille à plat.

| Marque | Règle |
|---|---|
| Point de couleur | tous les points d'une couleur finissent dans la **même pile**, sans autre couleur |
| Tache d'encre | ne doit **pas être visible** du dessus (couverte ou face contre la table) |
| Étoile | doit **rester visible** du dessus |
| Trou | laisse voir ce qu'il y a dessous |

Quand la réserve est épuisée sans succès, les marques fautives clignotent puis la feuille
se déplie. Progression : p1–p4 (points), p5–p6 (taches, recto/verso), p7–p8 (étoiles,
trous), p9–p12 (combinaisons générées, solution unique), puis **le Grand Pli** : une feuille
de 13 m sur un chevalet au centre de l'atelier.
- **Aperçu du pli** : au survol d'une ligne, la moitié qui va se rabattre s'éclaire en or. Si la
  ligne peut plier dans les deux sens (moitiés égales), l'autre moitié s'éclaire en lavande :
  c'est le clic droit (appui long sur mobile). Sans cet aperçu, un testeur a cru p8 impossible,
  car il ne voyait que trois plis là où il y en a quatre. L'aide montre la moitié à plier, et
  pas seulement la ligne.
- **Leçon du clic droit (p6)** : la tache du dos est dans la moitié gauche ; replier la gauche
  (clic gauche) la retourne face visible, il faut donc replier la droite (clic droit). C'est la
  première énigme qui l'impose, et elle est très facile : un seul pli, quatre cases.
- **L'aide montre le geste** : quand elle se déclenche et qu'on vise la pièce désignée, une
  souris apparaît sous le réticule, avec le bon bouton allumé (« clic gauche » ou « clic
  droit » ; au tactile, « toucher » ou « appui long »). C'est le cas pour toutes les énigmes :
  sens des socles, des objets, des manivelles et des plis.
- **Le Grand Pli se manipule de loin** (jusqu'à 26 m) : on recule pour voir toute la feuille.
  Chaque énigme a sa portée : la visée n'est plus coupée à 5 m pour toutes.

## 5. Zone 3 — Ombres (le Cloître des Ombres)

Chaque panneau est un petit théâtre d'ombres : des objets faits de cubes (boîte 3×3×3)
posés sur un **plateau tournant** (axe vertical) ou dans un **berceau** (axe est-ouest),
tournés par quarts de tour (clic gauche / droit). Une lampe de face projette les ombres sur
le **mur du fond**, une lampe de gauche sur le **mur de droite**. Les ombres de plusieurs
objets s'additionnent. Il faut que chaque ombre coïncide exactement avec la silhouette
gravée en or sur son mur.

- Lisibilité : les ombres sont agrandies (lampe proche) et colorées — ambre dans la
  silhouette, gris en dehors, dorées une fois résolu ; on regarde la scène de trois quarts.
- Les silhouettes sont **calculées** à partir d'une orientation-solution choisie, puis le
  solveur vérifie qu'aucune autre orientation (ou au plus une, symétrique) ne convient.
- **Manivelles couplées** (o11, o12, Cadran) : on n'agit plus sur les objets mais sur des
  roues placées devant la scène. Chaque roue fait tourner d'un quart de tour, ensemble, tous
  les objets qu'elle entraîne. La règle est toujours la même, *chaque manivelle entraîne son
  objet et son voisin de droite ; la dernière est seule*, ce qui en fait un petit système
  à résoudre. Pour régler un objet, il faut souvent en dérégler un autre puis le rattraper,
  c'est-à-dire passer par un état moins bon. L'agent glouton échoue alors à 100 %, contre
  0 % sur les mêmes scènes sans couplage. Lisibilité :
  - chaque roue a son métal (argent, cuivre, vert-de-gris), avec des tétons du même métal
    devant les supports qu'elle entraîne ;
  - au survol d'une roue, ces supports s'éclairent ;
  - l'aide désigne la roue du plus court chemin, calculé par un parcours en largeur des
    positions atteignables.
- Progression : o1–o2 (rotation, retournement), o3 (deux objets), o4–o6 (mur de droite,
  deux murs à la fois), o7–o9 (berceau, ombre trouée), o10 (synthèse), o11–o12 (manivelles),
  puis **le Cadran** : le même théâtre à manivelles, avec des cubes d'un mètre, au centre
  du cloître (5 gestes au minimum).

## 6. Zone 4 — Le Phare (combinaison)

Au sommet de l'île, six panneaux en arc au pied du phare. Chacun combine plusieurs langages :

- **Lumière + Ombres** (f1, f2, f5) : des objets en cubes, sur plateau tournant ou berceau,
  sont posés sur la grille de lumière. Leur **empreinte au sol** (la couche du bas) arrête
  les rayons : il faut raisonner en 3D (comme au cloître) pour laisser passer ou bloquer
  la bonne lumière (comme au jardin).
- **Pliage + Lumière** (f3, f4) : la feuille repose sur une **table lumineuse**. La lumière
  passe là où le papier est parti et à travers des trous **superposés** ; le motif éclairé
  doit correspondre au modèle (gravé sur la table et sur une plaque). f3 l'enseigne en un pli.
  f4 en demande trois : une case ne s'allume qu'à travers deux trous empilés, et aucun pli
  pris seul ne rapproche visiblement du motif.
- **La finale (f6)** réunit tout : rayons et couleurs du jardin, objets en cubes du cloître,
  et les **manivelles couplées** (trois roues sur le rebord du panneau, en chaîne). Il y a cinq
  rayons à trier :
  - le rouge qui tombe doit être arrêté, sinon il teinterait le cristal bleu en magenta ;
  - le vert doit être arrêté aussi, par un cristal noir ;
  - les trois autres doivent passer.

  Il faut 6 gestes au minimum, avec une solution unique. Chaque objet compte : le tourner seul
  défait la solution. La grille a été trouvée par `scripts/finale-search.ts`, qui pose les
  cristaux par construction. Au survol d'une roue, les objets qu'elle entraîne s'éclairent.

Chaque zone terminée envoie un rai de lumière colorée au phare (un quart de sa lampe) ;
le dernier panneau l'allume entièrement : son faisceau se met à tourner sur la mer et un
écran de fin s'affiche (énigmes résolues, temps de jeu). On peut ensuite continuer à explorer.

## 6 ter. Le récit et la fin

Les énigmes restent sans un mot ; le récit est facultatif. **Douze billets pliés**, laissés par le
dernier gardien du phare à quelqu'un parti en mer, attendent près des chemins (2 ou 3 par zone,
un caché près de la voile). Ils luisent tant qu'on ne les a pas lus ; on les vise et on clique
pour les lire, et le **carnet** du menu pause les rassemble dans l'ordre du récit.

L'histoire : l'île parlait à la mer de trois façons, la lumière (les signaux), le papier plié (les
messages confiés aux bateaux de papier) et les ombres (les histoires jouées le soir). Le phare ne
brûle pas d'huile : il brûle de ce qu'on a compris ; il s'est éteint quand plus personne ne venait
comprendre avec le gardien.

**La fin** : quand le phare se rallume, la caméra s'élève et, au large, **une petite lumière
répond** (deux éclats, une pause). Avec les **sept éclats**, le faisceau retrouve toutes ses
couleurs et des dizaines de **lanternes** apparaissent sur la mer et rentrent vers l'île. Si l'on
trouve le dernier éclat après la fin, les lanternes partent à ce moment-là. Elles restent au
large de la côte quand on continue d'explorer.

## 6 quater. La suite : l'Île du Ciel (inclinaison)

On croit le jeu fini quand le phare se rallume. Mais quand on clique sur « Continuer à explorer »,
la terre tremble, la mer bouillonne à l'est, et **une île entière s'arrache de la mer et monte
dans le ciel** (à 110 m, à 300 m de la côte). Un **pont de lumière** part d'une pierre d'envol au
pied du phare : on y entre et il nous emporte jusqu'à l'île (une autre pierre ramène au phare).
Pendant la transformation, la nuit passe et l'aube se lève.

**Quatrième langage, l'inclinaison** : des plateaux portent des billes de couleur. On incline le
plateau d'un côté (quatre flèches de pierre) et *toutes* les billes roulent jusqu'à buter contre
un mur, le bord ou une autre bille. Chacune doit finir dans le creux de sa couleur ; un puits noir
avale la bille et tout revient au départ. Une pierre ronde remet le plateau à zéro (utile dans les
impasses, que l'aide signale). Le plateau penche vraiment pendant que les billes roulent.

- Huit plateaux en cercle (t1, t2 : leçons ; puis deux billes, trois couleurs, deux paires), générés
  par `scripts/tilt-gen.ts` et validés au solveur (parcours en largeur des inclinaisons), avec un
  nombre de gestes minimum croissant de 2 à 9.
- **Le Grand Plateau**, au fond d'un bassin de pierre au centre de l'île (on le regarde d'en haut,
  on l'incline de loin) : quatre couleurs, 12 gestes.
- Trois billets du gardien sur l'île ; quinze en tout.
- **La vraie fin** : le Grand Plateau résolu, la nuit retombe, les étoiles se rallument et les
  lanternes quittent la mer pour monter les rejoindre. Le gardien laisse sa dernière lettre : la
  lumière est passée de ses mains aux nôtres.

## 6 bis. Les Éclats (secrets)

Sept énigmes cachées hors des chemins, allumées dès le départ, sans câble ni guide lumineux :
le jardin des lanternes (grille d'environnement sur la plage ouest), un panneau dans le bosquet
est, une voile de papier dans les bois ouest, deux statues derrière le cloître, un panneau au
bord du plateau du phare, une feuille dans les dunes est, trois gardiens derrière le phare.
Toutes choisies pour leur « déclic » (l'agent glouton y échoue souvent). Un scintillement furtif
attire l'œil quand on passe à moins de 35 m. Chaque éclat gagné vole jusqu'au phare et tourne
autour de la lampe ; les sept réunis irisent le faisceau et le grand cristal de la place.

## 7. Direction artistique

- Low-poly à facettes, géométrie générée par le code (aucun modèle importé requis).
- Pierre blanche, herbe vert tendre, sable chaud, mer turquoise ; rayons très saturés avec
  halo (bloom) : ce sont les seules choses « électriques » du monde.
- Lumière de fin d'après-midi, brouillard léger, ciel en dégradé.
- Sons : vent et vagues générés (Web Audio), carillons doux à la résolution.

## 8. Contrôles (PC d'abord, mobile ensuite)

- Souris : regarder ; clic gauche : interagir ; clic droit : interagir en sens inverse.
- Déplacement : touches physiques WASD (= ZQSD sur AZERTY, géré automatiquement) ou
  flèches ; Maj : courir ; Échap : pause.
- Mobile (plus tard) : joystick virtuel à gauche, glisser pour regarder, toucher pour
  interagir. L'architecture sépare les entrées de la logique pour le permettre.

## 9. Architecture technique

```
src/
  core/        logique pure, sans Three.js (testable) : moteurs d'énigmes, solveurs, progression
  puzzles/     définitions des énigmes (format texte lisible)
  render/      scène Three.js : terrain, ciel, eau, végétation, panneaux, rayons, effets
  game/        joueur, interactions, monde (qui débloque quoi), audio, sauvegarde
  debug/       API window.__game pour les tests automatisés
tests/
  unit/        Vitest : moteurs, solveurs, validation de toutes les énigmes
  e2e/         Playwright : démarrage, captures, résolution complète via l'API debug
```

### Qualité garantie automatiquement

- **Chaque énigme est vérifiée par un solveur** : solvable, non résolue au départ, nombre de
  solutions et taille de l'espace de recherche mesurés (pour estimer la difficulté).
- **Tests de bout en bout** : le jeu démarre sans erreur, chaque panneau est capturé en
  image, une partie complète est jouée automatiquement (énigmes résolues → portes ouvertes).
- **CI GitHub Actions** sur chaque PR ; déploiement automatique sur GitHub Pages à chaque
  fusion dans `main`.

## 10. Jalons

| # | Jalon | Contenu |
|---|---|---|
| 0 | Squelette | Vite + TS + Three.js, tests, CI, déploiement Pages |
| 1 | Moteur Lumière | simulation, solveur, format d'énigmes, tests |
| 2 | Prototype 3D | île, joueur, panneaux jouables, portes |
| 3 | Zone Lumière complète | ~20 énigmes, Tours-Miroirs, son, menus |
| 4 | Zone Pliage | moteur, solveur, énigmes, intégration |
| 5 | Zone Ombres | idem |
| 6 | Le Phare | zone finale combinée, fin du jeu |

**Bilan** : 65 énigmes (22 + 1 en zone 1, 13 + 1 en zone 2, 12 + 1 en zone 3, 6 en zone 4, 8 + 1 sur l'Île du Ciel),
toutes vérifiées par les solveurs à chaque modification.
| 7 | Mobile | contrôles tactiles, performances |
