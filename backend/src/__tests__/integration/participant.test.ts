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

async function addParticipant(eventId: string, userId: string) {
  await prisma.eventParticipation.create({
    data: { eventId, userId },
  });
}

describe("Participant API", () => {
  describe("GET /api/events/:eventId/participants", () => {
    it("should list participants for event participant", async () => {
      const { cookie: adminCookie, user: _admin } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { user: regularUser } = await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      await addParticipant(event.id, regularUser.id);

      const { cookie: userCookie } = await loginTestUser("user@example.com");

      const res = await request
        .get(`/api/events/${event.id}/participants`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty("userId");
      expect(res.body.data[0]).toHaveProperty("username");
      expect(res.body.data[0]).toHaveProperty("role");
      expect(res.body.data[0]).toHaveProperty("joinedAt");
    });

    it("should reject non-participant", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      await createTestUserDirectly({
        email: "outsider@example.com",
        username: "outsider",
      });
      const { cookie: outsiderCookie } = await loginTestUser("outsider@example.com");

      const res = await request
        .get(`/api/events/${event.id}/participants`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/events/:eventId/participants/:userId", () => {
    it("rejects the creator alone, without admin.events", async () => {
      // Etre le createur ne donne plus de droit particulier : il faut admin.events.
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { user: regularUser } = await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      await addParticipant(event.id, regularUser.id);

      const res = await request
        .delete(`/api/events/${event.id}/participants/${regularUser.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(403);
    });

    it("removes a participant once admin.events is enabled", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const event = await createTestEvent(adminCookie);

      const { user: regularUser } = await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      await addParticipant(event.id, regularUser.id);

      const res = await request
        .delete(`/api/events/${event.id}/participants/${regularUser.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(204);

      const participation = await prisma.eventParticipation.findUnique({
        where: {
          eventId_userId: { eventId: event.id, userId: regularUser.id },
        },
      });
      expect(participation).toBeNull();
    });

    it("should not allow removing the event creator", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const event = await createTestEvent(adminCookie);

      const res = await request
        .delete(`/api/events/${event.id}/participants/${admin.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });

    it("should reject non-admin non-creator", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const event = await createTestEvent(adminCookie);

      const { user: regularUser } = await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      await addParticipant(event.id, regularUser.id);

      // A participant (non-admin) trying to remove another participant
      const { user: otherUser } = await createTestUserDirectly({
        email: "other@example.com",
        username: "otheruser",
      });
      await addParticipant(event.id, otherUser.id);
      const { cookie: otherCookie } = await loginTestUser("other@example.com");

      const res = await request
        .delete(`/api/events/${event.id}/participants/${regularUser.id}`)
        .set("Cookie", otherCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-participant", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      await enableEventManager(admin.id);
      const event = await createTestEvent(adminCookie);

      const res = await request
        .delete(`/api/events/${event.id}/participants/00000000-0000-0000-0000-000000000000`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/events/:eventId/participants/me", () => {
    it("should allow participant to leave event", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { user: regularUser } = await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      await addParticipant(event.id, regularUser.id);

      const { cookie: userCookie } = await loginTestUser("user@example.com");

      const res = await request
        .delete(`/api/events/${event.id}/participants/me`)
        .set("Cookie", userCookie);

      expect(res.status).toBe(204);

      const participation = await prisma.eventParticipation.findUnique({
        where: {
          eventId_userId: { eventId: event.id, userId: regularUser.id },
        },
      });
      expect(participation).toBeNull();
    });

    it("should not allow creator to leave", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request
        .delete(`/api/events/${event.id}/participants/me`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });

    it("should reject non-participant", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      await createTestUserDirectly({
        email: "outsider@example.com",
        username: "outsider",
      });
      const { cookie: outsiderCookie } = await loginTestUser("outsider@example.com");

      const res = await request
        .delete(`/api/events/${event.id}/participants/me`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
    });
  });
});
