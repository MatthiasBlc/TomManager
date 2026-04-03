import { test, expect, Page } from "@playwright/test";
import { seedAdmin, seedEvent, seedInvitation, AdminContext, EventContext } from "./fixtures/seed";

const API = process.env.E2E_API_URL || "http://localhost:3001";

/** Cree un user participant et retourne sa session (cookie) */
async function seedParticipant(
  admin: AdminContext,
  event: EventContext
): Promise<{ cookie: string; email: string; password: string; username: string }> {
  const email = `player_e2e_${Date.now()}@test.com`;
  const username = `player_${Date.now()}`;
  const password = "PlayerPassword123!";

  // Seed user admin pour creer l'invitation
  const { token } = await seedInvitation(admin.cookie, event.id, email);

  // Signup via l'API
  const res = await fetch(`${API}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, invitationToken: token }),
  });
  if (!res.ok) throw new Error(`seedParticipant signup failed: ${res.status}`);

  return { cookie: "", email, password, username };
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email|identifiant/i).fill(email);
  await page.getByLabel(/mot de passe|password/i).fill(password);
  await page.getByRole("button", { name: /connexion|login/i }).click();
  await expect(page).toHaveURL("/events");
}

test.describe("Planning — tables", () => {
  test("creer une table", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);

    await loginAs(page, admin.email, admin.password);
    await page.goto(`/events/${event.id}`);

    // Aller sur l'onglet planning
    await page.getByRole("tab", { name: /planning/i }).click();

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

    await page.getByRole("button", { name: /creer|create/i }).click();

    // La table apparait dans la liste
    await expect(page.getByText("Table E2E")).toBeVisible();
  });

  test("rejoindre puis quitter une table", async ({ page, browser }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const player = await seedParticipant(admin, event);

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
    await page.getByRole("tab", { name: /planning/i }).click();

    await page.getByText("Table Rejoindre").click();
    await page.getByRole("button", { name: /rejoindre/i }).click();
    await expect(page.getByText(/confirme|joined/i)).toBeVisible();

    // Quitter
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
    await page.getByRole("tab", { name: /planning/i }).click();
    await page.getByRole("button", { name: /vue calendrier/i }).click();

    // Cliquer sur un creneau du calendrier (zone vide)
    // FullCalendar rend les creneaux avec data-time attribute
    const slot = page.locator(".fc-timegrid-slot-lane").first();
    await slot.click();

    // Le modal de creation doit s'ouvrir
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel(/titre/i)).toBeVisible();
  });
});
