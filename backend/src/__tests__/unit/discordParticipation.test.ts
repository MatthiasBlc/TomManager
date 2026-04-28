import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncDiscordParticipations } from "../../services/discordAuth";

vi.mock("../../config/env", () => ({
  default: {
    DISCORD_CLIENT_ID: "cid",
    DISCORD_CLIENT_SECRET: "secret",
    DISCORD_GUILD_ID: "guild123",
    DISCORD_REDIRECT_URI: "http://localhost:3001/api/auth/discord/callback",
    DISCORD_ADMIN_ROLE_ID: "",
    CORS_ORIGIN: "http://localhost:5173",
  },
}));

const mockUpsert = vi.fn().mockResolvedValue({});
const mockDelete = vi.fn().mockResolvedValue({});
const mockDeleteMany = vi.fn().mockResolvedValue({});
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock("../../util/db", () => ({
  default: {
    event: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    eventParticipation: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    gameTableParticipant: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

describe("syncDiscordParticipations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts participations for events matching member roles", async () => {
    mockFindMany.mockResolvedValue([
      { id: "event-1", discordRoleId: "role-A" },
      { id: "event-2", discordRoleId: "role-B" },
    ]);
    mockFindUnique.mockResolvedValue(null);

    await syncDiscordParticipations("user-1", ["role-A"]);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: "event-1", userId: "user-1" } },
      }),
    );
  });

  it("removes participation when role is revoked", async () => {
    mockFindMany.mockResolvedValue([
      { id: "event-1", discordRoleId: "role-A" },
    ]);
    mockFindUnique.mockResolvedValue({ id: "part-1" });

    await syncDiscordParticipations("user-1", []);

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("skips removal if participation does not exist", async () => {
    mockFindMany.mockResolvedValue([
      { id: "event-1", discordRoleId: "role-A" },
    ]);
    mockFindUnique.mockResolvedValue(null);

    await syncDiscordParticipations("user-1", []);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("is idempotent when roles unchanged", async () => {
    mockFindMany.mockResolvedValue([
      { id: "event-1", discordRoleId: "role-A" },
    ]);
    mockFindUnique.mockResolvedValue(null);

    await syncDiscordParticipations("user-1", ["role-A"]);
    await syncDiscordParticipations("user-1", ["role-A"]);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("handles empty events list", async () => {
    mockFindMany.mockResolvedValue([]);

    await syncDiscordParticipations("user-1", ["role-A", "role-B"]);

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
