# Jeux

Quelques petits jeux dans le navigateur, à lancer en un clic : solo, hors ligne, sans compte. Une page d'accueil liste les jeux et affiche le record de chacun.

| Jeu           | Adresse           | En une phrase                                                                             |
| ------------- | ----------------- | ----------------------------------------------------------------------------------------- |
| Tower defense | `/tower-defense/` | Un chemin, une seule tourelle à améliorer (dégâts, portée, cadence), des vagues sans fin. |
| Nuit blanche  | `/nuit-blanche/`  | Survie à vagues : une luciole qui suit la souris et tire seule, dix minutes à tenir.      |
| Échecs        | `/echecs/`        | Vos parties chess.com analysées dans le navigateur : chaque gaffe devient un problème.    |

## Lancer

```bash
docker compose up -d --build      # Vite (rechargement à chaud) sur http://localhost:5180
docker compose exec app npm run ci # lint, types, tests, build
docker compose exec app npm run simulate # tower defense : courbe de difficulté jouée par le joueur automatique
docker compose exec app npm run simulate:survival # Nuit blanche : nuits jouées par le joueur automatique
docker compose down
```

Build de production servi par nginx : `docker compose --profile prod up -d --build web` puis http://localhost:5181.

Rien ne s'installe sur la machine : Node et les dépendances sont dans l'image.

## Jouer au tower defense

Cliquez une case libre pour poser une tourelle, cliquez une tourelle pour monter ses jauges ou la vendre, puis lancez la vague. Au clavier : Tab jusqu'à la carte, flèches pour changer de case, Entrée pour poser ou sélectionner, P pour la pause, Échap pour désélectionner.

## Jouer à Nuit blanche

La luciole suit la souris et tire toute seule. Ramassez les éclats laissés par les ombres : à chaque niveau, choisissez une amélioration parmi trois (clic, ou touches 1, 2, 3). À 10:00 le boss arrive ; le battre gagne la nuit. Échap ou P : pause. Les pièces gagnées à chaque partie débloquent, au menu, de nouvelles cartes pour le tirage.

## S'entraîner aux échecs

Donnez votre pseudo chess.com : la page lit vos dernières parties (bullet, blitz, rapide) sur l'API publique du site et les analyse sur votre appareil avec Stockfish. Chaque gaffe devient un problème : trouvez le meilleur coup en glissant la pièce, ou en cliquant la pièce puis sa case. Un problème raté revient le lendemain, un problème réussi dans 3, 7, 21 puis 60 jours. Un bilan par cadence (bullet, blitz, rapide) donne la précision, les gaffes par partie, les ouvertures, la phase où les parties se perdent et les erreurs en fin de pendule. Le pseudo, les analyses et la progression restent dans le navigateur.

Logiciels tiers et licences (Stockfish est sous GPL-3.0) : [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Documentation

- [docs/README.md](docs/README.md) : index et état des phases.
- [docs/product/SPECS.md](docs/product/SPECS.md) : règles et chiffres d'équilibrage du tower defense.
- [docs/product/SPECS-NUIT-BLANCHE.md](docs/product/SPECS-NUIT-BLANCHE.md) : règles et chiffres de Nuit blanche.
- [docs/product/SPECS-ECHECS.md](docs/product/SPECS-ECHECS.md) : seuils de gaffe, révision espacée et limites de la page Échecs.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : pages, découpage logique / rendu / interface.
- [docs/DECISIONS.md](docs/DECISIONS.md) : décisions datées (dont l'exception de stack).
