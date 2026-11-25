import { requireElement, setText } from "../../shared/dom.ts";
import type { KeyValueStore } from "../../shared/storage.ts";
import { ARENA_HEIGHT, ARENA_WIDTH, STEP_SECONDS } from "../game/balance.ts";
import { abandon, step } from "../game/engine.ts";
import { applyRun, buyUnlock, loadProfile, saveProfile, summarizeRun, type Profile } from "../game/profile.ts";
import { createGame } from "../game/state.ts";
import type { GameState, PlayerInput, UpgradeId } from "../game/types.ts";
import { chooseUpgrade } from "../game/upgrades.ts";
import { createRenderer, type Renderer } from "../render/renderer.ts";
import { createDialogs, type Dialogs } from "./dialogs.ts";
import { createHud, type Hud } from "./hud.ts";
import { createMenu, type Menu } from "./menu.ts";
import { describeChoice, formatNumber } from "./texts.ts";

/** Tout ce que l'interface tient en main. `state` est `null` au menu. */
export interface App {
  readonly store: KeyValueStore;
  readonly renderer: Renderer;
  readonly hud: Hud;
  readonly menu: Menu;
  readonly dialogs: Dialogs;
  readonly announcer: HTMLElement;
  readonly input: PlayerInput;
  readonly motionQuery: MediaQueryList;
  profile: Profile;
  state: GameState | null;
  isPaused: boolean;
  /** Vrai une fois le bilan de la partie enregistré : une partie ne rapporte ses pièces qu'une fois. */
  isRunRecorded: boolean;
  /** Temps réel accumulé, pas encore converti en pas de simulation. */
  pendingSeconds: number;
  /** Vitesse du temps de jeu : toujours 1 en jeu, modifiable par les outils de test du serveur de dev. */
  timeScale: number;
}

/** Au-delà, l'onglet a été figé (veille, débogueur) : on n'essaie pas de rattraper le temps perdu. */
const MAX_FRAME_SECONDS = 0.25;
/** Touches qui prennent la carte 1, 2 ou 3 au passage de niveau. */
const CHOICE_KEYS = ["1", "2", "3"];

function announce(app: App, message: string): void {
  setText(app.announcer, message);
}

function isPlaying(app: App): boolean {
  return app.state !== null && app.state.phase === "playing" && !app.isPaused;
}

function startRun(app: App): void {
  // La graine vient de l'horloge et du hasard du navigateur, ici et nulle part dans la logique du jeu.
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
  app.state = createGame(seed, app.profile.unlocked);
  app.isPaused = false;
  app.isRunRecorded = false;
  app.pendingSeconds = 0;
  app.dialogs.hideEnd();
  app.menu.setVisible(false);
  app.hud.setVisible(true);
  announce(app, "La nuit commence. Votre luciole suit la souris.");
}

function showMenu(app: App): void {
  app.state = null;
  app.isPaused = false;
  app.dialogs.hideEnd();
  app.dialogs.hidePause();
  app.hud.setVisible(false);
  app.menu.refresh(app.profile);
  app.menu.setVisible(true);
  app.menu.focusPlay();
}

function setPaused(app: App, isPaused: boolean): void {
  const { state } = app;
  if (state === null || state.phase !== "playing" || app.isPaused === isPaused) {
    return;
  }
  app.isPaused = isPaused;
  app.pendingSeconds = 0;
  if (isPaused) {
    app.dialogs.showPause(state);
  } else {
    app.dialogs.hidePause();
  }
}

/** Fin de partie : le bilan est enregistré une seule fois (record, pièces), puis affiché. */
function finishRun(app: App, state: GameState): void {
  if (app.isRunRecorded) {
    return;
  }
  app.isRunRecorded = true;
  const summary = summarizeRun(state, app.profile);
  app.profile = applyRun(app.profile, summary);
  saveProfile(app.store, app.profile);
  app.isPaused = false;
  app.dialogs.hidePause();
  app.dialogs.hideLevelUp();
  app.dialogs.showEnd(summary, app.profile);
  const outcome = summary.hasWon ? "L'aube se lève, vous avez tenu la nuit." : "La nuit a gagné.";
  announce(app, `${outcome} ${formatNumber(summary.score)} points.`);
}

/** Réagit à ce que la simulation vient de décider : niveau franchi, victoire ou défaite. */
function followPhase(app: App, state: GameState): void {
  if (state.phase === "levelUp") {
    app.dialogs.showLevelUp(state);
    const options = state.choices.map((choice, index) => `${index + 1} : ${describeChoice(choice).name}`);
    announce(app, `Niveau ${state.player.level}. ${options.join(", ")}.`);
  } else if (state.phase === "won" || state.phase === "lost") {
    finishRun(app, state);
  }
}

