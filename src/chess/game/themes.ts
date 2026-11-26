import type { Chess, Move } from "chess.js";
import { detectBlunderTheme } from "./blunderThemes.ts";
import { exchangeGain } from "./exchange.ts";
import { phaseOf } from "./pgn.ts";
import { selectSession } from "./schedule.ts";
import {
  alignmentsFrom,
  isPin,
  isSkewer,
  laterCaptureSquares,
  materialGain,
  piecesOf,
  playLine,
  sliderDirections,
  firstTwoPieces,
  valueOf,
} from "./tactics.ts";
import type { BoardPiece, PlayedLine } from "./tactics.ts";
import type { Puzzle } from "./types.ts";

export type TacticTheme =
  | "mateIn1"
  | "mateIn2"
  | "mateIn3"
  | "hangingPiece"
  | "fork"
  | "discoveredAttack"
  | "pin"
  | "skewer"
  | "allowedMate"
  | "hungPiece"
  | "ignoredThreat"
  | "endgame"
  | "other";

export const THEME_NAMES: Readonly<Record<TacticTheme, string>> = {
  mateIn1: "Mat en 1",
  mateIn2: "Mat en 2",
  mateIn3: "Mat en 3",
  hangingPiece: "Pièce en prise",
  fork: "Fourchette",
  discoveredAttack: "Attaque à la découverte",
  pin: "Clouage",
  skewer: "Enfilade",
  allowedMate: "Mat à parer",
  hungPiece: "Pièce laissée en prise",
  ignoredThreat: "Menace ignorée",
  endgame: "Finale",
  other: "Autre",
};

/**
 * Un thème de gain n'est retenu que si la suite du moteur gagne au moins 2 pions (sauf mat) ; un
 * thème de défense, que si le coup joué perd au moins 2 pions de plus que la meilleure suite.
 * 2 pions : la qualité (tour contre pièce mineure) compte, un pion seul non.
 */
export const MIN_THEME_GAIN = 2;

/** Pièce de valeur pour une fourchette ou une découverte : au moins un cavalier. */
const MIN_TARGET_VALUE = 3;

function isWorthTarget(chess: Chess, piece: BoardPiece, attackerValue: number): boolean {
  if (piece.type === "k") {
    return true;
  }
  const isUndefended = chess.attackers(piece.square, piece.color).length === 0;
  return valueOf(piece.type) > attackerValue || (isUndefended && valueOf(piece.type) >= MIN_TARGET_VALUE);
}

/** Le premier coup prend une pièce non défendue ou mal défendue : l'échange sur la case gagne au moins 2 pions. */
function isHangingCapture(line: PlayedLine, first: Move): boolean {
  return first.captured !== undefined && exchangeGain(line.start, first) >= MIN_THEME_GAIN;
}

/**
 * Plus loin dans la suite (après un échec ou un échange), le joueur prend une pièce non défendue ou
 * mal défendue. Vient après les motifs : une fourchette ou un clouage finit aussi par une prise.
 */
function isLaterHangingCapture(line: PlayedLine): boolean {
  return line.moves.some((move, index) => {
    const before = line.positions[index - 1];
    return index > 0 && index % 2 === 0 && move.captured !== undefined && before !== undefined && exchangeGain(before, move) >= MIN_THEME_GAIN;
  });
}

/**
 * Le premier coup attaque au moins deux pièces de valeur, et la suite en prend une. Quand il donne
 * échec, la suite peut gagner autrement (la pièce attaquée se sauve en cédant autre chose) : le
 * gain de la suite, déjà exigé, suffit.
 */
function isFork(line: PlayedLine, first: Move): boolean {
  const after = line.positions[0];
  if (after === undefined) {
    return false;
  }
  const opponent = after.turn();
  const targets = piecesOf(after, opponent).filter(
    (piece) => after.attackers(piece.square, first.color).includes(first.to) && isWorthTarget(after, piece, valueOf(first.piece)),
  );
  const captured = laterCaptureSquares(line);
  return targets.length >= 2 && (after.inCheck() || targets.some((target) => captured.has(target.square)));
}

