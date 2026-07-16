import { test, expect } from "@playwright/test";
import { seedAdmin } from "./fixtures/seed";
import { loginAs } from "./fixtures/session";

test.describe("Auth — session et deconnexion", () => {
  test("session existante restaure l'utilisateur connecte", async ({ page }) => {
    const admin = await seedAdmin();

    await loginAs(page, admin.cookie);

    await expect(page.getByText(admin.username)).toBeVisible();
  });

  test("logout", async ({ page }) => {
    const admin = await seedAdmin();
    await loginAs(page, admin.cookie);

    // Desktop : bouton "Deconnexion" dans la navbar
    // Mobile : bouton username dans la BottomTabBar (qui appelle logout())
    const logoutBtn = page.getByRole("button", { name: /déconnect|logout/i });
    const mobileProfileBtn = page.getByRole("button", { name: admin.username });
    // Attendre que l'un des deux soit rendu avant de choisir (evite une race
    // juste apres l'injection du cookie de session, ou aucun n'est encore monte)
    await Promise.race([
      logoutBtn.waitFor({ state: "visible" }),
      mobileProfileBtn.waitFor({ state: "visible" }),
    ]);
    const btn = (await logoutBtn.count()) > 0 ? logoutBtn : mobileProfileBtn;
    await btn.click();
    await expect(page).toHaveURL("/login");
  });
});
