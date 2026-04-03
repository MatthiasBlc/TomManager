import { test, expect } from "@playwright/test";
import { seedAdmin, seedEvent, seedInvitation } from "./fixtures/seed";

test.describe("Auth — inscription et connexion", () => {
  test("flow complet : invitation → signup → acces event", async ({ page }) => {
    // Seed
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const userEmail = `user_e2e_${Date.now()}@test.com`;
    const { token } = await seedInvitation(admin.cookie, event.id, userEmail);

    // 1. L'user arrive sur le lien d'invitation
    await page.goto(`/invite/${token}`);
    await expect(page.getByText(event.name)).toBeVisible();

    // 2. Clic sur "Creer un compte"
    await page.getByRole("link", { name: /creer|s'inscrire|signup/i }).click();

    // 3. Remplir le formulaire d'inscription
    await page.getByLabel(/email/i).fill(userEmail);
    await page.getByLabel(/pseudo|username/i).fill(`user_e2e_${Date.now()}`);
    await page.getByLabel(/mot de passe|password/i).fill("UserPassword123!");
    await page.getByRole("button", { name: /s'inscrire|creer|signup/i }).click();

    // 4. Redirige vers l'event apres inscription
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}`));
  });

  test("login avec compte existant", async ({ page }) => {
    const admin = await seedAdmin();

    await page.goto("/login");
    await page.getByLabel(/email|identifiant/i).fill(admin.email);
    await page.getByLabel(/mot de passe|password/i).fill(admin.password);
    await page.getByRole("button", { name: /connexion|login/i }).click();

    await expect(page).toHaveURL("/events");
    await expect(page.getByText(admin.username)).toBeVisible();
  });

  test("logout", async ({ page }) => {
    const admin = await seedAdmin();

    await page.goto("/login");
    await page.getByLabel(/email|identifiant/i).fill(admin.email);
    await page.getByLabel(/mot de passe|password/i).fill(admin.password);
    await page.getByRole("button", { name: /connexion|login/i }).click();
    await expect(page).toHaveURL("/events");

    await page.getByRole("button", { name: /deconnex|logout/i }).click();
    await expect(page).toHaveURL("/");
  });
});
