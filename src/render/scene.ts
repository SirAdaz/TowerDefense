import { enemyPosition } from "../game/combat.ts";
import { COLS, type Cell, PATH, type Point, ROWS } from "../game/grid.ts";
import { towerStats } from "../game/towers.ts";
import type { Enemy, GameState, Projectile, Tower } from "../game/types.ts";
import { CELL_PX, COLORS, ENEMY_LOOKS } from "./palette.ts";

/** Ce que le rendu doit savoir en plus de l'état : sélection et case visée (souris ou clavier). */
export interface SceneView {
  readonly state: GameState;
  readonly selectedTowerId: number | null;
  readonly cursor: Cell | null;
  /** build : on peut poser ici ; tower : une tourelle à sélectionner ; blocked : chemin ou pas assez d'argent. */
  readonly cursorKind: CursorKind;
}

export type CursorKind = "build" | "tower" | "blocked";

type Ctx = CanvasRenderingContext2D;

const NEW_TOWER_RANGE = towerStats({ damage: 1, range: 1, rate: 1 }).range;

function toPx(point: Point): Point {
  return { x: point.x * CELL_PX, y: point.y * CELL_PX };
}

function drawGround(ctx: Ctx): void {
  ctx.fillStyle = COLORS.grassBlend;
  ctx.fillRect(0, 0, COLS * CELL_PX, ROWS * CELL_PX);
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const x = col * CELL_PX;
      const y = row * CELL_PX;
      ctx.fillStyle = (col + row) % 2 ? COLORS.grassA : COLORS.grassB;
      ctx.fillRect(x, y, CELL_PX, CELL_PX);
      ctx.fillStyle = COLORS.tuft;
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(x + ((col * 7 + row * 13 + k * 17) % 46) + 4, y + ((col * 11 + row * 5 + k * 23) % 46) + 4, 4, 4);
      }
    }
  }
}

function drawPath(ctx: Ctx): void {
  for (const cell of PATH) {
    const x = cell.col * CELL_PX;
    const y = cell.row * CELL_PX;
    ctx.fillStyle = COLORS.dirt;
    ctx.fillRect(x, y, CELL_PX, CELL_PX);
    ctx.fillStyle = COLORS.pebble;
    ctx.fillRect(x + 8, y + 12, 6, 6);
    ctx.fillRect(x + 34, y + 36, 6, 6);
    ctx.fillRect(x + 22, y + 28, 4, 4);
  }
}

function drawRange(ctx: Ctx, center: Point, rangeInCells: number): void {
  ctx.fillStyle = COLORS.rangeFill;
  ctx.strokeStyle = COLORS.highlight;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, rangeInCells * CELL_PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTower(ctx: Ctx, tower: Tower, isSelected: boolean): void {
  const { x, y } = toPx({ x: tower.col + 0.5, y: tower.row + 0.5 });
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(x - 20, y + 14, 40, 8);
  ctx.fillStyle = COLORS.stone;
  ctx.fillRect(x - 18, y - 18, 36, 34);
  ctx.fillStyle = COLORS.stoneLight;
  ctx.fillRect(x - 18, y - 18, 36, 8);
  ctx.fillStyle = COLORS.stoneDark;
  ctx.fillRect(x - 14, y - 26, 8, 8);
  ctx.fillRect(x + 6, y - 26, 8, 8);
  ctx.fillStyle = COLORS.wood;
  ctx.fillRect(x - 4, y - 6, 8, 10);
  if (isSelected) {
    ctx.strokeStyle = COLORS.highlight;
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 24, y - 30, 48, 56);
  }
}

function drawCrown(ctx: Ctx, center: Point, size: number): void {
  const left = center.x - size / 2;
  const top = center.y - size / 2;
  ctx.fillStyle = COLORS.crown;
  ctx.fillRect(left, top - 8, size, 6);
  ctx.fillRect(left, top - 16, 6, 8);
  ctx.fillRect(center.x - 3, top - 16, 6, 8);
  ctx.fillRect(left + size - 6, top - 16, 6, 8);
}

function drawHealthBar(ctx: Ctx, enemy: Enemy, center: Point, size: number): void {
  if (enemy.hp >= enemy.maxHp) return;
  const top = center.y + size / 2 + 3;
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(center.x - size / 2, top, size, 4);
  ctx.fillStyle = COLORS.hpFill;
  ctx.fillRect(center.x - size / 2, top, size * Math.max(enemy.hp / enemy.maxHp, 0), 4);
}

function drawEnemy(ctx: Ctx, enemy: Enemy): void {
  const center = toPx(enemyPosition(enemy));
  const { size, color } = ENEMY_LOOKS[enemy.kind];
  ctx.fillStyle = color;
  ctx.fillRect(center.x - size / 2, center.y - size / 2, size, size);
  ctx.fillStyle = COLORS.eye;
  ctx.fillRect(center.x - size / 4 - 2, center.y - size / 5, 5, 5);
  ctx.fillRect(center.x + size / 4 - 3, center.y - size / 5, 5, 5);
  if (enemy.kind === "boss") drawCrown(ctx, center, size);
  drawHealthBar(ctx, enemy, center, size);
}

/** Projectile en pointillés jaunes : la tête et deux points de traîne dans l'axe du tir. */
function drawProjectile(ctx: Ctx, projectile: Projectile, enemies: readonly Enemy[]): void {
  const head = toPx(projectile);
  const target = enemies.find((enemy) => enemy.id === projectile.targetId);
  const aim = target ? toPx(enemyPosition(target)) : head;
  const length = Math.hypot(aim.x - head.x, aim.y - head.y) || 1;
  const backX = (head.x - aim.x) / length;
  const backY = (head.y - aim.y) / length;
  ctx.fillStyle = COLORS.shot;
  for (let k = 0; k < 3; k++) ctx.fillRect(head.x + backX * k * 10 - 3, head.y + backY * k * 10 - 3, 6, 6);
}

function drawCursor(ctx: Ctx, view: SceneView): void {
  const { cursor } = view;
  if (!cursor) return;
  ctx.strokeStyle = view.cursorKind === "blocked" ? COLORS.invalid : COLORS.highlight;
  ctx.lineWidth = 3;
  ctx.strokeRect(cursor.col * CELL_PX + 2, cursor.row * CELL_PX + 2, CELL_PX - 4, CELL_PX - 4);
  if (view.cursorKind === "build") drawRange(ctx, toPx({ x: cursor.col + 0.5, y: cursor.row + 0.5 }), NEW_TOWER_RANGE);
}

/**
 * Dessine toute la carte dans le repère de la maquette (1 case = 56 unités) ; l'appelant a déjà
 * appliqué l'échelle du canvas. Lit l'état sans jamais le modifier.
 */
export function drawScene(ctx: Ctx, view: SceneView): void {
  const { state } = view;
  drawGround(ctx);
  drawPath(ctx);
  const selected = state.towers.find((tower) => tower.id === view.selectedTowerId);
  if (selected) drawRange(ctx, toPx({ x: selected.col + 0.5, y: selected.row + 0.5 }), towerStats(selected.levels).range);
  drawCursor(ctx, view);
  for (const tower of state.towers) drawTower(ctx, tower, tower.id === view.selectedTowerId);
  for (const enemy of state.enemies) drawEnemy(ctx, enemy);
  for (const projectile of state.projectiles) drawProjectile(ctx, projectile, state.enemies);
}
