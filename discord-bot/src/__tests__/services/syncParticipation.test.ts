import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAvatarUrl,
  handleRoleAdded,
  handleRoleRemoved,
  handleAdminRoleChange,
} from "../../services/syncParticipation";

// ------------------------------------------------------------------ mocks
vi.mock("../../util/db", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    event: {
      findFirst: vi.fn(),
    },
    eventParticipation: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    gameTableParticipant: {
      deleteMany: vi.fn(),
    },
  },
}));

const mockEnv = vi.hoisted(() => ({ DISCORD_ADMIN_ROLE_ID: "admin-role-id" }));
vi.mock("../../util/env", () => ({ default: mockEnv }));

// ------------------------------------------------------------------ helpers
import prisma from "../../util/db";
const db = prisma as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  event: { findFirst: ReturnType<typeof vi.fn> };
  eventParticipation: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  gameTableParticipant: { deleteMany: ReturnType<typeof vi.fn> };
};

const EVENT = { id: "event-1", discordRoleId: "role-event-1" };
const USER = { id: "user-1", username: "TestUser" };

beforeEach(() => {
  mockEnv.DISCORD_ADMIN_ROLE_ID = "admin-role-id";
});

// ================================================================ buildAvatarUrl
describe("buildAvatarUrl", () => {
  it("retourne l url CDN si l avatar est present", () => {
    const url = buildAvatarUrl("123456789", "abc123hash");
    expect(url).toBe("https://cdn.discordapp.com/avatars/123456789/abc123hash.png?size=256");
  });

  it("retourne l avatar par defaut si pas d avatar, index calcule sur les 4 derniers chars", () => {
    // "0000" hex = 0, 0 % 5 = 0
    const url = buildAvatarUrl("xyz0000", null);
    expect(url).toBe("https://cdn.discordapp.com/embed/avatars/0.png");
  });

  it("calcule l index defaut correctement avec modulo 5", () => {
    // "0005" hex = 5, 5 % 5 = 0
    const url0 = buildAvatarUrl("0005", null);
    expect(url0).toBe("https://cdn.discordapp.com/embed/avatars/0.png");
    // "0001" hex = 1, 1 % 5 = 1
    const url1 = buildAvatarUrl("0001", null);
    expect(url1).toBe("https://cdn.discordapp.com/embed/avatars/1.png");
  });
});

// ================================================================ handleRoleAdded
describe("handleRoleAdded", () => {
  it("ne fait rien si le role n est pas lie a un event", async () => {
    db.event.findFirst.mockResolvedValue(null);

    await handleRoleAdded("discord-123", "TestUser", "https://avatar.url", "unrelated-role");

    expect(db.user.findFirst).not.toHaveBeenCalled();
    expect(db.eventParticipation.upsert).not.toHaveBeenCalled();
  });

  it("cree un user et une participation si le user n existe pas", async () => {
    db.event.findFirst.mockResolvedValue(EVENT);
    db.user.findFirst
      .mockResolvedValueOnce(null) // recherche par discordId -> absent
      .mockResolvedValueOnce(null); // generateUniqueUsername: username libre
    db.user.create.mockResolvedValue(USER);
    db.eventParticipation.upsert.mockResolvedValue({});

    await handleRoleAdded("discord-123", "TestUser", "https://avatar.url", "role-event-1");

    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ discordId: "discord-123", discordUsername: "TestUser" }),
      })
    );
    expect(db.eventParticipation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: "event-1", userId: "user-1" } },
      })
    );
  });

  it("met a jour le user existant et upsert la participation", async () => {
    db.event.findFirst.mockResolvedValue(EVENT);
    db.user.findFirst.mockResolvedValue(USER);
    db.user.update.mockResolvedValue(USER);
    db.eventParticipation.upsert.mockResolvedValue({});

    await handleRoleAdded("discord-123", "NewName", "https://new-avatar.url", "role-event-1");

    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { discordUsername: "NewName", avatarUrl: "https://new-avatar.url" },
      })
    );
    expect(db.eventParticipation.upsert).toHaveBeenCalled();
  });

  it("utilise un username de fallback si le username de base est deja pris", async () => {
    db.event.findFirst.mockResolvedValue(EVENT);
    db.user.findFirst
      .mockResolvedValueOnce(null) // recherche par discordId -> absent
      .mockResolvedValueOnce({ id: "other" }) // generateUniqueUsername: base prise
      .mockResolvedValueOnce(null); // fallback libre
    db.user.create.mockResolvedValue(USER);
    db.eventParticipation.upsert.mockResolvedValue({});

    await handleRoleAdded("discord-12345", "TestUser", "https://avatar.url", "role-event-1");

    const createCall = db.user.create.mock.calls[0][0];
    // Le fallback contient les 5 derniers chars du discordId
    expect(createCall.data.username).toContain("12345");
  });
});

