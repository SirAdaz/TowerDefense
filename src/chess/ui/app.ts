import { requireElement, setText } from "../../shared/dom.ts";
import type { KeyValueStore } from "../../shared/storage.ts";
import { analyseGames } from "../data/analyser.ts";
import type { AnalysisProgress } from "../data/analyser.ts";
import { ChessComError, fetchGamesToAnalyse, isAbortError } from "../data/chesscomApi.ts";
import { startEngine } from "../data/engine.ts";
import type { ChessStore } from "../data/store.ts";
import { normalizeUsername } from "../game/chesscom.ts";
import { countSolved, forgetUsername, loadUsername, saveSolvedCount, saveUsername } from "../game/summary.ts";
import { describeRemaining, pluralize } from "./format.ts";
import { createPuzzleView } from "./puzzleView.ts";
import type { PuzzleView } from "./puzzleView.ts";
import { createReportView } from "./reportView.ts";
import type { ReportView } from "./reportView.ts";
import { FAILURE_MESSAGES, TEXTS } from "./texts.ts";

interface Elements {
  readonly form: HTMLFormElement;
  readonly input: HTMLInputElement;
  readonly inputError: HTMLElement;
  readonly account: HTMLElement;
  readonly accountName: HTMLElement;
  readonly sync: HTMLButtonElement;
  readonly forget: HTMLButtonElement;
  readonly progress: HTMLElement;
  readonly progressBar: HTMLProgressElement;
  readonly progressLabel: HTMLElement;
  readonly cancel: HTMLButtonElement;
  readonly status: HTMLElement;
}

interface App {
  readonly elements: Elements;
  readonly keyValueStore: KeyValueStore;
  readonly store: ChessStore;
  readonly puzzleView: PuzzleView;
  readonly reportView: ReportView;
  username: string | null;
  /** Présent pendant une analyse : sert à l'annuler, et à refuser d'en lancer deux. */
  abortController: AbortController | null;
}

function collectElements(): Elements {
  return {
    form: requireElement("username-form", HTMLFormElement),
    input: requireElement("username", HTMLInputElement),
    inputError: requireElement("username-error", HTMLElement),
    account: requireElement("account", HTMLElement),
    accountName: requireElement("account-username", HTMLElement),
    sync: requireElement("sync", HTMLButtonElement),
    forget: requireElement("forget", HTMLButtonElement),
    progress: requireElement("progress", HTMLElement),
    progressBar: requireElement("progress-bar", HTMLProgressElement),
    progressLabel: requireElement("progress-label", HTMLElement),
    cancel: requireElement("cancel", HTMLButtonElement),
    status: requireElement("status", HTMLElement),
  };
}

function renderAccount(app: App): void {
  const { elements, username } = app;
  elements.form.hidden = username !== null;
  elements.account.hidden = username === null;
  setText(elements.accountName, username ?? "");
}

/** Relit les données du joueur et met à jour l'entraîneur, le bilan et le compteur lu par l'accueil. */
async function refreshPuzzles(app: App): Promise<void> {
  const puzzles = app.username === null ? [] : await app.store.listPuzzles(app.username);
  app.puzzleView.setPuzzles(puzzles);
  app.reportView.setGames(app.username === null ? [] : await app.store.listGames(app.username));
  if (app.username !== null) {
    saveSolvedCount(app.keyValueStore, countSolved(puzzles));
  }
}

function setBusy(app: App, isBusy: boolean): void {
  app.elements.progress.hidden = !isBusy;
  app.elements.sync.disabled = isBusy;
  app.elements.forget.disabled = isBusy;
}

function describeFailure(error: unknown): string {
  if (isAbortError(error)) {
    return TEXTS.cancelled;
  }
  if (error instanceof ChessComError) {
    return FAILURE_MESSAGES[error.reason];
  }
  console.error("Analyse interrompue", error);
  return TEXTS.engineFailed;
}

/** Suit l'avancement : la barre, le temps restant estimé, et les problèmes dès qu'une partie est finie. */
function createProgressReporter(app: App): (progress: AnalysisProgress) => void {
  const startedAt = Date.now();
  let shownGames = 0;
  return (progress) => {
    const ratio = progress.totalPositions === 0 ? 0 : progress.donePositions / progress.totalPositions;
    const elapsed = Date.now() - startedAt;
    const remaining = ratio > 0.05 ? ` · ${describeRemaining((elapsed / ratio) * (1 - ratio))}` : "";
    app.elements.progressBar.value = ratio;
    setText(app.elements.progressLabel, `Analyse : partie ${Math.min(progress.doneGames + 1, progress.totalGames)} sur ${progress.totalGames}${remaining}`);
    if (progress.doneGames !== shownGames) {
      shownGames = progress.doneGames;
      void refreshPuzzles(app);
    }
  };
}

