# Logiciels tiers

Ce dépôt ne contient le code d'aucun de ces logiciels : ils sont installés par npm. Seule exception : les sons de la page Échecs, copiés dans `public/`. Le site construit, lui, en distribue une partie ; cette page dit laquelle et sous quelle licence.

| Logiciel | Version | Licence | Ce que le site distribue |
| --- | --- | --- | --- |
| [Stockfish.js](https://github.com/nmrugg/stockfish.js) (moteur [Stockfish](https://github.com/official-stockfish/Stockfish)) | 19.0.1 | GPL-3.0 | `stockfish-19-lite-single.js` et `.wasm`, tels quels, servis comme fichiers séparés et exécutés dans un Web Worker (page Échecs) |
| [chess.js](https://github.com/jhlywa/chess.js) | 1.4.0 | BSD-2-Clause | Inclus dans le JavaScript de la page Échecs |
| Sons « Impact Sounds » et « Interface Sounds » de [Kenney](https://kenney.nl/assets/impact-sounds) | 1.0 | CC0-1.0 | 7 fichiers mp3 de `public/sons/echecs/` (page Échecs) |
| [IBM Plex Mono](https://github.com/IBM/plex) via `@fontsource/ibm-plex-mono` | 5.3.0 | OFL-1.1 | Fichiers de police du tower defense |

## Stockfish (GPL-3.0)

- Le site sert le texte de la licence (`/licences/GPL-3.0.txt`) et une page de mentions (`/licences/echecs.txt`, source : `public/licences/`) qui donne l'adresse du code source correspondant : <https://github.com/nmrugg/stockfish.js/tree/v19.0.1>. La page Échecs y renvoie depuis son pied de page.
- Les deux fichiers du moteur ne sont ni modifiés ni fusionnés avec le code de la page : la page lance le moteur dans un Web Worker et lui parle en texte (protocole UCI). Mettre à jour le paquet `stockfish` demande de mettre à jour la version et le lien ci-dessus et dans `public/licences/echecs.txt`.
- Le code de ce dépôt n'a pas de licence déclarée à ce jour ; ces mentions ne couvrent que les logiciels tiers.

## Sons de la page Échecs (CC0)

- Source : packs « Impact Sounds » (<https://kenney.nl/assets/impact-sounds>) et « Interface Sounds » (<https://kenney.nl/assets/interface-sounds>) de Kenney, licence Creative Commons Zero (<https://creativecommons.org/publicdomain/zero/1.0/>) : domaine public, sans obligation de mention.
- Fichiers d'origine : `impactWood_light_002` (déplacement), `impactWood_heavy_000` (prise), `impactPlank_medium_001` (échec, raccourci), `impactWood_light_000` + `impactWood_light_003` (roque, les deux à 110 ms d'écart), `maximize_001` (promotion), `error_006` (erreur), `confirmation_001` (réussite).
- Transformation : silence de tête retiré, volumes harmonisés, mono 44,1 kHz, mp3 64 kb/s (ffmpeg). Aucun son de Chess.com n'est utilisé.