// ================================================================ handleRoleRemoved
describe("handleRoleRemoved", () => {
  it("ne fait rien si le role n est pas lie a un event", async () => {
    db.event.findFirst.mockResolvedValue(null);

    await handleRoleRemoved("discord-123", "unrelated-role");

    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("ne fait rien si le user est introuvable en DB", async () => {
    db.event.findFirst.mockResolvedValue(EVENT);
    db.user.findFirst.mockResolvedValue(null);

    await handleRoleRemoved("discord-123", "role-event-1");

    expect(db.eventParticipation.findUnique).not.toHaveBeenCalled();
  });

  it("ne fait rien si le user n a pas de participation a l event", async () => {
    db.event.findFirst.mockResolvedValue(EVENT);
    db.user.findFirst.mockResolvedValue(USER);
    db.eventParticipation.findUnique.mockResolvedValue(null);

    await handleRoleRemoved("discord-123", "role-event-1");

    expect(db.gameTableParticipant.deleteMany).not.toHaveBeenCalled();
    expect(db.eventParticipation.delete).not.toHaveBeenCalled();
  });

  it("supprime les participations aux tables et a l event", async () => {
    const participation = { id: "part-1" };
    db.event.findFirst.mockResolvedValue(EVENT);
    db.user.findFirst.mockResolvedValue(USER);
    db.eventParticipation.findUnique.mockResolvedValue(participation);
    db.gameTableParticipant.deleteMany.mockResolvedValue({ count: 2 });
    db.eventParticipation.delete.mockResolvedValue(participation);

    await handleRoleRemoved("discord-123", "role-event-1");

    expect(db.gameTableParticipant.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", gameTable: { eventId: "event-1" } },
    });
    expect(db.eventParticipation.delete).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: "event-1", userId: "user-1" } },
    });
  });
});

// ================================================================ handleAdminRoleChange
describe("handleAdminRoleChange", () => {
  it("ne fait rien si DISCORD_ADMIN_ROLE_ID n est pas configure", async () => {
    mockEnv.DISCORD_ADMIN_ROLE_ID = "";

    await handleAdminRoleChange("discord-123", true);

    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("ne fait rien si le user est introuvable en DB", async () => {
    db.user.findFirst.mockResolvedValue(null);

    await handleAdminRoleChange("discord-123", true);

    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("passe le user en ADMIN quand added=true", async () => {
    db.user.findFirst.mockResolvedValue(USER);
    db.user.update.mockResolvedValue({ ...USER, role: "ADMIN" });

    await handleAdminRoleChange("discord-123", true);

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "ADMIN" },
    });
  });

  it("passe le user en USER quand added=false", async () => {
    db.user.findFirst.mockResolvedValue({ ...USER, role: "ADMIN" });
    db.user.update.mockResolvedValue({ ...USER, role: "USER" });

    await handleAdminRoleChange("discord-123", false);

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "USER" },
    });
  });
});
