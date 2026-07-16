import { test, expect } from "@playwright/test";
import { seedAdmin, seedEvent, seedParticipant } from "./fixtures/seed";
import { loginAs } from "./fixtures/session";

const API = process.env.E2E_API_URL || "http://localhost:3001";

/** Cree une table via API et fait rejoindre deux joueurs (1 confirme, 1 waitlist). */
async function setupTableWithWaitlist(adminCookie: string, eventId: string) {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(16, 0, 0, 0);

  // Titre unique pour eviter les conflits entre tests (pas de cleanup E2E)
  const tableTitle = `WL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const tableRes = await fetch(`${API}/api/events/${eventId}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      title: tableTitle,
      maxPlayers: 1,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
    }),
  });
  const tableData = await tableRes.json();
  const tableId = tableData.data.id;

  const player1 = await seedParticipant(eventId);
  const player2 = await seedParticipant(eventId);

  // Player1 rejoint (CONFIRMED — seule place)
  await fetch(`${API}/api/events/${eventId}/tables/${tableId}/join`, {
    method: "POST",
    headers: { Cookie: player1.cookie },
  });

  // Player2 rejoint (WAITLIST)
  await fetch(`${API}/api/events/${eventId}/tables/${tableId}/join`, {
    method: "POST",
    headers: { Cookie: player2.cookie },
  });

  return { tableId, tableTitle, player1, player2 };
}

test.describe("Waitlist — gestion manuelle par le GM", () => {
  test("GM voit les boutons Promouvoir/Retrograder, joueur lambda non", async ({
    page,
    browser,
  }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const { tableTitle, player1 } = await setupTableWithWaitlist(admin.cookie, event.id);

    // GM ouvre la table
    await loginAs(page, admin.cookie);
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: "Planning", exact: true }).click();
    await page.getByText(tableTitle).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Attendre que les participants soient charges (toBeVisible retente automatiquement)
    await expect(
      page.getByRole("button", { name: /ajouter à la table|mettre sur liste/i }).first()
    ).toBeVisible();

    // GM doit voir au moins un bouton Ajouter a la table ou Mettre sur liste d'attente
    const promoteOrDemoteGM =
      (await page.getByRole("button", { name: /ajouter à la table/i }).count()) +
      (await page.getByRole("button", { name: /mettre sur liste/i }).count());
    expect(promoteOrDemoteGM).toBeGreaterThan(0);

    await page.keyboard.press("Escape");

    // Joueur lambda ouvre la meme table — ne doit PAS voir ces boutons
    const playerCtx = await browser.newContext();
    const playerPage = await playerCtx.newPage();
    await loginAs(playerPage, player1.cookie);
    await playerPage.goto(`/events/${event.id}`);
    await playerPage.getByRole("button", { name: "Planning", exact: true }).click();
    await playerPage.getByText(tableTitle).click();
    await expect(playerPage.getByRole("dialog")).toBeVisible();

    // Attendre que le contenu soit charge (le nom du joueur visible dans le dialog)
    await expect(playerPage.getByRole("dialog").getByText(player1.username).first()).toBeVisible();

    expect(await playerPage.getByRole("button", { name: /ajouter à la table/i }).count()).toBe(0);
    expect(await playerPage.getByRole("button", { name: /mettre sur liste/i }).count()).toBe(0);

    await playerCtx.close();
  });

  test("GM promote un joueur en waitlist quand une place est disponible", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    // Table pleine avec 1 confirme et 1 waitlist
    const { tableId, tableTitle, player1, player2 } = await setupTableWithWaitlist(
      admin.cookie,
      event.id
    );

    // D'abord retrograder player1 pour liberer une place
    await fetch(
      `${API}/api/events/${event.id}/tables/${tableId}/participants/${player1.userId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: admin.cookie },
        body: JSON.stringify({ status: "WAITLIST" }),
      }
    );

    await loginAs(page, admin.cookie);
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: "Planning", exact: true }).click();
    await page.getByText(tableTitle).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Cliquer Ajouter a la table (les deux joueurs sont en WAITLIST apres la retrograde)
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /ajouter à la table/i }).first()).toBeVisible();
    await dialog
      .getByRole("button", { name: /ajouter à la table/i })
      .first()
      .click();

    // Toast de succes
    await expect(page.getByText(/promu/i)).toBeVisible();
  });

  test("bouton Promouvoir desactive quand la table est pleine", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const { tableTitle, player2 } = await setupTableWithWaitlist(admin.cookie, event.id);

    await loginAs(page, admin.cookie);
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: "Planning", exact: true }).click();
    await page.getByText(tableTitle).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // La table est pleine (1/1), le bouton du joueur WAITLIST doit etre desactive
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: /aucune place disponible/i }).first()
    ).toBeDisabled();
  });

  test("GM demote un joueur confirme, le suivant en waitlist ne bouge pas", async ({ page }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const { tableId, tableTitle, player1, player2 } = await setupTableWithWaitlist(
      admin.cookie,
      event.id
    );

    await loginAs(page, admin.cookie);
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: "Planning", exact: true }).click();
    await page.getByText(tableTitle).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Mettre sur liste d'attente player1 (seul CONFIRMED dans la table)
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /mettre sur liste/i }).first()).toBeVisible();
    await dialog
      .getByRole("button", { name: /mettre sur liste/i })
      .first()
      .click();

    // Toast de succes
    await expect(page.getByText(/rétrogradé/i)).toBeVisible();

    // player2 doit toujours etre WAITLIST (pas de promotion automatique) — verification cote serveur
    const detail = await (
      await fetch(`${API}/api/events/${event.id}/tables/${tableId}`, {
        headers: { Cookie: admin.cookie },
      })
    ).json();
    const p2 = detail.data.participants.find(
      (p: { userId: string }) => p.userId === player2.userId
    );
    expect(p2.status).toBe("WAITLIST");
  });
});
