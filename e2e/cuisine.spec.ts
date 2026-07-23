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

    // --- Le responsable genere le planning : la creation manuelle hors-grille a ete
    // retiree (Admin Chef point 3), tous les repas naissent desormais de /generate.
    // maxAssistants demarre a 0 (spec 5), sans generation l'equipier ne pourrait pas
    // s'inscrire (repas "Complet").
    await page.getByRole("button", { name: "Générer le planning", exact: true }).click();
    const generateDialog = page.getByRole("dialog", { name: "Générer le planning" });
    await expect(generateDialog).toBeVisible();
    await generateDialog.getByRole("button", { name: "Générer", exact: true }).click();
    await expect(page.getByText(/planning généré/i)).toBeVisible();

    // --- Le chef reclame l'unique creneau genere (l'event ne dure que 2 jours calendaires :
    // diner seul le J1, rien le dernier jour, cf computeExpectedSlots) puis renomme sa fiche ---
    const chefCtx = await browser.newContext();
    const chefPage = await chefCtx.newPage();
    await loginAs(chefPage, chef.cookie);
    await chefPage.goto(`/events/${event.id}`);
    // "Cuisine" est ambigu ici : le chef sans repas voit aussi un lien "Cuisine"
    // dans l'alerte KitchenBoard de l'onglet Infos ; l'onglet est le premier dans le DOM.
    await chefPage.getByRole("button", { name: "Cuisine", exact: true }).first().click();

    await chefPage.getByRole("combobox").selectOption({ index: 1 });
    await chefPage.getByRole("button", { name: "Choisir ce créneau", exact: true }).click();
    await expect(chefPage.getByText(/créneau choisi/i)).toBeVisible();

    // Attend specifiquement la reponse PATCH du champ nom (autosave debounce 600ms) avant
    // de fermer le contexte : ingredients/ustensiles s'autosauvegardent aussi au montage
    // de la fiche (memes champs, valeurs vides), donc un simple filtre sur l'URL matcherait
    // parfois l'une de ces sauvegardes au lieu du renommage.
    const renamePatch = chefPage.waitForResponse(
      (res) =>
        res.url().includes("/kitchen/meals/") &&
        res.request().method() === "PATCH" &&
        JSON.stringify(res.request().postDataJSON()).includes("Couscous E2E")
    );
    await chefPage.getByLabel(/nom du repas/i).fill("Couscous E2E");
    await renamePatch;
    await chefCtx.close();

    // --- Recupere l'horaire reel du creneau genere (heures fixes Europe/Paris, mais
    // converties en UTC par le backend) pour construire une table de jeu chevauchante.
    // Pas d'attente sur le socket ici (contrairement au commentaire historique) : le
    // reload est le meme filet de securite que celui deja utilise plus bas pour la
    // purge, qui evite toute dependance a la latence/fiabilite du push temps reel. ---
    await page.reload();
    await page.getByRole("button", { name: "Cuisine", exact: true }).click();
    await expect(page.getByText("Couscous E2E")).toBeVisible();
    const kitchenRes = await fetch(`${API}/api/events/${event.id}/kitchen`, {
      headers: { Cookie: admin.cookie },
    });
    expect(kitchenRes.ok).toBe(true);
    const kitchenData = await kitchenRes.json();
    const meal = kitchenData.data.meals[0];

    // --- Une table de jeu chevauchante (nichee 30min a l'interieur du creneau repas),
    // creee via API comme les autres specs planning ---
    const tableStart = new Date(new Date(meal.startDateTime).getTime() + 30 * 60_000);
    const tableEnd = new Date(new Date(meal.endDateTime).getTime() - 30 * 60_000);

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

    // Onglet Infos (par defaut) : board repas KitchenBoard, matrice jour x service.
    // La cellule desktop est un <td> ; la vue mobile (md:hidden, .card.bg-base-200)
    // est presente dans le DOM mais masquee au viewport desktop par defaut de Playwright.
    const mealCell = equipierPage.locator("td", { hasText: "Couscous E2E" });
    await expect(mealCell).toBeVisible();
    await mealCell.getByRole("button", { name: "S'inscrire", exact: true }).click();
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
