# Lueur — jeu d'énigmes visuelles en 3D

Une île silencieuse, des ruines de pierre blanche, un phare éteint. Trois langages
d'énigmes à comprendre **sans un seul mot** : la lumière, le pliage, les ombres.

**Le jeu est complet** : 4 zones, 49 énigmes, une fin.

| Zone | Langage | Contenu |
|---|---|---|
| Le Jardin des Prismes | Lumière | 19 panneaux + les Tours-Miroirs |
| L'Atelier de Papier | Pliage | 12 pupitres + le Grand Pli |
| Le Cloître des Ombres | Ombres | 10 théâtres d'ombres + le Cadran |
| Le Phare | Combinaisons | 5 panneaux, puis le phare se rallume |

**▶ Jouer : https://gaetandg.github.io/JeuEnigmes3D/** (PC, navigateur récent)

## Contrôles

| Action | Touche |
|---|---|
| Regarder | souris |
| Se déplacer | ZQSD / WASD / flèches |
| Courir | Maj |
| Interagir | clic gauche (clic droit : sens inverse) |
| Pause | Échap |

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests unitaires + validation de toutes les énigmes par le solveur
npm run e2e        # tests de bout en bout (Playwright) avec captures d'écran
npm run build      # version de production dans dist/
```

Conception : [docs/DESIGN.md](docs/DESIGN.md).

Projet développé de façon autonome par Claude (Claude Code), à partir d'une idée de gaetandg.
