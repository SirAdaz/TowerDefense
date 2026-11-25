import type { KeyValueStore } from "../shared/storage.ts";
import { readRecord } from "../tower-defense/game/save.ts";

/** Record personnel d'un jeu, tel qu'il s'affiche sur sa carte de l'accueil. */
export interface GameRecord {
  /** Identifiant de la carte : attribut `data-record` dans `index.html`. */
  readonly gameId: string;
  /** Texte du record, ou `null` tant que le joueur n'en a pas (la ligne reste alors cachée). */
  readonly describe: (store: KeyValueStore) => string | null;
}

function describeTowerDefense(store: KeyValueStore): string | null {
  const bestWave = readRecord(store);
  return bestWave > 0 ? `Record : vague ${bestWave}` : null;
}

/** Un lecteur par jeu : l'accueil lit les records là où chaque jeu les écrit, sans les recopier. */
export const GAME_RECORDS: readonly GameRecord[] = [{ gameId: "tower-defense", describe: describeTowerDefense }];
