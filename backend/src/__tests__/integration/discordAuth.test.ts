import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import supertest from "supertest";
import app from "../../app";
import { request, setupAdmin, createTestEvent, enableEventManager } from "../setup/testHelpers";
import * as discordService from "../../services/discordAuth";

// Note: tests requiring DB migration (discordId, discordRoleId fields) are marked
// and will fully pass once `prisma migrate dev --name add_discord_fields` is run.

describe("Discord OAuth — GET /api/auth/discord", () => {
  beforeEach(() => {
    vi.spyOn(discordService, "isDiscordConfigured").mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 503 when Discord not configured", async () => {
    const res = await request.get("/api/auth/discord");
    expect(res.status).toBe(503);
  });
});

describe("Discord OAuth — GET /api/auth/discord/callback (mode redirect)", () => {
  it("redirects to /login?error=discord_denied when error param present", async () => {
    const res = await request.get("/api/auth/discord/callback?error=access_denied&state=x");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=discord_denied");
  });

  it("redirects to /login?error=invalid_state when state missing from session", async () => {
    const res = await request.get("/api/auth/discord/callback?code=abc&state=forged-state");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=invalid_state");
  });

  it("redirects to /login?error=invalid_state when code without state in session", async () => {
    const res = await request.get("/api/auth/discord/callback?code=abc&state=no-match");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=invalid_state");
  });
});

describe("Discord OAuth — GET /api/auth/discord/callback (mode popup)", () => {
  // On utilise supertest.agent pour maintenir la session entre les requetes
  let agent: ReturnType<typeof supertest.agent>;

  beforeEach(() => {
    agent = supertest.agent(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirige vers /oauth-popup avec DISCORD_AUTH_ERROR sur erreur Discord", async () => {
    vi.spyOn(discordService, "isDiscordConfigured").mockReturnValue(true);
    vi.spyOn(discordService, "generateState").mockReturnValue("popup-state-abc");

    // Initier le login en mode popup pour stocker oauthPopup en session
    await agent.get("/api/auth/discord?popup=1");

    // Simuler un retour Discord avec erreur
    const res = await agent.get(
      "/api/auth/discord/callback?error=access_denied&state=popup-state-abc"
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/oauth-popup");
    expect(res.headers.location).toContain("DISCORD_AUTH_ERROR");
    expect(res.headers.location).toContain("discord_denied");
  });

  it("redirige vers /oauth-popup avec DISCORD_AUTH_ERROR sur state invalide", async () => {
    vi.spyOn(discordService, "isDiscordConfigured").mockReturnValue(true);
    vi.spyOn(discordService, "generateState").mockReturnValue("popup-state-xyz");

    await agent.get("/api/auth/discord?popup=1");

    const res = await agent.get("/api/auth/discord/callback?code=abc&state=wrong-state");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/oauth-popup");
    expect(res.headers.location).toContain("DISCORD_AUTH_ERROR");
    expect(res.headers.location).toContain("invalid_state");
  });

  it("retourne un redirect (302) quand pas de popup en session", async () => {
    // Pas d'appel a initiateLogin => pas de oauthPopup en session
    const res = await agent.get("/api/auth/discord/callback?error=access_denied&state=x");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=discord_denied");
  });
});

describe("Discord OAuth — DELETE /api/auth/discord/link", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request.delete("/api/auth/discord/link");
    expect(res.status).toBe(401);
  });
});

describe("Event PATCH — discordRoleId Zod validation", () => {
  it("rejects invalid discordRoleId (Zod, pre-migration)", async () => {
    const { cookie, user: admin } = await setupAdmin();
    await enableEventManager(admin.id);
    const event = await createTestEvent(cookie);

    const res = await request
      .patch(`/api/events/${event.id}`)
      .set("Cookie", cookie)
      .send({ discordRoleId: "not-a-snowflake" });

    expect(res.status).toBe(400);
  });
});
