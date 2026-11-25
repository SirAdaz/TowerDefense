# Logiciels tiers

Ce dépôt ne contient le code d'aucun de ces logiciels : ils sont installés par npm. Le site construit, lui, en distribue une partie ; cette page dit laquelle et sous quelle licence.

| Logiciel | Version | Licence | Ce que le site distribue |
| --- | --- | --- | --- |
| [Stockfish.js](https://github.com/nmrugg/stockfish.js) (moteur [Stockfish](https://github.com/official-stockfish/Stockfish)) | 19.0.1 | GPL-3.0 | `stockfish-19-lite-single.js` et `.wasm`, tels quels, servis comme fichiers séparés et exécutés dans un Web Worker (page Échecs) |
| [chess.js](https://github.com/jhlywa/chess.js) | 1.4.0 | BSD-2-Clause | Inclus dans le JavaScript de la page Échecs |
| [IBM Plex Mono](https://github.com/IBM/plex) via `@fontsource/ibm-plex-mono` | 5.3.0 | OFL-1.1 | Fichiers de police du tower defense |

## Stockfish (GPL-3.0)

- Le site sert le texte de la licence (`/licences/GPL-3.0.txt`) et une page de mentions (`/licences/echecs.txt`, source : `public/licences/`) qui donne l'adresse du code source correspondant : <https://github.com/nmrugg/stockfish.js/tree/v19.0.1>. La page Échecs y renvoie depuis son pied de page.
- Les deux fichiers du moteur ne sont ni modifiés ni fusionnés avec le code de la page : la page lance le moteur dans un Web Worker et lui parle en texte (protocole UCI). Mettre à jour le paquet `stockfish` demande de mettre à jour la version et le lien ci-dessus et dans `public/licences/echecs.txt`.
- Le code de ce dépôt n'a pas de licence déclarée à ce jour ; ces mentions ne couvrent que les logiciels tiers.
