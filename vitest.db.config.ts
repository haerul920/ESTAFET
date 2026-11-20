import { defineConfig } from "vitest/config";

/** Integration tests against the LOCAL Supabase stack (`supabase start`). Run: pnpm test:db */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    exclude: ["tests/db/**/*.destructive.test.ts"],
    testTimeout: 30000,
    fileParallelism: false,
    setupFiles: ["tests/db/env.ts"],
  },
});
