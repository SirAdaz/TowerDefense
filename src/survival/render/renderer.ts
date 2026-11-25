import { ARENA_HEIGHT, ARENA_WIDTH } from "../game/balance.ts";
import type { GameState, PlayerInput } from "../game/types.ts";
import { drawEnemies, drawGems, drawPlayer } from "./actors.ts";
import { drawAuras, drawEffects, drawHitMarks, drawProjectiles } from "./effects.ts";
import { THEME } from "./theme.ts";

export interface Renderer {
  /** Dessine la partie (ou l'arène vide derrière le menu). Ne modifie jamais l'état. */
  draw(state: GameState | null, isReducedMotion: boolean): void;
  /** Convertit un point de la fenêtre en point de l'arène et l'écrit dans `input`. */
  aimAt(clientX: number, clientY: number, input: PlayerInput): void;
}

/** Placement de l'arène dans le canvas : la plus grande échelle qui la montre entière, centrée. */
interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const DOT_SPACING = 50;
const SHAKE_PIXELS = 5;

/** Adapte la taille réelle du canvas à sa taille affichée et à la densité de l'écran. */
function fitCanvas(canvas: HTMLCanvasElement, viewport: Viewport): number {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(Math.round(canvas.clientWidth * pixelRatio), 1);
  const height = Math.max(Math.round(canvas.clientHeight * pixelRatio), 1);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  viewport.scale = Math.min(canvas.clientWidth / ARENA_WIDTH, canvas.clientHeight / ARENA_HEIGHT);
  viewport.offsetX = (canvas.clientWidth - ARENA_WIDTH * viewport.scale) / 2;
  viewport.offsetY = (canvas.clientHeight - ARENA_HEIGHT * viewport.scale) / 2;
  return pixelRatio;
}

function drawArena(ctx: CanvasRenderingContext2D, isHurt: boolean): void {
  ctx.fillStyle = THEME.arena;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  ctx.beginPath();
  for (let x = DOT_SPACING; x < ARENA_WIDTH; x += DOT_SPACING) {
    for (let y = DOT_SPACING; y < ARENA_HEIGHT; y += DOT_SPACING) {
      ctx.rect(x - 1, y - 1, 2, 2);
    }
  }
  ctx.fillStyle = THEME.arenaDot;
  ctx.fill();
  ctx.strokeStyle = isHurt ? THEME.arenaEdgeHurt : THEME.arenaEdge;
  ctx.lineWidth = isHurt ? 4 : 2;
  ctx.strokeRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
}

/** Décalage de la secousse après un coup reçu ; nul en mouvement réduit. */
function shakeOffset(state: GameState | null, isReducedMotion: boolean): number {
  if (state === null || isReducedMotion || state.shakeTimer <= 0) {
    return 0;
  }
  return Math.sin(state.time * 95) * SHAKE_PIXELS * (state.shakeTimer / 0.25);
}

/** Crée le rendu de l'arène sur le canvas donné. */
export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2D is not available");
  }
  const ctx = context;
  const viewport: Viewport = { scale: 1, offsetX: 0, offsetY: 0 };

  return {
    draw(state, isReducedMotion) {
      const pixelRatio = fitCanvas(canvas, viewport);
      const scale = viewport.scale * pixelRatio;
      const shake = shakeOffset(state, isReducedMotion) * pixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = THEME.outside;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, viewport.offsetX * pixelRatio + shake, viewport.offsetY * pixelRatio);
      // Rien ne déborde de l'arène : les ennemis y entrent par les bords.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
      ctx.clip();
      drawArena(ctx, state !== null && state.player.hurtTimer > 0);
      if (state !== null) {
        drawGems(ctx, state);
        drawAuras(ctx, state);
        drawEnemies(ctx, state, isReducedMotion);
        drawProjectiles(ctx, state);
        drawPlayer(ctx, state, isReducedMotion);
        drawEffects(ctx, state, isReducedMotion);
        drawHitMarks(ctx, state, isReducedMotion);
      }
      ctx.restore();
    },
    aimAt(clientX, clientY, input) {
      const bounds = canvas.getBoundingClientRect();
      input.targetX = (clientX - bounds.left - viewport.offsetX) / viewport.scale;
      input.targetY = (clientY - bounds.top - viewport.offsetY) / viewport.scale;
    },
  };
}
