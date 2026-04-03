import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  createTestInvitation,
  createTestUserDirectly,
} from "../setup/testHelpers";

// Helper: setup admin + event + participant user with cookie
async function setupEventWithParticipant() {
  const admin = await setupAdmin();
  const event = await createTestEvent(admin.cookie);

  // Create invitation + signup a regular user
  const invitation = await createTestInvitation(admin.cookie, event.id, "player@example.com");
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

const validTableData = {
  title: "Curse of Strahd",
  pitch: "A gothic horror adventure",
  maxPlayers: 5,
  startDateTime: "2026-06-01T10:00:00Z",
  endDateTime: "2026-06-01T14:00:00Z",
  tags: ["dnd", "horror"],
};

describe("GameTable API", () => {
  describe("POST /api/events/:eventId/tables", () => {
    it("should create a table as event participant", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send(validTableData);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe("Curse of Strahd");
      expect(res.body.data.maxPlayers).toBe(5);
      expect(res.body.data.tags).toHaveLength(2);
      expect(res.body.data.tags.map((t: { name: string }) => t.name).sort()).toEqual([
        "dnd",
        "horror",
      ]);
    });

    it("should create a table as admin", async () => {
      const { admin, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);

      expect(res.status).toBe(201);
    });

    it("should reject empty title", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, title: "" });

      expect(res.status).toBe(400);
    });

    it("should reject title over 150 characters", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, title: "a".repeat(151) });

      expect(res.status).toBe(400);
    });

    it("should reject maxPlayers out of range", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res1 = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, maxPlayers: 0 });

      const res2 = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, maxPlayers: 21 });

      expect(res1.status).toBe(400);
      expect(res2.status).toBe(400);
    });

    it("should reject table dates outside event bounds", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      // Start before event
      const res1 = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, startDateTime: "2026-05-31T09:00:00Z" });

      // End after event
      const res2 = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, endDateTime: "2026-06-01T19:00:00Z" });

      expect(res1.status).toBe(400);
      expect(res2.status).toBe(400);
    });

    it("should reject endDateTime before startDateTime", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({
          ...validTableData,
          startDateTime: "2026-06-01T14:00:00Z",
          endDateTime: "2026-06-01T10:00:00Z",
        });

      expect(res.status).toBe(400);
    });

    it("should reject non-participant", async () => {
      const { event } = await setupEventWithParticipant();

      // Create a user not part of the event
      await createTestUserDirectly({
        email: "outsider@example.com",
        username: "outsider",
      });
      const loginRes = await request.post("/api/auth/login").send({
        identifier: "outsider@example.com",
        password: "Password123!",
      });

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", loginRes.headers["set-cookie"])
        .send(validTableData);

      expect(res.status).toBe(403);
    });

    it("should normalize tag names to lowercase", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, tags: ["DnD", "HORROR"] });

      expect(res.status).toBe(201);
      expect(res.body.data.tags.map((t: { name: string }) => t.name).sort()).toEqual([
        "dnd",
        "horror",
      ]);
    });
  });

  describe("GET /api/events/:eventId/tables", () => {
    it("should list tables with counts", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      // Admin creates a table
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);

      const res = await request.get(`/api/events/${event.id}/tables`).set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Curse of Strahd");
      expect(res.body.data[0].confirmedCount).toBe(0);
      expect(res.body.data[0].waitlistCount).toBe(0);
      expect(res.body.data[0].currentUserStatus).toBeNull();
      expect(res.body.data[0].creator).toBeDefined();
      expect(res.body.data[0].tags).toHaveLength(2);
    });

    it("should return empty array when no tables", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request.get(`/api/events/${event.id}/tables`).set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("PATCH /api/events/:eventId/tables/:tableId", () => {
    it("should update table as GM", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", playerCookie)
        .send({ title: "Updated Title", maxPlayers: 8 });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Updated Title");
      expect(res.body.data.maxPlayers).toBe(8);
    });

    it("should reject update by non-GM non-admin", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Admin creates a table
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      // Create another participant
      const inv = await createTestInvitation(admin.cookie, event.id, "other@example.com");
      await request.post("/api/auth/signup").send({
        email: "other@example.com",
        username: "otherplayer",
        password: "Password123!",
        invitationToken: inv.invitation.token,
      });
      const loginRes = await request.post("/api/auth/login").send({
        identifier: "other@example.com",
        password: "Password123!",
      });

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", loginRes.headers["set-cookie"])
        .send({ title: "Hacked" });

      expect(res.status).toBe(403);
    });

    it("should demote last confirmed players when reducing maxPlayers", async () => {
      const { admin, playerCookie, playerId: _playerId, event } = await setupEventWithParticipant();

      // Admin creates table with maxPlayers=2
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 2 });
      const tableId = createRes.body.data.id;

      // Player joins (confirmed)
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      // Add a second participant
      const inv = await createTestInvitation(admin.cookie, event.id, "p2@example.com");
      await request.post("/api/auth/signup").send({
        email: "p2@example.com",
        username: "player2",
        password: "Password123!",
        invitationToken: inv.invitation.token,
      });
      const p2Login = await request.post("/api/auth/login").send({
        identifier: "p2@example.com",
        password: "Password123!",
      });
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", p2Login.headers["set-cookie"]);

      // Reduce maxPlayers to 1 — last joined should be demoted
      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ maxPlayers: 1 });

      expect(res.status).toBe(200);

      // Check detail
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      const confirmed = detail.body.data.participants.filter(
        (p: { status: string }) => p.status === "CONFIRMED"
      );
      const waitlisted = detail.body.data.participants.filter(
        (p: { status: string }) => p.status === "WAITLIST"
      );
      expect(confirmed).toHaveLength(1);
      expect(waitlisted).toHaveLength(1);
    });

    it("should promote waitlisted players when increasing maxPlayers", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      // Admin creates table with maxPlayers=1
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 1 });
      const tableId = createRes.body.data.id;

      // Player joins (confirmed, slot 1)
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      // Second player joins (waitlisted)
      const inv = await createTestInvitation(admin.cookie, event.id, "p2@example.com");
      await request.post("/api/auth/signup").send({
        email: "p2@example.com",
        username: "player2",
        password: "Password123!",
        invitationToken: inv.invitation.token,
      });
      const p2Login = await request.post("/api/auth/login").send({
        identifier: "p2@example.com",
        password: "Password123!",
      });
      const joinRes = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", p2Login.headers["set-cookie"]);
      expect(joinRes.body.data.status).toBe("WAITLIST");

      // Increase maxPlayers to 3
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ maxPlayers: 3 });

      // Check detail — both should be confirmed
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      const confirmed = detail.body.data.participants.filter(
        (p: { status: string }) => p.status === "CONFIRMED"
      );
      expect(confirmed).toHaveLength(2);
    });
  });

  describe("DELETE /api/events/:eventId/tables/:tableId", () => {
    it("should delete table as GM", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      const res = await request
        .delete(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(204);

      // Verify deleted
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", playerCookie);
      expect(detail.status).toBe(404);
    });

    it("should reject delete by non-GM non-admin", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      const res = await request
        .delete(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/events/:eventId/tables/:tableId/join", () => {
    it("should join table as confirmed when slots available", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      const res = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("CONFIRMED");
    });

    it("should join as waitlist when table is full", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Create table with maxPlayers=1
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 1 });
      const tableId = createRes.body.data.id;

      // First player joins (fills the slot)
      const inv1 = await createTestInvitation(admin.cookie, event.id, "fill@example.com");
      await request.post("/api/auth/signup").send({
        email: "fill@example.com",
        username: "filler",
        password: "Password123!",
        invitationToken: inv1.invitation.token,
      });
      const fillLogin = await request.post("/api/auth/login").send({
        identifier: "fill@example.com",
        password: "Password123!",
      });
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", fillLogin.headers["set-cookie"]);

      // Second player joins (should be waitlisted)
      const inv2 = await createTestInvitation(admin.cookie, event.id, "wait@example.com");
      await request.post("/api/auth/signup").send({
        email: "wait@example.com",
        username: "waiter",
        password: "Password123!",
        invitationToken: inv2.invitation.token,
      });
      const waitLogin = await request.post("/api/auth/login").send({
        identifier: "wait@example.com",
        password: "Password123!",
      });
      const res = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", waitLogin.headers["set-cookie"]);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("WAITLIST");
    });

    it("should reject 409 if already participant", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      const res = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(409);
    });

    it("should reject 400 if GM tries to join own table", async () => {
      const { admin, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      const res = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/events/:eventId/tables/:tableId/leave", () => {
    it("should leave table", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      const res = await request
        .delete(`/api/events/${event.id}/tables/${tableId}/leave`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(204);
    });

    it("should promote waitlisted player when confirmed leaves", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      // Create table with maxPlayers=1
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 1 });
      const tableId = createRes.body.data.id;

      // Player1 joins (confirmed)
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      // Player2 joins (waitlisted)
      const inv = await createTestInvitation(admin.cookie, event.id, "wait@example.com");
      await request.post("/api/auth/signup").send({
        email: "wait@example.com",
        username: "waiter",
        password: "Password123!",
        invitationToken: inv.invitation.token,
      });
      const waitLogin = await request.post("/api/auth/login").send({
        identifier: "wait@example.com",
        password: "Password123!",
      });
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", waitLogin.headers["set-cookie"]);

      // Player1 leaves
      await request
        .delete(`/api/events/${event.id}/tables/${tableId}/leave`)
        .set("Cookie", playerCookie);

      // Check — waitlisted player should now be confirmed
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      expect(detail.body.data.participants).toHaveLength(1);
      expect(detail.body.data.participants[0].status).toBe("CONFIRMED");
      expect(detail.body.data.participants[0].username).toBe("waiter");
    });
  });

  describe("DELETE /api/events/:eventId/tables/:tableId/participants/:userId (kick)", () => {
    it("should kick player as GM", async () => {
      const { admin, playerCookie, playerId, event } = await setupEventWithParticipant();

      // Player creates table, admin joins
      // Actually: admin creates table, player joins, admin kicks player
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      const res = await request
        .delete(`/api/events/${event.id}/tables/${tableId}/participants/${playerId}`)
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(204);

      // Verify kicked
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      expect(detail.body.data.participants).toHaveLength(0);
    });

    it("should reject kick by non-GM non-admin", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      const res = await request
        .delete(`/api/events/${event.id}/tables/${tableId}/participants/${admin.user.id}`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/events/:eventId/tables/:tableId", () => {
    it("should return table detail with participants", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      const tableId = createRes.body.data.id;

      const res = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Curse of Strahd");
      expect(res.body.data.participants).toEqual([]);
      expect(res.body.data.creator.username).toBe("adminuser");
      expect(res.body.data.tags).toHaveLength(2);
      expect(res.body.data.pitch).toBe("A gothic horror adventure");
    });

    it("should return 404 for non-existent table", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .get(`/api/events/${event.id}/tables/00000000-0000-0000-0000-000000000000`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(404);
    });
  });
});

