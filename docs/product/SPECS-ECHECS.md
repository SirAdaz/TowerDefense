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

## Retour sur le plateau

- Mauvais coup : il reste 0,7 s sur le plateau, cases de départ et d'arrivée en rouge avec une croix, le plateau tremble (sauf `prefers-reduced-motion`), son d'erreur, puis la pièce revient. Le message est relu aux lecteurs d'écran même s'il se répète.
- Bon coup : case d'arrivée en vert avec une coche, son du coup puis son de réussite. Si le moteur préférait un autre coup, il est dessiné en flèche.
- Indice : la case de la pièce à jouer est entourée et le reste jusqu'à la fin du problème. Solution : le coup est joué et dessiné en flèche verte. Le texte à droite ne fait que compléter.
- Flèches (`arrow.ts`) : forme pleine de 7 points, contour sombre ; verte pour le meilleur coup, rouge en pointillés pour le coup de la partie.

## Sons (`sounds.ts`)

- Un son par coup : échec (mat compris), sinon promotion, roque, prise (en passant comprise), déplacement. Plus l'erreur et la réussite d'un problème.
- Fichiers mp3 de 3 à 5 Ko dans `public/sons/echecs/`, tirés des packs Kenney (CC0, voir `THIRD-PARTY-NOTICES.md`). Aucun son synthétisé.
- Rien ne joue à l'ouverture de la page : seulement après un coup ou un bouton. Bouton « Couper le son », choix gardé dans `echecs.sound.v1`.

## Explorer après un problème (`explore.ts`)

- Une fois le problème réussi ou la solution montrée : « Continuer à jouer » (le moteur répond pour l'adversaire), « Voir la suite » (la meilleure suite gardée avec le problème), « Rejouer votre coup » (le coup de la partie puis la réfutation du moteur, 8 demi-coups au plus), « Revenir à la position du problème ».
- Navigation coup par coup : boutons ou flèches gauche/droite (Début/Fin) hors du plateau. Jouer un coup au milieu d'une suite la coupe et explore une autre branche.
- Moteur : un Web Worker Stockfish lancé au premier besoin et gardé, recherche courte (profondeur 14 ou 0,4 s, `EXPLORE_SEARCH`). Évaluation affichée du côté du joueur (« +1,3, avantage pour vous » ; égalité sous 0,3 pion), barre des chances de gain, flèche de son meilleur coup quand la suite est au bout.
- Rien de ce qui est joué ici ne change la révision espacée : le résultat est gardé à la fin du problème.

## Révision espacée (`schedule.ts`, commune à tous les exercices)

| Résultat | Effet |
| -------- | ----- |
| Raté (mauvais coup, ou solution demandée) | revient le lendemain |
| Réussi | délai suivant : 3, 7, 21 puis 60 jours |
| Réussi avec l'indice | même délai qu'avant, sans progrès (lendemain pour un nouveau problème) |

- Un problème réussi à la première vue revient dans 3 jours.
- L'échéance est avancée de 8 heures (`DUE_SLACK_MS`) : « demain » marche dès le matin.
- Ordre d'une séance : révisions échues (la plus en retard d'abord), puis nouveaux problèmes, des parties les plus récentes aux plus anciennes.

## Convertir un avantage (`conversion.ts`, `opponent.ts`)

