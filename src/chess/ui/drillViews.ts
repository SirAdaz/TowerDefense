import type { KeyValueStore } from "../../shared/storage.ts";
import type { Engine } from "../data/engine.ts";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import type { ChessStore } from "../data/store.ts";
import { selectConversionDrills } from "../game/conversion.ts";
import { selectDefenseDrills } from "../game/defense.ts";
import { selectRepertoire } from "../game/repertoire.ts";
import type { AnalysedGame, DrillReview, Puzzle } from "../game/types.ts";
import { createConvertView } from "./convertView.ts";
import { createDefendView } from "./defendView.ts";
import { createPrepareControl } from "./prepareGames.ts";
import { createRepertoireView } from "./repertoireView.ts";
import type { SoundPlayer } from "./sound.ts";

export interface DrillViewsOptions {
  readonly store: ChessStore;
  readonly keyValueStore: KeyValueStore;
  readonly sound: SoundPlayer;
  readonly engine: ExploreEngine;
  readonly startEngine: () => Promise<Engine>;
  /** Un résultat est gardé ou une partie relue : la page relit ses données. */
  readonly onChange: () => void;
}

export interface DrillViews {
  /** Reconstruit les exercices (avantage à convertir, menace à voir, répertoire) à partir des données du joueur. */
  setData(games: readonly AnalysedGame[], puzzles: readonly Puzzle[], reviews: readonly DrillReview[]): void;
}

/** Les entraîneurs tirés des parties autres que les problèmes, avec leur bloc « relire ces parties ». */
export function createDrillViews(options: DrillViewsOptions): DrillViews {
  const { store, sound, engine } = options;
  const onReviewed = (drillReview: DrillReview) => {
    void store.saveDrillReview(drillReview).then(options.onChange);
  };
  const now = () => Date.now();
  const prepare = (prefix: string) =>
    createPrepareControl({ prefix, store, startEngine: options.startEngine, onGameReady: options.onChange });
  const convertView = createConvertView({ now, random: () => Math.random(), sound, engine, keyValueStore: options.keyValueStore, onReviewed });
  const convertPrepare = prepare("convert-prepare");
  const defendView = createDefendView({ now, sound, engine, onReviewed });
  const defendPrepare = prepare("defend-prepare");
  const repertoireView = createRepertoireView({ now, sound, engine, onReviewed });
  const repertoirePrepare = prepare("repertoire-prepare");
  return {
    setData: (games, puzzles, reviews) => {
      const conversion = selectConversionDrills(games, puzzles, reviews);
      convertView.setDrills(conversion.drills, games.length > 0);
      convertPrepare.setGames(conversion.gamesToPrepare);
      const defense = selectDefenseDrills(games, reviews);
      defendView.setDrills(defense.drills, games.length > 0);
      defendPrepare.setGames(defense.gamesToPrepare);
      const repertoire = selectRepertoire(games, reviews);
      repertoireView.setData(repertoire.routes, repertoire.drills, games.length > 0);
      repertoirePrepare.setGames(repertoire.gamesToPrepare);
    },
  };
}
