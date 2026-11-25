# Spécifications — Nuit blanche

Jeu de survie à vagues : une luciole, des ombres qui arrivent de partout en nombre croissant, dix minutes à tenir. Règles sous forme testable « si… alors… ». Les chiffres viennent de `src/survival/game/balance.ts` (source de vérité) : changer un chiffre là-bas = mettre à jour cette page dans le même changement. Les tests de `src/survival/game/*.test.ts` vérifient les règles, `tests/survivalBalance.test.ts` la courbe de difficulté.

## Partie

- L'arène est fixe (1600 × 900 unités) et tient entière à l'écran. Le joueur part du centre avec 100 points de vie et l'Étincelle au niveau 1.
- Si le curseur bouge, alors la luciole le rejoint à 330 unités/s au plus : elle ne se téléporte jamais et ne sort pas de l'arène.
- Les armes tirent seules. Le joueur ne clique que dans les menus.
- Si le joueur tient 10:00, alors le boss entre. Si le boss tombe, la partie est **gagnée** ; si la vie du joueur tombe à 0, elle est **perdue**. Dans les deux cas l'écran de score s'affiche.
- Si un ennemi touche le joueur, alors il lui retire ses dégâts et le joueur est invulnérable 0,5 s.
- La simulation avance par pas fixes de 1/60 s, avec un hasard à graine : même graine et mêmes gestes = même nuit.

## Expérience et améliorations

- Un ennemi détruit laisse un éclat. Si un éclat est à moins de 85 unités du joueur, alors il file vers lui (640 unités/s) et lui donne son expérience en l'atteignant.
- Passer du niveau N au suivant demande `6 + 5 × (N − 1) + 0,5 × (N − 1)²` points, arrondi à l'entier inférieur (6, 11, 18, 25…). Une nuit gagnée finit vers le niveau 25 à 30.
- Si un niveau est franchi, alors le joueur récupère 8 points de vie, la partie se fige et **3 cartes** différentes sont proposées : une arme nouvelle, un niveau d'arme ou un niveau de passif. Il en choisit une (clic, ou touches 1, 2, 3) et la partie reprend. Échap ne passe pas ce choix.
- Une arme monte jusqu'au niveau 5, un passif jusqu'au niveau 3. Si moins de 3 cartes restent possibles, alors un soin (« Second souffle », 30 points de vie) complète le tirage.
- Si plusieurs niveaux sont franchis d'un coup, alors les choix s'enchaînent.

## Armes

| Arme      | Ce qu'elle fait                                                                                 | Niveau 1                        | Niveau 5                           |
| --------- | ----------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------- |
| Étincelle | Un trait vers l'ennemi le plus proche (640 unités/s).                                           | 12 dégâts, 1 trait / 0,6 s      | 24 dégâts, 3 traits / 0,45 s, traverse 1 ennemi |
| Halo      | Des orbes en orbite autour du joueur, dégâts continus au contact.                               | 2 orbes, 30 dégâts/s, rayon 85  | 5 orbes, 70 dégâts/s, rayon 110    |
| Onde      | Une détonation autour du joueur : blesse et repousse (sauf le boss).                            | 18 dégâts, rayon 150, / 3,6 s   | 52 dégâts, rayon 230, / 2,7 s      |
| Foudre    | Frappe des ennemis au hasard dans l'arène, avec un petit impact de zone. **À débloquer.**       | 2 éclairs de 26, / 2,2 s        | 6 éclairs de 58, / 1,6 s           |
| Comète    | Un projectile lent (430 unités/s) qui traverse tout, une fois par ennemi. **À débloquer.**      | 22 dégâts, / 1,8 s              | 2 comètes opposées de 56, / 1,3 s  |

Le détail de chaque niveau est le texte de sa carte (`WEAPONS` dans `balance.ts`).

## Passifs (3 niveaux, même bonus à chaque niveau)

| Passif    | Bonus par niveau                    | De base ou à débloquer |
| --------- | ----------------------------------- | ---------------------- |
| Vigueur   | Vie maximale +20, et autant rendue  | base                   |
| Élan      | Vitesse +8 %                        | base                   |
| Aimant    | Portée de ramassage +35 %           | base                   |
| Puissance | Dégâts +12 %                        | base                   |
| Cadence   | Rechargement −8 %                   | base                   |
| Souffle   | +0,5 point de vie par seconde       | à débloquer            |
| Carapace  | Dégâts reçus −10 %                  | à débloquer            |
| Sagesse   | Expérience +12 %                    | à débloquer            |

