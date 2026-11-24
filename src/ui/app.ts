import { BALANCE } from "../game/balance.ts";
import { STEP_SECONDS, createGame, startNextWave, step } from "../game/game.ts";
import { type Cell, isOnPath } from "../game/grid.ts";
import { type KeyValueStore, clearSave, readRecord, readSave, updateRecord, writeSave } from "../game/save.ts";
import { buildTower, findTower, sellTower, towerAt, upgradeTower } from "../game/towers.ts";
import type { GameState, Gauge } from "../game/types.ts";
import type { CursorKind, SceneView } from "../render/scene.ts";
import { drawBoard, watchCanvasSize } from "./board.ts";
import { byId, setText } from "./dom.ts";
import { type HudElements, getHud, renderHud } from "./hud.ts";
import { bindInputs } from "./input.ts";
import { Overlay } from "./overlay.ts";
import { type PanelElements, getPanel, renderPanel } from "./panel.ts";

/** Écart maximal pris en compte entre deux images : un onglet qui se réveille ne fait pas un bond. */
const MAX_FRAME_SECONDS = 0.25;

/** Relie l'état du jeu, la boucle à pas fixe, le rendu et l'interface. */
export class GameApp {
  readonly canvas = byId<HTMLCanvasElement>("board");
  private readonly announcer = byId<HTMLElement>("announcer");
  private readonly hud: HudElements = getHud();
  private readonly panel: PanelElements = getPanel();
  private readonly overlay = new Overlay(this.canvas);
  private readonly store: KeyValueStore;
  private state: GameState = createGame();
  private record = 0;
  private isPaused = false;
  private isFast = false;
  private selectedTowerId: number | null = null;
  private cursor: Cell | null = null;
  private accumulator = 0;
  private lastFrame: number | null = null;

  constructor(store: KeyValueStore) {
    this.store = store;
  }

  /** Charge la sauvegarde (reprise en pause) ou démarre une partie neuve, puis lance la boucle. */
  start(): void {
    this.record = readRecord(this.store);
    const saved = readSave(this.store);
    if (saved) {
      this.state = saved;
      this.isPaused = true;
      this.showResume();
    }
    bindInputs(this);
    watchCanvasSize(this.canvas, () => this.render());
    requestAnimationFrame((now) => this.frame(now));
  }

  get isLocked(): boolean {
    return this.isPaused || this.state.phase === "gameOver";
  }

  get currentCursor(): Cell | null {
    return this.cursor;
  }

  private frame(now: number): void {
    const elapsed = this.lastFrame === null ? 0 : Math.min((now - this.lastFrame) / 1000, MAX_FRAME_SECONDS);
    this.lastFrame = now;
    if (!this.isLocked) this.advance(elapsed * (this.isFast ? 2 : 1));
    this.render();
    requestAnimationFrame((next) => this.frame(next));
  }

  private advance(seconds: number): void {
    this.accumulator += seconds;
    while (this.accumulator >= STEP_SECONDS && !this.isLocked) {
      this.accumulator -= STEP_SECONDS;
      this.stepOnce();
    }
  }

  private stepOnce(): void {
    const { phase, wave } = this.state;
    step(this.state, STEP_SECONDS);
    if (this.state.wave !== wave) this.onWaveStarted();
    if (phase === "wave" && this.state.phase === "intermission") this.onWaveCleared();
    if (this.state.phase === "gameOver" && phase !== "gameOver") this.onGameOver();
  }

  private onWaveStarted(): void {
    this.record = updateRecord(this.store, this.state.wave);
    this.announce(`Vague ${this.state.wave}`);
  }

  private onWaveCleared(): void {
    writeSave(this.store, this.state);
    this.announce(`Vague ${this.state.wave} terminée. Suivante dans ${BALANCE.intermissionSeconds} secondes.`);
  }

  private onGameOver(): void {
    writeSave(this.store, this.state);
    this.selectedTowerId = null;
    const text = `Vague atteinte : ${this.state.wave}. Record : ${this.record}.`;
    this.announce(`Partie perdue. ${text}`);
    this.overlay.show({ title: "Perdu !", text, primary: { label: "Nouvelle partie", onSelect: () => this.newGame() } });
  }