/** Le premier coup démasque une pièce à longue portée sur un roi ou une pièce de valeur. */
function isDiscoveredAttack(line: PlayedLine, first: Move): boolean {
  const after = line.positions[0];
  if (after === undefined) {
    return false;
  }
  const captured = laterCaptureSquares(line);
  const sliders = piecesOf(after, first.color).filter((piece) => piece.square !== first.to);
  return sliders.some((slider) =>
    sliderDirections(slider.type).some((direction) => {
      const [blocker] = firstTwoPieces(line.start, slider.square, direction);
      const [target] = firstTwoPieces(after, slider.square, direction);
      const isUnmasked = blocker?.square === first.from && target !== undefined && target.color !== first.color;
      return isUnmasked && (target.type === "k" || (valueOf(target.type) >= MIN_TARGET_VALUE && captured.has(target.square)));
    }),
  );
}

/** Après le premier coup, une pièce adverse est clouée (créé ou attaquée par ce coup), et la suite la prend. */
function isPinTactic(line: PlayedLine, first: Move): boolean {
  const after = line.positions[0];
  if (after === undefined) {
    return false;
  }
  const captured = laterCaptureSquares(line);
  const pins = piecesOf(after, first.color)
    .flatMap((slider) => alignmentsFrom(after, slider))
    .filter((alignment) => isPin(alignment) && captured.has(alignment.front.square));
  return pins.some(
    (pin) => pin.slider.square === first.to || after.attackers(pin.front.square, first.color).includes(first.to),
  );
}

/** La pièce jouée attaque une pièce de valeur qui, en partant, laisse celle de derrière, prise ensuite. */
function isSkewerTactic(line: PlayedLine, first: Move): boolean {
  const after = line.positions[0];
  const moved = after?.get(first.to);
  if (after === undefined || moved === undefined) {
    return false;
  }
  const captured = laterCaptureSquares(line);
  return alignmentsFrom(after, { square: first.to, type: moved.type, color: moved.color }).some(
    (alignment) => isSkewer(alignment) && captured.has(alignment.back.square),
  );
}

const MATERIAL_THEMES: readonly (readonly [TacticTheme, (line: PlayedLine, first: Move) => boolean])[] = [
  ["hangingPiece", isHangingCapture],
  ["fork", isFork],
  ["discoveredAttack", isDiscoveredAttack],
  ["pin", isPinTactic],
  ["skewer", isSkewerTactic],
  ["hangingPiece", isLaterHangingCapture],
];

/** Mat donné au premier, deuxième ou troisième coup du joueur dans la suite. */
function mateTheme(line: PlayedLine): TacticTheme | null {
  const mates: readonly TacticTheme[] = ["mateIn1", "mateIn2", "mateIn3"];
  const index = mates.findIndex((_, moveNumber) => line.positions[moveNumber * 2]?.isCheckmate() === true);
  return mates[index] ?? null;
}

function materialTheme(line: PlayedLine, first: Move): TacticTheme | null {
  if (materialGain(line) < MIN_THEME_GAIN) {
    return null;
  }
  return MATERIAL_THEMES.find(([, matches]) => matches(line, first))?.[0] ?? null;
}

/** La bonne réponse évite une perte : ce que le coup de la partie a laissé (voir `blunderThemes.ts`). */
function defenceTheme(puzzle: ThemedPuzzle, line: PlayedLine): TacticTheme | null {
  if (puzzle.kind === "allowedMate") {
    return "allowedMate";
  }
  if (puzzle.playedSan === undefined) {
    return null;
  }
  return detectBlunderTheme(puzzle.fen, puzzle.playedSan, Math.max(0, -materialGain(line)), MIN_THEME_GAIN);
}

