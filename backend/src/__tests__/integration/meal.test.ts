import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
  loginTestUser,
  KITCHEN_WIDE_EVENT_BOUNDS,
} from "../setup/testHelpers";
import prisma from "../../util/db";

async function enableKitchenManager(userId: string) {
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key: "admin.kitchen" } },
    create: { userId, key: "admin.kitchen", value: true },
    update: { value: true },
  });
}

async function setupManager() {
  const { user, cookie } = await setupAdmin({
    email: "mealmanager@example.com",
    username: "mealmanager",
  });
  await enableKitchenManager(user.id);
  return { user, cookie };
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

// Creation directe d'un repas deja assigne a un chef (la creation manuelle
// hors-grille a ete retiree : desormais tous les repas naissent de generatePlanning,
// cf kitchenPlanning.test.ts). Meme pattern direct-DB que kitchen.test.ts ; le chef
// est resolu depuis son cookie via /api/auth/me pour ne pas changer la signature
// (eventId, managerCookie, chefCookie) attendue par tous les appelants existants.
async function createMealForChef(
  eventId: string,
  managerCookie: string[],
  chefCookie: string[],
  patchOverrides: Record<string, unknown> = {},
  slotOverrides: Partial<{
    service: "LUNCH" | "DINNER";
    startDateTime: string;
    endDateTime: string;
  }> = {}
) {
  const meRes = await request.get("/api/auth/me").set("Cookie", chefCookie);
  const chefUserId = meRes.body.user.id;

  const eventKitchen = await prisma.eventKitchen.upsert({
    where: { eventId },
    create: { eventId },
    update: {},
  });
  const meal = await prisma.meal.create({
    data: {
      eventKitchenId: eventKitchen.id,
      chefUserId,
      name: "Repas de test",
      service: slotOverrides.service ?? "DINNER",
      startDateTime: new Date(slotOverrides.startDateTime ?? "2026-06-01T18:30:00Z"),
      endDateTime: new Date(slotOverrides.endDateTime ?? "2026-06-01T21:00:00Z"),
      maxAssistants: 0,
    },
  });

  if (Object.keys(patchOverrides).length > 0) {
    const patchRes = await request
      .patch(`/api/events/${eventId}/kitchen/meals/${meal.id}`)
      .set("Cookie", managerCookie)
      .send(patchOverrides);
    return patchRes.body.data;
  }

  const res = await request.get(`/api/events/${eventId}/kitchen`).set("Cookie", managerCookie);
  return res.body.data.meals.find((m: { id: string }) => m.id === meal.id);
}

async function generateAndGetMeals(eventId: string, managerCookie: string[]) {
  await request.post(`/api/events/${eventId}/kitchen/generate`).set("Cookie", managerCookie);
  const res = await request.get(`/api/events/${eventId}/kitchen`).set("Cookie", managerCookie);
  return res.body.data.meals as {
    id: string;
    service: string;
    chef: { id: string } | null;
  }[];
}

describe("Meal API", () => {
  describe("POST /api/events/:eventId/kitchen/meals/:mealId/claim", () => {
    it("allows a roster chef to claim an orphan slot", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie, user: chefUser } = await setupChef(event.id, managerCookie, {
        email: "claimchefA@example.com",
        username: "claimchefA",
      });

      const meals = await generateAndGetMeals(event.id, managerCookie);
      const orphan = meals.find((m) => m.chef === null)!;

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${orphan.id}/claim`)
        .set("Cookie", chefCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.chef.id).toBe(chefUser.id);
    });

    it("rejects claiming a slot that already has a chef", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chef1Cookie } = await setupChef(event.id, managerCookie, {
        email: "claimchefB@example.com",
        username: "claimchefB",
      });
      const { cookie: chef2Cookie } = await setupChef(event.id, managerCookie, {
        email: "claimchefC@example.com",
        username: "claimchefC",
      });

      const meals = await generateAndGetMeals(event.id, managerCookie);
      const orphan = meals.find((m) => m.chef === null)!;

      await request
        .post(`/api/events/${event.id}/kitchen/meals/${orphan.id}/claim`)
        .set("Cookie", chef1Cookie);
      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${orphan.id}/claim`)
        .set("Cookie", chef2Cookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("MEAL_ALREADY_CLAIMED");
    });

    it("rejects a participant who is not in the chef roster", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      await setupChef(event.id, managerCookie, {
        email: "claimchefD@example.com",
        username: "claimchefD",
      });
      const { cookie: outsiderCookie } = await addTestParticipant(event.id, {
        email: "claimoutsider@example.com",
        username: "claimoutsider",
      });

      const meals = await generateAndGetMeals(event.id, managerCookie);
      const orphan = meals.find((m) => m.chef === null)!;

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${orphan.id}/claim`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("NOT_IN_CHEF_ROSTER");
    });

    it("rejects a chef who already owns a meal from claiming another slot", async () => {
      const { cookie: managerCookie } = await setupManager();
      // Event 3 jours -> plusieurs creneaux orphelins
      const event = await createTestEvent(managerCookie, {
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-03T18:00:00Z",
      });
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "claimchefE@example.com",
        username: "claimchefE",
      });

      const meals = await generateAndGetMeals(event.id, managerCookie);
      const orphans = meals.filter((m) => m.chef === null);
      expect(orphans.length).toBeGreaterThanOrEqual(2);

      await request
        .post(`/api/events/${event.id}/kitchen/meals/${orphans[0].id}/claim`)
        .set("Cookie", chefCookie);
      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${orphans[1].id}/claim`)
        .set("Cookie", chefCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CHEF_ALREADY_HAS_MEAL");
    });
  });

  describe("PATCH /api/events/:eventId/kitchen/meals/:mealId", () => {
    it("allows the owning chef to edit their meal name", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefI@example.com",
        username: "chefI",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", chefCookie)
        .send({ name: "Tartiflette revisitee" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Tartiflette revisitee");
    });

    it("sets ingredients/utensils with find-or-create Product/Utensil catalogs (points 7/8)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefH@example.com",
        username: "chefH",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", chefCookie)
        .send({
          ingredients: [
            { name: "Reblochon", quantity: 1, unit: "PIECE" },
            // Quantite envoyee en string ("1.5") : z.coerce.number() l'accepte
            // (defense en profondeur). La normalisation virgule -> point est faite
            // cote frontend avant envoi (IngredientListInput, teste separement) ;
            // le backend ne parse pas la virgule lui-meme.
            { name: "Pommes de terre", quantity: "1.5", unit: "KG" },
          ],
          utensils: [{ name: "Plat à gratin" }],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.ingredients).toHaveLength(2);
      expect(res.body.data.utensils).toHaveLength(1);
      expect(Number(res.body.data.ingredients[1].quantity)).toBe(1.5);

      const product = await prisma.product.findUnique({ where: { name: "reblochon" } });
      expect(product).not.toBeNull();

      // Dedup lowercase, pattern identique a Product/Tag.
      const utensil = await prisma.utensil.findUnique({ where: { name: "plat à gratin" } });
      expect(utensil).not.toBeNull();
      const utensilRow = res.body.data.utensils[0];
      expect(utensilRow.utensilId).toBe(utensil!.id);
    });

    it("rejects a chef trying to change the schedule or service (manager only)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefIsched@example.com",
        username: "chefIsched",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", chefCookie)
        .send({ startDateTime: "2026-06-01T16:00:00Z" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects a non-owning, non-manager user", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefJ@example.com",
        username: "chefJ",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      const { cookie: otherCookie } = await addTestParticipant(event.id, {
        email: "outsiderK@example.com",
        username: "outsiderK",
      });

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", otherCookie)
        .send({ name: "Hack" });

      expect(res.status).toBe(403);
    });

    it("rejects a chef trying to set maxAssistants (manager only)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefL@example.com",
        username: "chefL",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", chefCookie)
        .send({ maxAssistants: 5 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows the manager to set maxAssistants", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefM@example.com",
        username: "chefM",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.maxAssistants).toBe(3);
    });

    it("allows the manager to reassign an orphan meal to a free roster chef", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie, user: chefUser } = await setupChef(event.id, managerCookie, {
        email: "chefN@example.com",
        username: "chefN",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      // Le chef sort du roster -> le repas devient orphelin
      await request
        .delete(`/api/events/${event.id}/kitchen/chefs/${chefUser.id}`)
        .set("Cookie", managerCookie);

      const { user: newChef } = await setupChef(event.id, managerCookie, {
        email: "chefO@example.com",
        username: "chefO",
      });

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", managerCookie)
        .send({ chefUserId: newChef.id });

      expect(res.status).toBe(200);
      expect(res.body.data.chef.id).toBe(newChef.id);
    });

    it("rejects reassignment when the meal already has a chef (not orphan)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefP@example.com",
        username: "chefP",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);

      const { user: otherChef } = await setupChef(event.id, managerCookie, {
        email: "chefQ@example.com",
        username: "chefQ",
      });

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", managerCookie)
        .send({ chefUserId: otherChef.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MEAL_NOT_ORPHAN");
    });
  });

  describe("DELETE /api/events/:eventId/kitchen/meals/:mealId", () => {
    it("deletes a meal and cascades assistants", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefR@example.com",
        username: "chefR",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 2 });

      const { cookie: assistantCookie } = await addTestParticipant(event.id, {
        email: "assistantR@example.com",
        username: "assistantR",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal.id}/assistants`)
        .set("Cookie", assistantCookie);

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", chefCookie);
      expect(res.status).toBe(204);

      const remaining = await prisma.meal.findUnique({ where: { id: meal.id } });
      expect(remaining).toBeNull();
      const remainingAssistants = await prisma.mealAssistant.findMany({
        where: { mealId: meal.id },
      });
      expect(remainingAssistants).toHaveLength(0);
    });
  });

  describe("Meal assistants (inscription equipier)", () => {
    async function setupMealWithCapacity(capacity: number) {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: `chefcap-${capacity}-${Math.random()}@example.com`,
        username: `chefcap${capacity}${Math.floor(Math.random() * 100000)}`,
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: capacity });
      return { event, managerCookie, mealId: meal.id };
    }

    it("allows an equipier to join a meal with available seats", async () => {
      const { event, mealId } = await setupMealWithCapacity(2);
      const { cookie } = await addTestParticipant(event.id, {
        email: "eq1@example.com",
        username: "eq1",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants`)
        .set("Cookie", cookie);

      expect(res.status).toBe(201);
      expect(res.body.data.remainingSeats).toBe(1);
    });

    it("rejects joining a full meal", async () => {
      const { event, mealId } = await setupMealWithCapacity(1);
      const { cookie: cookie1 } = await addTestParticipant(event.id, {
        email: "eq2@example.com",
        username: "eq2",
      });
      const { cookie: cookie2 } = await addTestParticipant(event.id, {
        email: "eq3@example.com",
        username: "eq3",
      });

      await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants`)
        .set("Cookie", cookie1);
      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants`)
        .set("Cookie", cookie2);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("MEAL_FULL");
    });

    it("blocks a chef from registering as an assistant (exclusivity)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefS@example.com",
        username: "chefS",
      });
      const meal = await createMealForChef(event.id, managerCookie, chefCookie);
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 5 });

      await setupChef(event.id, managerCookie, {
        email: "chefT@example.com",
        username: "chefT",
      });
      const { cookie: otherChefCookie } = await loginTestUser("chefT@example.com");

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal.id}/assistants`)
        .set("Cookie", otherChefCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ROLE_EXCLUSIVITY");
    });

    it("moves an assistant to another meal transactionally, and rejects the move if destination is full", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);

      const { cookie: chef1Cookie } = await setupChef(event.id, managerCookie, {
        email: "chefU@example.com",
        username: "chefU",
      });
      const meal1 = await createMealForChef(event.id, managerCookie, chef1Cookie);
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal1.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 2 });

      const { cookie: chef2Cookie } = await setupChef(event.id, managerCookie, {
        email: "chefV@example.com",
        username: "chefV",
      });
      const meal2 = await createMealForChef(
        event.id,
        managerCookie,
        chef2Cookie,
        { name: "Raclette" },
        { service: "LUNCH" }
      );
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal2.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 1 });

      const { cookie: fillerCookie } = await addTestParticipant(event.id, {
        email: "fillerW@example.com",
        username: "fillerW",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal2.id}/assistants`)
        .set("Cookie", fillerCookie);

      const { cookie: moverCookie } = await addTestParticipant(event.id, {
        email: "moverX@example.com",
        username: "moverX",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal1.id}/assistants`)
        .set("Cookie", moverCookie);

      // meal2 est deja plein (fillerW) -> le deplacement doit echouer sans desinscrire de meal1
      const moveRes = await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal2.id}/assistants`)
        .set("Cookie", moverCookie);
      expect(moveRes.status).toBe(409);
      expect(moveRes.body.error.code).toBe("MEAL_FULL");

      const meal1Check = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie);
      const meal1Data = meal1Check.body.data.meals.find((m: { id: string }) => m.id === meal1.id);
      expect(meal1Data.assistants.map((a: { id: string }) => a.id)).toContain(
        (await prisma.user.findUnique({ where: { username: "moverX" } }))!.id
      );
    });

    it("allows an equipier to leave a meal", async () => {
      const { event, mealId } = await setupMealWithCapacity(2);
      const { cookie } = await addTestParticipant(event.id, {
        email: "eq4@example.com",
        username: "eq4",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants`)
        .set("Cookie", cookie);

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/me`)
        .set("Cookie", cookie);
      expect(res.status).toBe(204);

      const remaining = await prisma.mealAssistant.findMany({ where: { mealId } });
      expect(remaining).toHaveLength(0);
    });

    it("returns NOT_MEAL_ASSISTANT when leaving a meal not joined", async () => {
      const { event, mealId } = await setupMealWithCapacity(2);
      const { cookie } = await addTestParticipant(event.id, {
        email: "eq5@example.com",
        username: "eq5",
      });

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/me`)
        .set("Cookie", cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_MEAL_ASSISTANT");
    });

    describe("Manager assigns/removes a third-party equipier (Admin Chef point 5)", () => {
    it("allows the manager to assign an equipier directly onto a meal", async () => {
      const { event, managerCookie, mealId } = await setupMealWithCapacity(2);
      const { user } = await addTestParticipant(event.id, {
        email: "eqM1@example.com",
        username: "eqM1",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${user.id}`)
        .set("Cookie", managerCookie);

      expect(res.status).toBe(201);
      expect(res.body.data.assistants.map((a: { id: string }) => a.id)).toContain(user.id);
    });

    it("rejects a manager assignment when the meal is full", async () => {
      const { event, managerCookie, mealId } = await setupMealWithCapacity(1);
      const { user: user1 } = await addTestParticipant(event.id, {
        email: "eqM2@example.com",
        username: "eqM2",
      });
      const { user: user2 } = await addTestParticipant(event.id, {
        email: "eqM3@example.com",
        username: "eqM3",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${user1.id}`)
        .set("Cookie", managerCookie);

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${user2.id}`)
        .set("Cookie", managerCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("MEAL_FULL");
    });

    it("rejects assigning a chef (role exclusivity)", async () => {
      const { event, managerCookie, mealId } = await setupMealWithCapacity(2);
      const { user: chefUser } = await setupChef(event.id, managerCookie, {
        email: "eqM4@example.com",
        username: "eqM4",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${chefUser.id}`)
        .set("Cookie", managerCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ROLE_EXCLUSIVITY");
    });

    it("rejects assigning a user who is not an event participant", async () => {
      const { event, managerCookie, mealId } = await setupMealWithCapacity(2);
      const { user: outsider } = await setupAdmin({
        email: "eqM5@example.com",
        username: "eqM5",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${outsider.id}`)
        .set("Cookie", managerCookie);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("NOT_EVENT_PARTICIPANT");
    });

    it("rejects a non-manager caller", async () => {
      const { event, mealId } = await setupMealWithCapacity(2);
      const { user, cookie } = await addTestParticipant(event.id, {
        email: "eqM6@example.com",
        username: "eqM6",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${user.id}`)
        .set("Cookie", cookie);

      expect(res.status).toBe(403);
    });

    it("allows the manager to remove an assigned equipier", async () => {
      const { event, managerCookie, mealId } = await setupMealWithCapacity(2);
      const { user } = await addTestParticipant(event.id, {
        email: "eqM7@example.com",
        username: "eqM7",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${user.id}`)
        .set("Cookie", managerCookie);

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants/${user.id}`)
        .set("Cookie", managerCookie);

      expect(res.status).toBe(204);
      const remaining = await prisma.mealAssistant.findMany({ where: { mealId } });
      expect(remaining).toHaveLength(0);
    });
    });
  });
});
