import { defineConfig } from "vitest/config";
import path from "node:path";

/** Integration tests against the LOCAL Supabase stack (`supabase start`). Run: pnpm test:db */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    exclude: ["tests/db/**/*.destructive.test.ts"],
    testTimeout: 30000,
    fileParallelism: false,
    setupFiles: ["tests/db/env.ts"],
  },
});
