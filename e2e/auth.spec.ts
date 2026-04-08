import { test, expect } from "@playwright/test";
import { seedAdmin } from "./fixtures/seed";

test.describe("Auth — inscription et connexion", () => {
  test("login avec compte existant", async ({ page }) => {
    const admin = await seedAdmin();

    await page.goto("/login");
    await page.getByLabel(/email|identifiant/i).fill(admin.email);
    await page.getByLabel(/mot de passe|password/i).fill(admin.password);
    await page.getByRole("button", { name: /^(connexion|login)$/i }).click();

    await expect(page).toHaveURL("/events");
    await expect(page.getByText(admin.username)).toBeVisible();
  });

  test("logout", async ({ page }) => {
    const admin = await seedAdmin();

    await page.goto("/login");
    await page.getByLabel(/email|identifiant/i).fill(admin.email);
    await page.getByLabel(/mot de passe|password/i).fill(admin.password);
    await page.getByRole("button", { name: /^(connexion|login)$/i }).click();
    await expect(page).toHaveURL("/events");

    await page.getByRole("button", { name: /deconnex|logout/i }).click();
    await expect(page).toHaveURL("/login");
  });
});
