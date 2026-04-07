import { describe, it, expect, vi, beforeEach } from "vitest";
import { startupSync } from "../../services/startupSync";

// ------------------------------------------------------------------ mocks
vi.mock("../../util/db", () => ({
  default: {
    event: { findMany: vi.fn() },
  },
}));

const mockEnv = vi.hoisted(() => ({
  DISCORD_ADMIN_ROLE_ID: "admin-role-id",
  DISCORD_GUILD_ID: "guild-id",
}));
vi.mock("../../util/env", () => ({ default: mockEnv }));

vi.mock("../../services/syncParticipation", () => ({
  handleRoleAdded: vi.fn(),
  handleRoleRemoved: vi.fn(),
  handleAdminRoleChange: vi.fn(),
  buildAvatarUrl: vi.fn().mockReturnValue("https://default-avatar.png"),
}));

// ------------------------------------------------------------------ helpers
import prisma from "../../util/db";
import {
  handleRoleAdded,
  handleRoleRemoved,
  handleAdminRoleChange,
} from "../../services/syncParticipation";

const db = prisma as { event: { findMany: ReturnType<typeof vi.fn> } };

const ROLE_ID = "role-event-1";
const EVENT = { id: "event-1", discordRoleId: ROLE_ID };

function makeMember(roleIds: string[], userId = "user-1", username = "TestUser") {
  return {
    user: { id: userId, username, avatar: null },
    roles: { cache: new Map(roleIds.map((r) => [r, {}])) },
  };
}

function makeGuild(members: object[]) {
  const map = new Map(members.map((m, i) => [`id-${i}`, m]));
  return { members: { fetch: vi.fn().mockResolvedValue(map) } };
}

beforeEach(() => {
  mockEnv.DISCORD_ADMIN_ROLE_ID = "admin-role-id";
});

// ================================================================
describe("startupSync", () => {
  it("ne fait rien si aucun event n a de discordRoleId", async () => {
    db.event.findMany.mockResolvedValue([]);
    const guild = makeGuild([]);

    await startupSync(guild as never);

    expect(guild.members.fetch).not.toHaveBeenCalled();
    expect(handleRoleAdded).not.toHaveBeenCalled();
  });

  it("appelle handleRoleAdded pour un membre qui a le role de l event", async () => {
    db.event.findMany.mockResolvedValue([EVENT]);
    const member = makeMember([ROLE_ID]);
    const guild = makeGuild([member]);

    await startupSync(guild as never);

    expect(handleRoleAdded).toHaveBeenCalledWith("user-1", "TestUser", expect.any(String), ROLE_ID);
    expect(handleRoleRemoved).not.toHaveBeenCalledWith("user-1", ROLE_ID);
  });

  it("appelle handleRoleRemoved pour un membre qui n a pas le role de l event", async () => {
    db.event.findMany.mockResolvedValue([EVENT]);
    const member = makeMember(["other-role"]);
    const guild = makeGuild([member]);

    await startupSync(guild as never);

    expect(handleRoleRemoved).toHaveBeenCalledWith("user-1", ROLE_ID);
    expect(handleRoleAdded).not.toHaveBeenCalled();
  });

  it("gere plusieurs events et plusieurs membres", async () => {
    const EVENT_2 = { id: "event-2", discordRoleId: "role-event-2" };
    db.event.findMany.mockResolvedValue([EVENT, EVENT_2]);

    const member1 = makeMember([ROLE_ID], "user-1");
    const member2 = makeMember(["role-event-2"], "user-2");
    const guild = makeGuild([member1, member2]);

    await startupSync(guild as never);

    // member1 a role-event-1 mais pas role-event-2
    expect(handleRoleAdded).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      expect.any(String),
      ROLE_ID
    );
    expect(handleRoleRemoved).toHaveBeenCalledWith("user-1", "role-event-2");

    // member2 a role-event-2 mais pas role-event-1
    expect(handleRoleAdded).toHaveBeenCalledWith(
      "user-2",
      expect.any(String),
      expect.any(String),
      "role-event-2"
    );
    expect(handleRoleRemoved).toHaveBeenCalledWith("user-2", ROLE_ID);
  });

  it("appelle handleAdminRoleChange si DISCORD_ADMIN_ROLE_ID est configure", async () => {
    db.event.findMany.mockResolvedValue([EVENT]);
    const member = makeMember([ROLE_ID, "admin-role-id"]);
    const guild = makeGuild([member]);

    await startupSync(guild as never);

    expect(handleAdminRoleChange).toHaveBeenCalledWith("user-1", true);
  });

  it("ne appelle pas handleAdminRoleChange si DISCORD_ADMIN_ROLE_ID est vide", async () => {
    mockEnv.DISCORD_ADMIN_ROLE_ID = "";
    db.event.findMany.mockResolvedValue([EVENT]);
    const member = makeMember([ROLE_ID]);
    const guild = makeGuild([member]);

    await startupSync(guild as never);

    expect(handleAdminRoleChange).not.toHaveBeenCalled();
  });

  it("continue de traiter les autres membres si l un d eux provoque une erreur", async () => {
    db.event.findMany.mockResolvedValue([EVENT]);

    // member1 leve une exception
    vi.mocked(handleRoleAdded).mockRejectedValueOnce(new Error("DB error"));
    const member1 = makeMember([ROLE_ID], "user-1");
    const member2 = makeMember([ROLE_ID], "user-2");
    const guild = makeGuild([member1, member2]);

    await expect(startupSync(guild as never)).resolves.not.toThrow();

    // Les deux membres ont ete tentes
    expect(handleRoleAdded).toHaveBeenCalledTimes(2);
  });
});
