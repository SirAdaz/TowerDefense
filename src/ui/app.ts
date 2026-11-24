import { GAUGES, type Gauge } from "../game/balance.ts";
import { canStartWave, startNextWave } from "../game/engine.ts";
import type { Cell } from "../game/grid.ts";
import { updateRecord, type KeyValueStore } from "../game/save.ts";
import { buildTower, sellTower, towerAt, towerById, upgradeTower } from "../game/towers.ts";
import type { GameEvent } from "../game/types.ts";
import { createRenderer, type Renderer } from "../render/renderer.ts";
import { createBoard, type Board } from "./board.ts";
import { isUnavailable, requireElement, setText } from "./dom.ts";
import { createHud, type Hud } from "./hud.ts";
import { advanceSession, openSession, persistSession, resetSession, type Session } from "./session.ts";
import { createTowerPanel, type TowerPanel } from "./towerPanel.ts";

/** Tout ce dont les actions du joueur ont besoin : la session, le stockage et les morceaux d'interface. */
interface App {
  readonly session: Session;
  readonly store: KeyValueStore;
  readonly renderer: Renderer;
  readonly hud: Hud;
  readonly panel: TowerPanel;
  readonly board: Board;
  readonly announcer: HTMLElement;
  readonly gameOverDialog: HTMLDialogElement;
}

/** Une sauvegarde par seconde pendant que la partie tourne : fermer l'onglet ne coûte presque rien. */
const AUTOSAVE_SECONDS = 1;

function announce(app: App, message: string): void {
  setText(app.announcer, message);
}

function showGameOver(app: App): void {
  const { session } = app;
  const hasNewRecord = session.state.wave > session.recordAtStart;
  setText(requireElement("game-over-wave", HTMLElement), `Vague ${session.state.wave}`);
  const recordLine = hasNewRecord ? "Nouveau record !" : `Record : vague ${session.record}`;
  setText(requireElement("game-over-record", HTMLElement), recordLine);
  if (!app.gameOverDialog.open) {
    app.gameOverDialog.showModal();
  }
  announce(app, `Partie terminée à la vague ${session.state.wave}. ${recordLine}`);
}

/** Réagit aux événements du jeu : record, annonces, sauvegarde aux moments clés, écran de fin. */
function handleEvents(app: App, events: readonly GameEvent[]): void {
  const { session, store } = app;
  app.renderer.addEvents(events);
  for (const event of events) {
    if (event.type === "waveStarted") {
      session.record = updateRecord(store, event.wave);
      announce(app, `Vague ${event.wave} lancée.`);
      persistSession(session, store);
    } else if (event.type === "waveCleared") {
      persistSession(session, store);
    } else if (event.type === "gameOver") {
      persistSession(session, store);
      showGameOver(app);
    }
  }
}

function activateCell(app: App, cell: Cell): void {
  const { session, store } = app;
  const existing = towerAt(session.state, cell);
  if (existing !== undefined) {
    session.selectedTowerId = session.selectedTowerId === existing.id ? null : existing.id;
    return;
  }
  const built = buildTower(session.state, cell);
  if (built === null) {
    announce(app, "Pose impossible : pas assez d'argent.");
    return;
  }
  session.selectedTowerId = built.id;
  announce(app, "Tourelle posée.");
  persistSession(session, store);
}

function upgradeSelected(app: App, gauge: Gauge): void {
  const { session, store } = app;
  if (session.selectedTowerId !== null && upgradeTower(session.state, session.selectedTowerId, gauge)) {
    announce(app, "Amélioration faite.");
    persistSession(session, store);
  }
}

function sellSelected(app: App): void {
  const { session, store } = app;
  const tower = session.selectedTowerId === null ? undefined : towerById(session.state, session.selectedTowerId);
  if (tower === undefined || sellTower(session.state, tower.id) === null) {
    return;
  }
  session.selectedTowerId = null;
  announce(app, "Tourelle vendue.");
  persistSession(session, store);
  app.board.focusCell(tower);
}

function launchNextWave(app: App): void {
  const { session } = app;
  if (!canStartWave(session.state)) {
    return;
  }
  session.isPaused = false;
  handleEvents(app, startNextWave(session.state));
}

