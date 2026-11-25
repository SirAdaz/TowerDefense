# Spécifications — V1 jouable

Règles du jeu sous forme testable « si… alors… ». Les chiffres viennent de `src/tower-defense/game/balance.ts` (source de vérité) : changer un chiffre là-bas = mettre à jour cette page dans le même changement. Les tests de `src/tower-defense/game/*.test.ts` vérifient les règles, `tests/balance.test.ts` vérifie la courbe de difficulté.

## Carte

- La carte fait 16 × 10 cases. Le chemin est fixe : 36 cases, de la case (0, 1) à gauche jusqu'à la case (15, 7) à droite.
- Si on clique une case libre et qu'on a au moins 50 $, alors une tourelle y est posée, 50 $ sont retirés et la tourelle est sélectionnée.
- Si la case est sur le chemin, hors de la carte, déjà occupée, ou si on a moins de 50 $, alors rien n'est posé.
- Si on survole une case libre, alors la portée d'une tourelle neuve s'y dessine (grisée si l'argent manque).
- Si on clique une tourelle, alors elle est sélectionnée : sa portée s'affiche et le panneau montre ses 3 jauges. Un second clic ou Échap la désélectionne.

## Tourelle (une seule sorte)

Chaque tourelle a 3 jauges indépendantes, du niveau 1 (à la pose) au niveau 5.

| Niveau | Dégâts par tir | Portée (cases) | Cadence (tirs/s) | Prix pour atteindre ce niveau |
| ------ | -------------- | -------------- | ---------------- | ----------------------------- |
| 1      | 10             | 2              | 1                | pose : 50 $                   |
| 2      | 16             | 2,4            | 1,3              | 30 $                          |
| 3      | 24             | 2,8            | 1,7              | 60 $                          |
| 4      | 34             | 3,2            | 2,2              | 110 $                         |
| 5      | 46             | 3,6            | 2,8              | 180 $                         |

- Si une jauge est au niveau N < 5 et qu'on a le prix du niveau N + 1, alors « Améliorer » la monte à N + 1 et retire ce prix. Le prix ne dépend que du niveau visé, pas de la jauge.
- Si l'argent manque ou si la jauge est au niveau 5 (« Niveau max »), alors l'amélioration est refusée et rien ne change.
- Une jauge entièrement montée coûte 30 + 60 + 110 + 180 = 380 $ ; une tourelle entièrement améliorée coûte 50 + 3 × 380 = 1 190 $.
- Si on vend une tourelle, alors elle disparaît et rend 75 % de tout ce qu'elle a coûté (pose + améliorations), arrondi à l'unité inférieure. Ex. : tourelle neuve → 37 $ ; pose + dégâts 2 + cadence 2 = 110 $ dépensés → 82 $.
- Si un ennemi vivant est à portée (distance entre les centres ≤ portée) et que la tourelle est prête, alors elle touche aussitôt celui qui est le plus avancé sur le chemin, lui retire ses dégâts, et attend 1 / cadence seconde avant le tir suivant. Il n'y a pas de projectile : un tir ne se perd jamais.
- On peut poser, améliorer et vendre à tout moment tant que la partie n'est pas perdue : pendant une vague, entre deux vagues et en pause.

## Ennemis

Vie à la vague V = vie de base × 1,12^(V − 1), arrondie.

| Ennemi  | Forme sur la carte        | Vie de base | Vitesse (cases/s) | Prime | Vies retirées à la sortie |
| ------- | ------------------------- | ----------- | ----------------- | ----- | ------------------------- |
| Normal  | rond corail               | 24          | 1,2               | 5 $   | 1                         |
| Rapide  | triangle jaune            | 12          | 2,4 (2 × normal)  | 4 $   | 1                         |
| Costaud | carré violet              | 96 (4 ×)    | 0,7               | 12 $  | 1                         |
| Boss    | grand hexagone blanc      | 480         | 0,6               | 100 $ | **5**                     |

- Si la vie d'un ennemi tombe à 0, alors il disparaît et sa prime est ajoutée à l'argent.
- Si un ennemi atteint la sortie, alors il disparaît et retire 1 vie ; **si c'est un boss, il en retire 5**.
- Exemples de vie d'un normal : vague 1 = 24, vague 10 = 67, vague 15 = 117, vague 20 = 207, vague 25 = 364. Boss : vague 10 = 1 331, vague 20 = 4 134, vague 30 = 12 840.

## Vagues

- Si V est le numéro de la vague, alors elle compte 6 + 2 V ennemis ordinaires (8 à la vague 1, 26 à la vague 10), plafonnés à 50 (à partir de la vague 22).
- Si V ≥ 4, alors un ennemi sur quatre (le 4e, le 8e…) est un costaud.
- Si V ≥ 3, alors le dernier tiers de la vague (arrondi en dessous) est un peloton de rapides, sauf aux places des costauds.
- Si V est un multiple de 10, alors un boss entre en dernier, en plus des ennemis ordinaires.
- Les ennemis entrent un par un, toutes les 0,9 s à la vague 1, puis 0,02 s de moins par vague, jamais moins de 0,4 s (vague 26).
- La composition est fixe, sans hasard : une même vague se rejoue à l'identique.
- Si la partie commence, alors la vague 1 attend le clic sur « Lancer la vague 1 » : pas de compte à rebours, le temps de poser ses premières tourelles.
- Si une vague est finie (plus d'ennemi à faire entrer ni sur la carte), alors un compte à rebours de 10 s démarre ; à 0, la vague suivante part seule, sans bonus.
- Si on clique « Vague suivante » pendant le compte à rebours, alors la vague part tout de suite et rapporte 2 $ par seconde entière restante (20 $ au plus).
- Si une vague est en cours, alors « Vague suivante » est inactif.

## Vies, défaite, score

- Si la partie commence, alors on a 20 vies et 150 $ (de quoi poser 3 tourelles).
- Si les vies tombent à 0, alors la partie est perdue : tout s'arrête et l'écran de fin donne la vague atteinte, le record et « Nouvelle partie ».
- Le score est la vague atteinte : le numéro de la dernière vague lancée.
- Si une vague lancée dépasse le record, alors le record (gardé dans `localStorage`) prend sa valeur tout de suite, même si l'onglet est fermé ensuite.

## Confort

- Si l'onglet passe en arrière-plan (`visibilitychange`) pendant une vague ou un compte à rebours, alors la partie se met en pause, et y reste au retour : « Reprendre » la relance.
- Si on clique « Pause » (ou touche P), alors ennemis, tirs et compte à rebours s'arrêtent ; un bandeau « En pause » s'affiche sur la carte. On peut encore poser, améliorer et vendre.
- Si on active « Vitesse ×2 », alors le temps de jeu passe deux fois plus vite (deux fois plus de pas de simulation, chacun identique).
- Sauvegarde : l'état complet de la partie (vague, vies, argent, tourelles et jauges, ennemis en route, minuteries) est écrit dans `localStorage` à chaque action du joueur, au début et à la fin de chaque vague, une fois par seconde pendant que le jeu tourne, et quand on quitte ou ferme l'onglet.
- Si on recharge la page avec une sauvegarde, alors la partie reprend à l'identique, **y compris en pleine vague** (mêmes ennemis aux mêmes endroits), en pause : « Reprendre » la relance. Recharger ne fait donc ni gagner ni perdre quoi que ce soit.
- Si la sauvegarde est illisible ou incohérente (tourelle sur le chemin, niveau hors bornes, ennemis avant la vague 1…), alors elle est ignorée et une partie neuve démarre.
- Si la partie est perdue, alors la sauvegarde est effacée ; le record reste.
- Si on clique « Nouvelle partie » pendant une partie en cours, alors une confirmation est demandée avant de l'abandonner.
- Si `localStorage` est indisponible, alors le jeu reste jouable, sans sauvegarde ni record.

## Accessibilité

- Chaque case constructible est un vrai bouton ; les cases du chemin ne sont pas focalisables. Une seule case est dans l'ordre de tabulation, les flèches déplacent le focus en enjambant le chemin, Entrée ou Espace pose ou sélectionne.
- Si une commande est indisponible (argent insuffisant, niveau max, vague en cours), alors elle reste focalisable, est annoncée indisponible (`aria-disabled`) et n'agit pas.
- Les ennemis se distinguent par leur forme, pas seulement par leur couleur. Textes et commandes respectent un contraste AA sur le fond.
- Les changements importants (vague lancée, pause, tourelle posée ou vendue, fin de partie) sont annoncés dans une zone `aria-live`.

## Équilibrage (mesuré par `npm run simulate`)

Objectif : une première partie facile, une difficulté qui se fait vraiment sentir entre les vagues 15 et 25. La vie des ennemis croît de 12 % par vague (× 2,8 à la vague 10, × 8,6 à la vague 20, × 15 à la vague 25) quand les gains ne croissent qu'avec le nombre d'ennemis.

Joueur automatique de `tests/bot.ts` : il pose sur les cases qui couvrent le plus de chemin, puis achète toujours l'amélioration la moins chère.

| Joueur                                          | Vague atteinte | Première vie perdue |
| ----------------------------------------------- | -------------- | ------------------- |
| Aucune tourelle                                 | 3              | vague 1             |
| 3 tourelles de départ, rien ensuite             | 6              | vague 3             |
| Pose seulement, 12 tourelles                    | 13             | vague 10            |
| 4 tourelles + améliorations                     | 20             | vague 18            |
| 8 tourelles + améliorations                     | 22             | vague 20            |
| 8 tourelles + améliorations, vagues en avance   | 23             | vague 20            |
| 30 tourelles + améliorations                    | 25             | vague 20            |

Règles vérifiées par `tests/balance.test.ts` :

- Si on ne pose rien, alors la partie est perdue à la vague 3.
- Si on pose seulement ses 3 tourelles de départ, alors les vagues 1 et 2 ne coûtent aucune vie et on atteint au moins la vague 5.
- Si on pose des tourelles sans jamais améliorer, alors les 9 premières vagues ne coûtent aucune vie.
- Si on pose et améliore (4, 8 ou 30 tourelles), alors aucune vie n'est perdue avant la vague 15, et la partie se termine entre les vagues 18 et 30.
- Si on investit davantage, alors on va plus loin (30 tourelles améliorées > 4 tourelles améliorées > pose seule).
