import type { App } from "./app.ts";

/**
 * Outils de test, branchés seulement par le serveur de développement (`import.meta.env.DEV` dans
 * `main.ts`) : lire l'état et accélérer le temps pour jouer une nuit entière en une minute. Le build
 * de production ne contient pas ce module.
 */
export function exposeDevTools(app: App): void {
  Object.assign(window, { nuitBlancheTest: app });
}
