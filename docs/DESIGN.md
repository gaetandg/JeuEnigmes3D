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
   ailleurs. **Progression souple** : dans chaque suite d'énigmes, les trois premières
   s'allument l'une après l'autre (les deux premières, des leçons, sont obligatoires) ;
   ensuite, chacune s'allume dès que *l'une des deux précédentes* est résolue. Bloqué sur une
   énigme, on la laisse de côté et l'on continue (jamais deux de suite) ; seules les grandes
   énigmes de zone sont obligatoires. Les câbles le montrent : deux câbles arrivent à chaque
   énigme, le premier allumé suffit. Le 100 % reste à aller chercher : la **carte du gardien**,
   une table d'orientation en pierre qui **sort du sol sur la place quand le jardin est fini**
   (il faut revenir la consulter), dessine l'île d'après son relief ; chaque énigme y est une
   lanterne (allumée : résolue ; qui palpite : à faire ; éteinte : pas encore accessible), avec
   les éclats trouvés (étoiles), notre position (flèche), l'Île du Ciel et la grotte en médaillons
   une fois découvertes. **Aucun texte** : la progression totale est un anneau d'or qui se remplit
   autour de la rose des vents. Vérifié par `tests/unit/progression.test.ts`.
   **Aide graduée, demandée** : rien ne s'impose. Après 45 s devant une énigme, une petite
   lanterne apparaît (elle palpite doucement après 2 min 30) ; la touche H (bouton Y, ou toucher
   la lanterne) donne un palier de plus à chaque demande, une toutes les 8 s : **où regarder**
   (des anneaux palpitent sur ce qui n'est pas encore comme il faut : cristaux non éclairés,
   creux sans leur bille, murs dont l'ombre ne colle pas, fuites de racines), puis **la pièce**
   à changer, puis **le geste** (la souris dessinée, bouton allumé).
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

## 6 quinquies. La bascule et les Racines du Phare

On croit le jeu fini une deuxième fois : la dernière lettre du gardien s'affiche, on clique sur
« Rester sur l'île »… et deux secondes plus tard, **l'île entière se met à pencher**, exactement
comme les plateaux qu'on vient d'incliner. On glisse vers le bord ouest, on tombe du ciel ; pendant
la chute, au loin, **le phare s'enfonce dans sa colline**. Noir. On se réveille allongé sur la
terre, sous une voûte d'où pendent des racines : la grotte des Racines, sous la mer.
(Si l'on recharge avant d'avoir cliqué, la bascule a lieu dès qu'on remet le pied sur l'île.)

**Cinquième langage, les racines** : chaque pupitre est une grille de tuiles portant des bouts de
racine (bout, coude, droit, T, croix). Un clic tourne une tuile d'un quart de tour (clic droit :
dans l'autre sens). Depuis la graine lumineuse, la lumière suit les racines reliées et les allume
en or ; un bout éclairé qui s'ouvre dans le vide montre un point rouge. C'est résolu quand toutes
les tuiles sont allumées, sans aucune fuite (les cristaux, au bout des racines, s'allument avec).

- Six pupitres en cercle (3×3 à 6×5), générés par `scripts/roots-gen.ts` (arbre couvrant
  aléatoire, rotations mélangées) et gardés seulement si le solveur (retour sur trace ligne par
  ligne) trouve **une solution unique**.
- **La Racine-mère**, au fond d'une fosse au centre de la grotte (7×6, on la tourne de loin).
- Trois billets (dix-huit en tout) : le gardien est passé par là, lui aussi, « la première fois ».
- Deux **pierres de passage** relient la grotte et le pied du phare enfoncé.
- **La fin des Racines** : la Racine-mère reliée, la lumière remonte les racines jusqu'à la voûte ;
  dehors, le phare sort de la colline et se rallume. Le gardien ajoute un post-scriptum : sa
  « dernière lettre » ne l'était pas tout à fait.
- Ambiance : sous terre, plus de soleil ; une voûte violette, une lampe chaude au-dessus de la
  fosse, une brume sombre et proche, la mer étouffée, une gamme phrygienne grave.

## 6 sexies. La Bulle, au fond de l'océan (les vases)

Encore une suite, et un retournement du récit. Quand la Racine-mère est reliée et que le phare
remonte, la carte de fin se referme et **le phare montre la mer** : au large, là où une lumière
avait répondu à la première fin, des bulles montent ; puis la caméra revient sur **la plage du
départ**, où une pierre s'est allumée. On y monte : une bulle nous enveloppe, nous emporte au-dessus
de la mer (on voit déjà le dôme luire sous l'eau), plonge, et nous dépose dans **la Bulle** : une
demi-sphère de verre posée sur le fond, pleine d'air, de sable, de coraux et d'anémones qui luisent ;
dehors, l'eau bleue, des forêts d'algues qui ondulent, des bancs de poissons qui tournent autour du
dôme, des rais de lumière qui tombent de la surface. Une pierre ramène à la plage (et la suivante
plonge d'un simple fondu).

**Sixième langage, les vases** : des tubes de verre de hauteurs différentes (graduées, sans
chiffres), plus ou moins remplis d'eau, reliés par des tuyaux à vanne. Un clic sur une vanne verse
dans un sens (clic droit : dans l'autre, sauf tuyau à sens unique, marqué d'une flèche d'or),
jusqu'à ce que la source soit vide ou la cible pleine. Il faut que l'eau arrive pile aux anneaux
d'or (tous en même temps). Une pierre ronde remet tout comme au départ (l'aide la désigne dans une
impasse).

- Six tables (2 tubes en 1 geste pour la leçon, puis 3 tubes, une chaîne, un tuyau à sens unique,
  4 tubes et deux anneaux ; 1 à 11 gestes), générées par `scripts/vases-gen.ts` et vérifiées au
  solveur (parcours en largeur des états).
- **La Grande Écluse**, au centre : quatre grands tubes, deux anneaux, 14 gestes.
- **Le récit se retourne** : les trois billets de la Bulle ne sont pas du gardien. C'est l'autre
  qui écrit, la personne partie en mer : elle n'était jamais loin, juste en dessous ; les bateaux de
  papier ont tous coulé jusqu'à elle ; c'était elle, la lumière qui répondait au large.
- **La fin de la Bulle** : la Grande Écluse remplie, le dôme s'illumine et un rai de lumière monte
  jusqu'à la surface, face au phare : les deux lumières se répondent à travers la mer.

## 6 bis. Les Éclats (secrets)

Sept énigmes cachées hors des chemins, allumées dès le départ, sans câble ni guide lumineux :
le jardin des lanternes (grille d'environnement sur la plage ouest), un panneau dans le bosquet
est, une voile de papier dans les bois ouest, deux statues derrière le cloître, un panneau au
bord du plateau du phare, une feuille dans les dunes est, trois gardiens derrière le phare.
Toutes choisies pour leur « déclic » (l'agent glouton y échoue souvent). Un scintillement furtif
attire l'œil quand on passe à moins de 35 m. Chaque éclat gagné vole jusqu'au phare et tourne
autour de la lampe ; les sept réunis irisent le faisceau et le grand cristal de la place.

**Les rendre lisibles sans un mot** (retour de jeu : « je ne comprends pas ce que c'est ») :
- dès le début, des **alvéoles fantômes** (cristaux de verre pâle) tournent autour de la lanterne,
  une par éclat : on voit qu'il y a des choses à chercher, et combien il en reste ; chaque éclat
  trouvé vient prendre la place de la sienne ;
- au-dessus de chaque énigme secrète non résolue **flotte un petit éclat pâle** (c'est de là qu'il
  s'envole vers le phare) : on distingue les secrets des énigmes du parcours.

**Deux éclats de plus dans la suite** (neuf en tout) : un plateau à trois billes au bord est de
l'Île du Ciel (12 gestes), et un pupitre de racines à deux lumières au fond d'une alcôve de la
grotte (14 tuiles indécises). Les lanternes de la première fin attendent les sept de l'île ;
l'irisation du faisceau, les neuf.

## 6 septies. Le 100 % : la barque de papier

Quand tout est résolu, les 79 énigmes et les neuf éclats, une **barque de papier** dorée attend au
bord de l'eau, devant la plage du départ, sous une colonne de lumière visible de toute l'île (et un
appel doux se fait entendre). C'est le geste du gardien, qui pliait un bateau chaque soir : cette
fois, c'est le joueur. On la vise, on clique : elle s'éloigne vers le large, le soir tombe, sa
lanterne s'amenuise… et très loin, **une lumière que personne ne connaît encore** se met à
clignoter (trois éclats, une pause : pas la même voix que la Bulle). La boucle se ferme : *garde-la
allumée pour qui arrivera ensuite par la mer*. Ensuite, c'est le soir pour de bon, et la lumière
lointaine reste à l'horizon. (Mode test : « Le 100 % », et la cinématique « La barque de papier ».)

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

**Rendu léger** (mesuré en appels de dessin par image, `__game.drawCalls()`, et par groupe avec
`__game.inspect(nom)`) :
- les pièces fixes d'une énigme (cadres, socles, piliers, miroirs fixes) et du décor (bassins,
  colonnes, vasques, pergolas, lanternes) sont fusionnées : un maillage par matériau ;
- ce qui bouge en nombre (oiseaux, papillons, nénuphars, poissons, câbles) est instancié ;
- la passe d'ombre du soleil n'est refaite qu'une image sur trois, ou aussitôt que la zone
  d'ombre suit le joueur (elle coûtait 20 à 35 % des appels) ;
- sous terre, l'île n'est pas dessinée (vue courte), la mer et le ciel non plus.
Exemples, tout résolu : plage 828 → 610, place 734 → 511, phare 533 → 390, intérieur de la Bulle
338 → 106 (tubes, graduations, tuyaux et flèches fusionnés ; chaque vanne d'un seul bloc).

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

**Bilan** : 72 énigmes (22 + 1 en zone 1, 13 + 1 en zone 2, 12 + 1 en zone 3, 6 en zone 4, 8 + 1 sur l'Île du Ciel,
6 + 1 dans les Racines du Phare),
toutes vérifiées par les solveurs à chaque modification.
| 7 | Mobile | contrôles tactiles, performances |
