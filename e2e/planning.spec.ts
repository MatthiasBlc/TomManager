import { test, expect, Page } from "@playwright/test";
import { seedAdmin, seedEvent, seedParticipant } from "./fixtures/seed";

const API = process.env.E2E_API_URL || "http://localhost:3001";

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email|identifiant/i).fill(email);
  await page.getByLabel(/mot de passe|password/i).fill(password);
  await page.getByRole("button", { name: /^(connexion|login)$/i }).click();
  await expect(page).toHaveURL(/\/events/);
}

test.describe("Planning — tables", () => {
  test("creer une table", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);

    await loginAs(page, admin.email, admin.password);
    await page.goto(`/events/${event.id}`);

    // Aller sur l'onglet planning
    await page.getByRole("button", { name: "Planning", exact: true }).click();

    // Clic sur "Create Table"
    await page.getByRole("button", { name: /create table/i }).click();

    // Remplir le formulaire
    await page.getByLabel(/titre/i).fill("Table E2E");
    // Type JDR par defaut, laisser tel quel
    await page.getByLabel(/joueurs max/i).fill("4");

    // Date = lendemain
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    await page.getByLabel(/date/i).fill(dateStr);
    await page.getByLabel(/heure de debut/i).fill("14:00");

    await page.getByRole("button", { name: "Creer", exact: true }).click();

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
    await loginAs(page, player.email, player.password);
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: "Planning", exact: true }).click();

    await page.getByText("Table Rejoindre").click();
    await page.getByRole("button", { name: /rejoindre/i }).click();
    await expect(page.getByText("Joined", { exact: true })).toBeVisible();

    // Quitter (accepter le dialog confirm)
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /quitter/i }).click();
    await expect(page.getByRole("button", { name: /rejoindre/i })).toBeVisible();
  });
});

test.describe("Planning — creation via clic calendrier", () => {
  test("ouvre le modal pre-rempli en cliquant sur un creneau", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);

    await loginAs(page, admin.email, admin.password);
    await page.goto(`/events/${event.id}`);

    // Passer en vue calendrier
    await page.getByRole("button", { name: "Planning", exact: true }).click();
    await page.getByRole("button", { name: /vue calendrier/i }).click();

    // Attendre que le calendrier soit interactif avant de dragger
    const slot = page.locator(".fc-timegrid-slot-lane").first();
    await expect(slot).toBeVisible();
    const box = await slot.boundingBox();
    if (!box) throw new Error("Creneau calendrier introuvable");

    // Simuler un drag progressif sur plusieurs creneaux pour declencher la selection FullCalendar
    // (steps: lent pour que FullCalendar detecte les mousemove intermediaires)
    const startX = box.x + box.width / 2;
    await page.mouse.move(startX, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(startX, box.y + box.height * 3, { steps: 10 });
    await page.mouse.up();

    // Le modal de creation doit s'ouvrir
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel(/titre/i)).toBeVisible();
  });
});
