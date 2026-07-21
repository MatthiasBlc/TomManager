import { describe, it, expect } from "vitest";
import { request, setupAdmin, createTestEvent, addTestParticipant } from "../setup/testHelpers";
import prisma from "../../util/db";

async function enableKitchenManager(userId: string) {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: "admin.kitchen" } },
    create: { userId, key: "admin.kitchen", value: true },
    update: { value: true },
  });
}

// L'auteur d'un event est automatiquement participant (nested create dans
// eventService.createEvent). On separe donc le createur (simple admin) du
// responsable cuisine (admin.kitchen) pour garder "le responsable n'a pas besoin
// d'etre participant" (spec 1), et on neutralise le createur dans le calcul du
// pool en l'ajoutant au roster chef (chefs et participants s'annulent alors).
async function setupManagerAndEvent(suffix: string) {
  const creator = await setupAdmin({
    email: `creator-${suffix}@example.com`,
    username: `creator${suffix}`,
  });
  const event = await createTestEvent(creator.cookie);

  const manager = await setupAdmin({
    email: `manager-${suffix}@example.com`,
    username: `manager${suffix}`,
  });
  await enableKitchenManager(manager.user.id);

  await request
    .post(`/api/events/${event.id}/kitchen/chefs`)
    .set("Cookie", manager.cookie)
    .send({ userId: creator.user.id });

  return { event, managerCookie: manager.cookie };
}

async function setupChef(
  eventId: string,
  managerCookie: string[],
  overrides: { email: string; username: string }
) {
  const { user, cookie } = await addTestParticipant(eventId, overrides);
  await request
    .post(`/api/events/${eventId}/kitchen/chefs`)
    .set("Cookie", managerCookie)
    .send({ userId: user.id });
  return { user, cookie };
}

async function createMeal(
  eventId: string,
  chefCookie: string[],
  overrides: { name: string; startDateTime: string; endDateTime: string }
) {
  const res = await request
    .post(`/api/events/${eventId}/kitchen/meals`)
    .set("Cookie", chefCookie)
    .send({ service: "DINNER", ...overrides });
  return res.body.data;
}