describe("Cascade Tests", () => {
  describe("Event date cascade to GameTables", () => {
    it("should clamp table dates when event dates shrink", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Create table spanning full event (10:00-18:00)
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({
          ...validTableData,
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      // Shrink event to 12:00-16:00
      await request.patch(`/api/events/${event.id}`).set("Cookie", admin.cookie).send({
        startDateTime: "2026-06-01T12:00:00Z",
        endDateTime: "2026-06-01T16:00:00Z",
      });

      const tables = await request
        .get(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie);

      expect(tables.body.data).toHaveLength(1);
      expect(new Date(tables.body.data[0].startDateTime).toISOString()).toBe(
        "2026-06-01T12:00:00.000Z"
      );
      expect(new Date(tables.body.data[0].endDateTime).toISOString()).toBe(
        "2026-06-01T16:00:00.000Z"
      );
    });

    it("should delete table when clamped dates become invalid", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Create table 10:00-12:00
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({
          ...validTableData,
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T12:00:00Z",
        });

      // Move event start to 14:00 — table (10-12) becomes invalid
      await request
        .patch(`/api/events/${event.id}`)
        .set("Cookie", admin.cookie)
        .send({ startDateTime: "2026-06-01T14:00:00Z" });

      const tables = await request
        .get(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie);

      expect(tables.body.data).toHaveLength(0);
    });
  });

  describe("Participant removal cascade to GameTables", () => {
    it("should delete tables created by removed participant", async () => {
      const { admin, playerCookie, playerId, event } = await setupEventWithParticipant();

      // Player creates a table
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send(validTableData);

      // Admin removes player from event
      await request
        .delete(`/api/events/${event.id}/participants/${playerId}`)
        .set("Cookie", admin.cookie);

      // Tables created by removed player should be gone
      const tables = await request
        .get(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie);

      expect(tables.body.data).toHaveLength(0);
    });

    it("should remove participant from tables and promote waitlist", async () => {
      const { admin, playerCookie, playerId, event } = await setupEventWithParticipant();

      // Admin creates table with maxPlayers=1
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 1 });
      const tableId = createRes.body.data.id;

      // Player joins (confirmed)
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", playerCookie);

      // Add a third participant who will be waitlisted
      const inv = await createTestInvitation(admin.cookie, event.id, "wait@example.com");
      await request.post("/api/auth/signup").send({
        email: "wait@example.com",
        username: "waiter",
        password: "Password123!",
        invitationToken: inv.invitation.token,
      });
      const waitLogin = await request.post("/api/auth/login").send({
        identifier: "wait@example.com",
        password: "Password123!",
      });
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", waitLogin.headers["set-cookie"]);

      // Remove player from event
      await request
        .delete(`/api/events/${event.id}/participants/${playerId}`)
        .set("Cookie", admin.cookie);

      // Waitlisted should be promoted
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      expect(detail.body.data.participants).toHaveLength(1);
      expect(detail.body.data.participants[0].status).toBe("CONFIRMED");
      expect(detail.body.data.participants[0].username).toBe("waiter");
    });
  });

  describe("Event deletion cascade to GameTables", () => {
    it("should delete all tables when event is deleted", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Create tables
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(validTableData);
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, title: "Second Table" });

      // Delete event
      await request.delete(`/api/events/${event.id}`).set("Cookie", admin.cookie);

      // Event should be gone
      const eventRes = await request.get(`/api/events/${event.id}`).set("Cookie", admin.cookie);
      expect(eventRes.status).toBe(404);
    });
  });
});

describe("Tag API", () => {
  describe("GET /api/tags?q=", () => {
    it("should return matching tags", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Create a table with tags first
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, tags: ["dnd", "horror", "dark-fantasy"] });

      const res = await request.get("/api/tags?q=d").set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.map((t: { name: string }) => t.name)).toContain("dnd");
      expect(res.body.data.map((t: { name: string }) => t.name)).toContain("dark-fantasy");
    });

    it("should return empty array for no match", async () => {
      const { admin } = await setupEventWithParticipant();

      const res = await request.get("/api/tags?q=zzz").set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("should require authentication", async () => {
      const res = await request.get("/api/tags?q=d");
      expect(res.status).toBe(401);
    });
  });
});
