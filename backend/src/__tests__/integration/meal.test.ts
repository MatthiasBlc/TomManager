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

const SLOT_PAYLOAD = { date: "2026-06-01", service: "DINNER" as const };

// Creation d'un repas assigne a un chef : desormais un parcours en 2 temps (POST
// /meals cree un creneau orphelin, manager only ; le chef le reclame) — le parcours
// standard depuis Evolutions.md point 1 (plus de creation directe avec chef/nom).
async function createMealForChef(
  eventId: string,
  managerCookie: string[],
  chefCookie: string[],
  patchOverrides: Record<string, unknown> = {},
  slotOverrides: Partial<{ date: string; service: "LUNCH" | "DINNER" }> = {}
) {
  const createRes = await request
    .post(`/api/events/${eventId}/kitchen/meals`)
    .set("Cookie", managerCookie)
    .send({ ...SLOT_PAYLOAD, ...slotOverrides });
  const mealId = createRes.body.data.id;

  const claimRes = await request
    .post(`/api/events/${eventId}/kitchen/meals/${mealId}/claim`)
    .set("Cookie", chefCookie);

  if (Object.keys(patchOverrides).length > 0) {
    const patchRes = await request
      .patch(`/api/events/${eventId}/kitchen/meals/${mealId}`)
      .set("Cookie", managerCookie)
      .send(patchOverrides);
    return patchRes.body.data;
  }
  return claimRes.body.data;
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
  describe("POST /api/events/:eventId/kitchen/meals (manager only, creneau orphelin)", () => {
    it("rejects a chef trying to create a meal slot (endpoint reserved to the manager)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefA@example.com",
        username: "chefA",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(SLOT_PAYLOAD);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ADMIN_REQUIRED");
    });

    it("creates an orphan slot with derived name/hours and maxAssistants 0", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", managerCookie)
        .send(SLOT_PAYLOAD);

      expect(res.status).toBe(201);
      expect(res.body.data.chef).toBeNull();
      expect(res.body.data.maxAssistants).toBe(0);
      expect(res.body.data.service).toBe("DINNER");
      expect(res.body.data.name).toBeTruthy();
    });

    it("rejects a duplicate slot for the same day and service", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);

      await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", managerCookie)
        .send(SLOT_PAYLOAD);
      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", managerCookie)
        .send(SLOT_PAYLOAD);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("SLOT_ALREADY_EXISTS");
    });

    it("rejects a slot whose default hours fall outside the event bounds", async () => {
      const { cookie: managerCookie } = await setupManager();
      // Bornes trop etroites pour couvrir le diner par defaut (18h30-21h Paris)
      const event = await createTestEvent(managerCookie, {
        startDateTime: "2026-06-01T00:00:00Z",
        endDateTime: "2026-06-01T10:00:00Z",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", managerCookie)
        .send(SLOT_PAYLOAD);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MEAL_END_OUT_OF_BOUNDS");
    });
  });

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
  });
});
