import { describe, it, expect, vi, afterEach } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  createTestUserDirectly,
  addTestParticipant,
} from "../setup/testHelpers";
import prisma from "../../util/db";

// Lot G : extension du purge d'event (spec CookV1, section 10).
// L'EventKitchen (et son chefRoleId) survit au purge, mais son contenu est vide :
// repas/ingredients/ustensiles/inscriptions, equipe courses, et chefs MANUAL
// uniquement. Les chefs ROLE se reconstituent au re-import (cf. syncChefRoleRoster).
//
// Les tests qui exercent le chemin "chefRoleId defini" mockent adminSync : le
// container de dev tourne avec un vrai token/guild Discord (cf. .env), et les tests
// existants evitent deliberement de fixer discordRoleId pour ne jamais solliciter le
// reseau reel. On applique la meme prudence ici.
let mockParticipantUserIds: string[] = [];
let mockChefRoleHolderUserIds: string[] = [];

vi.mock("../../services/adminSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/adminSync")>();
  return {
    ...actual,
    syncEventParticipantsFromDiscord: vi.fn(async (eventId: string) => {
      for (const userId of mockParticipantUserIds) {
        await prisma.eventParticipation.upsert({
          where: { eventId_userId: { eventId, userId } },
          create: { eventId, userId },
          update: {},
        });
      }
      return mockParticipantUserIds.length;
    }),
    getLocalUserIdsForDiscordRole: vi.fn(async () => mockChefRoleHolderUserIds),
  };
});