describe("POST /api/events/:eventId/kitchen/generate", () => {
  it("rejects a non-admin user", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("a1");
    const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
      email: "genchef1@example.com",
      username: "genchef1",
    });

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", chefCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ADMIN_REQUIRED");
  });

  it("sets maxAssistants=0 on all meals when there is no pool (no-op)", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("a2");
    const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
      email: "genchef2@example.com",
      username: "genchef2",
    });
    await createMeal(event.id, chefCookie, {
      name: "Petit dej",
      startDateTime: "2026-06-01T11:00:00Z",
      endDateTime: "2026-06-01T12:00:00Z",
    });

    // pool = 1 participant (le chef, le manager n'est pas participant) - 1 chef = 0
    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.pool).toBe(0);
    expect(res.body.data.capacities).toEqual([0]);

    const kitchenRes = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", managerCookie);
    expect(kitchenRes.body.data.meals[0].maxAssistants).toBe(0);
  });

  it("is a no-op when there are no meals", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("a3");

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.mealCount).toBe(0);
    expect(res.body.data.capacities).toEqual([]);
  });

  it("distributes the pool evenly with the remainder on the first meals (sorted by startDateTime)", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("a4");
    const { cookie: chef1Cookie } = await setupChef(event.id, managerCookie, {
      email: "genchef3@example.com",
      username: "genchef3",
    });
    const { cookie: chef2Cookie } = await setupChef(event.id, managerCookie, {
      email: "genchef4@example.com",
      username: "genchef4",
    });

    // Cree le repas 2 (16h) avant le repas 1 (11h) pour verifier le tri par startDateTime
    const meal2 = await createMeal(event.id, chef2Cookie, {
      name: "Diner",
      startDateTime: "2026-06-01T16:00:00Z",
      endDateTime: "2026-06-01T17:00:00Z",
    });
    const meal1 = await createMeal(event.id, chef1Cookie, {
      name: "Dejeuner",
      startDateTime: "2026-06-01T11:00:00Z",
      endDateTime: "2026-06-01T12:00:00Z",
    });

    // 3 equipiers en plus des 2 chefs -> pool = 5 participants - 2 chefs = 3 ; nbRepas = 2
    // -> base=1, reste=1 -> [2, 1] (premier repas = Dejeuner, trie par startDateTime)
    for (let i = 0; i < 3; i++) {
      await addTestParticipant(event.id, {
        email: `genequipier${i}@example.com`,
        username: `genequipier${i}`,
      });
    }

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.pool).toBe(3);
    expect(res.body.data.capacities).toEqual([2, 1]);

    const kitchenRes = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", managerCookie);
    const meals = kitchenRes.body.data.meals;
    const dejeuner = meals.find((m: { id: string }) => m.id === meal1.id);
    const diner = meals.find((m: { id: string }) => m.id === meal2.id);
    expect(dejeuner.maxAssistants).toBe(2);
    expect(diner.maxAssistants).toBe(1);
  });

  it("excludes courses team members from the pool", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("a5");
    const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
      email: "genchef5@example.com",
      username: "genchef5",
    });
    await createMeal(event.id, chefCookie, {
      name: "Repas",
      startDateTime: "2026-06-01T11:00:00Z",
      endDateTime: "2026-06-01T12:00:00Z",
    });

    const { user: coursesUser } = await addTestParticipant(event.id, {
      email: "gencourses1@example.com",
      username: "gencourses1",
    });
    await request
      .post(`/api/events/${event.id}/kitchen/courses`)
      .set("Cookie", managerCookie)
      .send({ userId: coursesUser.id });

    await addTestParticipant(event.id, {
      email: "genfree1@example.com",
      username: "genfree1",
    });

    // participants = chef + courses member + free = 3 ; pool = 3 - 1 chef - 1 courses = 1
    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.body.data.pool).toBe(1);
    expect(res.body.data.capacities).toEqual([1]);
  });

  it("is non-destructive: keeps assistant registrations and reports over-occupation when the new capacity is lower", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("a6");
    const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
      email: "genchef6@example.com",
      username: "genchef6",
    });
    const meal = await createMeal(event.id, chefCookie, {
      name: "Repas",
      startDateTime: "2026-06-01T11:00:00Z",
      endDateTime: "2026-06-01T12:00:00Z",
    });
    // Capacite initiale large : 3 equipiers s'inscrivent
    await request
      .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
      .set("Cookie", managerCookie)
      .send({ maxAssistants: 5 });

    const equipiers = [];
    for (let i = 0; i < 3; i++) {
      const p = await addTestParticipant(event.id, {
        email: `genover${i}@example.com`,
        username: `genover${i}`,
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal.id}/assistants`)
        .set("Cookie", p.cookie);
      equipiers.push(p.user);
    }

    // Promotion directe en DB (hors API, hors exclusivite) de 2 des 3 equipiers en chefs :
    // simule un pool retreci sous l'occupation courante sans toucher aux inscriptions existantes.
    const eventKitchen = await prisma.eventKitchen.findUniqueOrThrow({
      where: { eventId: event.id },
    });
    await prisma.kitchenChef.createMany({
      data: equipiers
        .slice(0, 2)
        .map((u) => ({ eventKitchenId: eventKitchen.id, userId: u.id, source: "MANUAL" as const })),
    });
    // participants = 4 (chef6 + 3 equipiers) ; chefs = 3 (chef6 + 2 promus) -> pool = 1 ; nbRepas = 1 -> capacite = 1

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.pool).toBe(1);
    expect(res.body.data.capacities).toEqual([1]);
    expect(res.body.data.overCapacity).toHaveLength(1);
    expect(res.body.data.overCapacity[0].mealId).toBe(meal.id);
    expect(res.body.data.overCapacity[0].occupied).toBe(3);
    expect(res.body.data.overCapacity[0].maxAssistants).toBe(1);

    // Les 3 inscriptions existantes doivent etre conservees malgre la sur-occupation
    const assistants = await prisma.mealAssistant.findMany({ where: { mealId: meal.id } });
    expect(assistants).toHaveLength(3);

    const kitchenRes = await request
      .get(`/api/events/${event.id}/kitchen`)
      .set("Cookie", managerCookie);
    const mealData = kitchenRes.body.data.meals.find((m: { id: string }) => m.id === meal.id);
    expect(mealData.maxAssistants).toBe(1);
    expect(mealData.assistants).toHaveLength(3);
  });

  it("regenerating twice recomputes capacities without erroring", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("a7");
    const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
      email: "genchef8@example.com",
      username: "genchef8",
    });
    await createMeal(event.id, chefCookie, {
      name: "Repas",
      startDateTime: "2026-06-01T11:00:00Z",
      endDateTime: "2026-06-01T12:00:00Z",
    });

    const first = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(first.status).toBe(200);
    const second = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(second.status).toBe(200);
    expect(second.body.data.capacities).toEqual(first.body.data.capacities);
  });
});
