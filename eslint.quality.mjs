// Règles de qualité « 10/10 » : fonctions courtes, noms explicites, typage strict.
// Importé dans eslint.config.mjs APRÈS les configs de base :
//   import quality from "./eslint.quality.mjs";
//   export default [...ignores, ...js, ...tseslint, ...quality];
// Aucune dépendance en plus : règles du cœur d'ESLint et de @typescript-eslint
// (fourni par typescript-eslint). Lancer avec `eslint . --max-warnings 0`.

/** Noms trop vagues : dire ce que contient la variable (userList, apiResponse…). */
const VAGUE_NAMES = ["data", "res", "tmp", "temp", "obj", "val", "foo", "bar", "stuff", "thing"];

/** Noms d'une lettre tolérés (index de boucle, coordonnées, traduction next-intl/maison, ignoré). */
const SHORT_NAMES_ALLOWED = ["_", "i", "j", "k", "x", "y", "t", "a", "b"]; // a/b : comparateurs de tri

/** Exports de configuration de route imposés par Next.js (nom fixé par le framework). */
const NEXT_ROUTE_CONFIG = "^(dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration)$";

const quality = [
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      // Imbrication et taille : une fonction = une responsabilité lisible d'un coup d'œil.
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      "max-params": ["error", 4],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],

      // Erreurs jamais avalées en silence.
      "no-empty": ["error", { allowEmptyCatch: false }],

      // Nommage explicite.
      "id-denylist": ["error", ...VAGUE_NAMES],
      "id-length": ["error", { min: 2, exceptions: SHORT_NAMES_ALLOWED, properties: "never" }],

      // Pas de dette cachée : un TODO devient un ticket.
      "no-warning-comments": ["error", { terms: ["todo", "fixme", "xxx", "hack"], location: "start" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // Règles TypeScript « typées » (le préfixe des booléens a besoin du type) :
    // lint avec les informations de type du tsconfig du projet. Un fichier hors du
    // tsconfig principal (ex. app/sw.ts vérifié par tsconfig.sw.json) donne une
    // « Parsing error » : l'ajouter à `ignores` de ce bloc ou au tsconfig.
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        // Composants React et constantes de module.
        { selector: "variable", format: ["camelCase", "PascalCase", "UPPER_CASE"] },
        { selector: "function", format: ["camelCase", "PascalCase"] },
        // Un composant reçu en prop ({ icon: Icon }) garde sa casse de composant.
        { selector: "parameter", format: ["camelCase", "PascalCase"], leadingUnderscore: "allow" },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
        // Un booléen se lit comme une question : isOpen, hasError, canEdit…
        {
          selector: "variable",
          types: ["boolean"],
          filter: { regex: NEXT_ROUTE_CONFIG, match: false },
          format: ["PascalCase"],
          prefix: ["is", "has", "can", "should", "was", "will", "did", "needs", "show"],
        },
        // Clés d'objets et en-têtes HTTP, JSON externes, Prisma : format imposé par d'autres.
        // objectLiteralMethod : une clé dont la valeur est une fonction (composant simulé par un
        // test, table de routes « GET /api/x ») est une méthode pour typescript-eslint.
        { selector: ["objectLiteralProperty", "objectLiteralMethod", "typeProperty"], format: null },
        { selector: "import", format: null },
      ],

      // Typage strict et pas de contournement.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Les tests décrivent des scénarios : describe/it imbriqués et longs sont normaux.
    files: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**", "e2e/**", "test/**", "tests/**"],
    rules: {
      "max-lines-per-function": "off",
      "max-nested-callbacks": ["error", 5],
      "max-lines": "off",
      "id-denylist": "off",
      "no-console": "off",
    },
  },
  {
    // Scripts en ligne de commande (synchros, maintenance) : la sortie console est voulue.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
];

export default quality;
