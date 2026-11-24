import type { KeyValueStore } from "../game/save.ts";

/** Stockage en mémoire : la partie vit le temps de l'onglet, rien n'est gardé ensuite. */
function memoryStore(): KeyValueStore {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

/**
 * `localStorage` du navigateur, ou un stockage en mémoire quand il est interdit (certains modes
 * privés lèvent une erreur dès l'accès) : le jeu reste jouable, sans sauvegarde ni record.
 */
export function browserStore(): KeyValueStore {
  try {
    return window.localStorage;
  } catch {
    return memoryStore();
  }
}
