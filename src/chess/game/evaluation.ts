import type { EngineScore, MoveQuality, PuzzleKind } from "./types.ts";

/**
 * Au-delà de 10 pions, la partie est décidée : borner l'évaluation évite de compter comme gaffe
 * le passage de +15 à +11, et donne une valeur aux mats.
 */
export const CP_LIMIT = 1000;

/** Seuils en centipions perdus, doublés d'une perte minimale de chances de gain (en points). */
export const BLUNDER = { lossCp: 200, winDrop: 10 } as const;
export const MISTAKE = { lossCp: 100, winDrop: 5 } as const;
export const INACCURACY = { lossCp: 50, winDrop: 2.5 } as const;

/** Un mat manqué ne devient un problème que s'il était court : au-delà, il est introuvable en partie. */
export const MISSED_MATE_MAX_MOVES = 5;

/** En dessous, la position était déjà perdue : chercher le meilleur coup n'apprend rien. */
export const HOPELESS_CP = -500;

/** Évaluation du moteur ramenée au point de vue du joueur, quel que soit le camp au trait. */
export interface PlayerView {
  /** Centipions bornés à ±CP_LIMIT ; un mat vaut la borne. */
  readonly cp: number;
  readonly mate: "none" | "winning" | "losing";
  /** Nombre de coups avant le mat (0 : le mat est sur l'échiquier). */
  readonly mateMoves: number;
}

/**
 * Le moteur évalue pour le camp au trait ; « mat en 0 » veut dire que ce camp est maté.
 * Le signe seul ne suffit donc pas à retourner un mat : on garde qui mate.
 */
export function toPlayerView(score: EngineScore, isPlayerToMove: boolean): PlayerView {
  if (score.kind === "cp") {
    const cp = Math.max(-CP_LIMIT, Math.min(CP_LIMIT, score.value));
    return { cp: isPlayerToMove || cp === 0 ? cp : -cp, mate: "none", mateMoves: 0 };
  }
  const isSideToMoveWinning = score.value > 0;
  const isPlayerWinning = isSideToMoveWinning === isPlayerToMove;
  return {
    cp: isPlayerWinning ? CP_LIMIT : -CP_LIMIT,
    mate: isPlayerWinning ? "winning" : "losing",
    mateMoves: Math.abs(score.value),
  };
}

/**
 * Chances de gain (0 à 100) pour une évaluation en centipions : courbe logistique ajustée sur des
 * parties réelles (celle de Lichess). Perdre 2 pions à égalité coûte bien plus qu'à +8.
 */
export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Précision d'un coup (0 à 100) selon les chances de gain perdues, formule de Lichess. */
export function moveAccuracy(cpBefore: number, cpAfter: number): number {
  const winDrop = Math.max(0, winPercent(cpBefore) - winPercent(cpAfter));
  const accuracy = 103.1668 * Math.exp(-0.04354 * winDrop) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

function exceeds(threshold: { lossCp: number; winDrop: number }, lossCp: number, winDrop: number): boolean {
  return lossCp >= threshold.lossCp && winDrop >= threshold.winDrop;
}

/** Qualité d'un coup d'après l'évaluation avant et après, vues du joueur, en centipions bornés. */
export function classifyMove(cpBefore: number, cpAfter: number): MoveQuality {
  const lossCp = cpBefore - cpAfter;
  const winDrop = winPercent(cpBefore) - winPercent(cpAfter);
  if (exceeds(BLUNDER, lossCp, winDrop)) {
    return "blunder";
  }
  if (exceeds(MISTAKE, lossCp, winDrop)) {
    return "mistake";
  }
  return exceeds(INACCURACY, lossCp, winDrop) ? "inaccuracy" : "good";
}

/**
 * Dit si un coup mérite un problème, et lequel.
 * Un mat court manqué compte même si la position reste gagnante : c'est le coup à voir en partie.
 */
export function puzzleKind(before: PlayerView, after: PlayerView): PuzzleKind | null {
  if (before.cp <= HOPELESS_CP) {
    return null;
  }
  const hasShortMate = before.mate === "winning" && before.mateMoves <= MISSED_MATE_MAX_MOVES;
  if (hasShortMate && after.mate !== "winning") {
    return "missedMate";
  }
  if (classifyMove(before.cp, after.cp) !== "blunder") {
    return null;
  }
  return after.mate === "losing" ? "allowedMate" : "blunder";
}