async function analyseNewGames(app: App, username: string, signal: AbortSignal): Promise<string> {
  const knownGames = await app.store.listGames(username);
  const analysedIds = new Set(knownGames.map((game) => game.id));
  const sinceEndTime = knownGames.length === 0 ? null : Math.min(...knownGames.map((game) => game.endTime));
  setText(app.elements.status, TEXTS.fetching);
  const selection = await fetchGamesToAnalyse(username, analysedIds, sinceEndTime, signal);
  if (selection.selected.length === 0) {
    return knownGames.length === 0 ? TEXTS.noGames : TEXTS.upToDate;
  }
  setText(app.elements.status, "");
  setBusy(app, true);
  const result = await analyseGames(selection.selected, {
    username,
    store: app.store,
    signal,
    startEngine,
    onProgress: createProgressReporter(app),
  });
  const summary = `${pluralize(result.games.length, "partie analysée", "parties analysées")}, ${pluralize(result.puzzles.length, "nouveau problème", "nouveaux problèmes")}.`;
  const remaining = selection.remainingCount > 0 ? ` ${TEXTS.moreToAnalyse(selection.remainingCount)}` : "";
  return summary + remaining;
}

async function runSync(app: App): Promise<void> {
  const username = app.username;
  if (username === null || app.abortController !== null) {
    return;
  }
  const abortController = new AbortController();
  app.abortController = abortController;
  app.elements.sync.disabled = true;
  try {
    setText(app.elements.status, await analyseNewGames(app, username, abortController.signal));
  } catch (error) {
    setText(app.elements.status, describeFailure(error));
    if (error instanceof ChessComError && error.reason === "not-found") {
      // Pseudo inconnu : on ne le garde pas, le formulaire revient pour le corriger.
      forgetUsername(app.keyValueStore);
      app.username = null;
      renderAccount(app);
      app.elements.input.focus();
    }
  } finally {
    app.abortController = null;
    setBusy(app, false);
    await refreshPuzzles(app);
  }
}

function submitUsername(app: App): void {
  const username = normalizeUsername(app.elements.input.value);
  app.elements.inputError.hidden = username !== null;
  setText(app.elements.inputError, username === null ? TEXTS.invalidUsername : "");
  if (username === null) {
    app.elements.input.setAttribute("aria-invalid", "true");
    app.elements.input.focus();
    return;
  }
  app.elements.input.removeAttribute("aria-invalid");
  app.username = username;
  saveUsername(app.keyValueStore, username);
  renderAccount(app);
  void refreshPuzzles(app).then(() => runSync(app));
}

async function forgetPlayer(app: App): Promise<void> {
  if (app.username === null || !window.confirm(TEXTS.confirmForget)) {
    return;
  }
  await app.store.clearUser(app.username);
  forgetUsername(app.keyValueStore);
  app.username = null;
  app.elements.input.value = "";
  setText(app.elements.status, "");
  renderAccount(app);
  await refreshPuzzles(app);
  app.elements.input.focus();
}

/** Branche la page : pseudo gardé dans le navigateur, analyse à la demande, entraîneur de problèmes. */
export function startApp(keyValueStore: KeyValueStore, store: ChessStore): void {
  const app: App = {
    elements: collectElements(),
    keyValueStore,
    store,
    username: loadUsername(keyValueStore),
    abortController: null,
    reportView: createReportView(),
    puzzleView: createPuzzleView({
      now: () => Date.now(),
      onReviewed: (puzzle) => {
        void store.savePuzzle(puzzle).then(() => refreshPuzzles(app));
      },
    }),
  };
  requireElement("storage-notice", HTMLElement).hidden = store.isPersistent;
  app.elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitUsername(app);
  });
  app.elements.sync.addEventListener("click", () => {
    void runSync(app);
  });
  app.elements.cancel.addEventListener("click", () => {
    app.abortController?.abort();
  });
  app.elements.forget.addEventListener("click", () => {
    void forgetPlayer(app);
  });
  renderAccount(app);
  void refreshPuzzles(app);
}