function setPaused(app: App, isPaused: boolean): void {
  const { session, store } = app;
  if (session.state.phase === "over" || session.isPaused === isPaused) {
    return;
  }
  session.isPaused = isPaused;
  announce(app, isPaused ? "Partie en pause." : "Partie reprise.");
  persistSession(session, store);
}

function startNewGame(app: App): void {
  const { session, store } = app;
  const isGameRunning = session.state.phase !== "over" && session.state.wave > 0;
  if (isGameRunning && !window.confirm("Abandonner la partie en cours et recommencer ?")) {
    return;
  }
  resetSession(session);
  app.renderer.reset();
  app.gameOverDialog.close();
  persistSession(session, store);
  announce(app, "Nouvelle partie.");
  app.hud.nextWaveButton.focus();
}

/** Branche un bouton : un bouton marqué indisponible reste focalisable mais n'agit pas. */
function onPress(button: HTMLButtonElement, action: () => void): void {
  button.addEventListener("click", () => {
    if (!isUnavailable(button)) {
      action();
    }
  });
}

function bindControls(app: App): void {
  const { session, store, hud, panel } = app;
  onPress(hud.nextWaveButton, () => launchNextWave(app));
  onPress(hud.pauseButton, () => setPaused(app, !session.isPaused));
  onPress(hud.speedButton, () => {
    session.isFast = !session.isFast;
    persistSession(session, store);
  });
  for (const gauge of GAUGES) {
    onPress(panel.upgradeButtons[gauge], () => upgradeSelected(app, gauge));
  }
  onPress(panel.sellButton, () => sellSelected(app));
  onPress(requireElement("new-game", HTMLButtonElement), () => startNewGame(app));
  onPress(requireElement("game-over-restart", HTMLButtonElement), () => startNewGame(app));

  document.addEventListener("keydown", (event) => {
    const isTyping = event.ctrlKey || event.metaKey || event.altKey;
    if (isTyping || app.gameOverDialog.open) {
      return;
    }
    if (event.key === "Escape") {
      session.selectedTowerId = null;
    } else if (event.key.toLowerCase() === "p") {
      setPaused(app, !session.isPaused);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      const isPlaying = session.state.phase === "wave" || session.state.phase === "countdown";
      setPaused(app, isPlaying || session.isPaused);
      persistSession(session, store);
    }
  });
  window.addEventListener("pagehide", () => persistSession(session, store));
}

function refreshInterface(app: App): void {
  const { session } = app;
  const selected = session.selectedTowerId === null ? undefined : towerById(session.state, session.selectedTowerId);
  app.hud.refresh(session);
  app.panel.refresh(selected, session.state.money);
  app.board.refresh(session.state);
  app.renderer.draw(session);
}

function runLoop(app: App): void {
  const { session, store } = app;
  let lastTime = performance.now();
  let secondsSinceSave = 0;
  const frame = (now: number): void => {
    const elapsedSeconds = Math.max(now - lastTime, 0) / 1000;
    lastTime = now;
    const wasRunning = !session.isPaused && session.state.phase !== "over";
    handleEvents(app, advanceSession(session, elapsedSeconds));
    if (wasRunning) {
      app.renderer.advance(elapsedSeconds);
      secondsSinceSave += elapsedSeconds;
    }
    if (secondsSinceSave >= AUTOSAVE_SECONDS) {
      secondsSinceSave = 0;
      persistSession(session, store);
    }
    refreshInterface(app);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Démarre le jeu sur le gabarit de `index.html`, avec le stockage donné (`localStorage` en vrai). */
export function startApp(store: KeyValueStore): void {
  const session = openSession(store);
  const boardHandlers = {
    onActivate: (cell: Cell): void => activateCell(app, cell),
    onHover: (cell: Cell | null): void => {
      session.hoveredCell = cell;
    },
  };
  const app: App = {
    session,
    store,
    renderer: createRenderer(requireElement("board-canvas", HTMLCanvasElement)),
    hud: createHud(),
    panel: createTowerPanel(),
    board: createBoard(requireElement("board-cells", HTMLElement), boardHandlers),
    announcer: requireElement("announcer", HTMLElement),
    gameOverDialog: requireElement("game-over", HTMLDialogElement),
  };
  bindControls(app);
  if (session.isPaused) {
    announce(app, "Partie reprise là où vous l'aviez laissée, en pause.");
  }
  runLoop(app);
}
