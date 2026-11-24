import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    env: {
      MOCK_MODE: "true",
      MOCK_STAGE_MS: "0",
      MOCK_AUTO_APPROVE: "false",
      DATABASE_URL: "sqlserver://unused-in-tests",
    },
  },
});
