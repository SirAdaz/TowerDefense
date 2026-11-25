import type { PlayerColor } from "./types.ts";

/** Lettres des pièces en notation française (Cavalier, Fou, Tour, Dame, Roi). */
const FRENCH_LETTERS: Readonly<Record<string, string>> = { N: "C", B: "F", R: "T", Q: "D", K: "R" };

const PIECE_NAMES: Readonly<Record<string, string>> = {
  p: "pion",
  n: "cavalier",
  b: "fou",
  r: "tour",
  q: "dame",
  k: "roi",
};

export const FILES = "abcdefgh";

/** Notation d'un coup avec les lettres françaises : `Nxf7+` devient `Cxf7+`, les roques ne changent pas. */
export function frenchSan(san: string): string {
  return san.replace(/[NBRQK]/g, (letter) => FRENCH_LETTERS[letter] ?? letter);
}

/**
 * Suite de coups numérotée à partir de la position (`12. Dxf7+ Rh8 13. Dg7#`, ou `12… Cf6` si les
 * noirs commencent), pour afficher la solution d'un problème.
 */
export function formatLine(fen: string, sanMoves: readonly string[]): string {
  const fields = fen.split(" ");
  let isWhiteToMove = fields[1] !== "b";
  let moveNumber = Number(fields[5]) || 1;
  const parts: string[] = [];
  sanMoves.forEach((san, index) => {
    if (isWhiteToMove) {
      parts.push(`${moveNumber}. ${frenchSan(san)}`);
    } else {
      parts.push(index === 0 ? `${moveNumber}… ${frenchSan(san)}` : frenchSan(san));
      moveNumber += 1;
    }
    isWhiteToMove = !isWhiteToMove;
  });
  return parts.join(" ");
}

/** Nom d'une case pour un lecteur d'écran : « e4, cavalier blanc » ou « e4, vide ». */
export function squareLabel(square: string, piece: { type: string; color: string } | null): string {
  if (piece === null) {
    return `${square}, vide`;
  }
  const pieceName = PIECE_NAMES[piece.type] ?? "pièce";
  const isFeminine = piece.type === "r" || piece.type === "q";
  const whiteWord = isFeminine ? "blanche" : "blanc";
  const blackWord = isFeminine ? "noire" : "noir";
  return `${square}, ${pieceName} ${piece.color === "w" ? whiteWord : blackWord}`;
}

/**
 * Case affichée à la ligne `row` et à la colonne `column` de l'échiquier (0 = en haut à gauche) :
 * le camp du joueur est toujours en bas.
 */
export function squareAt(row: number, column: number, orientation: PlayerColor): string {
  const fileIndex = orientation === "white" ? column : 7 - column;
  const rank = orientation === "white" ? 8 - row : row + 1;
  return `${FILES[fileIndex] ?? "a"}${rank}`;
}
