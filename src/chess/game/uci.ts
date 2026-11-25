import type { EngineLine, EngineScore } from "./types.ts";

/** Une ligne `info` du moteur réduite à ce qui sert : rang de la variante, profondeur, évaluation, suite. */
export interface InfoLine extends EngineLine {
  readonly multiPv: number;
  readonly depth: number;
  /** Faux pour une borne (`lowerbound`/`upperbound`) : l'évaluation n'est alors qu'un encadrement. */
  readonly isExact: boolean;
}

export interface UciMove {
  readonly from: string;
  readonly to: string;
  readonly promotion?: string;
}

const UCI_MOVE_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

function numberAfter(tokens: readonly string[], keyword: string): number | null {
  const index = tokens.indexOf(keyword);
  const parsed = index === -1 ? Number.NaN : Number(tokens[index + 1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScore(tokens: readonly string[]): EngineScore | null {
  const index = tokens.indexOf("score");
  const kind = tokens[index + 1];
  const scoreValue = Number(tokens[index + 2]);
  if (index === -1 || (kind !== "cp" && kind !== "mate") || !Number.isFinite(scoreValue)) {
    return null;
  }
  return { kind, value: scoreValue };
}

/** Lit une ligne `info … score … pv …` ; `null` pour les autres lignes (statistiques, `currmove`…). */
export function parseInfoLine(line: string): InfoLine | null {
  const tokens = line.trim().split(/\s+/);
  const pvIndex = tokens.indexOf("pv");
  const score = parseScore(tokens);
  const depth = numberAfter(tokens, "depth");
  const firstMove = tokens[pvIndex + 1];
  if (tokens[0] !== "info" || pvIndex === -1 || score === null || depth === null || firstMove === undefined) {
    return null;
  }
  const isBound = tokens.includes("lowerbound") || tokens.includes("upperbound");
  return {
    multiPv: numberAfter(tokens, "multipv") ?? 1,
    depth,
    score,
    isExact: !isBound,
    moveUci: firstMove,
    pvUci: tokens.slice(pvIndex + 1),
  };
}

/** Vrai quand le moteur annonce la fin de sa recherche. */
export function isBestMoveLine(line: string): boolean {
  return line.startsWith("bestmove");
}

function isBetterLine(candidate: InfoLine, current: InfoLine | undefined): boolean {
  if (current === undefined) {
    return true;
  }
  if (candidate.isExact !== current.isExact) {
    return candidate.isExact;
  }
  return candidate.depth >= current.depth;
}

/**
 * Garde, pour chaque variante, la ligne exacte la plus profonde : une borne (recherche coupée par le
 * temps) n'est retenue que faute de mieux. Renvoie les variantes de la meilleure à la moins bonne.
 */
export function collectLines(infoLines: readonly InfoLine[]): EngineLine[] {
  const deepestByRank = new Map<number, InfoLine>();
  for (const infoLine of infoLines) {
    if (isBetterLine(infoLine, deepestByRank.get(infoLine.multiPv))) {
      deepestByRank.set(infoLine.multiPv, infoLine);
    }
  }
  return [...deepestByRank.values()]
    .sort((a, b) => a.multiPv - b.multiPv)
    .map((infoLine) => ({ moveUci: infoLine.moveUci, score: infoLine.score, pvUci: infoLine.pvUci }));
}

/** Découpe un coup UCI (`e7e8q`) ; `null` s'il est mal formé. */
export function parseUciMove(uci: string): UciMove | null {
  const match = UCI_MOVE_PATTERN.exec(uci);
  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }
  return match[3] === undefined ? { from: match[1], to: match[2] } : { from: match[1], to: match[2], promotion: match[3] };
}
