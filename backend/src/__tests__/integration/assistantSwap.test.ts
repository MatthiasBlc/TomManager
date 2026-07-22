import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
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

async function setupManager(suffix: string) {
  const { user, cookie } = await setupAdmin({
    email: `aswapmgr-${suffix}@example.com`,
    username: `aswapmgr${suffix}`,
  });
  await enableKitchenManager(user.id);
  return { user, cookie };
}

async function createOrphanMeal(
  eventId: string,
  opts: { date: string; service: "LUNCH" | "DINNER"; maxAssistants: number }
) {
  const eventKitchen = await prisma.eventKitchen.upsert({
    where: { eventId },
    create: { eventId },
    update: {},
  });
  const hours = opts.service === "LUNCH" ? ["10:30:00", "13:00:00"] : ["18:30:00", "21:00:00"];
  return prisma.meal.create({
    data: {
      eventKitchenId: eventKitchen.id,
      chefUserId: null,
      name: "",
      service: opts.service,
      startDateTime: new Date(`${opts.date}T${hours[0]}Z`),
      endDateTime: new Date(`${opts.date}T${hours[1]}Z`),
      maxAssistants: opts.maxAssistants,
    },
  });
}

// Deux repas : meal1 (2 places, eq1 dessus) et meal2 (1 place, eq2 dessus -> complet).
async function setupTwoMealsWithAssistants(suffix: string) {
  const { cookie: managerCookie } = await setupManager(suffix);
  const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);

  const meal1 = await createOrphanMeal(event.id, {
    date: "2026-06-01",
    service: "DINNER",
    maxAssistants: 2,
  });
  const meal2 = await createOrphanMeal(event.id, {
    date: "2026-06-01",
    service: "LUNCH",
    maxAssistants: 1,
  });

  const eq1 = await addTestParticipant(event.id, {
    email: `aswapeq1-${suffix}@example.com`,
    username: `aswapeq1${suffix}`,
  });
  const eq2 = await addTestParticipant(event.id, {
    email: `aswapeq2-${suffix}@example.com`,
    username: `aswapeq2${suffix}`,
  });
  await request
    .post(`/api/events/${event.id}/kitchen/meals/${meal1.id}/assistants`)
    .set("Cookie", eq1.cookie);
  await request
    .post(`/api/events/${event.id}/kitchen/meals/${meal2.id}/assistants`)
    .set("Cookie", eq2.cookie);

  return { event, managerCookie, meal1, meal2, eq1, eq2 };
}

async function getMeal(eventId: string, cookie: string[], mealId: string) {
  const res = await request.get(`/api/events/${eventId}/kitchen`).set("Cookie", cookie);
  return res.body.data.meals.find((m: { id: string }) => m.id === mealId);
}

