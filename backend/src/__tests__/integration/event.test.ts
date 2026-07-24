import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  createTestUserDirectly,
  loginTestUser,
  enableEventManager,
} from "../setup/testHelpers";
import prisma from "../../util/db";

describe("Event API", () => {
  describe("POST /api/events", () => {
    it("should create an event as admin", async () => {
      const { cookie } = await setupAdmin();

      const res = await request.post("/api/events").set("Cookie", cookie).send({
        name: "Test Event",
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-01T18:00:00Z",
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("Test Event");
    });

    it("should auto-add creator as participant", async () => {
      const { cookie, user } = await setupAdmin();

      const res = await request.post("/api/events").set("Cookie", cookie).send({
        name: "Test Event",
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-01T18:00:00Z",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.participations).toHaveLength(1);
      expect(res.body.data.participations[0].userId).toBe(user.id);
    });

    it("should reject non-admin user", async () => {
      await createTestUserDirectly();
      const { cookie } = await loginTestUser();

      const res = await request.post("/api/events").set("Cookie", cookie).send({
        name: "Test Event",
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-01T18:00:00Z",
      });

      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request.post("/api/events").send({
        name: "Test Event",
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-01T18:00:00Z",
      });

      expect(res.status).toBe(401);
    });

    it("should reject empty name", async () => {
      const { cookie } = await setupAdmin();

      const res = await request.post("/api/events").set("Cookie", cookie).send({
        name: "",
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-01T18:00:00Z",
      });

      expect(res.status).toBe(400);
    });

    it("should reject name over 100 characters", async () => {
      const { cookie } = await setupAdmin();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "a".repeat(101),
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      expect(res.status).toBe(400);
    });

    it("should reject endDateTime before startDateTime", async () => {
      const { cookie } = await setupAdmin();

      const res = await request.post("/api/events").set("Cookie", cookie).send({
        name: "Test Event",
        startDateTime: "2026-06-01T18:00:00Z",
        endDateTime: "2026-06-01T10:00:00Z",
      });

      expect(res.status).toBe(400);
    });

    it("should reject invalid dates", async () => {
      const { cookie } = await setupAdmin();

      const res = await request.post("/api/events").set("Cookie", cookie).send({
        name: "Test Event",
        startDateTime: "not-a-date",
        endDateTime: "2026-06-01T18:00:00Z",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/events", () => {
    it("should list events where user is participant", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      await createTestEvent(adminCookie);
      await createTestEvent(adminCookie, { name: "Event 2" });

      // Regular user with no participations
      await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      const { cookie: userCookie } = await loginTestUser("user@example.com");

      const res = await request.get("/api/events").set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should list all events for ADMIN", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      await createTestEvent(adminCookie);
      await createTestEvent(adminCookie, { name: "Event 2" });

      const res = await request.get("/api/events").set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty("participantCount");
    });

    it("should restrict ADMIN to their own events when mine=true", async () => {
      const { cookie: admin1Cookie } = await setupAdmin();
      const { cookie: admin2Cookie } = await setupAdmin({
        email: "admin2@example.com",
        username: "adminuser2",
      });
      await createTestEvent(admin1Cookie);

      const resAdmin1 = await request.get("/api/events?mine=true").set("Cookie", admin1Cookie);
      const resAdmin2 = await request.get("/api/events?mine=true").set("Cookie", admin2Cookie);

      expect(resAdmin1.body.data).toHaveLength(1);
      expect(resAdmin2.body.data).toHaveLength(0);
    });

    it("should filter upcoming events", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      // Future event
      await createTestEvent(adminCookie, {
        name: "Future Event",
        startDateTime: "2027-01-01T10:00:00Z",
        endDateTime: "2027-01-01T18:00:00Z",
      });
      // Past event
      await createTestEvent(adminCookie, {
        name: "Past Event",
        startDateTime: "2020-01-01T10:00:00Z",
        endDateTime: "2020-01-01T18:00:00Z",
      });

      const res = await request.get("/api/events?upcoming=true").set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Future Event");
    });

    it("should reject unauthenticated request", async () => {
      const res = await request.get("/api/events");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/events/:eventId", () => {
    it("should return event detail for participant", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request.get(`/api/events/${event.id}`).set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Test Event");
      expect(res.body.data.participants).toHaveLength(1);
      expect(res.body.data.participants[0]).toHaveProperty("username");
      expect(res.body.data.participants[0]).toHaveProperty("joinedAt");
    });

    it("should reject non-participant non-admin", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      const { cookie: userCookie } = await loginTestUser("user@example.com");

      const res = await request.get(`/api/events/${event.id}`).set("Cookie", userCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent event", async () => {
      const { cookie: adminCookie } = await setupAdmin();

      const res = await request
        .get("/api/events/00000000-0000-0000-0000-000000000000")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/events/:eventId", () => {
    it("rejects the creator alone, without admin.events", async () => {
      // Etre le createur ne donne plus de droit particulier : il faut admin.events.
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request
        .patch(`/api/events/${event.id}`)
        .set("Cookie", adminCookie)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(403);
    });

    it("allows update by the creator once admin.events is enabled", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const event = await createTestEvent(adminCookie);

      const res = await request
        .patch(`/api/events/${event.id}`)
        .set("Cookie", adminCookie)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Name");
    });

    it("allows update by any admin.events-enabled admin, even if not the creator", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { cookie: otherCookie, user: other } = await setupAdmin({
        email: "other@admin.com",
        username: "otheradmin",
      });
      await enableEventManager(other.id);

      const res = await request
        .patch(`/api/events/${event.id}`)
        .set("Cookie", otherCookie)
        .send({ name: "Updated by other admin" });

      expect(res.status).toBe(200);
    });

    it("rejects an admin.events-enabled admin update that fails validation", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const event = await createTestEvent(adminCookie);

      const res = await request.patch(`/api/events/${event.id}`).set("Cookie", adminCookie).send({
        startDateTime: "2026-06-01T20:00:00Z",
        endDateTime: "2026-06-01T10:00:00Z",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/events/:eventId", () => {
    it("rejects the creator alone, without admin.events", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request.delete(`/api/events/${event.id}`).set("Cookie", adminCookie);

      expect(res.status).toBe(403);
    });

    it("allows delete by the creator once admin.events is enabled", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const event = await createTestEvent(adminCookie);

      const res = await request.delete(`/api/events/${event.id}`).set("Cookie", adminCookie);

      expect(res.status).toBe(204);

      const found = await prisma.event.findUnique({ where: { id: event.id } });
      expect(found).toBeNull();
    });

    it("allows delete by any admin.events-enabled admin, even if not the creator", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { cookie: otherCookie, user: other } = await setupAdmin({
        email: "other@admin.com",
        username: "otheradmin",
      });
      await enableEventManager(other.id);

      const res = await request.delete(`/api/events/${event.id}`).set("Cookie", otherCookie);

      expect(res.status).toBe(204);
    });
  });

  describe("discordRoleId persistence", () => {
    it("GET detail returns discordRoleId and PATCH without the field keeps it", async () => {
      const { cookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const createRes = await request.post("/api/events").set("Cookie", cookie).send({
        name: "Event avec role",
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-01T18:00:00Z",
        discordRoleId: "123456789012345678",
      });
      const eventId = createRes.body.data.id;

      const detail = await request.get(`/api/events/${eventId}`).set("Cookie", cookie);
      expect(detail.body.data.discordRoleId).toBe("123456789012345678");

      // Un PATCH sans le champ ne doit pas l'effacer
      const patchRes = await request.patch(`/api/events/${eventId}`).set("Cookie", cookie).send({
        name: "Event renomme",
      });
      expect(patchRes.status).toBe(200);
      const after = await prisma.event.findUnique({ where: { id: eventId } });
      expect(after?.discordRoleId).toBe("123456789012345678");
    });
  });

  describe("POST /api/events/:eventId/purge", () => {
    it("should wipe tables and participations but keep the event", async () => {
      const { cookie } = await setupAdmin();
      const event = await createTestEvent(cookie);

      await request.post(`/api/events/${event.id}/tables`).set("Cookie", cookie).send({
        title: "Table a purger",
        type: "JDR",
        maxPlayers: 4,
        startDateTime: "2026-06-01T11:00:00Z",
        endDateTime: "2026-06-01T13:00:00Z",
      });

      const res = await request.post(`/api/events/${event.id}/purge`).set("Cookie", cookie);

      expect(res.status).toBe(200);
      // Pas de role Discord lie : aucun re-import de participants
      expect(res.body.data.resyncedParticipants).toBeNull();

      const found = await prisma.event.findUnique({ where: { id: event.id } });
      expect(found).not.toBeNull();
      expect(await prisma.gameTable.count({ where: { eventId: event.id } })).toBe(0);
      expect(await prisma.eventParticipation.count({ where: { eventId: event.id } })).toBe(0);
    });
  });
});
