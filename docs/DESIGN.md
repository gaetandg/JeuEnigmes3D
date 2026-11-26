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
- Progression : o1–o2 (rotation, retournement), o3 (deux objets), o4–o6 (mur de droite,
  deux murs à la fois), o7–o9 (berceau, ombre trouée), o10 (synthèse), puis **le Cadran** :
  le même théâtre, avec des cubes d'un mètre, au centre du cloître.

## 6. Zone 4 — Le Phare (combinaison)

Au sommet de l'île, cinq panneaux en arc au pied du phare. Chacun combine deux langages :

- **Lumière + Ombres** (f1, f2, f5) : des objets en cubes, sur plateau tournant ou berceau,
  sont posés sur la grille de lumière. Leur **empreinte au sol** (la couche du bas) arrête
  les rayons : il faut raisonner en 3D (comme au cloître) pour laisser passer ou bloquer
  la bonne lumière (comme au jardin).
- **Pliage + Lumière** (f3, f4) : la feuille repose sur une **table lumineuse**. La lumière
  passe là où le papier est parti et à travers des trous **superposés** ; le motif éclairé
  doit correspondre au modèle (gravé sur la table et sur une plaque).

Chaque zone terminée envoie un rai de lumière colorée au phare (un quart de sa lampe) ;
le dernier panneau l'allume entièrement : son faisceau se met à tourner sur la mer et un
écran de fin s'affiche (énigmes résolues, temps de jeu). On peut ensuite continuer à explorer.

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

**Bilan** : 53 énigmes (22 + 1 en zone 1, 13 + 1 en zone 2, 10 + 1 en zone 3, 5 en zone 4),
toutes vérifiées par les solveurs à chaque modification.
| 7 | Mobile | contrôles tactiles, performances |