- Positions : chaque gaffe du joueur (voir Analyse) faite alors qu'il valait au moins +1,5 pion (`WINNING_CP`), position d'avant la gaffe. Elle vient du PGN gardé pour la revue, sinon du problème de la même gaffe ; à défaut, la partie est signalée « à relire » (bouton : relecture dans l'archive chess.com puis réévaluation, comme pour la revue).
- Le joueur joue la position contre le moteur. Après chaque coup du joueur, le moteur juge la position à pleine force (recherche de l'exploration), puis l'adversaire répond à son niveau.

| Fin | Règle | Résultat |
| --- | ----- | -------- |
| Mat donné | | réussi |
| Abandon du moteur | +10 pions ou plus sans mat annoncé (`RESIGN_CP`) | réussi |
| Avantage tenu | après 10 coups du joueur (`CONVERSION_MOVES`), encore +1,5 ou mieux | réussi |
| Avantage perdu | sous +1 pion après un coup du joueur (`LOST_ADVANTAGE_CP`) | raté (coup fautif en flèche rouge, meilleur coup en vert) |
| Pas assez | après 10 coups, entre +1 et +1,5 | raté |
| Nulle, maté, abandon du joueur | | raté |

- Un mat annoncé ne fait pas abandonner le moteur : le joueur va au bout. Nulle par répétition comptée (coups rejoués depuis le départ).
- Indice : le meilleur coup en flèche ; une réussite avec l'indice compte comme « réussi avec l'indice » (révision espacée ci-dessous).
- Niveaux de l'adversaire (`OPPONENT_LEVELS`, choix gardé dans `echecs.opponentLevel.v1`) : le moteur cherche peu profond, regarde plusieurs coups et n'en joue pas toujours le meilleur (tiré au hasard parmi ceux qui ne perdent pas plus d'un seuil). Réflexion 0,4 s.

| Niveau | Profondeur | Variantes | Meilleur coup joué | Perte tolérée sinon |
| ------ | ---------- | --------- | ------------------ | ------------------- |
| Débutant | 4 | 5 | 30 % | 4 pions |
| Facile (défaut, pour un joueur 600-800) | 6 | 4 | 50 % | 2 pions |
| Moyen | 8 | 3 | 70 % | 0,8 pion |
| Fort | 14 | 1 | toujours | — |

- Ces forces ne sont pas étalonnées en Elo : « Facile » est un choix de départ, à ajuster selon le ressenti.
- Explorer après l'exercice : « Rejouer votre coup de la partie » (gaffe et réfutation) et « Rejouer depuis le départ ».

## Voir la menace (`threats.ts`, `defense.ts`)

- Positions : chaque gaffe du joueur, position d'avant la gaffe, à condition qu'elle ait laissé passer une menace concrète déjà présente. On prend le coup qui l'a punie (meilleur coup du moteur après la gaffe, gardé pour la revue) et on le rejoue dans la position d'avant, le joueur « passant » son tour : il doit y être légal et être soit un mat, soit une prise gagnante (pièce prise non défendue, ou qui vaut plus que celle qui prend ; valeurs 1/3/3/5/9). Une menace créée par la gaffe elle-même (pièce déplacée en prise) ne compte pas ; joueur en échec : pas de problème.
- Il faut le PGN et les meilleurs coups gardés pour la revue : les parties analysées avant sont signalées « à relire ».
- Étape 1, « Que menace l'adversaire ? » : désigner (clic, doigt, ou flèches puis Entrée) la pièce qui menace ou la case menacée. Une mauvaise case compte comme raté mais on peut continuer ; « Voir la menace » la montre (raté).
- Étape 2, la parade : le coup de la partie est refusé, le meilleur coup du moteur accepté ; tout autre coup est évalué par le moteur (recherche de l'exploration) et accepté s'il n'est ni une erreur ni une gaffe par rapport à l'évaluation d'avant la gaffe (barème de l'Analyse). Un mat donné est accepté. Refusé : il reste 0,7 s en rouge puis la pièce revient. « Voir une parade » joue le coup du moteur (raté).
- Réussi sans faute ni aide : délai suivant de la révision espacée ; sinon, raté.

## Thèmes tactiques (`themes.ts`, `tactics.ts`)

- Chaque problème reçoit un thème, lu sur sa suite gardée (meilleur coup puis réponses, 6 demi-coups au plus), dans cet ordre ; le premier qui colle gagne :

| Thème | Détection |
| ----- | --------- |
| Mat en 1 | le meilleur coup mate |
| Mat en 2 | le deuxième coup du joueur mate |
| Pièce en prise | le premier coup prend une pièce (cavalier ou plus) non défendue, ou qui vaut plus que celle qui prend |
| Fourchette | la pièce jouée attaque au moins deux pièces de valeur (roi, pièce qui vaut plus qu'elle, ou pièce non défendue d'au moins un cavalier), et le joueur en prend une ensuite |
| Attaque à la découverte | le premier coup démasque une pièce à longue portée sur le roi, ou sur une pièce d'au moins un cavalier prise ensuite |
| Clouage | après le premier coup, une pièce adverse est clouée (devant le roi ou une pièce qui vaut plus), clouage créé par ce coup ou pièce clouée attaquée par lui, et le joueur la prend ensuite |
| Enfilade | la pièce jouée attaque, sur une ligne, le roi ou une pièce plus précieuse que celle de derrière, et le joueur prend celle de derrière ensuite |
| Autre | tout le reste |

- Sauf les mats, un thème n'est donné que si la suite gagne au moins 2 pions de matériel (`MIN_THEME_GAIN`, valeurs 1/3/3/5/9). Une défense, un coup calme, une promotion ou un motif non reconnu restent « Autre » : mieux vaut « Autre » qu'un thème faux.
- Surcharge (pièce qui défend deux choses) : non détectée, trop d'erreurs possibles avec une suite de 6 demi-coups.
- Bilan sous l'entraîneur : les thèmes du plus raté (nombre de problèmes, donc d'occasions ratées en partie) au moins raté, à égalité le moins réussi d'abord, « Autre » à la fin ; réussite à l'entraînement = réussites sur tentatives.
- « S'entraîner » sur un thème : la séance ne garde que ses problèmes, ceux dus d'abord puis les autres, du plus proche de son échéance au plus lointain (on peut s'entraîner à tout moment ; les résultats comptent pour la révision). Le thème est dit dans la correction, jamais avant.

## Stockage

- IndexedDB `echecs`, version 2 : parties, problèmes, et états de révision des exercices (`drills`, un état par exercice ; l'exercice lui-même se reconstruit à partir des parties). La montée depuis la version 1 ne fait qu'ajouter la table : parties et problèmes restent.

## Bilan par cadence (`report.ts`)

- Un bilan par cadence (bullet, blitz, rapide), jamais additionnés. La cadence la plus jouée s'ouvre d'abord.
- Précision moyenne : moyenne des précisions des parties. Gaffes et erreurs : nombre moyen par partie.
- Ouvertures : nom de famille tiré de l'adresse `ECOUrl` du PGN (« Sicilian Defense », gardé en anglais), les 6 plus jouées (`MAX_OPENINGS`) avec leur part de victoires, « peu de parties » sous 5 parties (`SMALL_SAMPLE_GAMES`).
- Pour chaque ouverture (`openingGuide.ts`) : les premiers coups en notation française, pris dans la partie la plus récente qui a gardé son PGN et coupés au dernier coup de la variante lu dans l'adresse ECO (16 demi-coups au plus) ; sinon les coups de base de la table. Une phrase d'explication pour une quarantaine de familles fréquentes ; inconnue : les coups seuls. Bouton « Voir la position » : mini-échiquier de la position d'arrivée.
- Défaites par phase où la partie a basculé (voir Analyse).
- Fin de pendule : gaffes et erreurs pour 100 coups joués avec moins de 10 secondes (`LOW_CLOCK_SECONDS`, pendule notée après le coup), comparées au reste des coups.
- Les parties sans coup évalué (illisibles, trop courtes) ne comptent pas.

## Revue de partie (`gameReview.ts`, `moveClass.ts`)

- Données : à l'analyse, chaque partie garde son PGN, l'évaluation de chaque position et le meilleur coup du moteur (passe rapide, `GameTimeline`, quelques Ko par partie). Une partie analysée avant la revue est relue dans l'archive de son mois sur chess.com et réévaluée à l'ouverture (barre de progression, annulable), puis gardée.
- Avis sur chaque coup des deux camps, selon les chances de gain perdues par le camp qui joue (points de 0 à 100, formule ci-dessus) :

| Avis | Règle |
| ---- | ----- |
| Brillant | sacrifice (pièce laissée en prise contre moins qu'elle, au moins 2 pions de matériel), perte < 2 points, chances avant ≤ 90 % et après ≥ 50 % |
| Occasion manquée | l'adversaire venait de perdre ≥ 10 points, le coup en perd ≥ 10 sans tomber sous 35 % |
| Meilleur | le coup du moteur |
| Excellent / Bon / Imprécision / Erreur / Gaffe | perte < 2 / < 5 / < 10 / < 20 / ≥ 20 points |

- Pas de « coup théorique » : sans livre d'ouvertures, on ne le détecte pas proprement.
- Précision de chaque joueur : moyenne de la précision de ses coups (même formule que le bilan).
- Icônes maison : forme, signe d'annotation (!!, !, ?!, ?, ??) et couleur propres à chaque avis, libellé en toutes lettres pour les lecteurs d'écran. Sur le plateau, en coin de la case d'arrivée ; flèche verte du coup du moteur quand le coup joué ne l'était pas.
- Barre d'évaluation verticale (part du joueur en bas), courbe des chances des blancs cliquable, navigation boutons et flèches du clavier, sons des coups. Jouer sur le plateau ou « Explorer depuis ce coup » ouvre l'exploration (moteur, évaluation, flèche).
- Temps par coup (`[%clk]` du PGN et cadence `TimeControl`) : pendule d'avant moins pendule d'après, plus l'incrément (sauf au premier coup de chaque camp). Zeitnot : moins de 10 s à la pendule (`ZEITNOT_SECONDS`) ; coup long : au moins 1/15 du temps de départ et 3 s (`LONG_THINK_SHARE`). Liste des coups, graphique sous la courbe et résumé écrit ; sans pendule, la page le dit.

## Limites connues

- Moteur allégé à faible profondeur : assez pour les gaffes, pas pour juger une position fine. La précision affichée n'est pas celle de chess.com.
- Trois mois d'archives au plus ; un joueur très actif (plus de 20 parties entre deux visites) relance l'analyse pour les suivantes.
- Les données ne suivent pas le joueur d'un appareil à l'autre.