function pickChoice(app: App, choiceIndex: number): void {
  const { state } = app;
  if (state === null || !chooseUpgrade(state, choiceIndex)) {
    return;
  }
  app.pendingSeconds = 0;
  if (state.phase === "levelUp") {
    app.dialogs.showLevelUp(state);
  } else {
    app.dialogs.hideLevelUp();
  }
}

function unlock(app: App, id: UpgradeId): void {
  const updated = buyUnlock(app.profile, id);
  if (updated === null) {
    return;
  }
  app.profile = updated;
  saveProfile(app.store, updated);
  app.menu.refresh(updated);
  announce(app, "Débloqué. Cette carte peut maintenant sortir au passage de niveau.");
}

/** Échap ou P : met en pause. P seul reprend (en pause, Échap ferme déjà la fenêtre, donc reprend). */
function togglePause(app: App, event: KeyboardEvent, key: string): void {
  if (key === "p" && app.isPaused) {
    setPaused(app, false);
  } else if ((key === "p" || key === "escape") && isPlaying(app)) {
    event.preventDefault();
    setPaused(app, true);
  }
}

function onKeyDown(app: App, event: KeyboardEvent): void {
  const { state } = app;
  if (state === null || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const key = event.key.toLowerCase();
  if (state.phase === "levelUp" && CHOICE_KEYS.includes(key)) {
    pickChoice(app, Number(key) - 1);
  } else {
    togglePause(app, event, key);
  }
}

function bindControls(app: App): void {
  app.hud.pauseButton.addEventListener("click", () => setPaused(app, true));
  window.addEventListener("pointermove", (event) => app.renderer.aimAt(event.clientX, event.clientY, app.input));
  document.addEventListener("keydown", (event) => onKeyDown(app, event));
  // Onglet caché ou fenêtre quittée : pause d'office, la luciole ne reste pas seule dans la horde.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      setPaused(app, true);
    }
  });
  window.addEventListener("blur", () => setPaused(app, true));
}

/**
 * Convertit le temps écoulé en pas fixes de 1/60 s : la simulation avance toujours du même pas,
 * quelle que soit la fréquence d'affichage. En pause ou hors partie, aucun pas.
 */
function advance(app: App, elapsedSeconds: number): void {
  const { state } = app;
  if (state === null || !isPlaying(app)) {
    app.pendingSeconds = 0;
    return;
  }
  app.pendingSeconds += Math.min(elapsedSeconds, MAX_FRAME_SECONDS) * app.timeScale;
  while (app.pendingSeconds >= STEP_SECONDS && state.phase === "playing") {
    app.pendingSeconds -= STEP_SECONDS;
    step(state, app.input);
  }
  if (state.phase !== "playing") {
    followPhase(app, state);
  }
}

function runLoop(app: App): void {
  let lastTime = performance.now();
  const frame = (now: number): void => {
    const elapsedSeconds = Math.max(now - lastTime, 0) / 1000;
    lastTime = now;
    advance(app, elapsedSeconds);
    if (app.state !== null) {
      app.hud.refresh(app.state);
    }
    app.renderer.draw(app.state, app.motionQuery.matches);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Démarre le jeu sur le gabarit de `nuit-blanche/index.html`, avec le stockage donné (`localStorage` en vrai). */
export function startApp(store: KeyValueStore): App {
  const app: App = {
    store,
    renderer: createRenderer(requireElement("arena", HTMLCanvasElement)),
    hud: createHud(),
    menu: createMenu({ onPlay: () => startRun(app), onUnlock: (id) => unlock(app, id) }),
    dialogs: createDialogs({
      onChoose: (choiceIndex) => pickChoice(app, choiceIndex),
      onResume: () => setPaused(app, false),
      onAbandon: () => {
        if (app.state !== null) {
          abandon(app.state);
          finishRun(app, app.state);
        }
      },
      onReplay: () => startRun(app),
      onMenu: () => showMenu(app),
    }),
    announcer: requireElement("announcer", HTMLElement),
    input: { targetX: ARENA_WIDTH / 2, targetY: ARENA_HEIGHT / 2 },
    motionQuery: window.matchMedia("(prefers-reduced-motion: reduce)"),
    profile: loadProfile(store),
    state: null,
    isPaused: false,
    isRunRecorded: false,
    pendingSeconds: 0,
    timeScale: 1,
  };
  bindControls(app);
  showMenu(app);
  runLoop(app);
  return app;
}
