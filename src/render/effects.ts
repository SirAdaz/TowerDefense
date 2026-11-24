import { PATH_LENGTH, pointAlongPath, type Point } from "../game/grid.ts";
import type { GameEvent } from "../game/types.ts";
import { drawLabel } from "./scene.ts";
import { THEME } from "./theme.ts";

/** Trace éphémère d'un événement de jeu : purement visuelle, jamais sauvegardée. */
export interface Effect {
  readonly kind: "shot" | "gain" | "loss";
  readonly from: Point;
  readonly to: Point;
  readonly label: string;
  readonly duration: number;
  age: number;
}

const SHOT_SECONDS = 0.1;
const GAIN_SECONDS = 0.7;
const LOSS_SECONDS = 1.1;

/** Traduit les événements d'un pas en effets à dessiner (les autres événements n'ont pas de trace). */
export function effectsFromEvents(events: readonly GameEvent[]): Effect[] {
  const effects: Effect[] = [];
  const exit = pointAlongPath(PATH_LENGTH);
  for (const event of events) {
    if (event.type === "shot") {
      effects.push({ kind: "shot", from: event.from, to: event.to, label: "", duration: SHOT_SECONDS, age: 0 });
    } else if (event.type === "killed") {
      effects.push({ kind: "gain", from: event.at, to: event.at, label: `+${event.bounty}`, duration: GAIN_SECONDS, age: 0 });
    } else if (event.type === "leaked") {
      effects.push({ kind: "loss", from: exit, to: exit, label: `−${event.livesLost}`, duration: LOSS_SECONDS, age: 0 });
    }
  }
  return effects;
}

/** Vieillit les effets et retire ceux qui sont terminés. */
export function ageEffects(effects: readonly Effect[], seconds: number): Effect[] {
  const remaining: Effect[] = [];
  for (const effect of effects) {
    effect.age += seconds;
    if (effect.age < effect.duration) {
      remaining.push(effect);
    }
  }
  return remaining;
}

function drawShot(ctx: CanvasRenderingContext2D, effect: Effect): void {
  ctx.strokeStyle = THEME.accent;
  ctx.lineWidth = 0.05;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(effect.from.x, effect.from.y);
  ctx.lineTo(effect.to.x, effect.to.y);
  ctx.stroke();
  ctx.fillStyle = THEME.ink;
  ctx.beginPath();
  ctx.arc(effect.to.x, effect.to.y, 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawRingWithLabel(ctx: CanvasRenderingContext2D, effect: Effect, color: string): void {
  const progress = effect.age / effect.duration;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.arc(effect.to.x, effect.to.y, 0.12 + progress * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  const size = effect.kind === "loss" ? 0.36 : 0.24;
  const labelAt = { x: effect.to.x, y: effect.to.y - 0.35 - progress * 0.45 };
  drawLabel(ctx, effect.label, labelAt, { color, size, align: effect.kind === "loss" ? "right" : "center" });
}

/** Dessine les effets en cours, de plus en plus transparents. */
export function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[]): void {
  for (const effect of effects) {
    ctx.globalAlpha = Math.max(1 - effect.age / effect.duration, 0);
    if (effect.kind === "shot") {
      drawShot(ctx, effect);
    } else {
      drawRingWithLabel(ctx, effect, effect.kind === "gain" ? THEME.accent : THEME.danger);
    }
  }
  ctx.globalAlpha = 1;
}
