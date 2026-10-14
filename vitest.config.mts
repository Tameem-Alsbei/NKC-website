import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // `server-only` throws outside a React Server environment; tests import
      // server modules directly, so replace it with an empty module.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Each database test file boots its own in-memory Postgres (PGlite).
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
