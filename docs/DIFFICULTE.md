# Courbe de difficulté

Mesurée par `node scripts/difficulty.ts` : chaque énigme est jouée 300 fois par un agent qui agit au hasard ;
la **difficulté** est le log₂ du nombre médian d'actions avant la solution. C'est une mesure « à l'aveugle » :
elle surestime les énigmes de pliage (où l'on raisonne) et sous-estime les ombres (petit espace d'états,
mais raisonnement 3D). Elle sert surtout à repérer les **sauts brusques** d'une énigme à la suivante.

La colonne **Déclic** est le pourcentage d'échecs d'un agent *glouton* (`scripts/greedy.ts`) qui
choisit toujours l'action qui améliore le plus la situation visible. Une énigme où il échoue souvent
ne se résout pas par petites améliorations : il faut une **idée**. Les énigmes d'apprentissage sont
volontairement à 0 % ; les énigmes de fin d'allée et de zone devraient en demander une.

Les **manivelles couplées** (o11, o12, Cadran, et la finale f6) sont à 100 % : chaque roue entraîne deux objets,
donc régler l'un dérègle l'autre, et aucune action ne fait progresser la situation visible.
Sans le couplage, les mêmes scènes sont à 0 %.

Au Phare, f1 à f3 sont volontairement des **leçons** (empreinte au sol, berceau, pochoir à un pli),
à 0 %. f4 (pochoir à trois plis où la lumière doit traverser des trous superposés), f5 et f6
demandent une idée. Les pochoirs à deux plis sont tous à 0 % (`scripts/stencil-search.ts`) :
c'est à trois plis que l'intuition « plier pour découvrir » ne suffit plus. La difficulté « à
l'aveugle » de f4 (7,6) surestime le pliage, comme en zone 2.