describe("Assistant swap API (point 4, Evolutions.md)", () => {
  describe("POST /assistant-swaps (create)", () => {
    it("rejects creation when the target meal still has a free seat", async () => {
      const { cookie: managerCookie } = await setupManager("a1b");
      const event = await createTestEvent(managerCookie, KITCHEN_WIDE_EVENT_BOUNDS);
      const mealFull = await createOrphanMeal(event.id, {
        date: "2026-06-01",
        service: "DINNER",
        maxAssistants: 1,
      });
      const mealFree = await createOrphanMeal(event.id, {
        date: "2026-06-01",
        service: "LUNCH",
        maxAssistants: 2,
      });
      const eq1 = await addTestParticipant(event.id, {
        email: "aswapeq1-a1b@example.com",
        username: "aswapeq1a1b",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/meals/${mealFull.id}/assistants`)
        .set("Cookie", eq1.cookie);

      const res = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: mealFree.id });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TARGET_MEAL_HAS_SEATS");
    });

    it("creates a pending request against a full target meal", async () => {
      const { event, eq1, meal2 } = await setupTwoMealsWithAssistants("a2");

      const res = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.requester.id).toBe(eq1.user.id);
      expect(res.body.data.targetMeal.id).toBe(meal2.id);
    });

    it("returns ASSISTANT_SWAP_SAME_MEAL when targeting one's own meal", async () => {
      const { event, eq1, meal1 } = await setupTwoMealsWithAssistants("a3");

      const res = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal1.id });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("ASSISTANT_SWAP_SAME_MEAL");
    });

    it("returns NOT_MEAL_ASSISTANT when the caller is not registered on any meal", async () => {
      const { event, meal2 } = await setupTwoMealsWithAssistants("a4");
      const outsider = await addTestParticipant(event.id, {
        email: "aswapoutsider-a4@example.com",
        username: "aswapoutsidera4",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", outsider.cookie)
        .send({ targetMealId: meal2.id });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_MEAL_ASSISTANT");
    });

    it("returns ASSISTANT_SWAP_ALREADY_PENDING on a second outgoing request", async () => {
      const { event, eq1, meal2 } = await setupTwoMealsWithAssistants("a5");

      await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const res = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ASSISTANT_SWAP_ALREADY_PENDING");
    });
  });

  describe("POST /assistant-swaps/:id/accept", () => {
    it("swaps the two assistants 1-for-1, capacity-neutral", async () => {
      const { event, managerCookie, meal1, meal2, eq1, eq2 } =
        await setupTwoMealsWithAssistants("a6");

      const proposeRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const requestId = proposeRes.body.data.id;

      const acceptRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps/${requestId}/accept`)
        .set("Cookie", eq2.cookie);
      expect(acceptRes.status).toBe(200);

      const meal1After = await getMeal(event.id, managerCookie, meal1.id);
      const meal2After = await getMeal(event.id, managerCookie, meal2.id);
      expect(meal1After.assistants.map((a: { id: string }) => a.id)).toEqual([eq2.user.id]);
      expect(meal2After.assistants.map((a: { id: string }) => a.id)).toEqual([eq1.user.id]);

      const req = await prisma.assistantSwapRequest.findUnique({ where: { id: requestId } });
      expect(req?.status).toBe("ACCEPTED");
      expect(req?.accepterUserId).toBe(eq2.user.id);
    });

    it("returns FORBIDDEN when the accepter is not currently on the target meal", async () => {
      const { event, eq1, meal2 } = await setupTwoMealsWithAssistants("a7");
      const outsider = await addTestParticipant(event.id, {
        email: "aswapoutsider-a7@example.com",
        username: "aswapoutsidera7",
      });

      const proposeRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const requestId = proposeRes.body.data.id;

      const res = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps/${requestId}/accept`)
        .set("Cookie", outsider.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    // Tous les chemins de suppression/deplacement atteignables par l'API annulent
    // deja la demande (cf tests "Auto-cancel" plus bas), donc la demande est
    // CANCELLED avant meme d'atteindre ce recheck en pratique. Ce test verifie
    // directement la defense en profondeur de acceptAssistantSwapRequest (l'ancien
    // emplacement du demandeur a change) en contournant le hook via Prisma, pour
    // couvrir un chemin de suppression qui oublierait d'appeler le nettoyage.
    it("returns ASSISTANT_SWAP_STALE when the requester's assistant row no longer matches (defense in depth)", async () => {
      const { event, eq1, eq2, meal1, meal2 } = await setupTwoMealsWithAssistants("a8");

      const proposeRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const requestId = proposeRes.body.data.id;

      // Contourne le hook de nettoyage : supprime la fiche equipier directement en
      // base, sans passer par leaveMeal/joinOrMoveMeal.
      await prisma.mealAssistant.delete({
        where: { mealId_userId: { mealId: meal1.id, userId: eq1.user.id } },
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps/${requestId}/accept`)
        .set("Cookie", eq2.cookie);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ASSISTANT_SWAP_STALE");
    });
  });

  describe("POST /assistant-swaps/:id/cancel", () => {
    it("lets only the requester cancel their own pending request", async () => {
      const { event, eq1, eq2, meal2 } = await setupTwoMealsWithAssistants("a9");

      const proposeRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const requestId = proposeRes.body.data.id;

      const forbidden = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps/${requestId}/cancel`)
        .set("Cookie", eq2.cookie);
      expect(forbidden.status).toBe(403);

      const cancelRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps/${requestId}/cancel`)
        .set("Cookie", eq1.cookie);
      expect(cancelRes.status).toBe(200);

      const req = await prisma.assistantSwapRequest.findUnique({ where: { id: requestId } });
      expect(req?.status).toBe("CANCELLED");
    });
  });

  describe("Auto-cancel when the requester's assistant registration changes elsewhere", () => {
    it("cancels the pending request when the requester leaves their meal directly", async () => {
      const { event, eq1, meal1, meal2 } = await setupTwoMealsWithAssistants("a10");

      const proposeRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const requestId = proposeRes.body.data.id;

      await request
        .delete(`/api/events/${event.id}/kitchen/meals/${meal1.id}/assistants/me`)
        .set("Cookie", eq1.cookie);

      const req = await prisma.assistantSwapRequest.findUnique({ where: { id: requestId } });
      expect(req?.status).toBe("CANCELLED");
    });

    it("cancels the pending request when the requester becomes a chef (auto-unassign)", async () => {
      const { event, managerCookie, eq1, meal2 } = await setupTwoMealsWithAssistants("a11");

      const proposeRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const requestId = proposeRes.body.data.id;

      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", managerCookie)
        .send({ userId: eq1.user.id });

      const req = await prisma.assistantSwapRequest.findUnique({ where: { id: requestId } });
      expect(req?.status).toBe("CANCELLED");
    });

    it("cancels the pending request when the requester joins the courses team (auto-unassign)", async () => {
      const { event, managerCookie, eq1, meal2 } = await setupTwoMealsWithAssistants("a12");

      const proposeRes = await request
        .post(`/api/events/${event.id}/kitchen/assistant-swaps`)
        .set("Cookie", eq1.cookie)
        .send({ targetMealId: meal2.id });
      const requestId = proposeRes.body.data.id;

      await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", managerCookie)
        .send({ userId: eq1.user.id });

      const req = await prisma.assistantSwapRequest.findUnique({ where: { id: requestId } });
      expect(req?.status).toBe("CANCELLED");
    });
  });
});
