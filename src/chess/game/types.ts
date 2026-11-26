/** Cadences suivies : chacune a son bilan, elles ne sont jamais mélangées. */
export type TimeClass = "bullet" | "blitz" | "rapid";

export type PlayerColor = "white" | "black";

export type GameResult = "win" | "draw" | "loss";

export type MoveQuality = "good" | "inaccuracy" | "mistake" | "blunder";

export type GamePhase = "opening" | "middlegame" | "endgame";

/** Phase où une partie perdue a basculé ; `other` : perdue sans position perdante (temps, abandon). */
export type LostPhase = GamePhase | "other";

/** Évaluation du moteur, du point de vue du camp au trait. `mate` : nombre de coups avant le mat. */
export interface EngineScore {
  readonly kind: "cp" | "mate";
  readonly value: number;
}

/** Une variante du moteur : son premier coup, son évaluation et la suite prévue (coups UCI). */
export interface EngineLine {
  readonly moveUci: string;
  readonly score: EngineScore;
  readonly pvUci: readonly string[];
}

/** Partie telle que la fournit le site, réduite à ce dont l'analyse a besoin. */
export interface RawGame {
  readonly id: string;
  readonly url: string;
  readonly pgn: string;
  readonly timeClass: TimeClass;
  /** Fin de la partie, en secondes Unix. */
  readonly endTime: number;
  readonly playerColor: PlayerColor;
  readonly result: GameResult;
}

/** Un demi-coup de la partie, avec la position d'où il part. */
export interface ParsedMove {
  readonly san: string;
  readonly uci: string;
  readonly fenBefore: string;
  readonly color: PlayerColor;
  /** Pendule du joueur après son coup, en secondes ; `null` si le PGN n'a pas d'horloge. */
  readonly clockSeconds: number | null;
}

export interface ParsedGame {
  readonly moves: readonly ParsedMove[];
  readonly finalFen: string;
  readonly openingName: string;
  readonly eco: string;
}

/** Un coup du joueur une fois évalué. Les évaluations sont en centipions, vues de son côté, bornées. */
export interface MoveReview {
  readonly ply: number;
  readonly san: string;
  readonly cpBefore: number;
  readonly cpAfter: number;
  readonly quality: MoveQuality;
  readonly phase: GamePhase;
  readonly clockSeconds: number | null;
}

/** Résultat gardé pour une partie analysée : tout ce que le bilan lit, sans le PGN. */
export interface AnalysedGame {
  readonly id: string;
  readonly url: string;
  readonly username: string;
  readonly timeClass: TimeClass;
  readonly endTime: number;
  readonly playerColor: PlayerColor;
  readonly result: GameResult;
  readonly openingName: string;
  readonly eco: string;
  /** Précision moyenne des coups du joueur, de 0 à 100. */
  readonly accuracy: number;
  readonly moves: readonly MoveReview[];
  /** `null` si la partie n'est pas perdue. */
  readonly lostPhase: LostPhase | null;
  /** De quoi revoir la partie coup par coup ; absent des parties analysées avant la revue (refaite à l'ouverture). */
  readonly timeline?: GameTimeline;
}

/**
 * Revue d'une partie : son PGN (coups, pendules, ouverture, adversaire) et, pour chaque position,
 * l'évaluation et le meilleur coup du moteur. Quelques Ko par partie.
 */
export interface GameTimeline {
  readonly pgn: string;
  /** `scores[i]` évalue la position avant le demi-coup `i` (camp au trait) ; le dernier, la position finale. */
  readonly scores: readonly EngineScore[];
  /** Meilleur coup du moteur (UCI) dans chaque position avant un demi-coup ; "" s'il manque. */
  readonly bestMoves: readonly string[];
}

export type PuzzleKind = "blunder" | "missedMate" | "allowedMate";

/** Position d'une partie où le coup joué a coûté cher : candidate à devenir un problème. */
export interface PuzzleCandidate {
  readonly ply: number;
  readonly fen: string;
  readonly playedUci: string;
  readonly playedSan: string;
  readonly kind: PuzzleKind;
  /** Coup adverse qui a mené à la position, pour le montrer sur le plateau. */
  readonly previousMoveUci: string | null;
}

export interface PuzzleMove {
  readonly uci: string;
  readonly san: string;
}

/** Où en est la révision d'un problème. `step` -1 : jamais tenté. */
export interface ReviewState {
  readonly step: number;
  /** Date à partir de laquelle le problème est à revoir (millisecondes Unix). */
  readonly dueAt: number;
  readonly attempts: number;
  readonly successes: number;
}

export interface Puzzle {
  readonly id: string;
  readonly username: string;
  readonly gameUrl: string;
  readonly timeClass: TimeClass;
  readonly gameEndTime: number;
  readonly fen: string;
  readonly playerColor: PlayerColor;
  readonly kind: PuzzleKind;
  readonly playedSan: string;
  readonly previousMoveUci: string | null;
  /** Coups acceptés, le meilleur en premier. */
  readonly solutions: readonly PuzzleMove[];
  /** Suite du meilleur coup, en notation lisible, pour l'explication. */
  readonly solutionLine: readonly string[];
  readonly review: ReviewState;
}

/**
 * Révision d'un exercice qui n'est pas un problème (avantage à convertir, menace à voir). L'exercice
 * lui-même se reconstruit à partir des parties : seul son état de révision est gardé.
 */
export interface DrillReview {
  readonly id: string;
  readonly username: string;
  readonly review: ReviewState;
}

/** Position d'avant une gaffe faite en position gagnante : il faut la jouer jusqu'au gain contre le moteur. */
export interface ConversionDrill {
  readonly id: string;
  readonly username: string;
  readonly gameUrl: string;
  readonly timeClass: TimeClass;
  readonly gameEndTime: number;
  readonly fen: string;
  readonly playerColor: PlayerColor;
  readonly previousMoveUci: string | null;
  /** Évaluation avant la gaffe, vue du joueur, en centipions bornés. */
  readonly startCp: number;
  /** La gaffe de la partie (notation anglaise). */
  readonly playedSan: string;
  readonly review: ReviewState;
}

/** Menace concrète laissée passer par une gaffe (voir `threats.ts`). */
export interface DrillThreat {
  readonly kind: "capture" | "mate";
  readonly moveUci: string;
  readonly from: string;
  readonly to: string;
  readonly san: string;
}

/** Position d'avant une gaffe qui a ignoré une menace : la voir, puis la parer. */
export interface DefenseDrill {
  readonly id: string;
  readonly username: string;
  readonly gameUrl: string;
  readonly timeClass: TimeClass;
  readonly gameEndTime: number;
  readonly fen: string;
  readonly playerColor: PlayerColor;
  readonly previousMoveUci: string | null;
  /** Évaluation avant la gaffe, vue du joueur : une parade doit la garder. */
  readonly cpBefore: number;
  readonly playedSan: string;
  readonly playedUci: string;
  /** Meilleur coup du moteur dans la position ("" s'il manque). */
  readonly bestUci: string;
  readonly threat: DrillThreat;
  readonly review: ReviewState;
}
