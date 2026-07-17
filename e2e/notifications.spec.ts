import { test, expect, Page } from "@playwright/test";
import { seedAdmin, seedEvent, seedParticipant } from "./fixtures/seed";
import { loginAs } from "./fixtures/session";

const API = process.env.E2E_API_URL || "http://localhost:3001";

/** Cree une table (MJ = admin) et retourne son id/titre. */
async function seedTable(adminCookie: string, eventId: string) {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(16, 0, 0, 0);

  const tableTitle = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const res = await fetch(`${API}/api/events/${eventId}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      title: tableTitle,
      maxPlayers: 4,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
    }),
  });
  const data = await res.json();
  return { tableId: data.data.id as string, tableTitle };
}

function bellButton(page: Page) {
  return page.getByRole("button", { name: "Notifications" });
}

function bellBadge(page: Page) {
  return bellButton(page).locator(".badge");
}

test.describe("Notifications — temps reel et sync", () => {
  test("le MJ recoit la notification en direct, le clic ouvre la table et ferme le panneau", async ({
    page,
  }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const { tableId, tableTitle } = await seedTable(admin.cookie, event.id);

    // MJ (admin) connecte, badge vierge
    await loginAs(page, admin.cookie);
    await expect(bellButton(page)).toBeVisible();
    await expect(bellBadge(page)).toBeHidden();

    // Un joueur rejoint la table via l'API -> notification live via socket
    const player = await seedParticipant(event.id);
    const joinRes = await fetch(`${API}/api/events/${event.id}/tables/${tableId}/join`, {
      method: "POST",
      headers: { Cookie: player.cookie },
    });
    expect(joinRes.ok).toBeTruthy();

    // Le badge apparait sans recharger la page
    await expect(bellBadge(page)).toHaveText("1");

    // Ouvrir le panneau : la notification MJ est la
    await bellButton(page).click();
    await expect(page.getByText("Nouveau joueur")).toBeVisible();
    await expect(page.getByText(`a rejoint ta table "${tableTitle}"`)).toBeVisible();

    // Clic : navigation vers la modale de la table + panneau ferme + marquee lue
    await page.getByText("Nouveau joueur").click();
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}/planning\\?table=${tableId}`));
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Nouveau joueur")).toBeHidden();
    await expect(bellBadge(page)).toBeHidden();
  });

  test("sync multi-onglets : tout marquer lu sur un onglet vide le badge de l'autre", async ({
    page,
    context,
  }) => {
    const admin = await seedAdmin();
    const event = await seedEvent(admin.cookie);
    const { tableId } = await seedTable(admin.cookie, event.id);

    // Deux onglets de la meme session (= deux appareils du meme utilisateur)
    await loginAs(page, admin.cookie);
    const pageB = await context.newPage();
    await pageB.goto("/events");
    await expect(bellButton(pageB)).toBeVisible();

    // Un joueur rejoint -> les deux onglets voient le badge en live
    const player = await seedParticipant(event.id);
    await fetch(`${API}/api/events/${event.id}/tables/${tableId}/join`, {
      method: "POST",
      headers: { Cookie: player.cookie },
    });
    await expect(bellBadge(page)).toHaveText("1");
    await expect(bellBadge(pageB)).toHaveText("1");

    // Onglet A : tout marquer lu
    await bellButton(page).click();
    await page.getByRole("button", { name: "Tout marquer lu" }).click();
    await expect(bellBadge(page)).toBeHidden();

    // Onglet B : le badge disparait sans action ni reload
    await expect(bellBadge(pageB)).toBeHidden();
  });
});
