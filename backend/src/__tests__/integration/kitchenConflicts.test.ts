import { describe, it, expect } from "vitest";
import { request, setupAdmin, createTestEvent, addTestParticipant } from "../setup/testHelpers";
import prisma from "../../util/db";

// Lot F : integration du moteur de conflits unifie (tables + cuisine).
// Verifie qu'une occupation cuisine (chef sur son repas, equipier inscrit) qui
// chevauche une table de jeu remonte bien un conflit des deux cotes (GET /tables
// ET GET /kitchen), et respecte la visibilite personne / chef / MJ.

async function enableKitchenManager(userId: string) {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: "admin.kitchen" } },
    create: { userId, key: "admin.kitchen", value: true },
    update: { value: true },
  });
}

// Cree une table de jeu (JDR) via l'API au nom du GM et renvoie son id
async function createTable(
  cookie: string[],
  eventId: string,
  overrides: { title: string; startDateTime: string; endDateTime: string }
) {
  const res = await request
    .post(`/api/events/${eventId}/tables`)
    .set("Cookie", cookie)
    .send({ type: "JDR", maxPlayers: 5, ...overrides });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function seedKitchenChefWithMeal(
  eventId: string,
  chefUserId: string,
  meal: { name: string; start: string; end: string }
) {
  const eventKitchen = await prisma.eventKitchen.upsert({
    where: { eventId },
    create: { eventId },
    update: {},
  });
  await prisma.kitchenChef.create({
    data: { eventKitchenId: eventKitchen.id, userId: chefUserId, source: "MANUAL" },
  });
  const created = await prisma.meal.create({
    data: {
      eventKitchenId: eventKitchen.id,
      chefUserId,
      name: meal.name,
      service: "DINNER",
      startDateTime: new Date(meal.start),
      endDateTime: new Date(meal.end),
      maxAssistants: 3,
    },
  });
  return { eventKitchenId: eventKitchen.id, mealId: created.id };
}

describe("Unified conflict engine (tables + kitchen)", () => {
  it("flags a table AND a meal when a chef busy on their meal joins an overlapping table", async () => {
    const { user: managerUser, cookie: managerCookie } = await setupAdmin({
      email: "manager@example.com",
      username: "manager1",
    });
    await enableKitchenManager(managerUser.id);
    const event = await createTestEvent(managerCookie);

    // GM (participant) qui dirige la table
    const { cookie: gmCookie } = await addTestParticipant(event.id, {
      email: "gm@example.com",
      username: "gm1",
    });
    // chef cuisine (participant) : occupe par son repas
    const { user: chefUser, cookie: chefCookie } = await addTestParticipant(event.id, {
      email: "chef@example.com",
      username: "chef1",
    });

    // Repas du chef 11:00 -> 13:00
    await seedKitchenChefWithMeal(event.id, chefUser.id, {
      name: "Couscous",
      start: "2026-06-01T11:00:00Z",
      end: "2026-06-01T13:00:00Z",
    });

    // Table 12:00 -> 14:00 (chevauche le repas)
    const tableId = await createTable(gmCookie, event.id, {
      title: "Donjon",
      startDateTime: "2026-06-01T12:00:00Z",
      endDateTime: "2026-06-01T14:00:00Z",
    });

    // Le chef rejoint la table -> il est occupe sur deux creneaux qui se chevauchent
    const joinRes = await request
      .post(`/api/events/${event.id}/tables/${tableId}/join`)
      .set("Cookie", chefCookie);
    expect(joinRes.status).toBe(201);

    // Cote tables, vu par le chef : conflit sur lui-meme
    const tablesAsChef = await request
      .get(`/api/events/${event.id}/tables`)
      .set("Cookie", chefCookie);
    const tableForChef = tablesAsChef.body.data.find((t: { id: string }) => t.id === tableId);
    expect(tableForChef.currentUserConflict).toBe(true);
    expect(tableForChef.conflictingPlayerCount).toBe(1);

    // Cote tables, vu par le MJ : il n'est pas en conflit lui-meme mais voit le compte
    const tablesAsGm = await request.get(`/api/events/${event.id}/tables`).set("Cookie", gmCookie);
    const tableForGm = tablesAsGm.body.data.find((t: { id: string }) => t.id === tableId);
    expect(tableForGm.isGM).toBe(true);
    expect(tableForGm.currentUserConflict).toBe(false);
    expect(tableForGm.conflictingPlayerCount).toBe(1);

    // Cote cuisine, vu par le chef : conflit sur son repas + compte visible
    const kitchenAsChef = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", chefCookie);
    expect(kitchenAsChef.body.data.meals).toHaveLength(1);
    expect(kitchenAsChef.body.data.meals[0].currentUserConflict).toBe(true);
    expect(kitchenAsChef.body.data.meals[0].conflictingCount).toBe(1);
  });

  it("does not flag a conflict when the meal and the table do not overlap", async () => {
    const { user: managerUser, cookie: managerCookie } = await setupAdmin({
      email: "manager2@example.com",
      username: "manager2",
    });
    await enableKitchenManager(managerUser.id);
    const event = await createTestEvent(managerCookie);

    const { cookie: gmCookie } = await addTestParticipant(event.id, {
      email: "gm2@example.com",
      username: "gm2",
    });
    const { user: chefUser, cookie: chefCookie } = await addTestParticipant(event.id, {
      email: "chef2@example.com",
      username: "chef2",
    });

    // Repas 11:00 -> 13:00, table 14:00 -> 16:00 : disjoints
    await seedKitchenChefWithMeal(event.id, chefUser.id, {
      name: "Brunch",
      start: "2026-06-01T11:00:00Z",
      end: "2026-06-01T13:00:00Z",
    });
    const tableId = await createTable(gmCookie, event.id, {
      title: "Oneshot",
      startDateTime: "2026-06-01T14:00:00Z",
      endDateTime: "2026-06-01T16:00:00Z",
    });
    await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", chefCookie);

    const tablesAsChef = await request
      .get(`/api/events/${event.id}/tables`)
      .set("Cookie", chefCookie);
    const tableForChef = tablesAsChef.body.data.find((t: { id: string }) => t.id === tableId);
    expect(tableForChef.currentUserConflict).toBe(false);
    expect(tableForChef.conflictingPlayerCount).toBe(0);

    const kitchenAsChef = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", chefCookie);
    expect(kitchenAsChef.body.data.meals[0].currentUserConflict).toBe(false);
    expect(kitchenAsChef.body.data.meals[0].conflictingCount).toBe(0);
  });

  it("flags an equipier registered on a meal who also joins an overlapping table", async () => {
    const { user: managerUser, cookie: managerCookie } = await setupAdmin({
      email: "manager3@example.com",
      username: "manager3",
    });
    await enableKitchenManager(managerUser.id);
    const event = await createTestEvent(managerCookie);

    const { cookie: gmCookie } = await addTestParticipant(event.id, {
      email: "gm3@example.com",
      username: "gm3",
    });
    const { user: chefUser, cookie: chefCookie } = await addTestParticipant(event.id, {
      email: "chef3@example.com",
      username: "chef3",
    });
    const { user: equipierUser, cookie: equipierCookie } = await addTestParticipant(event.id, {
      email: "equipier3@example.com",
      username: "equipier3",
    });

    // equipierPlanningEnabled pour que l'equipier voie le board cote GET /kitchen
    await request
      .patch(`/api/events/${event.id}/kitchen`)
      .set("Cookie", managerCookie)
      .send({ equipierPlanningEnabled: true });

    const { eventKitchenId, mealId } = await seedKitchenChefWithMeal(event.id, chefUser.id, {
      name: "Raclette",
      start: "2026-06-01T11:00:00Z",
      end: "2026-06-01T13:00:00Z",
    });
    // equipier inscrit au repas
    await prisma.mealAssistant.create({
      data: { mealId, eventKitchenId, userId: equipierUser.id },
    });

    // Table chevauchante, l'equipier la rejoint
    const tableId = await createTable(gmCookie, event.id, {
      title: "Enquete",
      startDateTime: "2026-06-01T12:30:00Z",
      endDateTime: "2026-06-01T15:00:00Z",
    });
    await request
      .post(`/api/events/${event.id}/tables/${tableId}/join`)
      .set("Cookie", equipierCookie);

    // L'equipier voit son propre conflit cote table
    const tablesAsEquipier = await request
      .get(`/api/events/${event.id}/tables`)
      .set("Cookie", equipierCookie);
    const tableForEquipier = tablesAsEquipier.body.data.find(
      (t: { id: string }) => t.id === tableId
    );
    expect(tableForEquipier.currentUserConflict).toBe(true);

    // Le chef (proprietaire du repas) voit le conflit remonter sur son repas (visibilite chef)
    const kitchenAsChef = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", chefCookie);
    const chefMeal = kitchenAsChef.body.data.meals[0];
    expect(chefMeal.currentUserConflict).toBe(false); // le chef lui-meme n'est pas en conflit
    expect(chefMeal.conflictingCount).toBe(1); // mais un equipier l'est

    // L'equipier voit son propre conflit sur le repas
    const kitchenAsEquipier = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", equipierCookie);
    expect(kitchenAsEquipier.body.data.meals[0].currentUserConflict).toBe(true);
  });
});
