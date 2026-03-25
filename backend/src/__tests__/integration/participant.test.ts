import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  createTestUserDirectly,
  createTestInvitation,
  loginTestUser,
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
      const { cookie: adminCookie, user: admin } = await setupAdmin();
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

      await createTestUserDirectly({ email: "outsider@example.com", username: "outsider" });
      const { cookie: outsiderCookie } = await loginTestUser("outsider@example.com");

      const res = await request
        .get(`/api/events/${event.id}/participants`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/events/:eventId/participants/:userId", () => {
    it("should remove participant as creator", async () => {
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

      expect(res.status).toBe(204);

      const participation = await prisma.eventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: regularUser.id } },
      });
      expect(participation).toBeNull();
    });

    it("should not allow removing the event creator", async () => {
      const { cookie: adminCookie, user: admin } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const res = await request
        .delete(`/api/events/${event.id}/participants/${admin.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });

    it("should reject non-creator", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { user: regularUser } = await createTestUserDirectly({
        email: "user@example.com",
        username: "user",
      });
      await addParticipant(event.id, regularUser.id);

      // Another admin who is not the creator
      const { cookie: otherCookie } = await setupAdmin({
        email: "other@admin.com",
        username: "otheradmin",
      });

      const res = await request
        .delete(`/api/events/${event.id}/participants/${regularUser.id}`)
        .set("Cookie", otherCookie);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-participant", async () => {
      const { cookie: adminCookie } = await setupAdmin();
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
        where: { eventId_userId: { eventId: event.id, userId: regularUser.id } },
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

      await createTestUserDirectly({ email: "outsider@example.com", username: "outsider" });
      const { cookie: outsiderCookie } = await loginTestUser("outsider@example.com");

      const res = await request
        .delete(`/api/events/${event.id}/participants/me`)
        .set("Cookie", outsiderCookie);

      expect(res.status).toBe(403);
    });
  });
});

describe("Invitation Listing API", () => {
  describe("GET /api/events/:eventId/invitations", () => {
    it("should list invitations for event creator", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);
      await createTestInvitation(adminCookie, event.id, "a@example.com");
      await createTestInvitation(adminCookie, event.id, "b@example.com");

      const res = await request
        .get(`/api/events/${event.id}/invitations`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty("email");
      expect(res.body.data[0]).toHaveProperty("status");
      expect(res.body.data[0]).toHaveProperty("createdAt");
    });

    it("should reject non-creator", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { cookie: otherCookie } = await setupAdmin({
        email: "other@admin.com",
        username: "otheradmin",
      });

      const res = await request
        .get(`/api/events/${event.id}/invitations`)
        .set("Cookie", otherCookie);

      expect(res.status).toBe(403);
    });
  });
});
