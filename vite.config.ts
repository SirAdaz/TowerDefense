import { defineConfig } from "vite";

/** Une page par dossier (chemins relatifs à la racine du projet) : l'accueil à la racine, chaque jeu dans le sien. */
const PAGES = {
  home: "index.html",
  towerDefense: "tower-defense/index.html",
  nuitBlanche: "nuit-blanche/index.html",
  echecs: "echecs/index.html",
};

// Site statique à plusieurs pages, servi à la racine du domaine : `base: "/"` garde des chemins d'assets valables
// depuis n'importe quel dossier. `appType: "mpa"` : une adresse inconnue donne une 404, pas l'accueil.
export default defineConfig({
  base: "/",
  appType: "mpa",
  server: { host: "0.0.0.0", port: 5180, strictPort: true },
  preview: { host: "0.0.0.0", port: 5180, strictPort: true },
  // assetsInlineLimit 0 : la police reste un fichier (la CSP de prod refuse les polices en data:).
  build: { target: "es2022", sourcemap: false, assetsInlineLimit: 0, rollupOptions: { input: PAGES } },
});
