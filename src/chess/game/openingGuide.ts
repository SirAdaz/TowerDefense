import { Chess } from "chess.js";
import { parseGame, pgnHeader } from "./pgn.ts";

/** Une ouverture expliquée : ses coups de base (notation anglaise, comme le PGN) et son idée en une phrase. */
interface OpeningEntry {
  readonly moves: readonly string[];
  readonly idea: string;
}

/** Ce que le bilan affiche d'une ouverture : les coups, l'idée si on la connaît, la position d'arrivée. */
export interface OpeningLine {
  readonly sanMoves: readonly string[];
  readonly idea: string | null;
  readonly fen: string;
}

/** Au-delà de 8 coups par camp, ce n'est plus l'ouverture qu'on montre mais la partie. */
export const MAX_OPENING_PLIES = 16;

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Familles fréquentes, au nom que leur donne chess.com (sans tirets). Le titre reste anglais. */
const OPENINGS: Readonly<Record<string, OpeningEntry>> = {
  "queens pawn opening": { moves: ["d4"], idea: "Les blancs prennent le centre avec le pion d et visent un jeu solide, souvent avec c4, Cf3 ou Ff4." },
  "kings pawn opening": { moves: ["e4", "e5"], idea: "Chaque camp pousse son pion e de deux cases : le centre est partagé et les pièces sortent vite." },
  "giuoco piano game": {
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
    idea: "Développement rapide et symétrique : les deux fous visent f7 et f2, les blancs préparent c3 et d4.",
  },
  "italian game": { moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"], idea: "Le fou blanc vise f7, le point faible des noirs près du roi, avant de roquer vite." },
  "ruy lopez opening": {
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    idea: "Le fou attaque le cavalier qui défend e5 : une pression lente mais durable sur le centre noir.",
  },
  "scotch game": { moves: ["e4", "e5", "Nf3", "Nc6", "d4"], idea: "Les blancs ouvrent le centre tout de suite par d4 pour jouer avec plus d'espace." },
  "four knights game": { moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"], idea: "Les quatre cavaliers sortent d'abord : un jeu classique, sûr et symétrique." },
  "petrovs defense": { moves: ["e4", "e5", "Nf3", "Nf6"], idea: "Au lieu de défendre e5, les noirs attaquent e4 : une défense solide qui vise la symétrie." },
  "philidor defense": { moves: ["e4", "e5", "Nf3", "d6"], idea: "Les noirs tiennent e5 avec un pion : solide mais un peu passif." },
  "vienna game": { moves: ["e4", "e5", "Nc3"], idea: "Le cavalier sort avant le fou ou le pion f : les blancs gardent l'option d'une poussée f4." },
  "kings gambit": { moves: ["e4", "e5", "f4"], idea: "Les blancs offrent un pion pour ouvrir la colonne f et attaquer vite le roi noir." },
  "bishops opening": { moves: ["e4", "e5", "Bc4"], idea: "Le fou vise f7 dès le deuxième coup, en gardant le pion f libre." },
  "center game": { moves: ["e4", "e5", "d4", "exd4", "Qxd4"], idea: "Les blancs ouvrent le centre et reprennent avec la dame, sortie tôt." },
  "ponziani opening": { moves: ["e4", "e5", "Nf3", "Nc6", "c3"], idea: "c3 prépare d4 pour bâtir un grand centre de pions." },
  "sicilian defense": { moves: ["e4", "c5"], idea: "Les noirs contestent d4 de côté : une défense déséquilibrée, riche en contre-attaque." },
  "french defense": { moves: ["e4", "e6"], idea: "Les noirs préparent d5 pour attaquer le centre, au prix d'un fou c8 enfermé." },
  "caro kann defense": { moves: ["e4", "c6"], idea: "c6 prépare d5 sans enfermer le fou c8 : une défense très solide." },
  "scandinavian defense": { moves: ["e4", "d5"], idea: "Les noirs attaquent e4 tout de suite ; la dame reprend souvent en d5." },
  "pirc defense": { moves: ["e4", "d6", "d4", "Nf6"], idea: "Les noirs laissent le centre aux blancs pour l'attaquer ensuite, fou en g7." },
  "modern defense": { moves: ["e4", "g6"], idea: "Fou en g7 d'abord, le centre est contesté plus tard." },
  "alekhines defense": { moves: ["e4", "Nf6"], idea: "Le cavalier attaque e4 pour pousser les pions blancs en avant et en faire des cibles." },
  "nimzowitsch defense": { moves: ["e4", "Nc6"], idea: "Le cavalier sort avant les pions : une défense rare qui sort des sentiers battus." },
  "owens defense": { moves: ["e4", "b6"], idea: "Le fou va en b7 pour viser e4 de loin." },
  "queens gambit": { moves: ["d4", "d5", "c4"], idea: "Les blancs offrent le pion c pour détourner le pion d5 et gagner le centre." },
  "slav defense": { moves: ["d4", "d5", "c4", "c6"], idea: "Les noirs tiennent d5 avec c6 et gardent leur fou c8 libre." },
  "london system": { moves: ["d4", "d5", "Bf4"], idea: "Un plan fixe : d4, Ff4, e3, Cf3, c3. Simple à jouer contre presque tout." },
  "indian game": { moves: ["d4", "Nf6"], idea: "Le cavalier contrôle e4 au lieu de bloquer avec d5 : la porte des défenses indiennes." },
  "kings indian defense": { moves: ["d4", "Nf6", "c4", "g6"], idea: "Les noirs laissent le centre, roquent derrière le fou g7 puis frappent avec e5 ou c5." },
  "nimzo indian defense": { moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"], idea: "Le fou cloue le cavalier c3 pour contrôler e4." },
  "grunfeld defense": { moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"], idea: "Les noirs laissent les blancs bâtir un grand centre pour l'attaquer aussitôt." },
  "benoni defense": { moves: ["d4", "Nf6", "c4", "c5"], idea: "Un centre bloqué et déséquilibré : les noirs jouent sur l'aile dame." },
  "catalan opening": { moves: ["d4", "Nf6", "c4", "e6", "g3"], idea: "Le fou blanc en g2 vise la grande diagonale et l'aile dame noire." },
  "dutch defense": { moves: ["d4", "f5"], idea: "Le pion f contrôle e4 et prépare une attaque sur l'aile roi." },
  "englund gambit": { moves: ["d4", "e5"], idea: "Les noirs offrent un pion pour un jeu rapide et piégeux ; douteux contre une bonne défense." },
  "english opening": { moves: ["c4"], idea: "Les blancs contrôlent d5 de côté : une ouverture souple qui change souvent d'aspect." },
  "zukertort opening": { moves: ["Nf3"], idea: "Le cavalier sort d'abord et attend de voir le plan noir." },
  "reti opening": { moves: ["Nf3", "d5", "c4"], idea: "Les blancs attaquent le centre noir de côté au lieu de l'occuper." },
  "kings fianchetto opening": { moves: ["g3"], idea: "Le fou ira en g2 pour viser la grande diagonale ; le centre attend." },
  "bird opening": { moves: ["f4"], idea: "Le pion f contrôle e5, comme une défense hollandaise avec les blancs." },
  "van t kruijs opening": { moves: ["e3"], idea: "Un premier coup discret qui ouvre le fou f1 sans engager le centre." },
  "nimzowitsch larsen attack": { moves: ["b3"], idea: "Le fou ira en b2 pour viser le centre de loin." },
  "polish opening": { moves: ["b4"], idea: "Un coup rare : le pion b gagne de l'espace et le fou ira en b2." },
};

/** Clé d'une famille : minuscules, sans apostrophe ni tiret (« Caro-Kann Defense » → « caro kann defense »). */
function familyKey(name: string): string {
  return name.toLowerCase().replace(/['’]/g, " ").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Nombre de demi-coups qui définissent la variante, d'après la fin de l'adresse ECO du PGN
 * (`…-Open-2...Nc6` : jusqu'au 2e coup noir, soit 4 demi-coups). `null` sans coup dans l'adresse.
 */
export function ecoUrlPlies(ecoUrl: string | null): number | null {
  const match = /-(\d+)\.(\.\.)?[^-./]+$/.exec(ecoUrl ?? "");
  if (match?.[1] === undefined) {
    return null;
  }
  const moveNumber = Number(match[1]);
  return Math.min(MAX_OPENING_PLIES, match[2] === undefined ? 2 * moveNumber - 1 : 2 * moveNumber);
}

function fenAfter(sanMoves: readonly string[]): string {
  const chess = new Chess(START_FEN);
  sanMoves.forEach((san) => chess.move(san));
  return chess.fen();
}

/**
 * Coups et idée d'une ouverture. Les coups viennent d'une partie du joueur (`pgn`), coupés là où
 * l'adresse ECO arrête la variante, sinon à la longueur des coups de base ; faute de PGN, les coups
 * de base. Ouverture inconnue de la table : les coups seuls, sans idée.
 */
/** Longueur montrée faute de variante lisible et d'ouverture connue : trois coups par camp. */
const DEFAULT_OPENING_PLIES = 6;

function gameOpeningMoves(pgn: string, entry: OpeningEntry | undefined): string[] {
  const gameMoves = parseGame(pgn)?.moves.map((move) => move.san) ?? [];
  const plies = ecoUrlPlies(pgnHeader(pgn, "ECOUrl")) ?? entry?.moves.length ?? DEFAULT_OPENING_PLIES;
  return gameMoves.slice(0, plies);
}

/**
 * Les coups de la partie illustrent l'ouverture s'ils commencent par ses coups de base : une partie
 * arrivée par transposition (1. e4 Ca6 classée Caro-Kann) montrerait sinon d'autres coups que l'idée.
 */
function isFaithful(gameMoves: readonly string[], entry: OpeningEntry | undefined): boolean {
  if (entry === undefined) {
    return gameMoves.length > 0;
  }
  return gameMoves.length >= entry.moves.length && entry.moves.every((san, index) => gameMoves[index] === san);
}

export function openingLine(name: string, pgn: string | null): OpeningLine | null {
  const entry = OPENINGS[familyKey(name)];
  const fromGame = pgn === null ? [] : gameOpeningMoves(pgn, entry);
  const sanMoves = isFaithful(fromGame, entry) ? fromGame : (entry?.moves ?? []);
  if (sanMoves.length === 0) {
    return null;
  }
  return { sanMoves, idea: entry?.idea ?? null, fen: fenAfter(sanMoves) };
}
