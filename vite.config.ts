import { defineConfig } from "vite";

// Site statique : `base: "./"` garde des chemins relatifs, le jeu marche servi depuis n'importe quel dossier.
export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5180, strictPort: true },
  preview: { host: "0.0.0.0", port: 5180, strictPort: true },
  // assetsInlineLimit 0 : la police reste un fichier (la CSP de prod refuse les polices en data:).
  build: { target: "es2022", sourcemap: false, assetsInlineLimit: 0 },
});
