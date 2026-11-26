import { Chess } from "chess.js";
import type { ExploreEngine } from "../data/exploreEngine.ts";
import { toPlayerView } from "../game/evaluation.ts";
import { formatPawnsSigned } from "../game/explore.ts";
import { isEquivalentMove } from "../game/repertoire.ts";
import type { OpeningDrill } from "../game/types.ts";
import { playUci } from "./puzzleText.ts";

/** Jugement d'un coup d'ouverture : accepté ou non, avec la phrase à dire au joueur. */
export interface OpeningVerdict {
  readonly isAccepted: boolean;
  readonly text: string;
}

/**
 * Juge un coup dans la position d'ouverture : un coup déjà joué là dans les parties est refusé
 * d'office, le coup du moteur accepté d'office ; un autre coup est évalué par le moteur et accepté
 * s'il se vaut (`isEquivalentMove`). Rejette si le moteur ne démarre pas.
 */
export async function judgeOpeningMove(engine: ExploreEngine, drill: OpeningDrill, uci: string): Promise<OpeningVerdict> {
  const played = playUci(drill.fen, uci);
  const moveName = played?.san ?? uci;
  if (played === null) {
    return { isAccepted: false, text: `${moveName} : coup impossible.` };
  }
  if (drill.playedUcis.includes(uci)) {
    return { isAccepted: false, text: `${moveName} : c'est le coup de vos parties, celui qui fait sortir de la route. Réessayez.` };
  }
  if (uci === drill.bestUci) {
    return { isAccepted: true, text: `Oui : ${moveName}, le coup du moteur.` };
  }
  if (new Chess(played.fen).isCheckmate()) {
    return { isAccepted: true, text: `${moveName} : échec et mat.` };
  }
  const best = await engine.bestLine(played.fen);
  const cpAfter = best === null ? 0 : toPlayerView(best.score, false).cp;
  const evaluation = `${formatPawnsSigned(drill.cpBefore)} avant, ${formatPawnsSigned(cpAfter)} après`;
  if (isEquivalentMove(drill.cpBefore, cpAfter)) {
    return { isAccepted: true, text: `Bon coup : ${moveName} se vaut avec celui du moteur (${evaluation}).` };
  }
  return { isAccepted: false, text: `${moveName} perd du terrain : ${evaluation}. Réessayez, ou voyez le bon coup.` };
}
