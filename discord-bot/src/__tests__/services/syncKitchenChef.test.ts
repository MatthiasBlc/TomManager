import { describe, it, expect, vi } from "vitest";
import { handleChefRoleAdded, handleChefRoleRemoved } from "../../services/syncKitchenChef";

// ------------------------------------------------------------------ mocks
vi.mock("../../util/db", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
    },
    eventKitchen: {
      findMany: vi.fn(),
    },
    eventParticipation: {
      findUnique: vi.fn(),
    },
    kitchenChef: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    kitchenCoursesMember: {
      deleteMany: vi.fn(),
    },
    mealAssistant: {
      deleteMany: vi.fn(),
    },
    meal: {
      updateMany: vi.fn(),
    },
  },
}));

// ------------------------------------------------------------------ helpers
import prisma from "../../util/db";
const db = prisma as unknown as {
  user: { findFirst: ReturnType<typeof vi.fn> };
  eventKitchen: { findMany: ReturnType<typeof vi.fn> };
  eventParticipation: { findUnique: ReturnType<typeof vi.fn> };
  kitchenChef: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  kitchenCoursesMember: { deleteMany: ReturnType<typeof vi.fn> };
  mealAssistant: { deleteMany: ReturnType<typeof vi.fn> };
  meal: { updateMany: ReturnType<typeof vi.fn> };
};

const KITCHEN = { id: "kitchen-1", eventId: "event-1", chefRoleId: "role-chef-1" };
const USER = { id: "user-1" };

describe("handleChefRoleAdded", () => {
  it("ne fait rien si aucun EventKitchen n a ce chefRoleId", async () => {
    db.eventKitchen.findMany.mockResolvedValue([]);

    await handleChefRoleAdded("discord-123", "unrelated-role");

    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("ne fait rien si le user est introuvable en DB", async () => {
    db.eventKitchen.findMany.mockResolvedValue([KITCHEN]);
    db.user.findFirst.mockResolvedValue(null);

    await handleChefRoleAdded("discord-123", "role-chef-1");

    expect(db.eventParticipation.findUnique).not.toHaveBeenCalled();
  });

  it("ne fait rien si le user n est pas participant de l event (spec 7)", async () => {
    db.eventKitchen.findMany.mockResolvedValue([KITCHEN]);
    db.user.findFirst.mockResolvedValue(USER);
    db.eventParticipation.findUnique.mockResolvedValue(null);

    await handleChefRoleAdded("discord-123", "role-chef-1");

    expect(db.kitchenChef.create).not.toHaveBeenCalled();
  });

  it("ne fait rien si le user est deja dans le roster", async () => {
    db.eventKitchen.findMany.mockResolvedValue([KITCHEN]);
    db.user.findFirst.mockResolvedValue(USER);
    db.eventParticipation.findUnique.mockResolvedValue({ id: "part-1" });
    db.kitchenChef.findUnique.mockResolvedValue({ id: "existing-chef" });

    await handleChefRoleAdded("discord-123", "role-chef-1");

    expect(db.kitchenChef.create).not.toHaveBeenCalled();
  });

  it("cree la ligne KitchenChef ROLE et preempte courses/equipier (spec 2.4)", async () => {
    db.eventKitchen.findMany.mockResolvedValue([KITCHEN]);
    db.user.findFirst.mockResolvedValue(USER);
    db.eventParticipation.findUnique.mockResolvedValue({ id: "part-1" });
    db.kitchenChef.findUnique.mockResolvedValue(null);

    await handleChefRoleAdded("discord-123", "role-chef-1");

    expect(db.kitchenChef.create).toHaveBeenCalledWith({
      data: { eventKitchenId: "kitchen-1", userId: "user-1", source: "ROLE" },
    });
    expect(db.kitchenCoursesMember.deleteMany).toHaveBeenCalledWith({
      where: { eventKitchenId: "kitchen-1", userId: "user-1" },
    });
    expect(db.mealAssistant.deleteMany).toHaveBeenCalledWith({
      where: { eventKitchenId: "kitchen-1", userId: "user-1" },
    });
  });
});

describe("handleChefRoleRemoved", () => {
  it("ne fait rien si aucun EventKitchen n a ce chefRoleId", async () => {
    db.eventKitchen.findMany.mockResolvedValue([]);

    await handleChefRoleRemoved("discord-123", "unrelated-role");

    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("ne fait rien si le user n est pas dans le roster", async () => {
    db.eventKitchen.findMany.mockResolvedValue([KITCHEN]);
    db.user.findFirst.mockResolvedValue(USER);
    db.kitchenChef.findUnique.mockResolvedValue(null);

    await handleChefRoleRemoved("discord-123", "role-chef-1");

    expect(db.kitchenChef.delete).not.toHaveBeenCalled();
  });

  it("ne touche pas un chef MANUAL (seul ROLE est gere par le bot)", async () => {
    db.eventKitchen.findMany.mockResolvedValue([KITCHEN]);
    db.user.findFirst.mockResolvedValue(USER);
    db.kitchenChef.findUnique.mockResolvedValue({ id: "chef-1", source: "MANUAL" });

    await handleChefRoleRemoved("discord-123", "role-chef-1");

    expect(db.kitchenChef.delete).not.toHaveBeenCalled();
  });

  it("retire le chef ROLE et orpheline son repas (spec 2.4)", async () => {
    db.eventKitchen.findMany.mockResolvedValue([KITCHEN]);
    db.user.findFirst.mockResolvedValue(USER);
    db.kitchenChef.findUnique.mockResolvedValue({ id: "chef-1", source: "ROLE" });

    await handleChefRoleRemoved("discord-123", "role-chef-1");

    expect(db.kitchenChef.delete).toHaveBeenCalledWith({ where: { id: "chef-1" } });
    expect(db.meal.updateMany).toHaveBeenCalledWith({
      where: { eventKitchenId: "kitchen-1", chefUserId: "user-1" },
      data: { chefUserId: null },
    });
  });
});
