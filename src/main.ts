import "@fontsource/press-start-2p/400.css";
import "./style.css";
import { GameApp } from "./ui/app.ts";

/** Stockage du navigateur ; peut être refusé (navigation privée stricte) : le jeu marche alors sans sauvegarde. */
function browserStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const memory = new Map<string, string>();
const fallbackStore = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};

new GameApp(browserStore() ?? fallbackStore).start();
