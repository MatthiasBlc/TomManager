import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  createTestInvitation,
  createTestUserDirectly,
  loginTestUser,
} from "../setup/testHelpers";
import prisma from "../../util/db";

describe("Auth API", () => {
  describe("POST /api/auth/signup", () => {
    it("should create a user with valid invitation token", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);
      const invitation = await createTestInvitation(adminCookie, event.id, "newuser@example.com");

      const res = await request.post("/api/auth/signup").send({
        email: "newuser@example.com",
        username: "newuser",
        password: "Password123!",
        invitationToken: invitation.invitation.token,
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user.email).toBe("newuser@example.com");
      expect(res.body.user.username).toBe("newuser");
      expect(res.body.eventId).toBe(event.id);
    });

    it("should create event participation on signup", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);
      const invitation = await createTestInvitation(adminCookie, event.id, "newuser@example.com");

      const res = await request.post("/api/auth/signup").send({
        email: "newuser@example.com",
        username: "newuser",
        password: "Password123!",
        invitationToken: invitation.invitation.token,
      });

      const participation = await prisma.eventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: res.body.user.id } },
      });
      expect(participation).not.toBeNull();
    });

    it("should mark invitation as ACCEPTED after signup", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);
      const invitation = await createTestInvitation(adminCookie, event.id, "newuser@example.com");

      await request.post("/api/auth/signup").send({
        email: "newuser@example.com",
        username: "newuser",
        password: "Password123!",
        invitationToken: invitation.invitation.token,
      });

      const updated = await prisma.eventInvitation.findUnique({
        where: { token: invitation.invitation.token },
      });
      expect(updated!.status).toBe("ACCEPTED");
    });

    it("should reject signup without invitation token", async () => {
      const res = await request.post("/api/auth/signup").send({
        email: "newuser@example.com",
        username: "newuser",
        password: "Password123!",
      });

      expect(res.status).toBe(400);
    });

    it("should reject signup with invalid token", async () => {
      const res = await request.post("/api/auth/signup").send({
        email: "newuser@example.com",
        username: "newuser",
        password: "Password123!",
        invitationToken: "invalid-token",
      });

      expect(res.status).toBe(404);
    });

    it("should reject signup when email does not match invitation", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);
      const invitation = await createTestInvitation(adminCookie, event.id, "invited@example.com");

      const res = await request.post("/api/auth/signup").send({
        email: "different@example.com",
        username: "newuser",
        password: "Password123!",
        invitationToken: invitation.invitation.token,
      });

      expect(res.status).toBe(403);
    });

    it("should reject duplicate email", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      // Create first user directly
      await createTestUserDirectly({ email: "taken@example.com", username: "taken" });

      const invitation = await createTestInvitation(adminCookie, event.id, "taken@example.com");

      const res = await request.post("/api/auth/signup").send({
        email: "taken@example.com",
        username: "newuser",
        password: "Password123!",
        invitationToken: invitation.invitation.token,
      });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with email", async () => {
      await createTestUserDirectly({ email: "user@example.com", username: "testuser" });

      const res = await request.post("/api/auth/login").send({
        identifier: "user@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("user@example.com");
    });

    it("should login with username", async () => {
      await createTestUserDirectly({ email: "user@example.com", username: "testuser" });

      const res = await request.post("/api/auth/login").send({
        identifier: "testuser",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe("testuser");
    });

    it("should reject invalid credentials", async () => {
      await createTestUserDirectly({ email: "user@example.com", username: "testuser" });

      const res = await request.post("/api/auth/login").send({
        identifier: "user@example.com",
        password: "wrong",
      });

      expect(res.status).toBe(401);
    });

    it("should login with invitation token and create participation", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      // Create a regular user directly
      const { user } = await createTestUserDirectly({
        email: "regular@example.com",
        username: "regular",
      });

      const invitation = await createTestInvitation(adminCookie, event.id, "regular@example.com");

      const res = await request.post("/api/auth/login").send({
        identifier: "regular@example.com",
        password: "Password123!",
        invitationToken: invitation.invitation.token,
      });

      expect(res.status).toBe(200);
      expect(res.body.eventId).toBe(event.id);

      const participation = await prisma.eventParticipation.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
      });
      expect(participation).not.toBeNull();
    });

    it("should login with token even if already participant (idempotent)", async () => {
      const { cookie: adminCookie } = await setupAdmin();
      const event = await createTestEvent(adminCookie);

      const { user } = await createTestUserDirectly({
        email: "regular@example.com",
        username: "regular",
      });

      // Add participation manually first
      await prisma.eventParticipation.create({
        data: { eventId: event.id, userId: user.id },
      });

      const invitation = await createTestInvitation(adminCookie, event.id, "regular@example.com");

      const res = await request.post("/api/auth/login").send({
        identifier: "regular@example.com",
        password: "Password123!",
        invitationToken: invitation.invitation.token,
      });

      expect(res.status).toBe(200);
      expect(res.body.eventId).toBe(event.id);
    });

    it("should login normally without token", async () => {
      await createTestUserDirectly({ email: "user@example.com", username: "testuser" });

      const res = await request.post("/api/auth/login").send({
        identifier: "user@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.eventId).toBeUndefined();
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request.get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("should return current user when authenticated", async () => {
      await createTestUserDirectly({ email: "user@example.com", username: "testuser" });
      const { cookie } = await loginTestUser("user@example.com");

      const res = await request.get("/api/auth/me").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("user@example.com");
    });
  });

  describe("Error format consistency", () => {
    it("should return { error: { message } } on invalid credentials", async () => {
      const res = await request.post("/api/auth/login").send({
        identifier: "nonexistent@example.com",
        password: "wrong",
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty("message");
      expect(typeof res.body.error.message).toBe("string");
    });

    it("should return { error: { message } } on signup without token", async () => {
      const res = await request.post("/api/auth/signup").send({
        email: "test@example.com",
        username: "testuser",
        password: "Password123!",
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toHaveProperty("message");
    });
  });
});
