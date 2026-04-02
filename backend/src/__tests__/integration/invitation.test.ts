import { describe, it, expect } from "vitest";
import {
  request,
  createTestUser,
  loginTestUser,
  createAdminUser,
  loginAdminUser,
} from "../setup/testHelpers";
import prisma from "../../util/db";

async function createEventAsAdmin(cookie: string[]) {
  const res = await request
    .post("/api/events")
    .set("Cookie", cookie)
    .send({
      name: "Test Event",
      startDateTime: "2026-06-01T10:00:00Z",
      endDateTime: "2026-06-01T18:00:00Z",
    });
  return res.body.data;
}

describe("Invitation API", () => {
  describe("POST /api/events/:eventId/invitations", () => {
    it("should create an invitation by email", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      const res = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      expect(res.status).toBe(201);
      expect(res.body.data.invitation).toHaveProperty("token");
      expect(res.body.data.invitation.email).toBe("invited@example.com");
      expect(res.body.data.invitation.status).toBe("PENDING");
      expect(res.body.data.inviteLink).toContain("/invite/");
    });

    it("should create an invitation by username and resolve to email", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      await createTestUser({ email: "michel@test.fr", username: "michel" });

      const res = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "michel" });

      expect(res.status).toBe(201);
      expect(res.body.data.invitation.email).toBe("michel@test.fr");
      expect(res.body.data.invitation.status).toBe("PENDING");
    });

    it("should return 404 for unknown username", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      const res = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "unknown-user" });

      expect(res.status).toBe(404);
    });

    it("should reject non-admin user", async () => {
      await createAdminUser();
      const { cookie: adminCookie } = await loginAdminUser();
      const event = await createEventAsAdmin(adminCookie);

      await createTestUser();
      const { cookie: userCookie } = await loginTestUser();

      const res = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", userCookie)
        .send({ identifier: "invited@example.com" });

      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request
        .post("/api/events/some-id/invitations")
        .send({ identifier: "invited@example.com" });

      expect(res.status).toBe(401);
    });

    it("should reject missing identifier", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      const res = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it("should return 409 for PENDING invitation to same email+event", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      const res = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      expect(res.status).toBe(409);
    });

    it("should resend invitation if previous was EXPIRED", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      const firstRes = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      await prisma.eventInvitation.update({
        where: { id: firstRes.body.data.invitation.id },
        data: { status: "EXPIRED" },
      });

      const res = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      expect(res.status).toBe(201);
      expect(res.body.data.invitation.token).not.toBe(
        firstRes.body.data.invitation.token
      );
    });

    it("should return 404 for non-existent event", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();

      const res = await request
        .post("/api/events/00000000-0000-0000-0000-000000000000/invitations")
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/invitations/:token", () => {
    it("should validate a valid token", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      const invRes = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      const token = invRes.body.data.invitation.token;

      const res = await request.get(`/api/invitations/${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe("invited@example.com");
      expect(res.body.data.eventName).toBe("Test Event");
      expect(res.body.data.eventId).toBe(event.id);
      expect(res.body.data.hasAccount).toBe(false);
    });

    it("should return hasAccount=true when user exists", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      await createTestUser({ email: "existing@example.com", username: "existinguser" });

      const invRes = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "existing@example.com" });

      const token = invRes.body.data.invitation.token;

      const res = await request.get(`/api/invitations/${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasAccount).toBe(true);
    });

    it("should return 404 for non-existent token", async () => {
      const res = await request.get("/api/invitations/non-existent-token");

      expect(res.status).toBe(404);
    });

    it("should return 410 for expired invitation", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      const invRes = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      await prisma.eventInvitation.update({
        where: { id: invRes.body.data.invitation.id },
        data: { expiresAt: new Date("2020-01-01") },
      });

      const token = invRes.body.data.invitation.token;
      const res = await request.get(`/api/invitations/${token}`);

      expect(res.status).toBe(410);
    });

    it("should return 409 for already used invitation", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();
      const event = await createEventAsAdmin(cookie);

      const invRes = await request
        .post(`/api/events/${event.id}/invitations`)
        .set("Cookie", cookie)
        .send({ identifier: "invited@example.com" });

      await prisma.eventInvitation.update({
        where: { id: invRes.body.data.invitation.id },
        data: { status: "ACCEPTED" },
      });

      const token = invRes.body.data.invitation.token;
      const res = await request.get(`/api/invitations/${token}`);

      expect(res.status).toBe(409);
    });
  });
});
