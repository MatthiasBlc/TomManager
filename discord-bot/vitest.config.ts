import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    clearMocks: true,
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "src/__tests__/**",
        "prisma/**",
        "**/*.d.ts",
        "src/index.ts",
        "src/util/db.ts",
        "src/util/env.ts",
        "*.config.*",
      ],
      thresholds: {
        statements: 70,
        branches: 70,
      },
    },
  },
});
