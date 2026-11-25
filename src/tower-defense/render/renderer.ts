import { TOWER_COST } from "../game/balance.ts";
import { COLS, ROWS, cellCenter, type Cell } from "../game/grid.ts";
import { gaugeValue, isBuildable, towerById, towerStat } from "../game/towers.ts";
import type { GameEvent, GameState } from "../game/types.ts";
import { drawEnemy, drawRange, drawSelection, drawTower } from "./actors.ts";
import { ageEffects, drawEffects, effectsFromEvents, type Effect } from "./effects.ts";
import { drawScene } from "./scene.ts";

/** Ce que le rendu lit à chaque image. Il ne modifie jamais l'état de la partie. */
export interface RenderView {
  readonly state: GameState;
  readonly selectedTowerId: number | null;
  readonly hoveredCell: Cell | null;
}

export interface Renderer {
  /** Enregistre les événements d'un pas pour en dessiner la trace (tirs, gains, vies perdues). */
  addEvents(events: readonly GameEvent[]): void;
  /** Fait vieillir les effets ; à ne pas appeler pendant la pause. */
  advance(seconds: number): void;
  draw(view: RenderView): void;
  /** Oublie effets et orientations (nouvelle partie). */
  reset(): void;
}

/** Les canons pointent vers la droite tant qu'ils n'ont pas tiré. */
const DEFAULT_AIM = 0;

/** Adapte la taille réelle du canvas à sa taille affichée et à la densité de l'écran. */
function fitCanvas(canvas: HTMLCanvasElement): number {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(Math.round(canvas.clientWidth * pixelRatio), 1);
  const height = Math.max(Math.round((canvas.clientWidth * pixelRatio * ROWS) / COLS), 1);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return width / COLS;
}

/** Portée de la tourelle sélectionnée, ou aperçu de la portée d'une pose sur la case survolée. */
function drawRanges(ctx: CanvasRenderingContext2D, view: RenderView): void {
  const { state, selectedTowerId, hoveredCell } = view;
  const selected = selectedTowerId === null ? undefined : towerById(state, selectedTowerId);
  if (selected !== undefined) {
    drawRange(ctx, cellCenter(selected), towerStat(selected, "range"), true);
    drawSelection(ctx, selected);
  }
  if (hoveredCell !== null && state.phase !== "over" && isBuildable(state, hoveredCell)) {
    drawRange(ctx, cellCenter(hoveredCell), gaugeValue("range", 1), state.money >= TOWER_COST);
  }
}

/** Crée le rendu de la carte sur le canvas donné. */
export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D is not available");
  }
  const ctx = context;
  let effects: Effect[] = [];
  const aimAngles = new Map<number, number>();

  return {
    addEvents(events) {
      for (const event of events) {
        if (event.type === "shot") {
          aimAngles.set(event.towerId, Math.atan2(event.to.y - event.from.y, event.to.x - event.from.x));
        }
      }
      effects.push(...effectsFromEvents(events));
    },
    advance(seconds) {
      effects = ageEffects(effects, seconds);
    },
    draw(view) {
      const scale = fitCanvas(canvas);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawScene(ctx);
      drawRanges(ctx, view);
      for (const tower of view.state.towers) {
        drawTower(ctx, tower, aimAngles.get(tower.id) ?? DEFAULT_AIM);
      }
      for (const enemy of view.state.enemies) {
        drawEnemy(ctx, enemy);
      }
      drawEffects(ctx, effects);
    },
    reset() {
      effects = [];
      aimAngles.clear();
    },
  };
}