| Zone | Énigme | Type | Pièces | Actions min. | Actions à l'aveugle (médiane) | Difficulté | Déclic |
|---|---|---|---|---|---|---|---|
| 1 Lumière | a1 | lumière | 1 | 1 | 1 | 1.0 █ | 0 % |
| 1 Lumière | a2 | lumière | 2 | 2 | 2 | 1.6 ██ | 0 % |
| 1 Lumière | a3 | lumière | 3 | 3 | 3 | 2.0 ██ | 7 % |
| 1 Lumière | a4 | lumière | 2 | 2 | 2 | 1.6 ██ | 0 % |
| 1 Lumière | a5 | lumière | 5 | 5 | 19 | 4.3 ████ | 63 % |
| 1 Lumière | b1 | lumière | 2 | 2 | 2 | 1.6 ██ | 0 % |
| 1 Lumière | b2 | lumière | 2 | 2 | 2 | 1.6 ██ | 0 % |
| 1 Lumière | b3 | lumière | 3 | 3 | 3 | 2.0 ██ | 0 % |
| 1 Lumière | b4 | lumière | 3 | 3 | 3 | 2.0 ██ | 0 % |
| 1 Lumière | b5 | lumière | 5 | 4 | 15 | 4.0 ████ | 0 % |
| 1 Lumière | b6 | lumière | 10 | 8 | 247 | 8.0 ████████ ⚠ saut | 40 % |
| 1 Lumière | c1 | lumière | 1 | 1 | 1 | 1.0 █ | 0 % |
| 1 Lumière | c2 | lumière | 2 | 2 | 2 | 1.6 ██ | 0 % |
| 1 Lumière | c3 | lumière | 5 | 4 | 16 | 4.1 ████ | 0 % |
| 1 Lumière | c4 | lumière | 7 | 7 | 99 | 6.6 ███████ | 48 % |
| 1 Lumière | c5 | lumière | 8 | 7 | 103 | 6.7 ███████ | 57 % |
| 1 Lumière | d1 | lumière | 1 | 1 | 2 | 1.6 ██ | 0 % |
| 1 Lumière | d2 | lumière | 5 | 3 | 25 | 4.7 █████ ⚠ saut | 49 % |
| 1 Lumière | d3 | lumière | 1 | 1 | 1 | 1.0 █ | 0 % |
| 1 Lumière | d4 | lumière | 4 | 4 | 12 | 3.7 ████ | 0 % |
| 1 Lumière | d5 | lumière | 7 | 5 | 98 | 6.6 ███████ | 29 % |
| 1 Lumière | d6 | lumière | 11 | 9 | 1100 | 10.1 ██████████ ⚠ saut | 100 % |
| 1 Lumière | tours | lumière | 7 | 3 | 58 | 5.9 ██████ | 77 % |
| 2 Pliage | p1 | pliage | 2 | 1 | 1 | 1.0 █ | 0 % |
| 2 Pliage | p2 | pliage | 4 | 1 | 1 | 1.0 █ | 0 % |
| 2 Pliage | p3 | pliage | 4 | 2 | 2 | 1.6 ██ | 0 % |
| 2 Pliage | p4 | pliage | 12 | 1 | 3 | 2.0 ██ | 0 % |
| 2 Pliage | p5 | pliage | 4 | 2 | 2 | 1.6 ██ | 0 % |
| 2 Pliage | p6 | pliage | 4 | 1 | 5 | 2.6 ███ | 0 % |
| 2 Pliage | p7 | pliage | 8 | 2 | 50 | 5.7 ██████ ⚠ saut | 0 % |
| 2 Pliage | p8 | pliage | 4 | 1 | 5 | 2.6 ███ | 0 % |
| 2 Pliage | p9 | pliage | 12 | 2 | 53 | 5.8 ██████ ⚠ saut | 100 % |
| 2 Pliage | p10 | pliage | 12 | 3 | 315 | 8.3 ████████ | 100 % |
| 2 Pliage | p11 | pliage | 12 | 3 | 131 | 7.0 ███████ | 100 % |
| 2 Pliage | p12 | pliage | 14 | 3 | 847 | 9.7 ██████████ | 100 % |
| 2 Pliage | p13 | pliage | 20 | 4 | 1334 | 10.4 ██████████ | 100 % |
| 2 Pliage | grand-pli | pliage | 15 | 3 | 387 | 8.6 █████████ | 100 % |
| 3 Ombres | o1 | ombres | 1 | 1 | 1 | 1.0 █ | 0 % |
| 3 Ombres | o2 | ombres | 1 | 2 | 4 | 2.3 ██ | 0 % |
| 3 Ombres | o3 | ombres | 2 | 2 | 8 | 3.2 ███ | 0 % |
| 3 Ombres | o4 | ombres | 1 | 1 | 3 | 2.0 ██ | 0 % |
| 3 Ombres | o5 | ombres | 1 | 1 | 3 | 2.0 ██ | 0 % |
| 3 Ombres | o6 | ombres | 1 | 2 | 4 | 2.3 ██ | 0 % |
| 3 Ombres | o7 | ombres | 1 | 1 | 3 | 2.0 ██ | 0 % |
| 3 Ombres | o8 | ombres | 2 | 3 | 15 | 4.0 ████ | 0 % |
| 3 Ombres | o9 | ombres | 2 | 2 | 12 | 3.7 ████ | 48 % |
| 3 Ombres | o10 | ombres | 3 | 3 | 59 | 5.9 ██████ | 57 % |
| 3 Ombres | o11 | ombres+manivelles | 2 | 2 | 12 | 3.7 ████ | 100 % |
| 3 Ombres | o12 | ombres+manivelles | 3 | 4 | 50 | 5.7 ██████ | 100 % |
| 3 Ombres | cadran | ombres+manivelles | 3 | 5 | 57 | 5.9 ██████ | 100 % |
| 4 Phare | f1 | lumière+objets | 1 | 2 | 4 | 2.3 ██ | 0 % |
| 4 Phare | f2 | lumière+objets | 1 | 1 | 3 | 2.0 ██ | 0 % |
| 4 Phare | f3 | pliage+lumière | 8 | 1 | 7 | 3.0 ███ | 0 % |
| 4 Phare | f4 | pliage+lumière | 16 | 3 | 195 | 7.6 ████████ ⚠ saut | 100 % |
| 4 Phare | f5 | lumière+objets | 3 | 5 | 27 | 4.8 █████ | 48 % |
| 4 Phare | f6 | lumière+objets+manivelles | 3 | 6 | 46 | 5.6 ██████ | 100 % |
