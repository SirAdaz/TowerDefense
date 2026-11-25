import { HALO_ORB_RADIUS } from "../game/balance.ts";
import { EFFECT_SECONDS, HIT_MARK_SECONDS } from "../game/combat.ts";
import type { GameState } from "../game/types.ts";
import { weaponLevel } from "../game/weapons.ts";
import { FONT_FAMILY, THEME } from "./theme.ts";

const FULL_TURN = Math.PI * 2;
const PULSE_RING_SECONDS = 0.3;
/** Longueur de la traînée d'un projectile, en secondes de trajet. */
const TRAIL_SECONDS = 0.05;
/** L'éclat d'impact ne dure que le début de la vie du chiffre. */
const IMPACT_SECONDS = 0.12;
const HIT_RISE = 34;
const HIT_FONT = `800 24px ${FONT_FAMILY}`;
const KILL_FONT = `800 30px ${FONT_FAMILY}`;
/** Chiffres de 0 à 999 préparés une fois : écrire un dégât ne crée aucune chaîne par image. */
const DAMAGE_LABELS = Array.from({ length: 1000 }, (_, value) => String(value));

/** Traînée des étincelles : un halo large et pâle sous un trait vif, pour les suivre de l'œil. */
function drawSparks(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.beginPath();
  for (const projectile of state.projectiles) {
    if (projectile.isActive && projectile.kind === "spark") {
      ctx.moveTo(projectile.x - projectile.vx * TRAIL_SECONDS, projectile.y - projectile.vy * TRAIL_SECONDS);
      ctx.lineTo(projectile.x, projectile.y);
    }
  }
  ctx.lineCap = "round";
  ctx.strokeStyle = THEME.sparkGlow;
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.strokeStyle = THEME.spark;
  ctx.lineWidth = 5;
  ctx.stroke();
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  drawSparks(ctx, state);

  ctx.beginPath();
  for (const projectile of state.projectiles) {
    if (projectile.isActive && projectile.kind === "lance") {
      ctx.moveTo(projectile.x + projectile.radius, projectile.y);
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, FULL_TURN);
    }
  }
  ctx.fillStyle = THEME.lance;
  ctx.fill();

  ctx.beginPath();
  for (const projectile of state.projectiles) {
    if (projectile.isActive && projectile.kind === "lance") {
      ctx.moveTo(projectile.x - projectile.vx * TRAIL_SECONDS * 4, projectile.y - projectile.vy * TRAIL_SECONDS * 4);
      ctx.lineTo(projectile.x, projectile.y);
    }
  }
  ctx.strokeStyle = THEME.lance;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineCap = "butt";
}

/** Les orbes du halo, là où la simulation les place, et l'anneau de l'onde qui vient de partir. */
export function drawAuras(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;
  const halo = weaponLevel(state, "halo");
  if (halo !== null) {
    ctx.beginPath();
    for (let index = 0; index < halo.count; index++) {
      const angle = state.weapons.halo.angle + (index / halo.count) * FULL_TURN;
      const x = player.x + Math.cos(angle) * halo.area;
      const y = player.y + Math.sin(angle) * halo.area;
      ctx.moveTo(x + HALO_ORB_RADIUS, y);
      ctx.arc(x, y, HALO_ORB_RADIUS, 0, FULL_TURN);
    }
    ctx.fillStyle = THEME.halo;
    ctx.fill();
  }
  const pulse = weaponLevel(state, "pulse");
  const pulseAge = state.weapons.pulse.effectAge;
  if (pulse !== null && pulseAge < PULSE_RING_SECONDS) {
    const progress = pulseAge / PULSE_RING_SECONDS;
    ctx.beginPath();
    ctx.arc(player.x, player.y, pulse.area * (0.35 + 0.65 * progress), 0, FULL_TURN);
    ctx.strokeStyle = THEME.pulse;
    ctx.globalAlpha = 1 - progress;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Trait brisé d'un éclair, du haut de l'arène à son point d'impact. Sa forme ne dépend que de sa position. */
function traceBolt(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const segmentCount = 6;
  ctx.moveTo(x + Math.sin(y) * 30, 0);
  for (let segment = 1; segment < segmentCount; segment++) {
    const sway = Math.sin(x * 0.7 + segment * 2.4) * 22;
    ctx.lineTo(x + sway, (y * segment) / segmentCount);
  }
  ctx.lineTo(x, y);
}

/**
 * Effets brefs : anneau d'un ennemi dissipé, impact de foudre. En mouvement réduit, la foudre garde
 * son cercle d'impact mais perd son trait lumineux sur toute la hauteur.
 */
export function drawEffects(ctx: CanvasRenderingContext2D, state: GameState, isReducedMotion: boolean): void {
  ctx.lineWidth = 2;
  for (const effect of state.effects) {
    if (!effect.isActive) {
      continue;
    }
    const progress = effect.age / EFFECT_SECONDS;
    ctx.globalAlpha = Math.max(1 - progress, 0);
    ctx.beginPath();
    if (effect.kind === "burst") {
      ctx.arc(effect.x, effect.y, effect.radius * (1 + progress), 0, FULL_TURN);
      ctx.strokeStyle = THEME.burst;
    } else {
      ctx.arc(effect.x, effect.y, effect.radius, 0, FULL_TURN);
      if (!isReducedMotion) {
        traceBolt(ctx, effect.x, effect.y);
      }
      ctx.strokeStyle = THEME.bolt;
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Éclats blancs aux points d'impact récents, en un seul tracé. */
function drawImpacts(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.beginPath();
  for (const mark of state.hitMarks) {
    if (mark.isActive && mark.age < IMPACT_SECONDS) {
      const radius = 5 + (mark.age / IMPACT_SECONDS) * 9;
      ctx.moveTo(mark.x + radius, mark.y);
      ctx.arc(mark.x, mark.y, radius, 0, FULL_TURN);
    }
  }
  ctx.fillStyle = THEME.impact;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Les chiffres d'une catégorie (coups ou coups fatals), avec un liseré sombre pour rester lisibles. */
function drawLabels(ctx: CanvasRenderingContext2D, state: GameState, isKill: boolean, isReducedMotion: boolean): void {
  ctx.font = isKill ? KILL_FONT : HIT_FONT;
  ctx.fillStyle = isKill ? THEME.killText : THEME.hitText;
  for (const mark of state.hitMarks) {
    if (!mark.isActive || mark.isKill !== isKill) {
      continue;
    }
    const progress = mark.age / HIT_MARK_SECONDS;
    const label = DAMAGE_LABELS[Math.min(Math.round(mark.amount), DAMAGE_LABELS.length - 1)] ?? "";
    const y = mark.y - 6 - (isReducedMotion ? 0 : progress * HIT_RISE);
    ctx.globalAlpha = progress < 0.6 ? 1 : (1 - progress) / 0.4;
    ctx.strokeText(label, mark.x, y);
    ctx.fillText(label, mark.x, y);
  }
  ctx.globalAlpha = 1;
}

/**
 * Retour des coups portés : un éclat au point d'impact et le chiffre des dégâts qui s'élève (les coups
 * fatals en jaune, plus gros). En mouvement réduit, le chiffre reste en place et l'éclat disparaît.
 */
export function drawHitMarks(ctx: CanvasRenderingContext2D, state: GameState, isReducedMotion: boolean): void {
  if (!isReducedMotion) {
    drawImpacts(ctx, state);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.strokeStyle = THEME.hitTextEdge;
  ctx.lineWidth = 4;
  drawLabels(ctx, state, false, isReducedMotion);
  drawLabels(ctx, state, true, isReducedMotion);
  ctx.lineJoin = "miter";
}