describe("Event purge - Kitchen extension (CookV1 Lot G)", () => {
  afterEach(() => {
    mockParticipantUserIds = [];
    mockChefRoleHolderUserIds = [];
  });

  it("keeps EventKitchen + chefRoleId, wipes meals/courses/manual chefs, keeps ROLE chef rows intact", async () => {
    const { cookie } = await setupAdmin();
    const event = await createTestEvent(cookie);

    const { user: roleChefUser } = await addTestParticipant(event.id, {
      email: "rolechef@example.com",
      username: "rolechef1",
    });
    const { user: manualChefUser } = await addTestParticipant(event.id, {
      email: "manualchef@example.com",
      username: "manualchef1",
    });
    const { user: equipierUser } = await addTestParticipant(event.id, {
      email: "equipier@example.com",
      username: "equipier1",
    });

    // chefRoleId reste null ici : isole le comportement de suppression pure,
    // sans declencher le chemin de reconciliation reseau (voir test suivant).
    const eventKitchen = await prisma.eventKitchen.create({
      data: { eventId: event.id, allergiesNotes: "Allergie noix" },
    });
    await prisma.kitchenChef.create({
      data: { eventKitchenId: eventKitchen.id, userId: roleChefUser.id, source: "ROLE" },
    });
    await prisma.kitchenChef.create({
      data: { eventKitchenId: eventKitchen.id, userId: manualChefUser.id, source: "MANUAL" },
    });
    await prisma.kitchenCoursesMember.create({
      data: { eventKitchenId: eventKitchen.id, userId: equipierUser.id },
    });
    const meal = await prisma.meal.create({
      data: {
        eventKitchenId: eventKitchen.id,
        chefUserId: roleChefUser.id,
        name: "Couscous",
        service: "DINNER",
        startDateTime: new Date("2026-06-01T11:00:00Z"),
        endDateTime: new Date("2026-06-01T13:00:00Z"),
        maxAssistants: 2,
      },
    });
    await prisma.mealIngredient.create({
      data: { mealId: meal.id, name: "Semoule", quantity: 1, unit: "KG" },
    });
    await prisma.mealAssistant.create({
      data: { mealId: meal.id, eventKitchenId: eventKitchen.id, userId: equipierUser.id },
    });

    // Un 2e repas + une demande d'echange equipier en attente (point 4, Evolutions.md) :
    // doit disparaitre en cascade via la suppression du repas (onDelete: Cascade).
    const { user: otherEquipierUser } = await addTestParticipant(event.id, {
      email: "otherequipier@example.com",
      username: "otherequipier1",
    });
    const meal2 = await prisma.meal.create({
      data: {
        eventKitchenId: eventKitchen.id,
        chefUserId: null,
        name: "",
        service: "LUNCH",
        startDateTime: new Date("2026-06-01T10:30:00Z"),
        endDateTime: new Date("2026-06-01T13:00:00Z"),
        maxAssistants: 1,
      },
    });
    await prisma.mealAssistant.create({
      data: { mealId: meal2.id, eventKitchenId: eventKitchen.id, userId: otherEquipierUser.id },
    });
    const assistantSwapRequest = await prisma.assistantSwapRequest.create({
      data: {
        eventKitchenId: eventKitchen.id,
        requesterMealId: meal.id,
        targetMealId: meal2.id,
        requesterUserId: equipierUser.id,
      },
    });

    const res = await request.post(`/api/events/${event.id}/purge`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    expect(
      await prisma.assistantSwapRequest.findUnique({ where: { id: assistantSwapRequest.id } })
    ).toBeNull();

    // EventKitchen conserve (config incluse)
    const kitchenAfter = await prisma.eventKitchen.findUnique({ where: { eventId: event.id } });
    expect(kitchenAfter).not.toBeNull();
    expect(kitchenAfter?.allergiesNotes).toBe("Allergie noix");

    // Contenu vide : repas (cascade ingredients/assistants), courses
    expect(await prisma.meal.count({ where: { eventKitchenId: eventKitchen.id } })).toBe(0);
    expect(await prisma.mealIngredient.count({ where: { mealId: meal.id } })).toBe(0);
    expect(await prisma.mealAssistant.count({ where: { eventKitchenId: eventKitchen.id } })).toBe(
      0
    );
    expect(
      await prisma.kitchenCoursesMember.count({ where: { eventKitchenId: eventKitchen.id } })
    ).toBe(0);

    // Chefs : MANUAL retire, ROLE conserve
    const chefsAfter = await prisma.kitchenChef.findMany({
      where: { eventKitchenId: eventKitchen.id },
    });
    expect(chefsAfter).toHaveLength(1);
    expect(chefsAfter[0].userId).toBe(roleChefUser.id);
    expect(chefsAfter[0].source).toBe("ROLE");
  });

  it("reconstitutes ROLE chefs from the Discord role once participants are re-imported", async () => {
    const { cookie } = await setupAdmin();
    const event = await createTestEvent(cookie);
    // Un discordRoleId lie declenche le re-import participants (mocke ci-dessus)
    await prisma.event.update({
      where: { id: event.id },
      data: { discordRoleId: "guild-role-participants" },
    });

    const { user: futureChef } = await createTestUserDirectly({
      email: "futurechef@example.com",
      username: "futurechef",
    });

    const eventKitchen = await prisma.eventKitchen.create({
      data: { eventId: event.id, chefRoleId: "guild-role-chef" },
    });

    // futureChef n'est ni participant ni chef avant le purge : le mock simule un
    // membre Discord porteur du role chef, reimporte comme participant PUIS
    // materialise en KitchenChef ROLE — sans aucun appel reseau reel.
    mockParticipantUserIds = [futureChef.id];
    mockChefRoleHolderUserIds = [futureChef.id];

    const res = await request.post(`/api/events/${event.id}/purge`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.resyncedParticipants).toBe(1);

    const participation = await prisma.eventParticipation.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: futureChef.id } },
    });
    expect(participation).not.toBeNull();

    const chefs = await prisma.kitchenChef.findMany({
      where: { eventKitchenId: eventKitchen.id },
    });
    expect(chefs).toHaveLength(1);
    expect(chefs[0].userId).toBe(futureChef.id);
    expect(chefs[0].source).toBe("ROLE");
  });

  it("does nothing kitchen-related when the event never had an EventKitchen", async () => {
    const { cookie } = await setupAdmin();
    const event = await createTestEvent(cookie);

    const res = await request.post(`/api/events/${event.id}/purge`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    expect(await prisma.eventKitchen.findUnique({ where: { eventId: event.id } })).toBeNull();
  });
});
