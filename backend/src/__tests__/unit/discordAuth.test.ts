import { describe, it, expect, vi } from "vitest";
import {
  generateState,
  buildAuthorizeUrl,
  buildAvatarUrl,
  isDiscordConfigured,
} from "../../services/discordAuth";

vi.mock("../../config/env", () => ({
  default: {
    DISCORD_CLIENT_ID: "test_client_id",
    DISCORD_CLIENT_SECRET: "test_secret",
    DISCORD_GUILD_ID: "123456789012345678",
    DISCORD_REDIRECT_URI: "http://localhost:3001/api/auth/discord/callback",
    DISCORD_ADMIN_ROLE_ID: "",
    CORS_ORIGIN: "http://localhost:5173",
  },
}));

describe("discordAuth service — utilities", () => {
  describe("isDiscordConfigured", () => {
    it("returns true when all required vars are set", () => {
      expect(isDiscordConfigured()).toBe(true);
    });
  });

  describe("generateState", () => {
    it("returns a 32-char hex string", () => {
      const state = generateState();
      expect(state).toMatch(/^[0-9a-f]{32}$/);
    });

    it("returns a different value each call", () => {
      expect(generateState()).not.toBe(generateState());
    });
  });

  describe("buildAuthorizeUrl", () => {
    it("includes required OAuth params", () => {
      const url = buildAuthorizeUrl("my-state-123");
      expect(url).toContain("client_id=test_client_id");
      expect(url).toContain("response_type=code");
      expect(url).toContain("state=my-state-123");
      expect(url).toContain("identify");
      expect(url).toContain("guilds.members.read");
    });
  });

  describe("buildAvatarUrl", () => {
    it("returns CDN URL when avatar hash present", () => {
      const url = buildAvatarUrl("123456789", "abc123hash");
      expect(url).toBe(
        "https://cdn.discordapp.com/avatars/123456789/abc123hash.png?size=256",
      );
    });

    it("returns default avatar when hash is null", () => {
      const url = buildAvatarUrl("123456789012345678", null);
      expect(url).toContain("cdn.discordapp.com/embed/avatars/");
      expect(url).toMatch(/\/[0-4]\.png$/);
    });

    it("returns deterministic default avatar for same id", () => {
      const url1 = buildAvatarUrl("123456789012345678", null);
      const url2 = buildAvatarUrl("123456789012345678", null);
      expect(url1).toBe(url2);
    });
  });
});
