import { test, expect } from "@playwright/test";
import { seedAdmin, seedEvent } from "./fixtures/seed";

// Ces tests simulent un viewport mobile (Pixel 5) pour valider la navigation mobile
test.describe("Navigation mobile", () => {
  test.use({ viewport: { width: 393, height: 851 } }); // Pixel 5
  test("bottom tab bar visible et fonctionnel", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);

    await page.goto("/login");
    await page.getByLabel(/email|identifiant/i).fill(admin.email);
    await page.getByLabel(/mot de passe|password/i).fill(admin.password);
    await page.getByRole("button", { name: /^se connecter$/i }).click();
    await expect(page).toHaveURL(/\/events/);

    await page.goto(`/events/${event.id}`);

    // La bottom tab bar doit etre visible en mobile
    const tabBar = page.locator("nav").filter({ hasText: /planning|jeux|infos/i });
    await expect(tabBar).toBeVisible();

    // Naviguer vers l'onglet Planning
    await tabBar.getByText(/planning/i).click();
    // En mobile, le bouton desktop "Créer une table" n'est pas rendu :
    // seul le FAB (aria-label="Créer une table") est present.
    const fab = page.locator("[aria-label='Créer une table']");
    await expect(fab).toBeVisible();
    await expect(fab).toHaveClass(/fixed/); // garantit que c'est bien le FAB positionne fixed
  });

  test("page 404 affichee pour une route inconnue", async ({ page }) => {
    await page.goto("/cette-page-nexiste-pas");
    await expect(page.getByText(/404|introuvable/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /accueil/i })).toBeVisible();
  });
});
