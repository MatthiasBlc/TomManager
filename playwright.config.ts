import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Tests sequentiels — partage la meme DB seedee
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /timezone\.spec\.ts/,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testIgnore: /timezone\.spec\.ts/,
    },
    // Regression fuseau non-Paris (cf docs/features/ParisTimezone) : le CI (runner
    // UTC) et les postes dev (probablement Paris) ne revelent jamais un bug de
    // fuseau ambiant navigateur/serveur — ce projet force un fuseau non-Paris,
    // hemisphere DST different (pas de bascule EU en mars/octobre).
    {
      name: "chromium-non-paris",
      use: { ...devices["Desktop Chrome"], timezoneId: "America/New_York" },
      testMatch: /timezone\.spec\.ts/,
    },
  ],
  // Pas de webServer ici : les tests attendent que le stack Docker soit deja demarre
});
