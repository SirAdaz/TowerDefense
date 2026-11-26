import type { AnalysedGame, EngineScore, MoveReview, Puzzle, RawGame } from "../src/chess/game/types.ts";

/** Joueur et adversaire inventés : aucune partie réelle dans les tests. */
export const TEST_USER = "joueur-test";
export const TEST_OPPONENT = "adversaire-test";

function headers(white: string, black: string, result: string, ecoUrl: string): string {
  return [
    '[Event "Live Chess"]',
    '[Site "Chess.com"]',
    '[Date "2026.01.15"]',
    `[White "${white}"]`,
    `[Black "${black}"]`,
    `[Result "${result}"]`,
    '[ECO "C20"]',
    `[ECOUrl "${ecoUrl}"]`,
    '[TimeControl "180"]',
    "",
    "",
  ].join("\n");
}

/** Le joueur (noirs) laisse le mat du berger : 3...Cf6 ?? 4. Dxf7#. Horloges notées comme sur le site. */
export const MATED_PGN =
  headers(TEST_OPPONENT, TEST_USER, "1-0", "https://www.chess.com/openings/Kings-Pawn-Opening-Wayward-Queen-Attack-2...Nc6") +
  "1. e4 {[%clk 0:03:00]} 1... e5 {[%clk 0:02:59.1]} 2. Qh5 {[%clk 0:02:58]} 2... Nc6 {[%clk 0:02:55.3]} " +
  "3. Bc4 {[%clk 0:02:57]} 3... Nf6 {[%clk 0:00:08.4]} 4. Qxf7# {[%clk 0:02:56]} 1-0\n";

/** Le joueur (blancs) rate le mat en un (4. Dxf7#) et joue 4. Cc3, puis la partie s'arrête sur une nulle. */
export const MISSED_MATE_PGN =
  headers(TEST_USER, TEST_OPPONENT, "1/2-1/2", "https://www.chess.com/openings/Kings-Pawn-Opening-Wayward-Queen-Attack-2...Nc6") +
  "1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Nc3 g6 5. Qf3 1/2-1/2\n";

/** Le joueur (noirs) ignore la menace de mat 6. Dxf7# et joue 5...b6 ??. */
export const IGNORED_MATE_PGN =
  headers(TEST_OPPONENT, TEST_USER, "1-0", "https://www.chess.com/openings/Vienna-Game") +
  "1. e4 e5 2. Nc3 Nc6 3. Bc4 a6 4. d3 h6 5. Qh5 b6 6. Qxf7# 1-0\n";

/** Le joueur (noirs) laisse son cavalier attaqué par le pion : 2...d6 ?? 3. exf6. */
export const IGNORED_PIECE_PGN =
  headers(TEST_OPPONENT, TEST_USER, "1-0", "https://www.chess.com/openings/Alekhines-Defense") +
  "1. e4 Nf6 2. e5 d6 3. exf6 exf6 4. d4 d5 5. Nf3 Bd6 6. Bd3 O-O 7. O-O Re8 1-0\n";

/** Le joueur (blancs), une pièce de plus, met sa dame en prise : 6. De4 ?? dxe4. Aucune menace avant. */
export const QUEEN_DROP_PGN =
  headers(TEST_USER, TEST_OPPONENT, "0-1", "https://www.chess.com/openings/Queens-Pawn-Opening") +
  "1. d4 d5 2. Bf4 Nf6 3. e3 Nh5 4. Qxh5 e6 5. Qf3 Bd6 6. Qe4 dxe4 7. Bxd6 Qxd6 0-1\n";

/** Partie sans horloge ni adresse d'ouverture. */
export const BARE_PGN = '[Event "?"]\n[Result "*"]\n\n1. d4 d5 2. c4 e6 *\n';

export function rawGame(overrides: Partial<RawGame> = {}): RawGame {
  return {
    id: "game-1",
    url: "https://www.chess.com/game/live/1",
    pgn: MATED_PGN,
    timeClass: "blitz",
    endTime: 1_700_000_000,
    playerColor: "black",
    result: "loss",
    ...overrides,
  };
}

export function cp(value: number): EngineScore {
  return { kind: "cp", value };
}

export function mate(value: number): EngineScore {
  return { kind: "mate", value };
}

export function moveReview(overrides: Partial<MoveReview> = {}): MoveReview {
  return { ply: 0, san: "e4", cpBefore: 20, cpAfter: 20, quality: "good", phase: "opening", clockSeconds: 120, ...overrides };
}

export function analysedGame(overrides: Partial<AnalysedGame> = {}): AnalysedGame {
  return {
    id: "game-1",
    url: "https://www.chess.com/game/live/1",
    username: TEST_USER,
    timeClass: "blitz",
    endTime: 1_700_000_000,
    playerColor: "white",
    result: "win",
    openingName: "Italian Game",
    eco: "C50",
    accuracy: 80,
    moves: [moveReview()],
    lostPhase: null,
    ...overrides,
  };
}

export function puzzle(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    id: "game-1:6",
    username: TEST_USER,
    gameUrl: "https://www.chess.com/game/live/1",
    timeClass: "blitz",
    gameEndTime: 1_700_000_000,
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    playerColor: "white",
    kind: "missedMate",
    playedSan: "Nc3",
    previousMoveUci: "g8f6",
    solutions: [{ uci: "h5f7", san: "Qxf7#" }],
    solutionLine: ["Qxf7#"],
    review: { step: -1, dueAt: 0, attempts: 0, successes: 0 },
    ...overrides,
  };
}

/** Réponse de l'API pour une archive mensuelle, au format du site. */
export function archiveEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    url: "https://www.chess.com/game/live/1",
    pgn: MATED_PGN,
    time_class: "blitz",
    end_time: 1_700_000_000,
    rules: "chess",
    uuid: "game-1",
    white: { username: "Adversaire-Test", result: "win" },
    black: { username: "Joueur-Test", result: "checkmated" },
    ...overrides,
  };
}
