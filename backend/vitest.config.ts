import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup/globalSetup.ts"],
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/**", "dist/**", "src/__tests__/**", "prisma/**", "**/*.d.ts"],
      thresholds: {
        statements: 50,
        branches: 50,
      },
    },
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
