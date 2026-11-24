# Architecture

Site statique : `index.html` + un bundle Vite (TypeScript) + la police. Aucun serveur applicatif, aucune base, aucun appel réseau à l'exécution.

## Découpage

| Dossier       | Rôle                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game/`   | Logique pure : grille et chemin, vagues, ennemis, tirs, économie, améliorations, sauvegarde. Ni DOM, ni horloge, ni hasard. Testée par Vitest (seuils de couverture). |
| `src/render/` | Dessin sur le `<canvas>` (style « Pixel douillet ») à partir de l'état. Ne modifie jamais l'état.                                                            |
| `src/ui/`     | Bandeau et panneau en HTML/CSS (vrais boutons, clavier, focus visible), souris et clavier sur la carte, boucle de jeu.                                     |
| `tests/`      | Joueur automatique (`bot.ts`) et règles d'équilibrage ; `scripts/simulate.ts` affiche la courbe de difficulté.                                              |

## Boucle de jeu

- Simulation à **pas fixe** : 60 pas par seconde de jeu (`STEP_SECONDS`), accumulateur alimenté par `requestAnimationFrame`, écart borné à 0,25 s (un onglet qui se réveille ne fait pas un bond).
- ×2 = deux pas par pas d'horloge. Pause = aucun pas.
- Le rendu dessine l'état courant à chaque image, indépendamment du nombre de pas.
- Les fonctions de `src/game/` ne modifient que l'état qu'on leur passe : même suite d'actions = même partie (c'est ce qui rend l'équilibrage testable).

## Données locales

`localStorage`, deux clés :
- `tower-defense.save.v1` : partie en cours, écrite seulement entre deux vagues (voir SPECS) ; validée à la lecture, ignorée si incohérente.
- `tower-defense.record.v1` : meilleure vague atteinte.

Toute erreur du stockage (navigation privée, quota) est absorbée : le jeu marche sans sauvegarde.

## Rendu

Canvas dimensionné sur sa taille affichée × `devicePixelRatio`. Le dessin se fait dans un repère où une case mesure 56 unités (unité fixe, indépendante de la taille d'affichage), mis à l'échelle par `setTransform` : la carte reste nette de 1024 à 1920 px.

## Exécution

- Dev : `docker compose up -d --build` → Vite sur http://localhost:5180.
- Build de prod : image `prod` (nginx 1.30.4, en-têtes de sécurité, CSP `default-src 'self'`) → http://localhost:5181 avec `--profile prod`.