  private showResume(): void {
    this.overlay.show({
      title: "Partie sauvegardée",
      text: `Vague ${this.state.wave}, ${this.state.lives} vies, ${this.state.towers.length} tourelles.`,
      primary: { label: "Reprendre", onSelect: () => this.resume() },
      secondary: { label: "Nouvelle partie", onSelect: () => this.newGame() },
    });
  }

  /** Pause manuelle ou automatique (onglet quitté) : rien n'avance tant qu'on ne clique pas « Reprendre ». */
  pause(): void {
    if (this.isPaused || this.state.phase === "gameOver") return;
    this.isPaused = true;
    this.overlay.show({
      title: "Pause",
      text: "La partie attend ton retour.",
      primary: { label: "Reprendre", onSelect: () => this.resume() },
      secondary: { label: "Nouvelle partie", onSelect: () => this.newGame() },
    });
  }

  resume(): void {
    this.isPaused = false;
    this.lastFrame = null;
    this.accumulator = 0;
    this.overlay.hide();
  }

  togglePause(): void {
    if (this.isPaused) this.resume();
    else this.pause();
  }

  toggleSpeed(): void {
    this.isFast = !this.isFast;
  }

  callNextWave(): void {
    if (!this.isLocked && startNextWave(this.state)) this.onWaveStarted();
  }

  newGame(): void {
    clearSave(this.store);
    this.state = createGame();
    this.selectedTowerId = null;
    this.resume();
    this.announce("Nouvelle partie.");
  }

  setCursor(cell: Cell | null): void {
    this.cursor = cell;
  }

  /** Clic ou Entrée sur une case : sélectionne la tourelle, en pose une sur l'herbe libre, sinon désélectionne. */
  actOnCell(cell: Cell): void {
    const existing = towerAt(this.state, cell);
    if (existing) {
      this.selectedTowerId = existing.id;
      this.announce(`Tourelle sélectionnée, ${existing.kills} abattus.`);
      return;
    }
    const built = this.isLocked ? null : buildTower(this.state, cell);
    this.selectedTowerId = built?.id ?? null;
    if (built) this.afterTowerChange("Tourelle posée.");
  }

  deselect(): void {
    this.selectedTowerId = null;
  }

  upgrade(gauge: Gauge): void {
    if (this.selectedTowerId === null || this.isLocked) return;
    if (upgradeTower(this.state, this.selectedTowerId, gauge)) this.afterTowerChange("Amélioration faite.");
  }

  sellSelected(): void {
    if (this.selectedTowerId === null || this.isLocked) return;
    if (!sellTower(this.state, this.selectedTowerId)) return;
    this.selectedTowerId = null;
    this.afterTowerChange("Tourelle vendue.");
    this.canvas.focus();
  }

  /** Entre deux vagues, chaque achat ou vente est sauvé ; pendant une vague, on garde la sauvegarde d'avant la vague. */
  private afterTowerChange(message: string): void {
    if (this.state.phase === "intermission") writeSave(this.store, this.state);
    this.announce(`${message} Argent : ${this.state.money} $.`);
  }

  /** Description de la case visée, lue par les lecteurs d'écran quand on se déplace au clavier. */
  describeCursor(): void {
    if (!this.cursor) return;
    const kindText: Record<CursorKind, string> = { build: "herbe libre", tower: "tourelle", blocked: "impossible de construire" };
    const place = isOnPath(this.cursor) ? "chemin" : kindText[this.cursorKind()];
    this.announce(`Case ${this.cursor.col + 1}, ${this.cursor.row + 1} : ${place}.`);
  }

  private cursorKind(): CursorKind {
    if (!this.cursor) return "blocked";
    if (towerAt(this.state, this.cursor)) return "tower";
    const canBuild = !isOnPath(this.cursor) && this.state.money >= BALANCE.towerCost && !this.isLocked;
    return canBuild ? "build" : "blocked";
  }

  private announce(text: string): void {
    setText(this.announcer, text);
  }

  private render(): void {
    const view: SceneView = {
      state: this.state,
      selectedTowerId: this.selectedTowerId,
      cursor: this.cursor,
      cursorKind: this.cursorKind(),
    };
    drawBoard(this.canvas, view);
    renderHud(this.hud, { state: this.state, record: this.record, isPaused: this.isPaused, isFast: this.isFast });
    const tower = this.selectedTowerId === null ? undefined : findTower(this.state, this.selectedTowerId);
    renderPanel(this.panel, { tower, money: this.state.money, isLocked: this.isLocked });
  }
}
