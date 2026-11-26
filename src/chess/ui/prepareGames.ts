import { requireElement, setText } from "../../shared/dom.ts";
import { isAbortError } from "../data/chesscomApi.ts";
import type { Engine } from "../data/engine.ts";
import { rebuildTimeline } from "../data/gameTimeline.ts";
import type { ChessStore } from "../data/store.ts";
import type { AnalysedGame } from "../game/types.ts";
import { pluralize } from "./format.ts";

export interface PrepareOptions {
  /** Préfixe des identifiants du bloc (`convert-prepare`…). */
  readonly prefix: string;
  readonly store: ChessStore;
  readonly startEngine: () => Promise<Engine>;
  /** Une partie a retrouvé ses positions : les exercices se relisent. */
  readonly onGameReady: () => void;
}

export interface PrepareControl {
  /** Parties analysées avant la revue dont des positions manquent ; le bloc se cache s'il n'y en a aucune. */
  setGames(games: readonly AnalysedGame[]): void;
}

interface Elements {
  readonly block: HTMLElement;
  readonly text: HTMLElement;
  readonly start: HTMLButtonElement;
  readonly progress: HTMLElement;
  readonly progressBar: HTMLProgressElement;
  readonly label: HTMLElement;
  readonly cancel: HTMLButtonElement;
  readonly status: HTMLElement;
}

interface Preparer {
  readonly options: PrepareOptions;
  readonly elements: Elements;
  games: readonly AnalysedGame[];
  abortController: AbortController | null;
}

function collectElements(prefix: string): Elements {
  return {
    block: requireElement(prefix, HTMLElement),
    text: requireElement(`${prefix}-text`, HTMLElement),
    start: requireElement(`${prefix}-start`, HTMLButtonElement),
    progress: requireElement(`${prefix}-progress`, HTMLElement),
    progressBar: requireElement(`${prefix}-bar`, HTMLProgressElement),
    label: requireElement(`${prefix}-label`, HTMLElement),
    cancel: requireElement(`${prefix}-cancel`, HTMLButtonElement),
    status: requireElement(`${prefix}-status`, HTMLElement),
  };
}

function render(preparer: Preparer): void {
  const { elements, games, abortController } = preparer;
  const isRunning = abortController !== null;
  elements.block.hidden = games.length === 0 && !isRunning && elements.status.textContent === "";
  elements.start.disabled = isRunning || games.length === 0;
  elements.progress.hidden = !isRunning;
  setText(
    elements.text,
    games.length === 0
      ? ""
      : `${pluralize(games.length, "partie analysée", "parties analysées")} avant la revue coup par coup : ${games.length === 1 ? "ses" : "leurs"} positions sont à relire sur chess.com puis à réévaluer (une minute environ par partie).`,
  );
}

/** Relit les parties une à une ; une partie introuvable est sautée, une annulation garde celles déjà faites. */
async function prepareAll(preparer: Preparer, signal: AbortSignal): Promise<string> {
  const queue = [...preparer.games];
  let doneCount = 0;
  let skippedCount = 0;
  for (const [index, game] of queue.entries()) {
    setText(preparer.elements.label, `Relecture : partie ${index + 1} sur ${queue.length}`);
    try {
      await rebuildTimeline(game, {
        store: preparer.options.store,
        startEngine: preparer.options.startEngine,
        signal,
        onProgress: (done, total) => {
          preparer.elements.progressBar.value = (index + done / total) / queue.length;
        },
      });
      doneCount += 1;
      preparer.options.onGameReady();
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      skippedCount += 1;
    }
  }
  const skipped = skippedCount === 0 ? "" : ` ${pluralize(skippedCount, "partie introuvable", "parties introuvables")}.`;
  return `${pluralize(doneCount, "partie relue", "parties relues")}.${skipped}`;
}

async function run(preparer: Preparer): Promise<void> {
  if (preparer.abortController !== null) {
    return;
  }
  const abortController = new AbortController();
  preparer.abortController = abortController;
  setText(preparer.elements.status, "");
  render(preparer);
  try {
    setText(preparer.elements.status, await prepareAll(preparer, abortController.signal));
  } catch (error) {
    setText(preparer.elements.status, isAbortError(error) ? "Relecture annulée : les parties déjà relues sont gardées." : "La relecture a échoué. Réessayez plus tard.");
  } finally {
    preparer.abortController = null;
    render(preparer);
    preparer.options.onGameReady();
  }
}

/** Bloc « relire ces parties » : retrouve les positions des parties analysées avant la revue. */
export function createPrepareControl(options: PrepareOptions): PrepareControl {
  const preparer: Preparer = { options, elements: collectElements(options.prefix), games: [], abortController: null };
  preparer.elements.start.addEventListener("click", () => {
    void run(preparer);
  });
  preparer.elements.cancel.addEventListener("click", () => {
    preparer.abortController?.abort();
  });
  return {
    setGames: (games) => {
      preparer.games = games;
      render(preparer);
    },
  };
}
