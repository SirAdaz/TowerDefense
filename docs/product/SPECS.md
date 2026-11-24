# Spécifications — V1 jouable

Règles du jeu sous forme testable « si… alors… ». Les chiffres viennent de `src/game/balance.ts` (source de vérité) : changer un chiffre là-bas = mettre à jour cette page dans la même PR. Les tests de `src/game/*.test.ts` et `tests/balance.test.ts` vérifient ces règles.

## Carte

- La carte fait 16 × 10 cases. Le chemin est fixe : 36 cases, de la case (0, 1) à gauche jusqu'à la case (15, 7) à droite.
- Si on clique une case d'herbe libre et qu'on a au moins 50 $, alors une tourelle y est posée et 50 $ sont retirés.
- Si la case est sur le chemin, déjà occupée, ou si on a moins de 50 $, alors rien n'est posé.
- Si on clique une tourelle, alors elle est sélectionnée : sa portée s'affiche et le panneau de droite montre ses 3 jauges.

## Tourelle (une seule sorte)

Chaque tourelle a 3 jauges indépendantes, du niveau 1 (à la pose) au niveau 5.

| Niveau | Dégâts par tir | Portée (cases) | Cadence (tirs/s) | Prix pour atteindre ce niveau |
| ------ | -------------- | -------------- | ---------------- | ----------------------------- |
| 1      | 10             | 2              | 1                | pose : 50 $                   |
| 2      | 16             | 2,5            | 1,35             | 25 $                          |
| 3      | 25             | 3              | 1,8              | 50 $                          |
| 4      | 38             | 3,5            | 2,4              | 90 $                          |
| 5      | 56             | 4              | 3,2              | 150 $                         |

- Si on améliore une jauge au niveau N et qu'on a le prix du niveau N+1, alors la jauge passe à N+1 et le prix est retiré. Le prix ne dépend que du niveau visé, pas de la jauge.
- Si une jauge est au niveau 5, alors elle ne s'améliore plus (bouton « MAX »).
- Une tourelle entièrement améliorée coûte 50 + 3 × 315 = 995 $.
- Si on vend une tourelle, alors elle disparaît et rend 70 % de tout ce qu'elle a coûté (pose + améliorations), arrondi à l'euro inférieur. Ex. : posée puis dégâts au niveau 2 = 75 $ dépensés → revente 52 $.
- La tourelle tire sur l'ennemi à portée le plus avancé sur le chemin. Son projectile suit la cible (8 cases/s) ; si la cible meurt ou sort avant, le projectile se perd.
- On peut poser, améliorer et vendre pendant une vague comme entre deux vagues.

## Ennemis

Vie à la vague V = vie de base × 1,15^(V−1), arrondie.

| Ennemi  | Apparence            | Vie de base | Vitesse (cases/s) | Prime |
| ------- | -------------------- | ----------- | ----------------- | ----- |
| Normal  | carré rouge          | 20          | 1,4               | 5 $   |
| Rapide  | petit carré bleu     | 10          | 2,8 (2× normal)   | 4 $   |
| Costaud | gros carré violet    | 80 (4×)     | 0,7               | 12 $  |
| Boss    | carré noir couronné  | 500         | 0,55              | 100 $ |

- Si un ennemi est tué, alors sa prime est ajoutée à l'argent.
- Si un ennemi atteint la sortie, alors il disparaît et retire 1 vie (boss compris).
- Exemples de vie d'un normal : vague 1 = 20, vague 10 = 70, vague 15 = 141, vague 20 = 285, vague 25 = 573. Boss : vague 10 = 1 759, vague 20 = 7 116.

## Vagues

- Si V est le numéro de vague, alors elle compte 5 + 2V ennemis ordinaires (7 à la vague 1, 25 à la vague 10), plafonnés à 60.
- Si V ≥ 3, alors un ennemi sur trois (3e, 6e…) est rapide. Si V ≥ 5, alors un ennemi sur cinq (5e, 10e…) est costaud (le costaud l'emporte).
- Si V est un multiple de 10, alors un boss entre en dernier.
- Les ennemis entrent un par un, toutes les 0,9 s à la vague 1, puis 0,02 s de moins par vague, jamais moins de 0,45 s.
- La composition est fixe (pas de hasard) : une même vague se rejoue à l'identique.
- Si la partie commence, alors la vague 1 attend le clic sur « Lancer la vague 1 » (pas de compte à rebours, le temps de poser ses premières tourelles).
- Si une vague est finie (plus d'ennemi à faire entrer ni sur la carte), alors un compte à rebours de 10 s démarre ; à 0, la vague suivante part seule.
- Si on clique « Vague suivante » pendant le compte à rebours, alors la vague part tout de suite et rapporte 2 $ par seconde entière restante (jusqu'à 20 $).
- Le bouton « Vague suivante » est inactif pendant une vague.

## Vies, défaite, score

- Si la partie commence, alors on a 20 vies et 150 $ (3 tourelles).
- Si les vies tombent à 0, alors la partie est perdue : écran de fin avec la vague atteinte et le record, bouton « Nouvelle partie ».
- La vague atteinte est le numéro de la dernière vague lancée.
- Si une vague lancée dépasse le record, alors le record (gardé dans `localStorage`) prend sa valeur tout de suite, même si l'onglet est fermé ensuite.

## Confort

- Si l'onglet passe en arrière-plan (`visibilitychange`), alors la partie se met en pause et y reste au retour : « Reprendre » la relance.
- Si on clique « Pause », alors tout s'arrête (ennemis, tirs, compte à rebours) ; on peut encore sélectionner une tourelle, mais pas poser, améliorer ni vendre.
- Si on active « ×2 », alors le jeu va deux fois plus vite (deux pas de simulation par pas d'horloge).
- Sauvegarde : si une vague se termine, ou si on pose, améliore ou vend une tourelle entre deux vagues, alors la partie (vague, vies, argent, tourelles et leurs jauges) est écrite dans `localStorage`.
- Si on recharge la page avec une sauvegarde, alors la partie reprend en pause, à la même vague, avec les mêmes tourelles ; le compte à rebours repart de 10 s.
- Si on recharge pendant une vague, alors on revient à la dernière sauvegarde, c'est-à-dire juste avant cette vague (les ennemis en route ne sont pas sauvés, et ce qui a été dépensé ou gagné pendant la vague est annulé : on ne peut pas tricher en rechargeant).
- Si la sauvegarde est illisible ou incohérente, alors une partie neuve démarre.
- Si la partie est perdue, alors la sauvegarde est effacée (le record reste).

## Courbe de difficulté visée (mesurée par `npm run simulate`)

Joueur automatique de `tests/bot.ts` (pose sur les cases qui couvrent le plus de chemin, améliore la jauge la moins chère) :

| Joueur                               | Vague atteinte | Premières vies perdues |
| ------------------------------------ | -------------- | ---------------------- |
| 2 tourelles, jamais améliorées       | 5              | vague 2                |
| Pose seulement, 12 tourelles         | 14             | vague 10               |
| 6 tourelles + améliorations          | 21             | vague 20               |
| 12 tourelles + améliorations         | 22             | vague 20               |
| 30 tourelles + améliorations         | 23             | vague 20               |

- Si on joue normalement (3 tourelles au départ, on pose et on améliore), alors les 9 premières vagues ne coûtent aucune vie : la première partie est facile.
- La vie des ennemis croît de 15 % par vague quand les gains ne croissent qu'avec le nombre d'ennemis : la pression monte nettement à partir de la vague 15 et la partie se joue entre les vagues 18 et 25.
