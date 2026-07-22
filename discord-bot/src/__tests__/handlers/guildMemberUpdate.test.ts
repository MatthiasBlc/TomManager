import { describe, it, expect, vi } from "vitest";
import { onGuildMemberUpdate } from "../../handlers/guildMemberUpdate";

// ------------------------------------------------------------------ mocks
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

vi.mock("../../services/syncKitchenChef", () => ({
  handleChefRoleAdded: vi.fn(),
  handleChefRoleRemoved: vi.fn(),
  reconcileChefEligibility: vi.fn(),
  reconcileChefOnParticipationLost: vi.fn(),
}));

// ------------------------------------------------------------------ helpers
import {
  handleRoleAdded,
  handleRoleRemoved,
  handleAdminRoleChange,
} from "../../services/syncParticipation";
import {
  handleChefRoleAdded,
  handleChefRoleRemoved,
  reconcileChefEligibility,
  reconcileChefOnParticipationLost,
} from "../../services/syncKitchenChef";

function makeMember(roleIds: string[], userId = "user-123", partial = false) {
  const member = {
    partial,
    user: { id: userId, username: "TestUser", avatar: "avatar-hash" },
    roles: { cache: new Map(roleIds.map((r) => [r, {}])) },
    fetch: vi.fn(),
  };
  // fetch() retourne une version complete de lui-meme
  member.fetch.mockResolvedValue({ ...member, partial: false });
  return member;
}

// ================================================================
describe("onGuildMemberUpdate", () => {
  it("ne fait rien si aucun role n a change", async () => {
    const roles = ["role-a", "role-b"];
    const old = makeMember(roles);
    const next = makeMember(roles);

    await onGuildMemberUpdate(old as never, next as never);

    expect(handleRoleAdded).not.toHaveBeenCalled();
    expect(handleRoleRemoved).not.toHaveBeenCalled();
  });

  it("appelle handleRoleAdded pour chaque role ajoute", async () => {
    const old = makeMember(["role-a"]);
    const next = makeMember(["role-a", "role-b", "role-c"]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(handleRoleAdded).toHaveBeenCalledTimes(2);
    expect(handleRoleAdded).toHaveBeenCalledWith(
      "user-123",
      "TestUser",
      expect.any(String),
      "role-b"
    );
    expect(handleRoleAdded).toHaveBeenCalledWith(
      "user-123",
      "TestUser",
      expect.any(String),
      "role-c"
    );
    expect(handleRoleRemoved).not.toHaveBeenCalled();
  });

  it("appelle handleRoleRemoved pour chaque role supprime", async () => {
    const old = makeMember(["role-a", "role-b"]);
    const next = makeMember([]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(handleRoleRemoved).toHaveBeenCalledTimes(2);
    expect(handleRoleRemoved).toHaveBeenCalledWith("user-123", "role-a");
    expect(handleRoleRemoved).toHaveBeenCalledWith("user-123", "role-b");
    expect(handleRoleAdded).not.toHaveBeenCalled();
  });

  it("appelle handleAdminRoleChange(true) quand le role admin est ajoute", async () => {
    const old = makeMember(["role-a"]);
    const next = makeMember(["role-a", "admin-role-id"]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(handleAdminRoleChange).toHaveBeenCalledWith("user-123", true);
  });

  it("appelle handleAdminRoleChange(false) quand le role admin est supprime", async () => {
    const old = makeMember(["role-a", "admin-role-id"]);
    const next = makeMember(["role-a"]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(handleAdminRoleChange).toHaveBeenCalledWith("user-123", false);
  });

  it("ne appelle pas handleAdminRoleChange si DISCORD_ADMIN_ROLE_ID est vide", async () => {
    mockEnv.DISCORD_ADMIN_ROLE_ID = "";
    const old = makeMember([]);
    const next = makeMember(["role-a"]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(handleAdminRoleChange).not.toHaveBeenCalled();
    mockEnv.DISCORD_ADMIN_ROLE_ID = "admin-role-id";
  });

  it("fetche les membres partiels avant de traiter", async () => {
    const old = makeMember([], "user-123", true);
    const next = makeMember(["role-a"], "user-123", true);

    await onGuildMemberUpdate(old as never, next as never);

    expect(old.fetch).toHaveBeenCalled();
    expect(next.fetch).toHaveBeenCalled();
  });

  it("continue de traiter les autres roles si l un provoque une erreur", async () => {
    vi.mocked(handleRoleAdded).mockRejectedValueOnce(new Error("DB error"));

    const old = makeMember([]);
    const next = makeMember(["role-a", "role-b"]);

    await expect(onGuildMemberUpdate(old as never, next as never)).resolves.not.toThrow();

    expect(handleRoleAdded).toHaveBeenCalledTimes(2);
  });

  it("appelle handleChefRoleAdded/handleChefRoleRemoved pour chaque role ajoute/supprime", async () => {
    const old = makeMember(["role-a"]);
    const next = makeMember(["role-b"]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(handleChefRoleAdded).toHaveBeenCalledWith("user-123", "role-b");
    expect(handleChefRoleRemoved).toHaveBeenCalledWith("user-123", "role-a");
  });

  it("reconcilie l'eligibilite chef quand la participation vient d'etre gagnee (role chef deja detenu)", async () => {
    // Cas du bug remonte : le role chef Discord a ete attribue AVANT que la personne
    // rejoigne l'event. Sans ce chemin, elle resterait absente du roster jusqu'au
    // prochain redemarrage du bot (startupSync).
    vi.mocked(handleRoleAdded).mockResolvedValueOnce({ eventId: "event-1", userId: "user-1" });

    const old = makeMember(["chef-role"]);
    const next = makeMember(["chef-role", "event-role"]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(reconcileChefEligibility).toHaveBeenCalledWith("event-1", "user-1", [
      "chef-role",
      "event-role",
    ]);
  });

  it("n'appelle pas reconcileChefEligibility si le role ajoute n'est lie a aucun event", async () => {
    vi.mocked(handleRoleAdded).mockResolvedValueOnce(null);

    const old = makeMember(["role-a"]);
    const next = makeMember(["role-a", "role-b"]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(reconcileChefEligibility).not.toHaveBeenCalled();
  });

  it("reconcilie la perte du roster chef quand la participation vient d'etre perdue", async () => {
    vi.mocked(handleRoleRemoved).mockResolvedValueOnce({ eventId: "event-1", userId: "user-1" });

    const old = makeMember(["event-role"]);
    const next = makeMember([]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(reconcileChefOnParticipationLost).toHaveBeenCalledWith("event-1", "user-1");
  });

  it("n'appelle pas reconcileChefOnParticipationLost si le role retire n'est lie a aucun event", async () => {
    vi.mocked(handleRoleRemoved).mockResolvedValueOnce(null);

    const old = makeMember(["role-a"]);
    const next = makeMember([]);

    await onGuildMemberUpdate(old as never, next as never);

    expect(reconcileChefOnParticipationLost).not.toHaveBeenCalled();
  });
});
