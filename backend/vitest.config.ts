import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
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
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/__tests__/unit/**/*.test.ts"],
          // Les options de la config racine (testTimeout, hookTimeout...) ne sont pas
          // heritees par les projets (workspace Vitest) : elles doivent etre repetees ici.
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/__tests__/integration/**/*.test.ts"],
          setupFiles: ["./src/__tests__/setup/globalSetup.ts"],
          // Les options de la config racine (testTimeout, hookTimeout...) ne sont pas
          // heritees par les projets (workspace Vitest) : elles doivent etre repetees ici.
          testTimeout: 30000,
          hookTimeout: 30000,
          pool: "forks",
          // beforeEach/afterEach truncate the whole DB (globalSetup.ts) : les fichiers de
          // test doivent s'executer sequentiellement, sinon leurs hooks se marchent dessus
          // (FK violations quand un fichier truncate pendant qu'un autre est en cours).
          fileParallelism: false,
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
        },
      },
    ],
  },
});
