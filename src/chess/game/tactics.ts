import { Chess } from "chess.js";
import type { Color, Move, PieceSymbol, Square } from "chess.js";
import { PIECE_VALUES } from "./threats.ts";

/** Une suite jouée depuis une position : les coups (détaillés) et la position après chacun. */
export interface PlayedLine {
  readonly start: Chess;
  readonly moves: readonly Move[];
  readonly positions: readonly Chess[];
}

export interface BoardPiece {
  readonly square: Square;
  readonly type: PieceSymbol;
  readonly color: Color;
}

const FILES = "abcdefgh";

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAGONAL: readonly (readonly [number, number])[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Directions d'une pièce à longue portée ; vide pour les autres. */
export function sliderDirections(type: PieceSymbol): readonly (readonly [number, number])[] {
  if (type === "b") {
    return DIAGONAL;
  }
  if (type === "r") {
    return ORTHOGONAL;
  }
  return type === "q" ? [...ORTHOGONAL, ...DIAGONAL] : [];
}

export function valueOf(type: PieceSymbol): number {
  return PIECE_VALUES[type] ?? 0;
}

/** Joue une suite en notation (SAN) ; s'arrête au premier coup impossible. */
export function playLine(fen: string, sanMoves: readonly string[]): PlayedLine {
  const chess = new Chess(fen);
  const moves: Move[] = [];
  const positions: Chess[] = [];
  for (const san of sanMoves) {
    try {
      moves.push(chess.move(san));
    } catch {
      break;
    }
    positions.push(new Chess(chess.fen()));
  }
  return { start: new Chess(fen), moves, positions };
}

export function piecesOf(chess: Chess, color: Color): BoardPiece[] {
  return chess
    .board()
    .flat()
    .flatMap((piece) => (piece !== null && piece.color === color ? [{ square: piece.square, type: piece.type, color: piece.color }] : []));
}

/** Matériel d'un camp en pions (le roi ne compte pas). */
export function material(chess: Chess, color: Color): number {
  return piecesOf(chess, color).reduce((sum, piece) => sum + (piece.type === "k" ? 0 : valueOf(piece.type)), 0);
}

/** Avance du joueur `color` en matériel : lui moins l'adversaire. */
export function materialLead(chess: Chess, color: Color): number {
  return material(chess, color) - material(chess, color === "w" ? "b" : "w");
}

function step(square: string, direction: readonly [number, number]): Square | null {
  const file = FILES.indexOf(square.charAt(0)) + direction[0];
  const rank = Number(square.charAt(1)) + direction[1];
  return file < 0 || file > 7 || rank < 1 || rank > 8 ? null : (`${FILES.charAt(file)}${rank}` as Square);
}

/** Les deux premières pièces rencontrées depuis `from` dans une direction (sans compter `from`). */
export function firstTwoPieces(chess: Chess, from: string, direction: readonly [number, number]): BoardPiece[] {
  const found: BoardPiece[] = [];
  for (let square = step(from, direction); square !== null && found.length < 2; square = step(square, direction)) {
    const piece = chess.get(square);
    if (piece !== undefined) {
      found.push({ square, type: piece.type, color: piece.color });
    }
  }
  return found;
}

/**
 * Pièces adverses alignées derrière une pièce à longue portée du joueur : `front` est la première
 * rencontrée, `back` la suivante. Sert au clouage (front moins précieuse que back) et à l'enfilade.
 */
export interface Alignment {
  readonly slider: BoardPiece;
  readonly front: BoardPiece;
  readonly back: BoardPiece;
}

export function alignmentsFrom(chess: Chess, slider: BoardPiece): Alignment[] {
  const alignments: Alignment[] = [];
  for (const direction of sliderDirections(slider.type)) {
    const [front, back] = firstTwoPieces(chess, slider.square, direction);
    if (front !== undefined && back !== undefined && front.color !== slider.color && back.color !== slider.color) {
      alignments.push({ slider, front, back });
    }
  }
  return alignments;
}

/** Une pièce clouée : derrière elle, le roi ou une pièce qui vaut plus. */
export function isPin(alignment: Alignment): boolean {
  return alignment.front.type !== "k" && (alignment.back.type === "k" || valueOf(alignment.back.type) > valueOf(alignment.front.type));
}

/** Une enfilade : la pièce de devant (roi ou plus précieuse) doit partir et laisse celle de derrière. */
export function isSkewer(alignment: Alignment): boolean {
  return alignment.front.type === "k" || valueOf(alignment.front.type) > valueOf(alignment.back.type);
}

/** Cases où le joueur prend une pièce plus loin dans la suite (ses coups après le premier). */
export function laterCaptureSquares(line: PlayedLine): Set<string> {
  return new Set(line.moves.filter((move, index) => index > 0 && index % 2 === 0 && move.captured !== undefined).map((move) => move.to));
}

/** Matériel gagné par le joueur entre le départ et la fin de la suite connue. */
export function materialGain(line: PlayedLine): number {
  const color = line.start.turn();
  const end = line.positions.at(-1) ?? line.start;
  return materialLead(end, color) - materialLead(line.start, color);
}
