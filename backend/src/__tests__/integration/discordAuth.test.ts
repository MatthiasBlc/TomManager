import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { request, setupAdmin, createTestEvent } from "../setup/testHelpers";
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

describe("Discord OAuth — GET /api/auth/discord/callback", () => {
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

describe("Discord OAuth — DELETE /api/auth/discord/link", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request.delete("/api/auth/discord/link");
    expect(res.status).toBe(401);
  });
});

describe("Event PATCH — discordRoleId Zod validation", () => {
  it("rejects invalid discordRoleId (Zod, pre-migration)", async () => {
    const { cookie } = await setupAdmin();
    const event = await createTestEvent(cookie);

    const res = await request
      .patch(`/api/events/${event.id}`)
      .set("Cookie", cookie)
      .send({ discordRoleId: "not-a-snowflake" });

    expect(res.status).toBe(400);
  });
});
