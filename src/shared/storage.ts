/** Stockage clé-valeur minimal : `localStorage` dans le navigateur, une `Map` dans les tests. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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
 * privés lèvent une erreur dès l'accès) : les jeux restent jouables, sans sauvegarde ni record.
 */
export function browserStore(): KeyValueStore {
  try {
    return window.localStorage;
  } catch {
    return memoryStore();
  }
}
