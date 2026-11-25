import { ARENA_WIDTH, PLAYER } from "../game/balance.ts";
import type { Enemy, EnemyKind, GameState } from "../game/types.ts";
import { ENEMY_COLORS, FONT_FAMILY, THEME } from "./theme.ts";

const HORDE_KINDS: readonly EnemyKind[] = ["drifter", "swarmer", "brute", "charger"];
const FULL_TURN = Math.PI * 2;
const TELEGRAPH_DASH = [10, 8];
const NO_DASH: number[] = [];

/** Ajoute la silhouette d'un ennemi au tracé en cours : rond, triangle, carré ou losange selon son type. */
function traceEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, radius: number): void {
  const { x, y } = enemy;
  if (enemy.kind === "swarmer") {
    ctx.moveTo(x + enemy.dashX * radius * 1.5, y + enemy.dashY * radius * 1.5);
    ctx.lineTo(x - enemy.dashX * radius - enemy.dashY * radius, y - enemy.dashY * radius + enemy.dashX * radius);
    ctx.lineTo(x - enemy.dashX * radius + enemy.dashY * radius, y - enemy.dashY * radius - enemy.dashX * radius);
    ctx.closePath();
  } else if (enemy.kind === "brute") {
    ctx.rect(x - radius * 0.9, y - radius * 0.9, radius * 1.8, radius * 1.8);
  } else if (enemy.kind === "charger") {
    ctx.moveTo(x, y - radius * 1.25);
    ctx.lineTo(x + radius * 1.25, y);
    ctx.lineTo(x, y + radius * 1.25);
    ctx.lineTo(x - radius * 1.25, y);
    ctx.closePath();
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, FULL_TURN);
  }
}

/** Un seul tracé et un seul remplissage par type : des centaines d'ennemis coûtent quelques appels. */
function drawKind(ctx: CanvasRenderingContext2D, state: GameState, kind: EnemyKind): void {
  ctx.beginPath();
  for (const enemy of state.enemies) {
    if (enemy.isActive && enemy.kind === kind) {
      traceEnemy(ctx, enemy, enemy.radius);
    }
  }
  ctx.fillStyle = ENEMY_COLORS[kind];
  ctx.fill();
}

/** Liseré clair des élites. */
function drawEliteRings(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.beginPath();
  for (const enemy of state.enemies) {
    if (enemy.isActive && enemy.isElite) {
      traceEnemy(ctx, enemy, enemy.radius + 3);
    }
  }
  ctx.strokeStyle = THEME.eliteRing;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Trait pointillé qui annonce la direction d'une charge pendant son temps d'arrêt. */
function drawTelegraphs(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.beginPath();
  for (const enemy of state.enemies) {
    if (enemy.isActive && enemy.stage === "windup") {
      ctx.moveTo(enemy.x, enemy.y);
      ctx.lineTo(enemy.x + enemy.dashX * 230, enemy.y + enemy.dashY * 230);
    }
  }
  ctx.strokeStyle = THEME.telegraph;
  ctx.lineWidth = 2;
  ctx.setLineDash(TELEGRAPH_DASH);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
}

/** Éclat blanc bref des ennemis qui viennent d'être touchés. */
function drawHitFlashes(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.beginPath();
  for (const enemy of state.enemies) {
    if (enemy.isActive && enemy.flashTimer > 0 && enemy.kind !== "boss") {
      traceEnemy(ctx, enemy, enemy.radius);
    }
  }
  ctx.fillStyle = THEME.flash;
  ctx.fill();
}

/** Le boss : un disque noir cerclé de lumière, et sa barre de vie en haut de l'arène. */
function drawBoss(ctx: CanvasRenderingContext2D, boss: Enemy): void {
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.radius, 0, FULL_TURN);
  ctx.fillStyle = THEME.bossCore;
  ctx.fill();
  ctx.strokeStyle = THEME.bossCorona;
  ctx.lineWidth = boss.stage === "windup" ? 9 : 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.radius + 10, 0, FULL_TURN);
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const barWidth = 520;
  const barX = (ARENA_WIDTH - barWidth) / 2;
  ctx.fillStyle = THEME.bossBarBack;
  ctx.fillRect(barX - 2, 62, barWidth + 4, 16);
  ctx.fillStyle = THEME.bossBarFill;
  ctx.fillRect(barX, 64, barWidth * Math.max(boss.hp / boss.maxHp, 0), 12);
  ctx.fillStyle = THEME.label;
  ctx.font = `600 18px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.fillText("L'Éclipse", ARENA_WIDTH / 2, 100);
}

export function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState, isReducedMotion: boolean): void {
  for (const kind of HORDE_KINDS) {
    drawKind(ctx, state, kind);
  }
  drawEliteRings(ctx, state);
  drawTelegraphs(ctx, state);
  if (!isReducedMotion) {
    drawHitFlashes(ctx, state);
  }
  for (const enemy of state.enemies) {
    if (enemy.isActive && enemy.kind === "boss") {
      drawBoss(ctx, enemy);
    }
  }
}

export function drawGems(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.beginPath();
  for (const gem of state.gems) {
    if (!gem.isActive) {
      continue;
    }
    const size = gem.value >= 5 ? 9 : 6;
    ctx.moveTo(gem.x, gem.y - size);
    ctx.lineTo(gem.x + size, gem.y);
    ctx.lineTo(gem.x, gem.y + size);
    ctx.lineTo(gem.x - size, gem.y);
    ctx.closePath();
  }
  ctx.fillStyle = THEME.gem;
  ctx.fill();
}

/**
 * La luciole du joueur, sa portée de ramassage et sa vie juste en dessous (là où il regarde).
 * Après un coup elle clignote le temps de l'invulnérabilité ; en mouvement réduit, elle pâlit sans clignoter.
 */
export function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, isReducedMotion: boolean): void {
  const { player, stats } = state;
  ctx.beginPath();
  ctx.arc(player.x, player.y, stats.pickupRadius, 0, FULL_TURN);
  ctx.fillStyle = THEME.pickupRing;
  ctx.fill();

  const isHurt = player.hurtTimer > 0;
  const isBlinkOff = isHurt && !isReducedMotion && Math.floor(player.hurtTimer * 16) % 2 === 0;
  ctx.globalAlpha = isBlinkOff || (isHurt && isReducedMotion) ? 0.45 : 1;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER.radius + 7, 0, FULL_TURN);
  ctx.fillStyle = "rgba(255, 226, 122, 0.28)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER.radius, 0, FULL_TURN);
  ctx.fillStyle = THEME.player;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER.radius * 0.45, 0, FULL_TURN);
  ctx.fillStyle = THEME.playerCore;
  ctx.fill();
  ctx.globalAlpha = 1;

  const barWidth = 44;
  ctx.fillStyle = THEME.hpBack;
  ctx.fillRect(player.x - barWidth / 2 - 1, player.y + 23, barWidth + 2, 7);
  ctx.fillStyle = THEME.hpFill;
  ctx.fillRect(player.x - barWidth / 2, player.y + 24, barWidth * Math.max(player.hp / stats.maxHp, 0), 5);
}
