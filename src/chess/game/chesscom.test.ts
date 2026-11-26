import { describe, expect, it } from "vitest";
import { TEST_USER, archiveEntry, rawGame } from "../../../tests/chessFixtures.ts";
import { archivesUrl, monthArchiveUrl, normalizeUsername, parseArchiveGames, parseArchiveList, selectGamesToAnalyse } from "./chesscom.ts";

describe("username", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Joueur-Test ")).toBe(TEST_USER);
  });

  it("rejects anything that could not be a username", () => {
    expect(normalizeUsername("ab")).toBeNull();
    expect(normalizeUsername("joueur test")).toBeNull();
    expect(normalizeUsername("../games")).toBeNull();
    expect(normalizeUsername("a".repeat(26))).toBeNull();
  });

  it("builds the archive list address", () => {
    expect(archivesUrl(TEST_USER)).toBe("https://api.chess.com/pub/player/joueur-test/games/archives");
  });
});

describe("archive list", () => {
  const base = "https://api.chess.com/pub/player/joueur-test/games";

  it("returns the player's monthly archives, latest first", () => {
    const payload = { archives: [`${base}/2026/09`, `${base}/2026/10`, `${base}/2026/11`] };
    expect(parseArchiveList(payload, TEST_USER)).toEqual([`${base}/2026/11`, `${base}/2026/10`, `${base}/2026/09`]);
  });

  it("drops addresses that are not this player's archives on the official API", () => {
    const payload = {
      archives: ["https://example.org/pub/player/joueur-test/games/2026/11", `${base}/2026/11/extra`, 42, `${base}/2026/10`],
    };
    expect(parseArchiveList(payload, TEST_USER)).toEqual([`${base}/2026/10`]);
  });

  it("returns nothing for an unexpected payload", () => {
    expect(parseArchiveList(null, TEST_USER)).toEqual([]);
    expect(parseArchiveList({ archives: "none" }, TEST_USER)).toEqual([]);
  });
});

describe("archive games", () => {
  it("reads the player's colour and result whatever the letter case", () => {
    const games = parseArchiveGames({ games: [archiveEntry()] }, TEST_USER);
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ id: "game-1", timeClass: "blitz", playerColor: "black", result: "loss", endTime: 1_700_000_000 });
  });

  it("maps wins and every kind of draw", () => {
    const win = archiveEntry({ white: { username: TEST_USER, result: "win" }, black: { username: "x-y-z", result: "resigned" } });
    const draw = archiveEntry({ white: { username: TEST_USER, result: "repetition" }, black: { username: "x-y-z", result: "repetition" } });
    const games = parseArchiveGames({ games: [win, draw] }, TEST_USER);
    expect(games.map((game) => [game.playerColor, game.result])).toEqual([
      ["white", "win"],
      ["white", "draw"],
    ]);
  });

  it("falls back to the address when a game has no identifier", () => {
    const games = parseArchiveGames({ games: [archiveEntry({ uuid: undefined })] }, TEST_USER);
    expect(games[0]?.id).toBe("https://www.chess.com/game/live/1");
  });

  it("skips variants, daily games, other players' games and malformed entries", () => {
    const entries = [
      archiveEntry({ rules: "chess960" }),
      archiveEntry({ time_class: "daily" }),
      archiveEntry({ black: { username: "someone-else", result: "win" } }),
      archiveEntry({ black: { username: TEST_USER } }),
      archiveEntry({ pgn: undefined }),
      archiveEntry({ end_time: "yesterday" }),
      archiveEntry({ url: "https://example.org/game/1" }),
      "not a game",
      null,
    ];
    expect(parseArchiveGames({ games: entries }, TEST_USER)).toEqual([]);
  });

  it("returns nothing for an unexpected payload", () => {
    expect(parseArchiveGames("oops", TEST_USER)).toEqual([]);
    expect(parseArchiveGames({ games: {} }, TEST_USER)).toEqual([]);
  });
});

describe("choosing the games of a pass", () => {
  const games = Array.from({ length: 30 }, (_, index) => rawGame({ id: `game-${index}`, endTime: 1000 + index }));

  it("takes the latest games on a first visit and forgets the older history", () => {
    const selection = selectGamesToAnalyse(games, new Set(), null);
    expect(selection.selected).toHaveLength(20);
    expect(selection.selected[0]?.id).toBe("game-29");
    expect(selection.selected[19]?.id).toBe("game-10");
    expect(selection.remainingCount).toBe(0);
  });

  it("then only takes games played since, never analysed, and counts what is left", () => {
    const analysedIds = new Set(["game-5", "game-6", "game-8"]);
    const selection = selectGamesToAnalyse(games, analysedIds, 1005, 10);
    expect(selection.selected.map((game) => game.id).slice(0, 2)).toEqual(["game-29", "game-28"]);
    expect(selection.selected).toHaveLength(10);
    expect(selection.remainingCount).toBe(12);
    expect(selection.selected.some((game) => analysedIds.has(game.id) || game.endTime <= 1005)).toBe(false);
  });

  it("selects nothing when everything is analysed", () => {
    const selection = selectGamesToAnalyse(games.slice(0, 3), new Set(["game-0", "game-1", "game-2"]), 1000);
    expect(selection).toEqual({ selected: [], remainingCount: 0 });
  });
});

describe("month archive", () => {
  it("pointe l'archive du mois UTC de fin de partie", () => {
    expect(monthArchiveUrl("joueur-test", 1_768_435_200)).toBe("https://api.chess.com/pub/player/joueur-test/games/2026/01");
    expect(monthArchiveUrl("joueur-test", 1_798_761_599)).toBe("https://api.chess.com/pub/player/joueur-test/games/2026/12");
  });
});
