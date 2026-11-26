import { Chess } from "chess.js";
import type { Move } from "chess.js";
import { bestCapture, exchangeGain } from "./exchange.ts";
import { valueOf } from "./tactics.ts";
import { passTurn } from "./threats.ts";

/** Ce que le coup de la partie a laissé à l'adversaire, quand la bonne réponse est de l'éviter. */
export type BlunderTheme = "allowedMate" | "hungPiece" | "ignoredThreat";

function playSan(chess: Chess, san: string): Move | null {
  try {
    return chess.move(san);
  } catch {
    return null;
  }
}

function allowsMateInOne(after: Chess): boolean {
  return after.moves().some((san) => san.endsWith("#"));
}

/**
 * Bilan d'une prise adverse après le coup joué. Si elle reprend sur la case où le joueur vient de
 * prendre, ce qu'il avait pris est déduit : un échange égal n'est pas une pièce perdue.
 */
function netGainAfter(after: Chess, played: Move): (move: Move) => number {
  return (move) => {
    const gain = exchangeGain(after, move);
    return played.captured !== undefined && move.to === played.to ? gain - valueOf(played.captured) : gain;
  };
}

/** La même prise, au même gain au moins, était-elle déjà possible si le joueur avait passé son tour ? */
function existedBefore(fen: string, threat: Move, minGain: number): boolean {
  const passed = passTurn(fen);
  if (passed === null) {
    return false;
  }
  const before = new Chess(passed);
  const same = before.moves({ verbose: true }).find((move) => move.from === threat.from && move.to === threat.to);
  return same !== undefined && exchangeGain(before, same) >= minGain;
}

/**
 * Thème « défensif » d'une gaffe, lu sans moteur sur la position et le coup joué :
 * - `allowedMate` : après le coup, l'adversaire mate en un ;
 * - `ignoredThreat` : l'adversaire gagne du matériel par une prise qui était déjà là avant le coup ;
 * - `hungPiece` : la prise gagnante est née du coup (pièce déplacée en prise, défenseur parti).
 * Le matériel perdu doit dépasser d'au moins `minGain` pions ce que la meilleure suite perd
 * (`solutionLoss`) : sinon la gaffe tient à autre chose, et rien n'est dit.
 */
export function detectBlunderTheme(fen: string, playedSan: string, solutionLoss: number, minGain: number): BlunderTheme | null {
  const after = new Chess(fen);
  const played = playSan(after, playedSan);
  if (played === null) {
    return null;
  }
  if (allowsMateInOne(after)) {
    return "allowedMate";
  }
  const threat = bestCapture(after, netGainAfter(after, played));
  if (threat === null || threat.gain - solutionLoss < minGain) {
    return null;
  }
  return existedBefore(fen, threat.move, minGain) ? "ignoredThreat" : "hungPiece";
}
