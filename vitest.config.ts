import { defineConfig } from "vitest/config";

// La logique du jeu (src/game) est pure : testée sans navigateur, avec des seuils de couverture.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/game/**/*.ts"],
      exclude: ["src/game/**/*.test.ts"],
      reporter: ["text-summary", "text"],
      // En dessous de ces seuils, `npm run test` échoue.
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
    },
  },
});
