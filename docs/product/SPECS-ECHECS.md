# Échecs : règles et chiffres

Source de vérité des chiffres : les constantes de `src/chess/game/` et de `src/chess/data/analyser.ts`. Tout changement se fait là, ici, et dans le test concerné.

## Parties lues

- API publique de chess.com : liste des archives du joueur, puis les archives mensuelles, de la plus récente à la plus ancienne, trois mois au plus (`MAX_ARCHIVE_MONTHS`), une requête à la fois.
- Gardées : échecs classiques (`rules: chess`) en bullet, blitz ou rapide. Écartées : parties par correspondance, variantes, parties de moins de 10 demi-coups (`MIN_PLIES`).
- Première visite : les 20 parties les plus récentes (`GAMES_PER_PASS`). Ensuite : les parties jamais analysées et jouées après la plus ancienne partie connue, 20 par passe, les plus récentes d'abord. L'historique d'avant la première visite n'est jamais analysé.
- Erreurs dites au joueur : pseudo inconnu (404), limite de débit (429), réseau, réponse inattendue.

## Analyse

| Passe | Positions | Limite (`analyser.ts`) |
| ----- | --------- | ---------------------- |
| Rapide | toutes | profondeur 14 ou 0,4 s (`QUICK_SEARCH`) |
| Profonde | candidates seulement | profondeur 18 ou 1,5 s, 4 variantes (`DEEP_SEARCH`), puis le coup joué cherché seul |

- Évaluations en centipions vues du joueur, bornées à ±1000 (`CP_LIMIT`) ; un mat vaut la borne.
- Chances de gain : `50 + 50 × (2 / (1 + e^(−0,00368208 × cp)) − 1)`. Précision d'un coup : `103,1668 × e^(−0,04354 × perte) − 3,1669`, bornée à 0-100 (formules de Lichess). Précision d'une partie : moyenne des coups du joueur.

| Qualité | Centipions perdus | Et chances de gain perdues |
| ------- | ----------------- | -------------------------- |
| Gaffe (`BLUNDER`) | ≥ 200 | ≥ 10 points |
| Erreur (`MISTAKE`) | ≥ 100 | ≥ 5 points |
| Imprécision (`INACCURACY`) | ≥ 50 | ≥ 2,5 points |

- Phase : finale à 6 pièces ou moins hors rois et pions ; sinon ouverture avant le 13e coup, milieu de jeu ensuite.
- Partie perdue : phase du dernier coup qui fait passer de plus de −2 pions à −2 ou moins (`LOSING_CP`) ; sans bascule, « autre » (temps, abandon).

## Problèmes

- Candidat : une gaffe du joueur, un mat concédé, ou un mat en 5 coups ou moins manqué (`MISSED_MATE_MAX_MOVES`), si la position valait mieux que −5 pions (`HOPELESS_CP`).
- Coups acceptés : le meilleur, et ceux qui gardent les chances de gain à 3 points près (`NEAR_BEST_WIN_DROP`) ; quand un mat existe, seuls les mats, un coup plus long au plus.
- Écarté si : le coup joué figure parmi les acceptés, plus de 3 coups se valent (`MAX_SOLUTIONS`), ou le coup joué, recherché en profondeur, n'est plus une gaffe.
- Le problème ne dit pas ce qu'il y a à trouver (gain, mat, défense) : comme en partie.

## Révision espacée (`schedule.ts`)

| Résultat | Effet |
| -------- | ----- |
| Raté (mauvais coup, ou solution demandée) | revient le lendemain |
| Réussi | délai suivant : 3, 7, 21 puis 60 jours |
| Réussi avec l'indice | même délai qu'avant, sans progrès (lendemain pour un nouveau problème) |

- Un problème réussi à la première vue revient dans 3 jours.
- L'échéance est avancée de 8 heures (`DUE_SLACK_MS`) : « demain » marche dès le matin.
- Ordre d'une séance : révisions échues (la plus en retard d'abord), puis nouveaux problèmes, des parties les plus récentes aux plus anciennes.

## Bilan par cadence (`report.ts`)

- Un bilan par cadence (bullet, blitz, rapide), jamais additionnés. La cadence la plus jouée s'ouvre d'abord.
- Précision moyenne : moyenne des précisions des parties. Gaffes et erreurs : nombre moyen par partie.
- Ouvertures : nom de famille tiré de l'adresse `ECOUrl` du PGN (« Sicilian Defense »), les 6 plus jouées (`MAX_OPENINGS`) avec leur part de victoires.
- Défaites par phase où la partie a basculé (voir Analyse).
- Fin de pendule : gaffes et erreurs pour 100 coups joués avec moins de 10 secondes (`LOW_CLOCK_SECONDS`, pendule notée après le coup), comparées au reste des coups.
- Les parties sans coup évalué (illisibles, trop courtes) ne comptent pas.

## Limites connues

- Moteur allégé à faible profondeur : assez pour les gaffes, pas pour juger une position fine. La précision affichée n'est pas celle de chess.com.
- Trois mois d'archives au plus ; un joueur très actif (plus de 20 parties entre deux visites) relance l'analyse pour les suivantes.
- Les données ne suivent pas le joueur d'un appareil à l'autre.
