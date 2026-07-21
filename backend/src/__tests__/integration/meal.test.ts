import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
  loginTestUser,
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

// Bornes par defaut de createTestEvent : 2026-06-01T10:00:00Z -> 2026-06-01T18:00:00Z
const MEAL_PAYLOAD = {
  name: "Tartiflette",
  service: "DINNER" as const,
  startDateTime: "2026-06-01T15:00:00Z",
  endDateTime: "2026-06-01T17:00:00Z",
};

describe("Meal API", () => {
  describe("POST /api/events/:eventId/kitchen/meals", () => {
    it("allows a chef to create their own meal", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie, user: chefUser } = await setupChef(event.id, managerCookie, {
        email: "chefA@example.com",
        username: "chefA",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Tartiflette");
      expect(res.body.data.chef.id).toBe(chefUser.id);
      expect(res.body.data.maxAssistants).toBe(0);
    });

    it("rejects a chef trying to create a meal for someone else", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefB@example.com",
        username: "chefB",
      });
      const { user: otherChef } = await setupChef(event.id, managerCookie, {
        email: "chefC@example.com",
        username: "chefC",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send({ ...MEAL_PAYLOAD, chefUserId: otherChef.id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows a manager to create a meal on behalf of a roster chef", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { user: chefUser } = await setupChef(event.id, managerCookie, {
        email: "chefD@example.com",
        username: "chefD",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", managerCookie)
        .send({ ...MEAL_PAYLOAD, chefUserId: chefUser.id });

      expect(res.status).toBe(201);
      expect(res.body.data.chef.id).toBe(chefUser.id);
    });

    it("rejects creation for a user not in the chef roster", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { user } = await addTestParticipant(event.id, {
        email: "notchefE@example.com",
        username: "notchefE",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", managerCookie)
        .send({ ...MEAL_PAYLOAD, chefUserId: user.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("NOT_IN_CHEF_ROSTER");
    });

    it("rejects a second meal for the same chef (unique 1 chef/repas)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefF@example.com",
        username: "chefF",
      });

      await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("MEAL_ALREADY_EXISTS");
    });

    it("rejects meal times outside event bounds", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefG@example.com",
        username: "chefG",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send({ ...MEAL_PAYLOAD, startDateTime: "2026-05-31T18:00:00Z" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MEAL_START_OUT_OF_BOUNDS");
    });

    it("creates ingredients with find-or-create Product and utensils", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefH@example.com",
        username: "chefH",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send({
          ...MEAL_PAYLOAD,
          ingredients: [
            { name: "Reblochon", quantity: 1, unit: "PIECE" },
            { name: "Pommes de terre", quantity: 2, unit: "KG" },
          ],
          utensils: [{ name: "Plat a gratin" }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.ingredients).toHaveLength(2);
      expect(res.body.data.utensils).toHaveLength(1);

      const product = await prisma.product.findUnique({ where: { name: "reblochon" } });
      expect(product).not.toBeNull();
    });
  });

  describe("PATCH /api/events/:eventId/kitchen/meals/:mealId", () => {
    it("allows the owning chef to edit their meal", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefI@example.com",
        username: "chefI",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", chefCookie)
        .send({ name: "Tartiflette revisitee" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Tartiflette revisitee");
    });

    it("rejects a non-owning, non-manager user", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefJ@example.com",
        username: "chefJ",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;

      const { cookie: otherCookie } = await addTestParticipant(event.id, {
        email: "outsiderK@example.com",
        username: "outsiderK",
      });

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", otherCookie)
        .send({ name: "Hack" });

      expect(res.status).toBe(403);
    });

    it("rejects a chef trying to set maxAssistants (manager only)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefL@example.com",
        username: "chefL",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", chefCookie)
        .send({ maxAssistants: 5 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows the manager to set maxAssistants", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefM@example.com",
        username: "chefM",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.maxAssistants).toBe(3);
    });

    it("allows the manager to reassign an orphan meal to a free roster chef", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie, user: chefUser } = await setupChef(event.id, managerCookie, {
        email: "chefN@example.com",
        username: "chefN",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;

      // Le chef sort du roster -> le repas devient orphelin
      await request
        .delete(`/api/events/${event.id}/kitchen/chefs/${chefUser.id}`)
        .set("Cookie", managerCookie);

      const { user: newChef } = await setupChef(event.id, managerCookie, {
        email: "chefO@example.com",
        username: "chefO",
      });

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", managerCookie)
        .send({ chefUserId: newChef.id });

      expect(res.status).toBe(200);
      expect(res.body.data.chef.id).toBe(newChef.id);
    });

    it("rejects reassignment when the meal already has a chef (not orphan)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefP@example.com",
        username: "chefP",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;

      const { user: otherChef } = await setupChef(event.id, managerCookie, {
        email: "chefQ@example.com",
        username: "chefQ",
      });

      const res = await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", managerCookie)
        .send({ chefUserId: otherChef.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("MEAL_NOT_ORPHAN");
    });
  });

  describe("DELETE /api/events/:eventId/kitchen/meals/:mealId", () => {
    it("deletes a meal and cascades assistants", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefR@example.com",
        username: "chefR",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 2 });

      const { cookie: assistantCookie } = await addTestParticipant(event.id, {
        email: "assistantR@example.com",
        username: "assistantR",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealId}/assistants`)
        .set("Cookie", assistantCookie);

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", chefCookie);
      expect(res.status).toBe(204);

      const remaining = await prisma.meal.findUnique({ where: { id: mealId } });
      expect(remaining).toBeNull();
      const remainingAssistants = await prisma.mealAssistant.findMany({ where: { mealId } });
      expect(remainingAssistants).toHaveLength(0);
    });
  });

  describe("Meal assistants (inscription equipier)", () => {
    async function setupMealWithCapacity(capacity: number) {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: `chefcap-${capacity}-${Math.random()}@example.com`,
        username: `chefcap${capacity}${Math.floor(Math.random() * 100000)}`,
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      const mealId = createRes.body.data.id;
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${mealId}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: capacity });
      return { event, managerCookie, mealId };
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
      const event = await createTestEvent(managerCookie);
      const { cookie: chefCookie } = await setupChef(event.id, managerCookie, {
        email: "chefS@example.com",
        username: "chefS",
      });
      const createRes = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chefCookie)
        .send(MEAL_PAYLOAD);
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${createRes.body.data.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 5 });

      await setupChef(event.id, managerCookie, {
        email: "chefT@example.com",
        username: "chefT",
      });
      const { cookie: otherChefCookie } = await loginTestUser("chefT@example.com");

      const res = await request
        .post(`/api/events/${event.id}/kitchen/meals/${createRes.body.data.id}/assistants`)
        .set("Cookie", otherChefCookie);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ROLE_EXCLUSIVITY");
    });

    it("moves an assistant to another meal transactionally, and rejects the move if destination is full", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      const { cookie: chef1Cookie } = await setupChef(event.id, managerCookie, {
        email: "chefU@example.com",
        username: "chefU",
      });
      const meal1Res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chef1Cookie)
        .send(MEAL_PAYLOAD);
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal1Res.body.data.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 2 });

      const { cookie: chef2Cookie } = await setupChef(event.id, managerCookie, {
        email: "chefV@example.com",
        username: "chefV",
      });
      const meal2Res = await request
        .post(`/api/events/${event.id}/kitchen/meals`)
        .set("Cookie", chef2Cookie)
        .send({ ...MEAL_PAYLOAD, name: "Raclette" });
      await request
        .patch(`/api/events/${event.id}/kitchen/meals/${meal2Res.body.data.id}`)
        .set("Cookie", managerCookie)
        .send({ maxAssistants: 1 });

      const { cookie: fillerCookie } = await addTestParticipant(event.id, {
        email: "fillerW@example.com",
        username: "fillerW",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal2Res.body.data.id}/assistants`)
        .set("Cookie", fillerCookie);

      const { cookie: moverCookie } = await addTestParticipant(event.id, {
        email: "moverX@example.com",
        username: "moverX",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal1Res.body.data.id}/assistants`)
        .set("Cookie", moverCookie);

      // meal2 est deja plein (fillerW) -> le deplacement doit echouer sans desinscrire de meal1
      const moveRes = await request
        .post(`/api/events/${event.id}/kitchen/meals/${meal2Res.body.data.id}/assistants`)
        .set("Cookie", moverCookie);
      expect(moveRes.status).toBe(409);
      expect(moveRes.body.error.code).toBe("MEAL_FULL");

      const meal1Check = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie);
      const meal1Data = meal1Check.body.data.meals.find(
        (m: { id: string }) => m.id === meal1Res.body.data.id
      );
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
