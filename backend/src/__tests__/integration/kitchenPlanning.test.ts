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

// Event sur 3 jours calendaires (Paris) -> 3 creneaux : diner J1, dejeuner+diner J2,
// rien J3. Le createur (participant automatique) est neutralise dans le pool en
// l'ajoutant au roster chef (chef et participant s'annulent), comme dans la spec :
// le responsable cuisine n'a pas besoin d'etre participant.
async function setupManagerAndEvent(suffix: string) {
  const creator = await setupAdmin({
    email: `creator-${suffix}@example.com`,
    username: `creator${suffix}`,
  });
  const event = await createTestEvent(creator.cookie, {
    startDateTime: "2026-06-01T10:00:00Z",
    endDateTime: "2026-06-03T18:00:00Z",
  });

  const manager = await setupAdmin({
    email: `manager-${suffix}@example.com`,
    username: `manager${suffix}`,
  });
  await enableKitchenManager(manager.user.id);

  await request
    .post(`/api/events/${event.id}/kitchen/chefs`)
    .set("Cookie", manager.cookie)
    .send({ userId: creator.user.id });

  return { event, managerCookie: manager.cookie, creatorUser: creator.user };
}

async function addEquipiers(eventId: string, count: number, prefix: string) {
  for (let i = 0; i < count; i++) {
    await addTestParticipant(eventId, {
      email: `${prefix}${i}@example.com`,
      username: `${prefix}${i}`,
    });
  }
}

async function getMeals(eventId: string, cookie: string[]) {
  const res = await request.get(`/api/events/${eventId}/kitchen`).set("Cookie", cookie);
  return res.body.data.meals as {
    id: string;
    service: string;
    name: string;
    maxAssistants: number;
    startDateTime: string;
    chef: { id: string } | null;
  }[];
}

