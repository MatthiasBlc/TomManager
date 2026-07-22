import { test, expect } from "@playwright/test";
import { seedAdmin, seedEvent } from "./fixtures/seed";
import { loginAs } from "./fixtures/session";
import { parisWallClockToUtcIso, parisWallClockHourMinute } from "./fixtures/parisTime";

/**
 * Regression fuseau non-Paris (cf docs/features/ParisTimezone). Ce fichier ne
 * tourne que sous le projet Playwright "chromium-non-paris"
 * (timezoneId: "America/New_York", cf playwright.config.ts) : le CI (runner
 * UTC) et les postes dev (probablement Paris) ne revelent jamais un bug ou le
 * frontend utiliserait par erreur le fuseau ambiant du navigateur au lieu de
 * Paris explicite.
 */

const API = process.env.E2E_API_URL || "http://localhost:3001";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

test("cree une table a une heure de Paris connue depuis un navigateur non-Paris", async ({
  page,
}) => {
  const admin = await seedAdmin();

  const now = new Date();
  const day1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const day2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  // Bornes d'event larges (08h00 Paris jour 1 -> 23h00 Paris jour 2)
  const eventStart = parisWallClockToUtcIso(
    day1.getFullYear(),
    day1.getMonth() + 1,
    day1.getDate(),
    8,
    0
  );
  const eventEnd = parisWallClockToUtcIso(
    day2.getFullYear(),
    day2.getMonth() + 1,
    day2.getDate(),
    23,
    0
  );
  const event = await seedEvent(admin.cookie, { startDateTime: eventStart, endDateTime: eventEnd });

  await loginAs(page, admin.cookie);
  await page.goto(`/events/${event.id}`);
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.getByRole("button", { name: /créer une table/i }).click();

  await page.getByLabel(/titre/i).fill("Table TZ E2E");
  const dateStr = `${day1.getFullYear()}-${pad(day1.getMonth() + 1)}-${pad(day1.getDate())}`;
  await page.getByLabel(/date/i).fill(dateStr);
  // 14h00 heure de Paris, saisi depuis un navigateur regle sur America/New_York
  await page.getByLabel(/heure de début/i).fill("14:00");
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  await expect(page.getByText("Table TZ E2E")).toBeVisible();

  // L'instant reel stocke doit correspondre a 14h00 heure de Paris ce jour-la,
  // pas 14h00 America/New_York (ce que ferait un `new Date(...)` naif sur la
  // valeur brute de l'input, interpretee dans le fuseau du navigateur)
  const expectedStartIso = parisWallClockToUtcIso(
    day1.getFullYear(),
    day1.getMonth() + 1,
    day1.getDate(),
    14,
    0
  );
  const res = await fetch(`${API}/api/events/${event.id}/tables`, {
    headers: { Cookie: admin.cookie },
  });
  const tables = (await res.json()).data as { title: string; startDateTime: string }[];
  const created = tables.find((t) => t.title === "Table TZ E2E");
  expect(created).toBeTruthy();
  expect(new Date(created!.startDateTime).toISOString()).toBe(expectedStartIso);

  // Reaffichage : l'heure montree dans la carte doit rester 14h00 (jamais 14h00
  // America/New_York re-etiquetee, ni l'heure UTC brute)
  await expect(page.getByText(/14:00/)).toBeVisible();
});

test("redimensionner une table dans CalendarView reste correct en heure de Paris (fuseau non-Paris)", async ({
  page,
}) => {
  const admin = await seedAdmin();

  const now = new Date();
  const day1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Bornes etroites sur un seul jour calendaire Paris -> une seule colonne dans
  // CalendarView, geometrie plus simple pour le drag
  const eventStart = parisWallClockToUtcIso(
    day1.getFullYear(),
    day1.getMonth() + 1,
    day1.getDate(),
    6,
    0
  );
  const eventEnd = parisWallClockToUtcIso(
    day1.getFullYear(),
    day1.getMonth() + 1,
    day1.getDate(),
    22,
    0
  );
  const event = await seedEvent(admin.cookie, { startDateTime: eventStart, endDateTime: eventEnd });

  const tableStart = parisWallClockToUtcIso(
    day1.getFullYear(),
    day1.getMonth() + 1,
    day1.getDate(),
    10,
    0
  );
  const tableEnd = parisWallClockToUtcIso(
    day1.getFullYear(),
    day1.getMonth() + 1,
    day1.getDate(),
    11,
    0
  );
  const createRes = await fetch(`${API}/api/events/${event.id}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: admin.cookie },
    body: JSON.stringify({
      title: "Table TZ Resize",
      maxPlayers: 4,
      startDateTime: tableStart,
      endDateTime: tableEnd,
    }),
  });
  const tableId = (await createRes.json()).data.id as string;

  await loginAs(page, admin.cookie);
  await page.goto(`/events/${event.id}`);
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.getByRole("button", { name: /vue calendrier/i }).click();

  const harness = page.locator(".fc-timegrid-event-harness", { hasText: "Table TZ Resize" });
  await expect(harness).toBeVisible();

  // Deduit dynamiquement les px/minute de la grille (independant du CSS) a
  // partir de deux lanes de 15 min connues, pour viser precisement +30 min sur
  // la poignee de redimensionnement du bas.
  const lane10 = await page
    .locator('.fc-timegrid-slot-lane[data-time="10:00:00"]')
    .first()
    .boundingBox();
  const lane11 = await page
    .locator('.fc-timegrid-slot-lane[data-time="11:00:00"]')
    .first()
    .boundingBox();
  if (!lane10 || !lane11) throw new Error("lanes de grille introuvables");
  const pxPerMinute = (lane11.y - lane10.y) / 60;

  await harness.hover();
  const resizer = harness.locator(".fc-event-resizer-end");
  const resizerBox = await resizer.boundingBox();
  if (!resizerBox) throw new Error("poignee de redimensionnement introuvable");

  // La poignee deborde legerement sous la limite basse de `.fc-event` (overflow:
  // hidden) : viser son centre geometrique tombe pile sur la limite du clip et
  // rate la cible (teste manuellement, cf docs/features/ParisTimezone). +2px
  // depuis le haut de la poignee reste dans la bande reellement cliquable.
  const startX = resizerBox.x + resizerBox.width / 2;
  const startY = resizerBox.y + 2;
  const deltaMinutes = 30; // 11:00 -> 11:30 Paris, snap 15 min
  const targetY = startY + deltaMinutes * pxPerMinute;

  // FullCalendar deplace l'event de facon optimiste des le drop, avant meme que
  // le PATCH ne reponde : attendre la vraie reponse reseau (pas seulement le
  // texte affiche) pour eviter une lecture API en avance sur la persistance.
  const patchResponse = page.waitForResponse(
    (r) => r.url().includes(`/tables/${tableId}`) && r.request().method() === "PATCH"
  );
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, targetY, { steps: 10 });
  await page.mouse.up();
  const response = await patchResponse;
  expect(response.ok()).toBe(true);

  await expect(harness.getByText("10:00 - 11:30")).toBeVisible();

  const getRes = await fetch(`${API}/api/events/${event.id}/tables/${tableId}`, {
    headers: { Cookie: admin.cookie },
  });
  const updated = (await getRes.json()).data as { endDateTime: string };
  const { h, min } = parisWallClockHourMinute(updated.endDateTime);
  expect(`${pad(h)}:${pad(min)}`).toBe("11:30");
});
