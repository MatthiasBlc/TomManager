import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  createTestUserDirectly,
  loginTestUser,
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
    it("should update event as creator", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request
        .patch(`/api/events/${event.id}`)
        .set("Cookie", adminCookie)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Name");
    });

    it("should allow update by any admin", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      // Any admin can update any event
      const { cookie: otherCookie } = await setupAdmin({
        email: "other@admin.com",
        username: "otheradmin",
      });

      const res = await request
        .patch(`/api/events/${event.id}`)
        .set("Cookie", otherCookie)
        .send({ name: "Updated by other admin" });

      expect(res.status).toBe(200);
    });

    it("should reject invalid date update", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request.patch(`/api/events/${event.id}`).set("Cookie", adminCookie).send({
        startDateTime: "2026-06-01T20:00:00Z",
        endDateTime: "2026-06-01T10:00:00Z",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/events/:eventId", () => {
    it("should delete event as creator", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request.delete(`/api/events/${event.id}`).set("Cookie", adminCookie);

      expect(res.status).toBe(204);

      // Verify event is gone
      const found = await prisma.event.findUnique({ where: { id: event.id } });
      expect(found).toBeNull();
    });

    it("should allow delete by any admin", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      // Any admin can delete any event
      const { cookie: otherCookie } = await setupAdmin({
        email: "other@admin.com",
        username: "otheradmin",
      });

      const res = await request.delete(`/api/events/${event.id}`).set("Cookie", otherCookie);

      expect(res.status).toBe(204);
    });
  });
});
