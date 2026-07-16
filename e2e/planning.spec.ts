import { test, expect } from "@playwright/test";
import { seedAdmin, seedEvent, seedParticipant } from "./fixtures/seed";
import { loginAs } from "./fixtures/session";

const API = process.env.E2E_API_URL || "http://localhost:3001";

test.describe("Planning — tables", () => {
  test("creer une table", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);

    await loginAs(page, admin.cookie);
    await page.goto(`/events/${event.id}`);

    // Aller sur l'onglet planning
    await page.getByRole("button", { name: "Planning", exact: true }).click();

    // Clic sur "Creer une table"
    await page.getByRole("button", { name: /créer une table/i }).click();

    // Remplir le formulaire
    await page.getByLabel(/titre/i).fill("Table E2E");
    // Type JDR par defaut, laisser tel quel
    // Joueurs max : stepper +/-, deja a 4 par defaut, rien a faire

    // Date = lendemain
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    await page.getByLabel(/date/i).fill(dateStr);
    await page.getByLabel(/heure de début/i).fill("14:00");

    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // La table apparait dans la liste
    await expect(page.getByText("Table E2E")).toBeVisible();
  });

  test("rejoindre puis quitter une table", async ({ page, browser }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const player = await seedParticipant(event.id);

    // Admin cree une table via API
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);

    const tableRes = await fetch(`${API}/api/events/${event.id}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: admin.cookie },
      body: JSON.stringify({
        title: "Table Rejoindre",
        maxPlayers: 4,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      }),
    });
    const tableData = await tableRes.json();
    const tableId = tableData.data.id;

    // Player se connecte et rejoint la table
    await loginAs(page, player.cookie);
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: "Planning", exact: true }).click();

    await page.getByText("Table Rejoindre").click();
    await page.getByRole("button", { name: /rejoindre/i }).click();
    await expect(page.getByText("Inscrit", { exact: true })).toBeVisible();

    // Quitter (confirmer via le ConfirmModal in-app qui remplace window.confirm)
    await page.getByRole("button", { name: /quitter/i }).click();
    await page
      .getByRole("dialog", { name: "Quitter la table" })
      .getByRole("button", { name: "Quitter", exact: true })
      .click();
    await expect(page.getByRole("button", { name: /rejoindre/i })).toBeVisible();
  });
});

test.describe("Planning — creation via clic calendrier", () => {
  test("ouvre le modal pre-rempli en cliquant sur un creneau", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);

    await loginAs(page, admin.cookie);
    await page.goto(`/events/${event.id}`);

    // Passer en vue calendrier
    await page.getByRole("button", { name: "Planning", exact: true }).click();
    await page.getByRole("button", { name: /vue calendrier/i }).click();

    // Cliquer sur un creneau vide : dateClick ouvre le modal (plus fiable qu'un drag en CI)
    const slot = page.locator(".fc-timegrid-slot-lane").first();
    await expect(slot).toBeVisible();
    await slot.click();

    // Le modal de creation doit s'ouvrir
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel(/titre/i)).toBeVisible();
  });
});
