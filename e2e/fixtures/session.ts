import { Page, expect } from "@playwright/test";

/**
 * Injecte un cookie de session (obtenu via seedAdmin/seedParticipant, qui se
 * loguent directement via l'API) dans le navigateur puis navigue vers /events.
 * Le formulaire login/mot de passe n'existe plus dans l'UI (Discord uniquement).
 */
export async function loginAs(page: Page, cookie: string): Promise<void> {
  const eq = cookie.indexOf("=");
  await page.context().addCookies([
    {
      name: cookie.slice(0, eq),
      value: cookie.slice(eq + 1),
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/events");
  await expect(page).toHaveURL(/\/events/);
}
