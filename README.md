# Lueur — jeu d'énigmes visuelles en 3D

Une île silencieuse, des ruines de pierre blanche, un phare éteint. Trois langages
d'énigmes à comprendre **sans un seul mot** : la lumière, le pliage, les ombres.

**Le jeu est complet** : 4 zones, 53 énigmes, une fin.

| Zone | Langage | Contenu |
|---|---|---|
| Le Jardin des Prismes | Lumière | 22 panneaux + les Tours-Miroirs |
| L'Atelier de Papier | Pliage | 13 pupitres + le Grand Pli |
| Le Cloître des Ombres | Ombres | 10 théâtres d'ombres + le Cadran |
| Le Phare | Combinaisons | 5 panneaux, puis le phare se rallume |

**▶ Jouer : https://gaetandg.github.io/JeuEnigmes3D/** (PC ou mobile, navigateur récent)

## Contrôles

| Action | Touche |
|---|---|
| Regarder | souris |
| Se déplacer | ZQSD / WASD / flèches |
| Courir | Maj |
| Interagir | clic gauche (clic droit : sens inverse) |
| Pause | Échap |

Sur **téléphone / tablette** : pouce gauche = joystick (pousser loin pour courir),
glisser à droite = regarder, toucher = agir, appui long = agir en sens inverse,
bouton ❚❚ = pause. La qualité graphique passe en « basse » automatiquement.

**Réglages** : volume, musique (générée, une tonalité par zone), sensibilité, qualité graphique (haute / moyenne / basse),
symboles des couleurs pour les personnes daltoniennes (▲ rouge, ■ vert, ● bleu),
aides discrètes (après 3 minutes bloqué devant une énigme, une pièce à changer luit doucement),
guide lumineux (colonnes au-dessus des énigmes en attente), champ de vision, inversion de l'axe
vertical, balancement de la marche. **Manette** : stick gauche marcher, stick droit regarder,
A agir, B ou X sens inverse, Start pause.

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests unitaires : moteurs, validation de toutes les énigmes, navigation
npm run e2e        # tests de bout en bout (Playwright) avec captures d'écran
npm run build      # version de production dans dist/
```

Conception : [docs/DESIGN.md](docs/DESIGN.md) · Courbe de difficulté mesurée : [docs/DIFFICULTE.md](docs/DIFFICULTE.md)
(`node scripts/difficulty.ts`).

Projet développé de façon autonome par Claude (Claude Code), à partir d'une idée de gaetandg.