/** Ce que lit la détection : la position, la suite du moteur, et si possible le coup joué et le type. */
export type ThemedPuzzle = Pick<Puzzle, "fen" | "solutionLine"> & Partial<Pick<Puzzle, "playedSan" | "kind">>;

/**
 * Thème d'un problème, lu sans moteur sur sa suite gardée (meilleur coup puis réponses, 6
 * demi-coups au plus) et sur le coup de la partie. Dans l'ordre, le premier qui colle gagne :
 * 1. mat en 1, 2 ou 3 ;
 * 2. la suite gagne au moins 2 pions : pièce en prise, fourchette, découverte, clouage, enfilade,
 *    puis pièce en prise plus loin dans la suite ;
 * 3. le coup joué perdait : mat à parer, menace ignorée, pièce laissée en prise ;
 * 4. position de finale : « finale » ; rien de sûr : « autre ».
 * Calculé à chaque ouverture de la page (rien n'est gardé) : un changement ici reclasse aussi les
 * problèmes déjà enregistrés.
 */
export function detectTheme(puzzle: ThemedPuzzle): TacticTheme {
  const line = playLine(puzzle.fen, puzzle.solutionLine);
  const first = line.moves[0];
  if (first === undefined) {
    return "other";
  }
  const found = mateTheme(line) ?? materialTheme(line, first) ?? defenceTheme(puzzle, line);
  if (found !== null) {
    return found;
  }
  return phaseOf(puzzle.fen, Number.MAX_SAFE_INTEGER) === "endgame" ? "endgame" : "other";
}

/** Bilan d'un thème : combien de fois raté en partie (un problème par gaffe), et la réussite à l'entraînement. */
export interface ThemeStat {
  readonly theme: TacticTheme;
  readonly count: number;
  readonly attempts: number;
  readonly successes: number;
  /** Part des tentatives réussies (0 à 1), `null` sans tentative. */
  readonly successRate: number | null;
}

/** Thèmes du plus raté au moins raté ; à égalité, le moins bien réussi d'abord. « Autre » toujours à la fin. */
export function themeStats(puzzles: readonly Puzzle[], themeOf: (puzzle: Puzzle) => TacticTheme): ThemeStat[] {
  const byTheme = new Map<TacticTheme, ThemeStat>();
  for (const puzzle of puzzles) {
    const theme = themeOf(puzzle);
    const current = byTheme.get(theme) ?? { theme, count: 0, attempts: 0, successes: 0, successRate: null };
    const attempts = current.attempts + puzzle.review.attempts;
    const successes = current.successes + puzzle.review.successes;
    byTheme.set(theme, { theme, count: current.count + 1, attempts, successes, successRate: attempts === 0 ? null : successes / attempts });
  }
  const rank = (stat: ThemeStat) => [stat.theme === "other" ? 1 : 0, -stat.count, stat.successRate ?? 1] as const;
  return [...byTheme.values()].sort((a, b) => {
    const [left, right] = [rank(a), rank(b)];
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  });
}

/**
 * Séance sur un thème : ses problèmes dus d'abord (ordre habituel), puis les autres du thème, du
 * plus proche de son échéance au plus lointain : on peut s'entraîner sur un thème à tout moment.
 */
export function selectThemeSession(
  puzzles: readonly Puzzle[],
  now: number,
  theme: TacticTheme | null,
  themeOf: (puzzle: Puzzle) => TacticTheme,
): Puzzle[] {
  if (theme === null) {
    return selectSession(puzzles, now);
  }
  const ofTheme = puzzles.filter((puzzle) => themeOf(puzzle) === theme);
  const due = selectSession(ofTheme, now);
  const dueIds = new Set(due.map((puzzle) => puzzle.id));
  const ahead = ofTheme.filter((puzzle) => !dueIds.has(puzzle.id)).sort((a, b) => a.review.dueAt - b.review.dueAt);
  return [...due, ...ahead];
}
