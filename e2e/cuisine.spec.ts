import { test, expect } from "@playwright/test";
import { seedAdmin, seedEvent, seedParticipant, enableKitchenManager } from "./fixtures/seed";
import { loginAs } from "./fixtures/session";

const API = process.env.E2E_API_URL || "http://localhost:3001";

test.describe("Cuisine — configuration, repas, conflit planning, purge", () => {
  test("responsable configure -> chef cree un repas -> equipier s'inscrit -> conflit visible -> purge", async ({
    page,
    browser,
  }) => {
    const admin = await seedAdmin();
    await enableKitchenManager(admin.cookie);
    const event = await seedEvent(admin.cookie);

    const chef = await seedParticipant(event.id);
    const equipier = await seedParticipant(event.id);

    // --- Responsable configure la cuisine (mode manuel, planning equipier active) ---
    await loginAs(page, admin.cookie);
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: "Cuisine", exact: true }).click();

    await page.getByLabel(/afficher le planning cuisine aux équipiers/i).check();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText(/configuration mise à jour/i)).toBeVisible();

    const chefsCard = page.locator(".card", { hasText: "Chefs" });
    await chefsCard.locator("select").selectOption({ label: chef.username });
    await chefsCard.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText(/chef ajouté/i)).toBeVisible();

    // --- Le chef cree sa fiche repas (14h-16h demain) ---
    const chefCtx = await browser.newContext();
    const chefPage = await chefCtx.newPage();
    await loginAs(chefPage, chef.cookie);
    await chefPage.goto(`/events/${event.id}`);
    await chefPage.getByRole("button", { name: "Cuisine", exact: true }).click();
    await chefPage.getByRole("button", { name: /créer mon repas/i }).click();

    await chefPage.getByLabel(/nom du repas/i).fill("Couscous E2E");
    await chefPage.getByLabel(/début/i).fill("14:00");
    await chefPage.getByLabel(/^fin$/i).fill("16:00");
    await chefPage.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(chefPage.getByText(/fiche repas créée/i)).toBeVisible();
    await chefCtx.close();

    // --- Le responsable genere le planning : maxAssistants demarre a 0 (spec 5), sans
    // generation l'equipier ne pourrait pas s'inscrire (repas "Complet") ---
    await expect(page.getByText("Couscous E2E")).toBeVisible(); // sync temps reel (socket kitchen:meal-changed)
    await page.getByRole("button", { name: "Générer le planning", exact: true }).click();
    const generateDialog = page.getByRole("dialog", { name: "Générer le planning" });
    await expect(generateDialog).toBeVisible();
    await generateDialog.getByRole("button", { name: "Générer", exact: true }).click();
    await expect(page.getByText(/planning généré/i)).toBeVisible();

    // --- Une table de jeu chevauchante (14h30-15h30), creee via API comme les autres specs planning ---
    const tableStart = new Date();
    tableStart.setDate(tableStart.getDate() + 1);
    tableStart.setHours(14, 30, 0, 0);
    const tableEnd = new Date(tableStart);
    tableEnd.setHours(15, 30, 0, 0);

    const tableRes = await fetch(`${API}/api/events/${event.id}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: admin.cookie },
      body: JSON.stringify({
        title: "Table Conflit E2E",
        maxPlayers: 4,
        startDateTime: tableStart.toISOString(),
        endDateTime: tableEnd.toISOString(),
      }),
    });
    expect(tableRes.ok).toBe(true);

    // --- L'equipier s'inscrit au repas, puis rejoint la table qui le chevauche -> conflit ---
    const equipierCtx = await browser.newContext();
    const equipierPage = await equipierCtx.newPage();
    await loginAs(equipierPage, equipier.cookie);
    await equipierPage.goto(`/events/${event.id}`);

    // Onglet Infos (par defaut) : board repas
    // (le conteneur "Planning cuisine" est aussi un .card : on cible la carte
    // interne specifique au repas via sa classe bg-base-200)
    const mealCard = equipierPage.locator(".card.bg-base-200", { hasText: "Couscous E2E" });
    await expect(mealCard).toBeVisible();
    await mealCard.getByRole("button", { name: "S'inscrire", exact: true }).click();
    await expect(equipierPage.getByText(/inscrit au repas/i)).toBeVisible();

    // Onglet Planning : rejoindre la table qui chevauche le repas
    await equipierPage.getByRole("button", { name: "Planning", exact: true }).click();
    await equipierPage.getByText("Table Conflit E2E").click();
    await equipierPage.getByRole("button", { name: /rejoindre/i }).click();
    await expect(equipierPage.getByText("Inscrit", { exact: true })).toBeVisible();
    await equipierPage.keyboard.press("Escape");

    // Le conflit (moteur unifie tables + cuisine) doit etre visible dans le Planning
    await expect(equipierPage.getByText("⚠ Conflit").first()).toBeVisible();
    await equipierCtx.close();

    // --- Purge : contenu cuisine efface, EventKitchen conserve ---
    // "Modifier" est ambigu (aussi utilise par l'edition d'une fiche repas) : le
    // bouton d'entete de l'event est le premier dans le DOM.
    await page.getByRole("button", { name: "Modifier", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "Modifier l'événement" })).toBeVisible();
    await page.getByRole("button", { name: "Purger l'event", exact: true }).click();

    const purgeDialog = page.getByRole("dialog", { name: "Purger l'événement" });
    await expect(purgeDialog).toBeVisible();
    await purgeDialog.getByRole("button", { name: "Purger", exact: true }).click();
    await expect(page.getByText(/event purgé/i)).toBeVisible();

    // Le purge n'emet pas d'evenement socket (silencieux) : reload pour verifier
    // l'etat persiste reellement en base, pas seulement un cache client perime.
    await page.reload();
    await page.getByRole("button", { name: "Cuisine", exact: true }).click();
    await expect(page.getByText("Couscous E2E")).not.toBeVisible();
    await expect(page.getByText("Aucun chef pour l'instant.")).toBeVisible();
  });
});