describe("POST /api/events/:eventId/kitchen/generate", () => {
  it("rejects a non-admin user", async () => {
    const { event } = await setupManagerAndEvent("g1");
    const { cookie: equipierCookie } = await addTestParticipant(event.id, {
      email: "gen-nonadmin@example.com",
      username: "gennonadmin",
    });

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", equipierCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ADMIN_REQUIRED");
  });

  it("builds the meal grid from event dates (diner J1, lunch+diner J2, nothing J3)", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("g2");

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.createdCount).toBe(3);

    const meals = await getMeals(event.id, managerCookie);
    expect(meals).toHaveLength(3);
    // Tries par startDateTime : diner J1, dejeuner J2, diner J2
    expect(meals.map((m) => m.service)).toEqual(["DINNER", "LUNCH", "DINNER"]);
    expect(meals.every((m) => m.chef === null)).toBe(true);
    expect(meals[0].name.startsWith("Dîner")).toBe(true);
    expect(meals[1].name.startsWith("Déjeuner")).toBe(true);
  });

  it("distributes the remaining pool over the newly created slots", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("g3");
    // creator (participant) neutralise par le roster chef ; +5 equipiers -> pool = 5
    await addEquipiers(event.id, 5, "gen3eq");

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.body.data.pool).toBe(5);
    // 3 creneaux, base=1 reste=2 -> [2, 2, 1]
    expect(res.body.data.capacities).toEqual([2, 2, 1]);

    const meals = await getMeals(event.id, managerCookie);
    expect(meals.map((m) => m.maxAssistants)).toEqual([2, 2, 1]);
  });

  it("excludes chefs and courses members from the pool", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("g4");
    // 3 equipiers, dont 1 promu chef et 1 en equipe courses -> pool = 3 - 1 - 1 = 1
    const chef = await addTestParticipant(event.id, {
      email: "gen4chef@example.com",
      username: "gen4chef",
    });
    const courses = await addTestParticipant(event.id, {
      email: "gen4courses@example.com",
      username: "gen4courses",
    });
    await addTestParticipant(event.id, { email: "gen4free@example.com", username: "gen4free" });

    await request
      .post(`/api/events/${event.id}/kitchen/chefs`)
      .set("Cookie", managerCookie)
      .send({ userId: chef.user.id });
    await request
      .post(`/api/events/${event.id}/kitchen/courses`)
      .set("Cookie", managerCookie)
      .send({ userId: courses.user.id });

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.body.data.pool).toBe(1);
    // 1 place a repartir sur 3 creneaux -> [1, 0, 0]
    expect(res.body.data.capacities).toEqual([1, 0, 0]);
  });

  it("is idempotent: re-generating adds nothing and leaves existing slots untouched", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("g5");
    await addEquipiers(event.id, 4, "gen5eq");

    const first = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(first.body.data.createdCount).toBe(3);
    const firstMeals = await getMeals(event.id, managerCookie);
    const firstCapacities = firstMeals.map((m) => m.maxAssistants);

    const second = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(second.body.data.createdCount).toBe(0);

    const secondMeals = await getMeals(event.id, managerCookie);
    expect(secondMeals).toHaveLength(3);
    expect(secondMeals.map((m) => m.maxAssistants)).toEqual(firstCapacities);
    expect(secondMeals.map((m) => m.id).sort()).toEqual(firstMeals.map((m) => m.id).sort());
  });

  it("coexists with a directly-seeded meal outside the generated grid: subtracts its capacity and only fills the generated slots", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("g6");
    await addEquipiers(event.id, 5, "gen6eq");
    const chef = await addTestParticipant(event.id, {
      email: "gen6chef@example.com",
      username: "gen6chef",
    });
    await request
      .post(`/api/events/${event.id}/kitchen/chefs`)
      .set("Cookie", managerCookie)
      .send({ userId: chef.user.id });

    // Repas seede directement en base (la creation manuelle hors-grille a ete
    // retiree, cf Admin Chef point 3) : le 3e jour (dernier jour) n'est pas couvert
    // par la grille generee (regle "dernier jour = aucun repas"), ce creneau reste
    // donc distinct des 3 que /generate va creer.
    const eventKitchen = await prisma.eventKitchen.findUniqueOrThrow({
      where: { eventId: event.id },
    });
    const seededMeal = await prisma.meal.create({
      data: {
        eventKitchenId: eventKitchen.id,
        chefUserId: chef.user.id,
        name: "Repas hors grille",
        service: "LUNCH",
        startDateTime: new Date("2026-06-03T10:30:00Z"),
        endDateTime: new Date("2026-06-03T13:00:00Z"),
        maxAssistants: 2,
      },
    });

    // pool = 5 equipiers + chef(participant) - chef(roster) = 5 ; consomme = 2 (seede)
    // -> remainingPool = 3 sur 3 creneaux generes -> [1, 1, 1]
    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.body.data.pool).toBe(5);
    expect(res.body.data.createdCount).toBe(3);
    expect(res.body.data.capacities).toEqual([1, 1, 1]);

    // Le repas seede n'est pas modifie
    const meals = await getMeals(event.id, managerCookie);
    const seededAfter = meals.find((m) => m.id === seededMeal.id);
    expect(seededAfter?.maxAssistants).toBe(2);
    expect(seededAfter?.chef?.id).toBe(chef.user.id);
    expect(meals).toHaveLength(4); // 1 hors grille + 3 generes
  });

  it("reports over-occupation without modifying the over-occupied slot", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("g7");
    await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    const meals = await getMeals(event.id, managerCookie);
    const slot = meals[0];

    // Capacite large -> 2 equipiers s'inscrivent -> capacite reduite a 1 (manager)
    await request
      .patch(`/api/events/${event.id}/kitchen/meals/${slot.id}`)
      .set("Cookie", managerCookie)
      .send({ maxAssistants: 5 });
    for (let i = 0; i < 2; i++) {
      const p = await addTestParticipant(event.id, {
        email: `gen7over${i}@example.com`,
        username: `gen7over${i}`,
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${slot.id}/assistants`)
        .set("Cookie", p.cookie);
    }
    await request
      .patch(`/api/events/${event.id}/kitchen/meals/${slot.id}`)
      .set("Cookie", managerCookie)
      .send({ maxAssistants: 1 });

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.status).toBe(200);
    const over = res.body.data.overCapacity.find((o: { mealId: string }) => o.mealId === slot.id);
    expect(over).toBeDefined();
    expect(over.occupied).toBe(2);
    expect(over.maxAssistants).toBe(1);

    // Inscriptions conservees, capacite inchangee
    const assistants = await prisma.mealAssistant.findMany({ where: { mealId: slot.id } });
    expect(assistants).toHaveLength(2);
  });
});

describe("POST /api/events/:eventId/kitchen/reset", () => {
  it("rejects a non-manager user", async () => {
    const { event } = await setupManagerAndEvent("r1");
    const { cookie: equipierCookie } = await addTestParticipant(event.id, {
      email: "reset-nonadmin@example.com",
      username: "resetnonadmin",
    });

    const res = await request
      .post(`/api/events/${event.id}/kitchen/reset`)
      .set("Cookie", equipierCookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ADMIN_REQUIRED");
  });

  it("deletes all meals but keeps the chef/courses rosters intact", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("r2");
    const courses = await addTestParticipant(event.id, {
      email: "reset-courses@example.com",
      username: "resetcourses",
    });
    await request
      .post(`/api/events/${event.id}/kitchen/courses`)
      .set("Cookie", managerCookie)
      .send({ userId: courses.user.id });
    await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    const before = await getMeals(event.id, managerCookie);
    expect(before.length).toBeGreaterThan(0);

    const res = await request
      .post(`/api/events/${event.id}/kitchen/reset`)
      .set("Cookie", managerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(before.length);

    const after = await request.get(`/api/events/${event.id}/kitchen`).set("Cookie", managerCookie);
    expect(after.body.data.meals).toHaveLength(0);
    expect(after.body.data.chefs.length).toBeGreaterThan(0);
    expect(after.body.data.coursesMembers).toHaveLength(1);
  });

  it("lets /generate rebuild the full grid after a reset", async () => {
    const { event, managerCookie } = await setupManagerAndEvent("r3");
    await request.post(`/api/events/${event.id}/kitchen/generate`).set("Cookie", managerCookie);
    await request.post(`/api/events/${event.id}/kitchen/reset`).set("Cookie", managerCookie);

    const res = await request
      .post(`/api/events/${event.id}/kitchen/generate`)
      .set("Cookie", managerCookie);
    expect(res.body.data.createdCount).toBe(3);
  });
});
