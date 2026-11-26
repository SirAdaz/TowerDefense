import { Chess } from "chess.js";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { toPlayerView } from "../game/evaluation.ts";
import { formatPawnsSigned } from "../game/explore.ts";
import { isGoodParry } from "../game/threats.ts";
import type { DefenseDrill } from "../game/types.ts";
import { playUci } from "./puzzleText.ts";

/** Jugement d'une parade : acceptée ou non, avec la phrase à dire au joueur. */
export interface ParryVerdict {
  readonly isAccepted: boolean;
  readonly text: string;
}

/**
 * Juge une parade : le coup de la partie est refusé d'office, le meilleur coup du moteur accepté
 * d'office ; un autre coup est évalué par le moteur et accepté s'il garde la position (`isGoodParry`).
 * Rejette si le moteur ne démarre pas.
 */
export async function judgeParry(engine: ExploreEngine, drill: DefenseDrill, uci: string): Promise<ParryVerdict> {
  const played = playUci(drill.fen, uci);
  const moveName = played?.san ?? uci;
  if (played === null) {
    return { isAccepted: false, text: `${moveName} : coup impossible.` };
  }
  if (uci === drill.playedUci) {
    return { isAccepted: false, text: `${moveName} : c'est le coup de la partie, il laisse passer la menace. Réessayez.` };
  }
  if (uci === drill.bestUci) {
    return { isAccepted: true, text: `Bien paré : ${moveName}, le coup du moteur.` };
  }
  if (new Chess(played.fen).isCheckmate()) {
    return { isAccepted: true, text: `${moveName} : échec et mat, encore mieux qu'une parade.` };
  }
  const best = await engine.bestLine(played.fen);
  const cpAfter = best === null ? 0 : toPlayerView(best.score, false).cp;
  const evaluation = `${formatPawnsSigned(drill.cpBefore)} avant, ${formatPawnsSigned(cpAfter)} après`;
  if (isGoodParry(drill.cpBefore, cpAfter)) {
    return { isAccepted: true, text: `Bien paré : ${moveName} garde la position (${evaluation}).` };
  }
  return { isAccepted: false, text: `${moveName} ne pare pas : ${evaluation}. Réessayez, ou voyez une parade.` };
}
