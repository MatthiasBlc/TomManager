import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  createTestInvitation,
} from "../setup/testHelpers";
import prisma from "../../util/db";

// Helper: setup admin + event + participant user with cookie
async function setupEventWithParticipant() {
  const admin = await setupAdmin();
  const event = await createTestEvent(admin.cookie);

  const invitation = await createTestInvitation(
    admin.cookie,
    event.id,
    "player@example.com"
  );
  await request.post("/api/auth/signup").send({
    email: "player@example.com",
    username: "player1",
    password: "Password123!",
    invitationToken: invitation.invitation.token,
  });
  const loginRes = await request.post("/api/auth/login").send({
    identifier: "player@example.com",
    password: "Password123!",
  });
  const playerCookie = loginRes.headers["set-cookie"];
  const playerId = loginRes.body.user.id;

  return { admin, event, playerCookie, playerId };
}

async function createBoardGame(name = "Catan") {
  return prisma.boardGame.create({ data: { name } });
}

describe("EventBoardGame API", () => {
  describe("POST /api/events/:eventId/boardgames", () => {
    it("should add a board game to the event", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      const res = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      expect(res.status).toBe(201);
      expect(res.body.data.boardGame.name).toBe("Catan");
      expect(res.body.data.broughtBy.username).toBe("player1");
    });

    it("should reject duplicate (same user, same game, same event)", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      const res = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      expect(res.status).toBe(409);
    });

    it("should allow different users to bring the same game", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      const res1 = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      const res2 = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", admin.cookie)
        .send({ boardGameId: bg.id });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
    });

    it("should reject non-participant", async () => {
      const { event } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      // Create a user who is NOT a participant
      const { user: outsider } = await (await import("../setup/testHelpers")).createTestUserDirectly({
        email: "outsider@example.com",
        username: "outsider",
      });
      const loginRes = await request.post("/api/auth/login").send({
        identifier: "outsider@example.com",
        password: "Password123!",
      });
      const outsiderCookie = loginRes.headers["set-cookie"];

      const res = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", outsiderCookie)
        .send({ boardGameId: bg.id });

      expect(res.status).toBe(403);
    });

    it("should reject non-existent board game", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: "00000000-0000-0000-0000-000000000000" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/events/:eventId/boardgames", () => {
    it("should list board games for the event", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();
      const bg1 = await createBoardGame("Catan");
      const bg2 = await createBoardGame("Pandemic");

      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg1.id });
      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg2.id });

      const res = await request
        .get(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].boardGame).toBeDefined();
      expect(res.body.data[0].broughtBy).toBeDefined();
    });
  });

  describe("DELETE /api/events/:eventId/boardgames/:id", () => {
    it("should allow owner to remove their board game", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      const addRes = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      const res = await request
        .delete(`/api/events/${event.id}/boardgames/${addRes.body.data.id}`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(204);
    });

    it("should allow admin to remove any board game", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      const addRes = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      const res = await request
        .delete(`/api/events/${event.id}/boardgames/${addRes.body.data.id}`)
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(204);
    });

    it("should reject non-owner non-admin", async () => {
      const { admin, event } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      // Admin adds a board game
      const addRes = await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", admin.cookie)
        .send({ boardGameId: bg.id });

      // Create another participant
      const inv = await createTestInvitation(admin.cookie, event.id, "other@example.com");
      await request.post("/api/auth/signup").send({
        email: "other@example.com",
        username: "otherplayer",
        password: "Password123!",
        invitationToken: inv.invitation.token,
      });
      const otherLogin = await request.post("/api/auth/login").send({
        identifier: "other@example.com",
        password: "Password123!",
      });
      const otherCookie = otherLogin.headers["set-cookie"];

      const res = await request
        .delete(`/api/events/${event.id}/boardgames/${addRes.body.data.id}`)
        .set("Cookie", otherCookie);

      expect(res.status).toBe(403);
    });
  });

  describe("Cascade: participant removal includes board games", () => {
    it("should delete EventBoardGame when participant is removed", async () => {
      const { admin, playerCookie, event, playerId } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      // Player adds a board game
      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      // Verify it exists
      const before = await prisma.eventBoardGame.findMany({
        where: { eventId: event.id, broughtByUserId: playerId },
      });
      expect(before).toHaveLength(1);

      // Remove participant
      await request
        .delete(`/api/events/${event.id}/participants/${playerId}`)
        .set("Cookie", admin.cookie);

      // Verify EventBoardGame is gone
      const after = await prisma.eventBoardGame.findMany({
        where: { eventId: event.id, broughtByUserId: playerId },
      });
      expect(after).toHaveLength(0);
    });

    it("should delete EventBoardGame when participant leaves", async () => {
      const { playerCookie, event, playerId } = await setupEventWithParticipant();
      const bg = await createBoardGame();

      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      // Player leaves event
      await request
        .delete(`/api/events/${event.id}/participants/me`)
        .set("Cookie", playerCookie);

      const after = await prisma.eventBoardGame.findMany({
        where: { eventId: event.id, broughtByUserId: playerId },
      });
      expect(after).toHaveLength(0);
    });
  });
});
