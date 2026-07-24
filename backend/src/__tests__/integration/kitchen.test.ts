import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
  createTestUserDirectly,
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
    email: "manager@example.com",
    username: "manager1",
  });
  await enableKitchenManager(user.id);
  return { user, cookie };
}

describe("Kitchen API", () => {
  describe("GET /api/events/:eventId/kitchen", () => {
    it("returns a default state when no EventKitchen exists yet (no 404)", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);

      const res = await request.get(`/api/events/${event.id}/kitchen`).set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.eventKitchenId).toBeNull();
      expect(res.body.data.chefRoleId).toBeNull();
      expect(res.body.data.equipierPlanningEnabled).toBe(false);
      expect(res.body.data.currentUserKitchenRole).toBe("manager");
      expect(res.body.data.meals).toEqual([]);
    });

    it("returns 404 for an unknown event", async () => {
      const { cookie } = await setupManager();
      const res = await request
        .get("/api/events/00000000-0000-4000-8000-000000000000/kitchen")
        .set("Cookie", cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
    });

    it("rejects a non-participant, non-admin user", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      await createTestUserDirectly({ email: "outsider@example.com", username: "outsider" });
      const { cookie: outsiderCookie } = await loginTestUser("outsider@example.com");

      const res = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", outsiderCookie);
      expect(res.status).toBe(403);
    });

    it("does not leak allergies or ingredients to a plain equipier (anti-leak)", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie)
        .send({ allergiesNotes: "Allergie noix", equipierPlanningEnabled: true });

      const { user: chefUser, cookie: chefCookie } = await addTestParticipant(event.id, {
        email: "chef@example.com",
        username: "chef1",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", managerCookie)
        .send({ userId: chefUser.id });

      const meal = await prisma.meal.create({
        data: {
          eventKitchenId: (
            await prisma.eventKitchen.findUniqueOrThrow({ where: { eventId: event.id } })
          ).id,
          chefUserId: chefUser.id,
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

      const { cookie: equipierCookie } = await addTestParticipant(event.id, {
        email: "equipier@example.com",
        username: "equipier1",
      });

      const res = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", equipierCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.currentUserKitchenRole).toBe("equipier");
      expect(res.body.data.allergiesNotes).toBeUndefined();
      expect(res.body.data.chefs).toBeUndefined();
      expect(res.body.data.coursesMembers).toBeUndefined();
      expect(res.body.data.unassigned).toBeUndefined();
      expect(res.body.data.meals).toHaveLength(1);
      expect(res.body.data.meals[0].ingredients).toBeUndefined();
      expect(res.body.data.meals[0].utensils).toBeUndefined();
      expect(res.body.data.meals[0].name).toBe("Couscous");
      expect(res.body.data.meals[0].remainingSeats).toBe(2);

      const chefRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", chefCookie);
      expect(chefRes.body.data.currentUserKitchenRole).toBe("chef");
      expect(chefRes.body.data.allergiesNotes).toBe("Allergie noix");
      expect(chefRes.body.data.meals[0].ingredients).toHaveLength(1);
      expect(chefRes.body.data.chefs).toBeUndefined();
      expect(chefRes.body.data.unassigned).toBeUndefined();

      const managerRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie);
      expect(managerRes.body.data.currentUserKitchenRole).toBe("manager");
      expect(managerRes.body.data.chefs).toHaveLength(1);
      expect(managerRes.body.data.unassigned).toBeDefined();
    });

    it("exposes vegeCount/carneCount and eventParticipantsCount to chef/manager/admin, never to a plain equipier", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie)
        .send({ equipierPlanningEnabled: true });

      const { user: chefUser, cookie: chefCookie } = await addTestParticipant(event.id, {
        email: "dietchef@example.com",
        username: "dietchef",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", managerCookie)
        .send({ userId: chefUser.id });

      const { cookie: equipierCookie } = await addTestParticipant(event.id, {
        email: "dietequipier@example.com",
        username: "dietequipier",
      });

      // 3 participants confirmes : le manager (createur), le chef, l'equipier.
      await prisma.meal.create({
        data: {
          eventKitchenId: (
            await prisma.eventKitchen.findUniqueOrThrow({ where: { eventId: event.id } })
          ).id,
          chefUserId: chefUser.id,
          name: "Couscous",
          service: "DINNER",
          startDateTime: new Date("2026-06-01T11:00:00Z"),
          endDateTime: new Date("2026-06-01T13:00:00Z"),
          maxAssistants: 0,
          vegeCount: 2,
          carneCount: 1,
        },
      });

      const equipierRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", equipierCookie);
      expect(equipierRes.body.data.meals[0].vegeCount).toBeUndefined();
      expect(equipierRes.body.data.meals[0].carneCount).toBeUndefined();
      expect(equipierRes.body.data.eventParticipantsCount).toBeUndefined();

      const chefRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", chefCookie);
      expect(chefRes.body.data.meals[0].vegeCount).toBe(2);
      expect(chefRes.body.data.meals[0].carneCount).toBe(1);
      expect(chefRes.body.data.eventParticipantsCount).toBe(3);

      const managerRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie);
      expect(managerRes.body.data.meals[0].vegeCount).toBe(2);
      expect(managerRes.body.data.meals[0].carneCount).toBe(1);
      expect(managerRes.body.data.eventParticipantsCount).toBe(3);

      const { cookie: plainAdminCookie } = await setupAdmin({
        email: "dietadmin@example.com",
        username: "dietadmin",
      });
      const adminRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", plainAdminCookie);
      expect(adminRes.body.data.meals[0].vegeCount).toBe(2);
      expect(adminRes.body.data.meals[0].carneCount).toBe(1);
      expect(adminRes.body.data.eventParticipantsCount).toBe(3);
    });

    it("hides the board from a plain equipier when equipierPlanningEnabled is false", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      const { cookie: equipierCookie } = await addTestParticipant(event.id, {
        email: "e2@example.com",
        username: "e2",
      });

      const res = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", equipierCookie);
      expect(res.status).toBe(200);
      expect(res.body.data.currentUserKitchenRole).toBe("equipier");
      expect(res.body.data.meals).toEqual([]);
    });

    it("gives a plain admin (no admin.kitchen) a dashboard only — no gestion, no fiches detail", async () => {
      const { user: managerUser, cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie)
        .send({ allergiesNotes: "Allergie noix" });

      const { user: chefUser } = await addTestParticipant(event.id, {
        email: "chef2@example.com",
        username: "chef2",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", managerCookie)
        .send({ userId: chefUser.id });

      const meal = await prisma.meal.create({
        data: {
          eventKitchenId: (
            await prisma.eventKitchen.findUniqueOrThrow({ where: { eventId: event.id } })
          ).id,
          chefUserId: chefUser.id,
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

      const { cookie: plainAdminCookie } = await setupAdmin({
        email: "plainadmin@example.com",
        username: "plainadmin",
      });

      const res = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", plainAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.currentUserKitchenRole).toBe("none");
      expect(res.body.data.isChef).toBe(false);
      expect(res.body.data.allergiesNotes).toBeUndefined();
      expect(res.body.data.chefs).toBeUndefined();
      expect(res.body.data.coursesMembers).toBeUndefined();
      expect(res.body.data.unassigned).toBeUndefined();
      expect(res.body.data.meals).toHaveLength(1);
      expect(res.body.data.meals[0].name).toBe("Couscous");
      expect(res.body.data.meals[0].ingredients).toBeUndefined();
      expect(res.body.data.meals[0].utensils).toBeUndefined();
      expect(res.body.data.dashboard).toEqual({
        chefsCount: 1,
        coursesCount: 0,
        unassignedCount: 1,
        chefs: [{ id: chefUser.id, username: "chef2", displayName: null, source: "MANUAL" }],
        coursesMembers: [],
        unassigned: [{ id: managerUser.id, username: "manager1", displayName: null }],
      });
    });

    it("gives an admin who is also chef both the dashboard AND their own fiche (cumulative, not exclusive)", async () => {
      const { user: managerUser, cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", managerCookie)
        .send({ allergiesNotes: "Allergie noix" });

      const { user: adminChefUser, cookie: adminChefCookie } = await setupAdmin({
        email: "adminchef@example.com",
        username: "adminchef",
      });
      await prisma.eventParticipation.create({
        data: { eventId: event.id, userId: adminChefUser.id },
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", managerCookie)
        .send({ userId: adminChefUser.id });

      const meal = await prisma.meal.create({
        data: {
          eventKitchenId: (
            await prisma.eventKitchen.findUniqueOrThrow({ where: { eventId: event.id } })
          ).id,
          chefUserId: adminChefUser.id,
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

      const res = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", adminChefCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.currentUserKitchenRole).toBe("chef");
      expect(res.body.data.isChef).toBe(true);
      // Toujours ses propres fiches (chef => isFullReader), meme en cumulant admin
      expect(res.body.data.allergiesNotes).toBe("Allergie noix");
      expect(res.body.data.meals[0].ingredients).toEqual([
        expect.objectContaining({ name: "Semoule" }),
      ]);
      // Et desormais aussi le dashboard admin (avant : exclusif avec le role chef)
      expect(res.body.data.dashboard).toEqual({
        chefsCount: 1,
        coursesCount: 0,
        unassignedCount: 1,
        chefs: [
          { id: adminChefUser.id, username: "adminchef", displayName: null, source: "MANUAL" },
        ],
        coursesMembers: [],
        unassigned: [{ id: managerUser.id, username: "manager1", displayName: null }],
      });
      // Toujours pas la gestion complete (pas responsable)
      expect(res.body.data.chefs).toBeUndefined();
      expect(res.body.data.capacitySummary).toBeUndefined();
    });

    it("exposes isCoursesMember as a self flag, never a nominative leak", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);

      const { user: coursesUser, cookie: coursesCookie } = await addTestParticipant(event.id, {
        email: "courses1@example.com",
        username: "courses1",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", managerCookie)
        .send({ userId: coursesUser.id });

      const { cookie: equipierCookie } = await addTestParticipant(event.id, {
        email: "e3@example.com",
        username: "e3",
      });

      const coursesRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", coursesCookie);
      expect(coursesRes.body.data.isCoursesMember).toBe(true);
      expect(coursesRes.body.data.isChef).toBe(false);

      const equipierRes = await request
        .get(`/api/events/${event.id}/kitchen`)
        .set("Cookie", equipierCookie);
      expect(equipierRes.body.data.isCoursesMember).toBe(false);
    });
  });

  describe("PATCH /api/events/:eventId/kitchen", () => {
    it("rejects a non-admin user", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      const { cookie: userCookie } = await addTestParticipant(event.id, {
        email: "u1@example.com",
        username: "u1",
      });

      const res = await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", userCookie)
        .send({ allergiesNotes: "x" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ADMIN_REQUIRED");
    });

    it("rejects an admin without the admin.kitchen preference", async () => {
      const { cookie: managerCookie } = await setupManager();
      const event = await createTestEvent(managerCookie);
      await createTestUserDirectly({
        email: "admin2@example.com",
        username: "admin2",
        role: "ADMIN",
      });
      const { cookie: adminCookie } = await loginTestUser("admin2@example.com");

      const res = await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", adminCookie)
        .send({ allergiesNotes: "x" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("KITCHEN_MANAGER_REQUIRED");
    });

    it("creates the EventKitchen on first write and updates config", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);

      const res = await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", cookie)
        .send({ allergiesNotes: "Sans gluten", equipierPlanningEnabled: true });

      expect(res.status).toBe(200);
      expect(res.body.data.eventKitchenId).not.toBeNull();
      expect(res.body.data.allergiesNotes).toBe("Sans gluten");
      expect(res.body.data.equipierPlanningEnabled).toBe(true);
    });

    it("rejects allergiesNotes longer than 5000 characters", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);

      const res = await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", cookie)
        .send({ allergiesNotes: "a".repeat(5001) });
      expect(res.status).toBe(400);
    });

    it("overwrites MANUAL chefs and orphans their meal when a chefRoleId is set", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user: chefUser } = await addTestParticipant(event.id, {
        email: "chef3@example.com",
        username: "chef3",
      });

      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: chefUser.id });

      const eventKitchen = await prisma.eventKitchen.findUniqueOrThrow({
        where: { eventId: event.id },
      });
      const meal = await prisma.meal.create({
        data: {
          eventKitchenId: eventKitchen.id,
          chefUserId: chefUser.id,
          name: "Tarte",
          service: "LUNCH",
          startDateTime: new Date("2026-06-01T11:00:00Z"),
          endDateTime: new Date("2026-06-01T13:00:00Z"),
        },
      });

      // Pas de token Discord configure en test -> le sync du roster ROLE echoue
      // silencieusement (best-effort), mais l'ecrasement MANUAL doit deja avoir eu lieu.
      const res = await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", cookie)
        .send({ chefRoleId: "123456789012345678" });

      expect(res.status).toBe(200);
      expect(res.body.data.chefRoleId).toBe("123456789012345678");

      const remainingChefs = await prisma.kitchenChef.findMany({
        where: { eventKitchenId: eventKitchen.id, source: "MANUAL" },
      });
      expect(remainingChefs).toHaveLength(0);

      const orphanedMeal = await prisma.meal.findUniqueOrThrow({ where: { id: meal.id } });
      expect(orphanedMeal.chefUserId).toBeNull();
    });
  });

  describe("POST/DELETE /api/events/:eventId/kitchen/chefs", () => {
    it("adds a manual chef who is an event participant", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "chef4@example.com",
        username: "chef4",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(201);
      expect(res.body.data.chefs.map((c: { id: string }) => c.id)).toContain(user.id);

      const notif = await prisma.notification.findFirst({
        where: { userId: user.id, type: "KITCHEN_CHEF_ADDED" },
      });
      expect(notif).not.toBeNull();
    });

    it("rejects adding a non-participant as chef", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await createTestUserDirectly({
        email: "notparticipant@example.com",
        username: "notparticipant",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("NOT_EVENT_PARTICIPANT");
    });

    it("rejects adding the same chef twice", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "chef5@example.com",
        username: "chef5",
      });

      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });
      const res = await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ALREADY_CHEF");
    });

    it("rejects manual chef management when chefRoleId is set", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "chef6@example.com",
        username: "chef6",
      });
      await request
        .patch(`/api/events/${event.id}/kitchen`)
        .set("Cookie", cookie)
        .send({ chefRoleId: "123456789012345678" });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("CHEF_ROLE_MODE_ACTIVE");
    });

    it("preempts courses membership when a courses member becomes chef (2.4)", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "chef7@example.com",
        username: "chef7",
      });

      await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(201);
      const eventKitchen = await prisma.eventKitchen.findUniqueOrThrow({
        where: { eventId: event.id },
      });
      const coursesRow = await prisma.kitchenCoursesMember.findUnique({
        where: { eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: user.id } },
      });
      expect(coursesRow).toBeNull();
    });

    it("auto-claims an orphan meal for a manually-assigned chef who was assisting on it (point 3, Evolutions.md)", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "chef10@example.com",
        username: "chef10",
      });
      const eventKitchen = await prisma.eventKitchen.create({ data: { eventId: event.id } });
      const orphanMeal = await prisma.meal.create({
        data: {
          eventKitchenId: eventKitchen.id,
          chefUserId: null,
          name: "",
          service: "DINNER",
          startDateTime: new Date("2026-06-01T18:00:00Z"),
          endDateTime: new Date("2026-06-01T20:00:00Z"),
          maxAssistants: 5,
        },
      });
      await prisma.mealAssistant.create({
        data: { mealId: orphanMeal.id, eventKitchenId: eventKitchen.id, userId: user.id },
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(201);
      const updatedMeal = await prisma.meal.findUniqueOrThrow({ where: { id: orphanMeal.id } });
      expect(updatedMeal.chefUserId).toBe(user.id);
      const assistantRow = await prisma.mealAssistant.findUnique({
        where: { mealId_userId: { mealId: orphanMeal.id, userId: user.id } },
      });
      expect(assistantRow).toBeNull();
    });

    it("does NOT auto-claim when the assisted meal already has a chef (point 3, Evolutions.md)", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user: otherChef } = await addTestParticipant(event.id, {
        email: "chef11@example.com",
        username: "chef11",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: otherChef.id });

      const { user } = await addTestParticipant(event.id, {
        email: "chef12@example.com",
        username: "chef12",
      });
      const eventKitchen = await prisma.eventKitchen.findUniqueOrThrow({
        where: { eventId: event.id },
      });
      const claimedMeal = await prisma.meal.create({
        data: {
          eventKitchenId: eventKitchen.id,
          chefUserId: otherChef.id,
          name: "Tartiflette",
          service: "DINNER",
          startDateTime: new Date("2026-06-01T18:00:00Z"),
          endDateTime: new Date("2026-06-01T20:00:00Z"),
          maxAssistants: 5,
        },
      });
      await prisma.mealAssistant.create({
        data: { mealId: claimedMeal.id, eventKitchenId: eventKitchen.id, userId: user.id },
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(201);
      const updatedMeal = await prisma.meal.findUniqueOrThrow({ where: { id: claimedMeal.id } });
      expect(updatedMeal.chefUserId).toBe(otherChef.id);
      const assistantRow = await prisma.mealAssistant.findUnique({
        where: { mealId_userId: { mealId: claimedMeal.id, userId: user.id } },
      });
      expect(assistantRow).toBeNull();
    });

    it("removing a chef with a meal orphans the meal but keeps the sheet (2.4/2.5)", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "chef8@example.com",
        username: "chef8",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      const eventKitchen = await prisma.eventKitchen.findUniqueOrThrow({
        where: { eventId: event.id },
      });
      const meal = await prisma.meal.create({
        data: {
          eventKitchenId: eventKitchen.id,
          chefUserId: user.id,
          name: "Ratatouille",
          service: "DINNER",
          startDateTime: new Date("2026-06-01T18:00:00Z"),
          endDateTime: new Date("2026-06-01T20:00:00Z"),
        },
      });

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/chefs/${user.id}`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      const orphaned = await prisma.meal.findUniqueOrThrow({ where: { id: meal.id } });
      expect(orphaned.chefUserId).toBeNull();
      expect(orphaned.name).toBe("Ratatouille");

      const notif = await prisma.notification.findFirst({
        where: { userId: user.id, type: "KITCHEN_CHEF_REMOVED" },
      });
      expect(notif).not.toBeNull();
      expect(notif?.message).toContain("sans chef");
    });

    it("returns NOT_IN_CHEF_ROSTER when removing a chef not in the roster", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "notchef@example.com",
        username: "notchef",
      });

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/chefs/${user.id}`)
        .set("Cookie", cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_IN_CHEF_ROSTER");
    });
  });

  describe("POST/DELETE /api/events/:eventId/kitchen/courses", () => {
    it("adds and removes a courses member who is a participant", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "courses1@example.com",
        username: "courses1",
      });

      const addRes = await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", cookie)
        .send({ userId: user.id });
      expect(addRes.status).toBe(201);
      expect(addRes.body.data.coursesMembers.map((c: { id: string }) => c.id)).toContain(user.id);

      const removeRes = await request
        .delete(`/api/events/${event.id}/kitchen/courses/${user.id}`)
        .set("Cookie", cookie);
      expect(removeRes.status).toBe(200);
      expect(removeRes.body.data.coursesMembers).toHaveLength(0);
    });

    it("blocks adding a chef to the courses team (exclusivity)", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "chefcourses@example.com",
        username: "chefcourses",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", cookie)
        .send({ userId: user.id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ROLE_EXCLUSIVITY");
    });

    it("auto-unassigns an already-assisting equipier when added to the courses team (point 3, Evolutions.md)", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user: chefUser } = await addTestParticipant(event.id, {
        email: "chef9@example.com",
        username: "chef9",
      });
      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: chefUser.id });

      const { user: assistantUser } = await addTestParticipant(event.id, {
        email: "assistant1@example.com",
        username: "assistant1",
      });
      const eventKitchen = await prisma.eventKitchen.findUniqueOrThrow({
        where: { eventId: event.id },
      });
      const meal = await prisma.meal.create({
        data: {
          eventKitchenId: eventKitchen.id,
          chefUserId: chefUser.id,
          name: "Pot au feu",
          service: "DINNER",
          startDateTime: new Date("2026-06-01T18:00:00Z"),
          endDateTime: new Date("2026-06-01T20:00:00Z"),
          maxAssistants: 5,
        },
      });
      await prisma.mealAssistant.create({
        data: { mealId: meal.id, eventKitchenId: eventKitchen.id, userId: assistantUser.id },
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", cookie)
        .send({ userId: assistantUser.id });

      expect(res.status).toBe(201);
      const coursesRow = await prisma.kitchenCoursesMember.findUnique({
        where: {
          eventKitchenId_userId: { eventKitchenId: eventKitchen.id, userId: assistantUser.id },
        },
      });
      expect(coursesRow).not.toBeNull();
      const assistantRow = await prisma.mealAssistant.findUnique({
        where: { mealId_userId: { mealId: meal.id, userId: assistantUser.id } },
      });
      expect(assistantRow).toBeNull();
    });

    it("rejects adding a non-participant to the courses team", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await createTestUserDirectly({
        email: "outsider2@example.com",
        username: "outsider2",
      });

      const res = await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", cookie)
        .send({ userId: user.id });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("NOT_EVENT_PARTICIPANT");
    });

    it("returns NOT_COURSES_MEMBER when removing someone not in the courses team", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user } = await addTestParticipant(event.id, {
        email: "notcourses@example.com",
        username: "notcourses",
      });

      const res = await request
        .delete(`/api/events/${event.id}/kitchen/courses/${user.id}`)
        .set("Cookie", cookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_COURSES_MEMBER");
    });
  });

  describe("Unassigned participants list", () => {
    it("lists participants who are neither chef, courses member, nor meal assistant", async () => {
      const { cookie } = await setupManager();
      const event = await createTestEvent(cookie);
      const { user: chefUser } = await addTestParticipant(event.id, {
        email: "chef10@example.com",
        username: "chef10",
      });
      const { user: coursesUser } = await addTestParticipant(event.id, {
        email: "courses2@example.com",
        username: "courses2",
      });
      const { user: unassignedUser } = await addTestParticipant(event.id, {
        email: "unassigned1@example.com",
        username: "unassigned1",
      });

      await request
        .post(`/api/events/${event.id}/kitchen/chefs`)
        .set("Cookie", cookie)
        .send({ userId: chefUser.id });
      await request
        .post(`/api/events/${event.id}/kitchen/courses`)
        .set("Cookie", cookie)
        .send({ userId: coursesUser.id });

      const res = await request.get(`/api/events/${event.id}/kitchen`).set("Cookie", cookie);

      const unassignedIds = res.body.data.unassigned.map((u: { id: string }) => u.id);
      expect(unassignedIds).toContain(unassignedUser.id);
      expect(unassignedIds).not.toContain(chefUser.id);
      expect(unassignedIds).not.toContain(coursesUser.id);
    });
  });
});
