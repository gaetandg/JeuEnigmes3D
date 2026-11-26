# Lueur — jeu d'énigmes visuelles en 3D

Une île silencieuse, des ruines de pierre blanche, un phare éteint. Trois langages
d'énigmes à comprendre **sans un seul mot** : la lumière, le pliage, les ombres.

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
