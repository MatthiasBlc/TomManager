import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_BACKEND_URL": JSON.stringify("http://localhost:3001"),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup/vitestSetup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "src/__tests__/**",
        "**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "*.config.{js,mjs,cjs,ts}",
      ],
      thresholds: {
        statements: 20,
        branches: 70,
      },
    },
  },
});
