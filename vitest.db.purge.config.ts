import { defineConfig } from "vitest/config";

/** DESTRUCTIVE purge test (removes demo data from the local stack). Run: pnpm test:db:purge, then pnpm db:reset */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.destructive.test.ts"],
    testTimeout: 30000,
    setupFiles: ["tests/db/env.ts"],
  },
});
