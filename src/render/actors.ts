import { GAUGES, MAX_LEVEL, type EnemyKind } from "../game/balance.ts";
import { cellCenter, pointAlongPath, type Point } from "../game/grid.ts";
import type { Enemy, Tower } from "../game/types.ts";
import { ENEMY_COLORS, ENEMY_RADIUS, GAUGE_COLORS, THEME } from "./theme.ts";

const TOWER_RADIUS = 0.27;
const GAUGE_RING_RADIUS = 0.39;
/** Chaque jauge occupe un tiers du tour, moins un petit écart entre les arcs. */
const GAUGE_ARC = (Math.PI * 2) / 3 - 0.28;
const BOSS_SIDES = 6;

/** Polygone régulier centré sur `at` ; `rotation` oriente son premier sommet. */
function tracePolygon(ctx: CanvasRenderingContext2D, at: Point, radius: number, shape: { sides: number; rotation: number }): void {
  ctx.beginPath();
  for (let i = 0; i < shape.sides; i++) {
    const angle = shape.rotation + (i * Math.PI * 2) / shape.sides;
    ctx.lineTo(at.x + Math.cos(angle) * radius, at.y + Math.sin(angle) * radius);
  }
  ctx.closePath();
}

/** Anneau à trois arcs autour de la tourelle : la longueur de chaque arc est le niveau de la jauge. */
function drawGaugeRing(ctx: CanvasRenderingContext2D, tower: Tower, center: Point): void {
  ctx.lineWidth = 0.07;
  ctx.lineCap = "butt";
  GAUGES.forEach((gauge, index) => {
    const start = -Math.PI / 2 + (index * Math.PI * 2) / 3 + 0.14;
    ctx.strokeStyle = GAUGE_COLORS[gauge];
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(center.x, center.y, GAUGE_RING_RADIUS, start, start + GAUGE_ARC);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, GAUGE_RING_RADIUS, start, start + (GAUGE_ARC * tower.levels[gauge]) / MAX_LEVEL);
    ctx.stroke();
  });
}

/** Tourelle : socle rond, canon orienté vers son dernier tir, anneau des trois jauges. */
export function drawTower(ctx: CanvasRenderingContext2D, tower: Tower, aimAngle: number): void {
  const center = cellCenter(tower);
  drawGaugeRing(ctx, tower, center);

  ctx.fillStyle = THEME.towerFill;
  ctx.strokeStyle = THEME.ink;
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  ctx.arc(center.x, center.y, TOWER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = THEME.accent;
  ctx.lineWidth = 0.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(center.x + Math.cos(aimAngle) * TOWER_RADIUS, center.y + Math.sin(aimAngle) * TOWER_RADIUS);
  ctx.stroke();

  ctx.fillStyle = THEME.ink;
  ctx.beginPath();
  ctx.arc(center.x, center.y, 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/** Portée autour d'une case : pleine pour une tourelle sélectionnée, grisée si la pose est impossible. */
export function drawRange(ctx: CanvasRenderingContext2D, center: Point, range: number, isAllowed: boolean): void {
  ctx.fillStyle = isAllowed ? THEME.rangeFill : "transparent";
  ctx.strokeStyle = isAllowed ? THEME.range : THEME.rangeBlocked;
  ctx.lineWidth = 0.035;
  ctx.setLineDash([0.14, 0.1]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Cadre de la case sélectionnée. */
export function drawSelection(ctx: CanvasRenderingContext2D, tower: Tower): void {
  ctx.strokeStyle = THEME.accent;
  ctx.lineWidth = 0.05;
  ctx.strokeRect(tower.col + 0.03, tower.row + 0.03, 0.94, 0.94);
}

function traceEnemyShape(ctx: CanvasRenderingContext2D, kind: EnemyKind, at: Point, heading: number): void {
  const radius = ENEMY_RADIUS[kind];
  switch (kind) {
    case "normal":
      ctx.beginPath();
      ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
      return;
    case "fast":
      tracePolygon(ctx, at, radius * 1.25, { sides: 3, rotation: heading });
      return;
    case "tank":
      tracePolygon(ctx, at, radius * 1.3, { sides: 4, rotation: Math.PI / 4 });
      return;
    case "boss":
      tracePolygon(ctx, at, radius, { sides: BOSS_SIDES, rotation: 0 });
  }
}

function drawHealthBar(ctx: CanvasRenderingContext2D, enemy: Enemy, at: Point): void {
  const radius = ENEMY_RADIUS[enemy.kind];
  const width = Math.max(radius * 2.2, 0.44);
  const left = at.x - width / 2;
  const top = at.y - radius - 0.2;
  ctx.fillStyle = THEME.hpBack;
  ctx.fillRect(left - 0.02, top - 0.02, width + 0.04, 0.11);
  ctx.fillStyle = THEME.hpFill;
  ctx.fillRect(left, top, (width * enemy.hp) / enemy.maxHp, 0.07);
}

/** Ennemi : rond (normal), triangle pointé vers l'avant (rapide), carré (costaud), hexagone (boss). */
export function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
  const at = pointAlongPath(enemy.distance);
  const ahead = pointAlongPath(enemy.distance + 0.05);
  const heading = Math.atan2(ahead.y - at.y, ahead.x - at.x);
  traceEnemyShape(ctx, enemy.kind, at, heading);
  ctx.fillStyle = ENEMY_COLORS[enemy.kind];
  ctx.strokeStyle = THEME.outline;
  ctx.lineWidth = 0.05;
  ctx.fill();
  ctx.stroke();
  if (enemy.kind === "boss") {
    tracePolygon(ctx, at, ENEMY_RADIUS.boss * 0.55, { sides: BOSS_SIDES, rotation: 0 });
    ctx.strokeStyle = THEME.danger;
    ctx.lineWidth = 0.07;
    ctx.stroke();
  }
  if (enemy.hp < enemy.maxHp || enemy.kind === "boss") {
    drawHealthBar(ctx, enemy, at);
  }
}