## Ennemis

Vie à la minute M = vie de base × (1 + 0,28 × M). Le boss a une vie fixe.

| Ennemi   | Forme            | Vie de base | Vitesse | Dégâts | Expérience | Points | Particularité                                                                 |
| -------- | ---------------- | ----------- | ------- | ------ | ---------- | ------ | ----------------------------------------------------------------------------- |
| Rôdeur   | rond rose        | 10          | 82      | 8      | 1          | 10     | —                                                                             |
| Nuée     | triangle orange  | 6           | 150     | 5      | 1          | 8      | Arrive par groupes de 3.                                                      |
| Colosse  | carré violet     | 80          | 52      | 16     | 5          | 40     | —                                                                             |
| Fonceur  | losange turquoise| 30          | 95      | 12     | 3          | 30     | À moins de 380 unités : s'arrête 0,8 s (trait pointillé), fonce 0,55 s à 420 en ligne droite, puis se repose 2,6 s. |
| L'Éclipse (boss) | grand disque noir cerclé | 5 200 | 72 | 28 | — | 5 000 (prime) | Charge comme un fonceur (à 540) et appelle 6 nuées toutes les 6 s. |

- **Élite** : à 1:30 puis toutes les 45 s, un ennemi du moment arrive en élite (liseré clair) : vie × 8, taille × 1,5, points × 5, +15 d'expérience.
- **Rythme** : `0,9 + 0,8 × minute` ennemis par seconde, entrés par un point au hasard du pourtour. Pendant le combat contre le boss, le rythme tombe à 35 %.
- **Composition** : rôdeurs seuls au début ; nuées à 1:00 ; colosses à 3:00 ; fonceurs à 4:30 ; plus de colosses et de fonceurs à 7:00.
- Les ennemis ne s'empilent pas : ils s'écartent les uns des autres. L'arène ne contient jamais plus de 336 ennemis de la horde (réserve de 360 avec le boss et ses renforts).

## Score, record, pièces

- Score = points des ennemis détruits + 10 points par seconde tenue (600 s au plus) + 5 000 si le boss est battu.
- Record = meilleur score ; le meilleur temps tenu et la première victoire sont gardés aussi.
- Pièces d'une partie = 1 par tranche de 10 s tenue + 3 par élite détruit + 30 pour une victoire. Une partie abandonnée depuis la pause est comptée comme perdue, avec son score et ses pièces.

## Déblocages

- Les pièces achètent, au menu, des cartes en plus pour le tirage : Souffle 30, Foudre 50, Carapace 70, Comète 90, Sagesse 110 (350 en tout, soit quelques nuits).
- Si on a assez de pièces et qu'on clique « Débloquer », alors les pièces sont retirées et la carte entre dans le tirage des parties suivantes.
- **Jamais de bonus permanent** : une partie démarre toujours avec les mêmes 100 points de vie et la seule Étincelle.

## Confort

- Pause : Échap, P ou le bouton « Pause ». La partie se met seule en pause quand l'onglet est caché ou que la fenêtre perd le focus. L'écran de pause rappelle les armes et passifs en main.
- Rien n'est sauvegardé en cours de partie (10 minutes au plus) : seul le profil l'est (clé `nuitblanche.profile.v1`), à la fin de chaque partie et à chaque déblocage.
- Mouvement réduit (`prefers-reduced-motion`) : pas de secousse d'écran, pas d'éclat blanc sur les ennemis touchés, pas de clignotement du joueur, la foudre garde seulement son cercle d'impact.
- Clavier : Tab et Entrée dans tous les menus, 1 / 2 / 3 pour choisir une carte. Le jeu lui-même se joue à la souris.

## Équilibrage (joueur automatique, `npm run simulate:survival`)

- Si le joueur lâche la souris, alors il perd avant 2:00.
- Si le joueur esquive mais ne prend que des passifs, alors il tient quelques minutes (médiane au-delà de 2:30) et ne voit jamais l'aube.
- Si le joueur esquive et monte ses armes, alors il voit l'aube la plupart des nuits, entre les niveaux 20 et 36.
- La meilleure nuit rapporte moins de la moitié du prix de tous les déblocages, et six de ces nuits les paient tous.
