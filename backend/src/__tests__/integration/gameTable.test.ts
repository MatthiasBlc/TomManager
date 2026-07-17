import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
  createTestUserDirectly,
} from "../setup/testHelpers";
import prisma from "../../util/db";

// Helper: setup admin + event + participant user with cookie
async function setupEventWithParticipant() {
  const admin = await setupAdmin();
  const event = await createTestEvent(admin.cookie);
  const { user, cookie: playerCookie } = await addTestParticipant(event.id, {
    email: "player@example.com",
    username: "player1",
  });
  return { admin, event, playerCookie, playerId: user.id };
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

    it("should create a JDS table with a valid boardGameId", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const game = await prisma.boardGame.create({ data: { name: "Catan" } });

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({ ...validTableData, type: "JDS", boardGameId: game.id });

      expect(res.status).toBe(201);
      expect(res.body.data.boardGame).toBeDefined();
      expect(res.body.data.boardGame.id).toBe(game.id);
      expect(res.body.data.boardGame.name).toBe("Catan");
    });

    it("should create a table without boardGameId (boardGame null)", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send(validTableData);

      expect(res.status).toBe(201);
      expect(res.body.data.boardGame).toBeNull();
    });

    it("should reject an invalid boardGameId", async () => {
      const { playerCookie, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send({
          ...validTableData,
          boardGameId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.status).toBe(400);
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
      const { cookie: otherCookie } = await addTestParticipant(event.id, {
        email: "other@example.com",
        username: "otherplayer",
      });

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", otherCookie)
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
      const { cookie: p2Cookie } = await addTestParticipant(event.id, {
        email: "p2@example.com",
        username: "player2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", p2Cookie);

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

    it("should NOT auto-promote waitlisted players when increasing maxPlayers (decision B)", async () => {
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
      const { cookie: p2Cookie } = await addTestParticipant(event.id, {
        email: "p2@example.com",
        username: "player2",
      });
      const joinRes = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", p2Cookie);
      expect(joinRes.body.data.status).toBe("WAITLIST");

      // Increase maxPlayers to 3
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ maxPlayers: 3 });

      // Le MJ controle manuellement — player2 reste en WAITLIST
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
      const { cookie: fillCookie } = await addTestParticipant(event.id, {
        email: "fill@example.com",
        username: "filler",
      });
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", fillCookie);

      // Second player joins (should be waitlisted)
      const { cookie: waitCookie } = await addTestParticipant(event.id, {
        email: "wait@example.com",
        username: "waiter",
      });
      const res = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", waitCookie);

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
      // Code stable expose pour le mapping francais cote front
      expect(res.body.error.code).toBe("ALREADY_TABLE_PARTICIPANT");
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
      const { cookie: waitCookie } = await addTestParticipant(event.id, {
        email: "wait@example.com",
        username: "waiter",
      });
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", waitCookie);

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

  describe("PATCH /api/events/:eventId/tables/:tableId/participants/:userId/status", () => {
    async function setupTableWithWaitlistedPlayer() {
      const admin = await setupAdmin();
      const event = await createTestEvent(admin.cookie);

      // Table avec maxPlayers=1
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 1 });
      const tableId = createRes.body.data.id;

      // Joueur1 rejoint (confirme)
      const { user: player1, cookie: cookie1 } = await addTestParticipant(event.id, {
        email: "setp1@example.com",
        username: "setp1user",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", cookie1);

      // Joueur2 rejoint (waitlist)
      const { user: player2, cookie: cookie2 } = await addTestParticipant(event.id, {
        email: "setp2@example.com",
        username: "setp2user",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", cookie2);

      return { admin, event, tableId, player1, cookie1, player2, cookie2 };
    }

    it("should promote a WAITLIST player to CONFIRMED when a slot is available", async () => {
      const { admin, event, tableId, player1, player2 } = await setupTableWithWaitlistedPlayer();

      // Retrograder player1 d'abord pour liberer une place
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${player1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      // Promouvoir player2 (le choix de place est toujours explicite)
      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${player2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("CONFIRMED");

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const p2 = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === player2.id
      );
      expect(p2.status).toBe("CONFIRMED");
    });

    it("should reject promote with 409 when table is full", async () => {
      const { admin, event, tableId, player2 } = await setupTableWithWaitlistedPlayer();

      // Table pleine (player1 est confirme, maxPlayers=1)
      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${player2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("NO_OPEN_SEAT");
    });

    it("should demote a CONFIRMED player to WAITLIST", async () => {
      const { admin, event, tableId, player1 } = await setupTableWithWaitlistedPlayer();

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${player1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("WAITLIST");

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const p1 = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === player1.id
      );
      expect(p1.status).toBe("WAITLIST");
    });

    it("should NOT auto-promote the next waitlist player after a demote", async () => {
      const { admin, event, tableId, player1, player2 } = await setupTableWithWaitlistedPlayer();

      // Retrograder player1 (confirme) -> waitlist
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${player1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      // player2 doit rester WAITLIST (pas de promotion automatique)
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const p2 = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === player2.id
      );
      expect(p2.status).toBe("WAITLIST");
    });

    it("should reject status change with 403 if not GM or admin", async () => {
      const { event, tableId, player1, cookie2 } = await setupTableWithWaitlistedPlayer();

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${player1.id}/status`)
        .set("Cookie", cookie2)
        .send({ status: "WAITLIST" });

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent participant", async () => {
      const { admin, event, tableId } = await setupTableWithWaitlistedPlayer();

      const res = await request
        .patch(
          `/api/events/${event.id}/tables/${tableId}/participants/00000000-0000-0000-0000-000000000000/status`
        )
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      expect(res.status).toBe(404);
    });
  });

  describe("Reserved Seats", () => {
    async function setupTableWithReserved(reservedSeats: number, maxPlayers: number) {
      const admin = await setupAdmin();
      const event = await createTestEvent(admin.cookie);
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers, reservedSeats });
      return { admin, event, tableId: createRes.body.data.id };
    }

    it("should create a table with reservedSeats and expose it in response", async () => {
      const { admin, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 5, reservedSeats: 2 });

      expect(res.status).toBe(201);
      expect(res.body.data.reservedSeats).toBe(2);
    });

    it("should reject reservedSeats > maxPlayers", async () => {
      const { admin, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 3, reservedSeats: 4 });

      expect(res.status).toBe(400);
    });

    it("should reject negative reservedSeats", async () => {
      const { admin, event } = await setupEventWithParticipant();

      const res = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 5, reservedSeats: -1 });

      expect(res.status).toBe(400);
    });

    it("join goes to WAITLIST when only reserved seats are left", async () => {
      // maxPlayers=3, reservedSeats=2 → openSeats=1
      const { admin: _admin, event, tableId } = await setupTableWithReserved(2, 3);

      // Premier joueur : prend la place ouverte
      const { cookie: c1 } = await addTestParticipant(event.id, {
        email: "rs1@example.com",
        username: "rsplayer1",
      });
      const r1 = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", c1);
      expect(r1.body.data.status).toBe("CONFIRMED");

      // Deuxieme joueur : plus de place ouverte → WAITLIST
      const { cookie: c2 } = await addTestParticipant(event.id, {
        email: "rs2@example.com",
        username: "rsplayer2",
      });
      const r2 = await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", c2);
      expect(r2.body.data.status).toBe("WAITLIST");
    });

    it("promote with seat=RESERVED assigns a reserved seat, reservedSeats stays the fixed total", async () => {
      // maxPlayers=3, reservedSeats=2 → openSeats=1
      const { admin, event, tableId } = await setupTableWithReserved(2, 3);

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "rsp1@example.com",
        username: "rsp1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);

      // p1 est CONFIRMED sur place normale, plus de place ouverte → p2 en WAITLIST
      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "rsp2@example.com",
        username: "rsp2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);

      // Promouvoir p2 depuis la waitlist sur une reserved seat (choix explicite)
      const promoteRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      expect(promoteRes.status).toBe(200);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      expect(detail.body.data.reservedSeats).toBe(2); // total fixe, inchange
      const p2Detail = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === p2.id
      );
      expect(p2Detail.status).toBe("CONFIRMED");
      expect(p2Detail.isOnReservedSeat).toBe(true);

      // La liste des tables (GET /tables) doit aussi exposer isOnReservedSeat par joueur
      // et le nombre de places reservees occupees
      const list = await request.get(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie);
      const listedTable = list.body.data.find((t: { id: string }) => t.id === tableId);
      const p2Listed = listedTable.players.find((p: { id: string }) => p.id === p2.id);
      expect(p2Listed.isOnReservedSeat).toBe(true);
      expect(listedTable.confirmedOnReserved).toBe(1);
    });

    it("promote uses normal seat when reservedSeats=0", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(0, 2);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "nrs1@example.com",
        username: "nrs1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);

      const { user: _p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "nrs2@example.com",
        username: "nrs2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      const { user: p3, cookie: c3 } = await addTestParticipant(event.id, {
        email: "nrs3@example.com",
        username: "nrs3",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c3);

      // p3 est en waitlist (table pleine a 2/2)
      const detail1 = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const p3pre = detail1.body.data.participants.find(
        (p: { userId: string }) => p.userId === p3.id
      );
      expect(p3pre.status).toBe("WAITLIST");

      // Retrograder p1 pour liberer une place
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      // Promouvoir p3 → place normale explicite
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p3.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      const detail2 = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const p3post = detail2.body.data.participants.find(
        (p: { userId: string }) => p.userId === p3.id
      );
      expect(p3post.status).toBe("CONFIRMED");
      expect(p3post.isOnReservedSeat).toBe(false);
      expect(detail2.body.data.reservedSeats).toBe(0); // inchange
    });

    it("promote returns 409 when no seats available at all", async () => {
      // maxPlayers=1, reservedSeats=0 → 1 place normale
      const { admin, event, tableId } = await setupTableWithReserved(0, 1);

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "full1@example.com",
        username: "full1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);

      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "full2@example.com",
        username: "full2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      // p2 est en WAITLIST

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      expect(res.status).toBe(409);
    });

    it("demote player on reserved seat returns seat to pool and clears flag", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(2, 4);

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "dem1@example.com",
        username: "dem1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // openSeats = 4-1-2 = 1
      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "dem2@example.com",
        username: "dem2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      // openSeats = 4-2-2 = 0, p2 en WAITLIST

      // Promouvoir p2 → prend reserved seat, reservedSeats = 1
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      // Retrograder p2 → reserved seat liberee, reservedSeats revient a 2
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      expect(detail.body.data.reservedSeats).toBe(2);
      const p2d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p2.id);
      expect(p2d.isOnReservedSeat).toBe(false);
      expect(p2d.status).toBe("WAITLIST");
    });

    it("explicit seat=FREE on promotion uses a free seat even when reserved seats remain", async () => {
      // maxPlayers=3, reservedSeats=2 → openSeats=1
      const { admin, event, tableId } = await setupTableWithReserved(2, 3);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "esf1@example.com",
        username: "esf1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // p1 CONFIRMED sur place normale, openSeats = 0 → prochain join va en WAITLIST

      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "esf2@example.com",
        username: "esf2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      // p2 en WAITLIST

      // p1 retrograde pour liberer une place normale
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      // Promouvoir p2 en demandant explicitement une place libre, malgre reservedSeats > 0
      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      expect(res.status).toBe(200);
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      expect(detail.body.data.reservedSeats).toBe(2); // inchange
      const p2d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p2.id);
      expect(p2d.status).toBe("CONFIRMED");
      expect(p2d.isOnReservedSeat).toBe(false);
    });

    it("explicit seat=RESERVED on promotion returns 409 when reservedSeats=0 even if a free seat exists", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(0, 2);

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "esr1@example.com",
        username: "esr1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // p1 CONFIRMED, openSeats = 2-1-0 = 1 (une place libre encore disponible)

      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "esr2@example.com",
        username: "esr2",
      });
      // p2 rejoint directement (place libre dispo) puis on le repasse en waitlist pour tester la promotion
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      expect(res.status).toBe(409);
    });

    it("converts a confirmed player from free seat to reserved seat in place", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(1, 3);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "cvf1@example.com",
        username: "cvf1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // p1 CONFIRMED sur place normale

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      expect(res.status).toBe(200);
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      expect(detail.body.data.reservedSeats).toBe(1); // total fixe, inchange
      const p1d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p1.id);
      expect(p1d.status).toBe("CONFIRMED");
      expect(p1d.isOnReservedSeat).toBe(true);
    });

    it("rejects converting a confirmed player to reserved seat when reservedSeats=0", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(0, 2);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "cvf2@example.com",
        username: "cvf2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      expect(res.status).toBe(409);
    });

    it("converts a confirmed player from reserved seat to free seat when a free seat is open", async () => {
      // maxPlayers=3, reservedSeats=1 → 2 places libres dont 1 occupee
      const { admin, event, tableId } = await setupTableWithReserved(1, 3);

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "cvr1@example.com",
        username: "cvr1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "cvr2@example.com",
        username: "cvr2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      // p2 CONFIRMED sur place libre → on le bascule sur la reservee puis retour
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      expect(res.status).toBe(200);
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      expect(detail.body.data.reservedSeats).toBe(1); // rendue au pool
      const p2d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p2.id);
      expect(p2d.status).toBe("CONFIRMED");
      expect(p2d.isOnReservedSeat).toBe(false);
    });

    it("rejects converting reserved -> free when no free seat is open (prevents overbooking)", async () => {
      // maxPlayers=4, reservedSeats=2 → 2 libres + 2 reservees
      const { admin, event, tableId } = await setupTableWithReserved(2, 4);

      const players: { id: string }[] = [];
      for (let i = 1; i <= 4; i++) {
        const { user, cookie } = await addTestParticipant(event.id, {
          email: `ovb${i}@example.com`,
          username: `ovb${i}`,
        });
        await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", cookie);
        players.push(user);
      }
      // p1, p2 CONFIRMED (libres pleines) ; p3, p4 WAITLIST → affectes sur les reservees
      for (const p of [players[2], players[3]]) {
        await request
          .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p.id}/status`)
          .set("Cookie", admin.cookie)
          .send({ status: "CONFIRMED", seat: "RESERVED" });
      }
      // Table 4/4 : aucune place libre → la conversion doit etre refusee, sinon le
      // compartiment libre deborde (3/2) et la reservee liberee permettrait un
      // 5e confirme sur une table de 4
      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${players[2].id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      expect(res.status).toBe(409);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const confirmed = detail.body.data.participants.filter(
        (p: { status: string }) => p.status === "CONFIRMED"
      );
      expect(confirmed).toHaveLength(4);
      const p3d = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === players[2].id
      );
      expect(p3d.isOnReservedSeat).toBe(true);
    });

    it("no-op when converting to the seat type already occupied", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(1, 2);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "noop1@example.com",
        username: "noop1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // p1 CONFIRMED sur place normale

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "FREE" });

      expect(res.status).toBe(200);
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      expect(detail.body.data.reservedSeats).toBe(1); // inchange
    });

    it("leave from reserved seat returns seat to pool with no auto-promotion", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(1, 2);
      // openSeats = 2-0-1 = 1

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "lrs1@example.com",
        username: "lrs1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // openSeats = 2-1-1 = 0, p1 CONFIRMED (place normale)

      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "lrs2@example.com",
        username: "lrs2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      // p2 en WAITLIST

      // Promouvoir p2 → reserved seat, reservedSeats=0
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      // Ajouter p3 en waitlist
      const { user: _p3, cookie: c3 } = await addTestParticipant(event.id, {
        email: "lrs3@example.com",
        username: "lrs3",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c3);

      // p2 quitte sa reserved seat
      await request.delete(`/api/events/${event.id}/tables/${tableId}/leave`).set("Cookie", c2);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      // reservedSeats doit revenir a 1
      expect(detail.body.data.reservedSeats).toBe(1);
      // p3 ne doit PAS etre auto-promu
      const p3d = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === _p3.id
      );
      expect(p3d.status).toBe("WAITLIST");
    });

    it("leave from normal seat still auto-promotes", async () => {
      // maxPlayers=2, reservedSeats=0
      const { admin, event, tableId } = await setupTableWithReserved(0, 2);

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "lan1@example.com",
        username: "lan1",
      });
      const { user: _p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "lan2@example.com",
        username: "lan2",
      });
      const { user: p3, cookie: c3 } = await addTestParticipant(event.id, {
        email: "lan3@example.com",
        username: "lan3",
      });

      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c3);
      // p1, p2 CONFIRMED; p3 WAITLIST

      // p1 quitte (place normale)
      await request.delete(`/api/events/${event.id}/tables/${tableId}/leave`).set("Cookie", c1);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      const p3d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p3.id);
      expect(p3d.status).toBe("CONFIRMED");
    });

    it("updateTable increasing reservedSeats demotes non-reserved players first", async () => {
      // maxPlayers=4, reservedSeats=0
      const { admin, event, tableId } = await setupTableWithReserved(0, 4);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "urd1@example.com",
        username: "urd1",
      });
      const { user: _p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "urd2@example.com",
        username: "urd2",
      });
      const { user: _p3, cookie: c3 } = await addTestParticipant(event.id, {
        email: "urd3@example.com",
        username: "urd3",
      });

      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c3);
      // p1, p2, p3 CONFIRMED (ordre join: p1 < p2 < p3)

      // MJ reserve 3 places → targetConfirmed = 4-3 = 1 → 2 demotions
      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ reservedSeats: 3 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.reservedSeats).toBe(3);

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
      expect(waitlisted).toHaveLength(2);
      // p1 (le plus ancien) doit rester CONFIRMED
      expect(confirmed[0].userId).toBe(p1.id);
    });

    it("updateTable decreasing reservedSeats does NOT auto-promote", async () => {
      // maxPlayers=4, reservedSeats=3 → openSeats=1
      const { admin, event, tableId } = await setupTableWithReserved(3, 4);

      const { user: _p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "rsd1@example.com",
        username: "rsd1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // p1 CONFIRMED (place normale), openSeats=0

      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "rsd2@example.com",
        username: "rsd2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      // p2 WAITLIST

      // MJ reduit reservedSeats a 1 → openSeats = 4-1-1 = 2
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ reservedSeats: 1 });

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      // p2 reste WAITLIST, pas d'auto-promotion
      const p2d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p2.id);
      expect(p2d.status).toBe("WAITLIST");
      expect(detail.body.data.reservedSeats).toBe(1);
    });

    it("updateTable reservedSeats back to its original value does not demote a player already on a reserved seat (regression)", async () => {
      // maxPlayers=2, reservedSeats=2 → aucune place normale
      const { admin, event, tableId } = await setupTableWithReserved(2, 2);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "orig1@example.com",
        username: "orig1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // p1 en WAITLIST (0 place normale)

      // Le MJ lui attribue une place reservee
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      // Le MJ remet reservedSeats a sa valeur d'origine (2)
      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ reservedSeats: 2 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.reservedSeats).toBe(2);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const p1d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p1.id);
      expect(p1d.status).toBe("CONFIRMED");
      expect(p1d.isOnReservedSeat).toBe(true);
    });

    it("updateTable decreasing reservedSeats converts the most recent reserved player to a free seat instead of waitlisting when room opens up", async () => {
      // maxPlayers=4, reservedSeats=3 → 1 place normale
      const { admin, event, tableId } = await setupTableWithReserved(3, 4);

      const { user: p0, cookie: c0 } = await addTestParticipant(event.id, {
        email: "conv0@example.com",
        username: "conv0",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c0);
      // p0 CONFIRMED sur la place normale (plus de place normale ouverte ensuite)

      const players = [];
      for (let i = 1; i <= 3; i++) {
        const { user, cookie } = await addTestParticipant(event.id, {
          email: `conv${i}@example.com`,
          username: `conv${i}`,
        });
        await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", cookie);
        // WAITLIST puis promu sur reserved seat (reserved-first par defaut)
        await request
          .patch(`/api/events/${event.id}/tables/${tableId}/participants/${user.id}/status`)
          .set("Cookie", admin.cookie)
          .send({ status: "CONFIRMED", seat: "RESERVED" });
        players.push(user);
      }
      // p1, p2, p3 CONFIRMED sur reserved seat, dans l'ordre de jointure

      // Le MJ reduit reservedSeats a 2 (maxPlayers inchange a 4)
      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ reservedSeats: 2 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.reservedSeats).toBe(2);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const byId = (id: string) =>
        detail.body.data.participants.find((p: { userId: string }) => p.userId === id);

      // p3 (le plus recent sur place reservee) devient libre, pas de liste d'attente
      expect(byId(players[2].id).status).toBe("CONFIRMED");
      expect(byId(players[2].id).isOnReservedSeat).toBe(false);
      // p1 et p2 restent sur leur place reservee
      expect(byId(players[0].id).status).toBe("CONFIRMED");
      expect(byId(players[0].id).isOnReservedSeat).toBe(true);
      expect(byId(players[1].id).status).toBe("CONFIRMED");
      expect(byId(players[1].id).isOnReservedSeat).toBe(true);
      // p0 (place normale d'origine) inchange
      expect(byId(p0.id).status).toBe("CONFIRMED");
      expect(byId(p0.id).isOnReservedSeat).toBe(false);

      const waitlisted = detail.body.data.participants.filter(
        (p: { status: string }) => p.status === "WAITLIST"
      );
      expect(waitlisted).toHaveLength(0);
    });

    it("updateTable decreasing reservedSeats converts what fits and waitlists the most recent overflow when room is short", async () => {
      // maxPlayers=6, reservedSeats=6 → aucune place normale
      const { admin, event, tableId } = await setupTableWithReserved(6, 6);

      const players = [];
      for (let i = 1; i <= 6; i++) {
        const { user, cookie } = await addTestParticipant(event.id, {
          email: `part${i}@example.com`,
          username: `part${i}`,
        });
        await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", cookie);
        await request
          .patch(`/api/events/${event.id}/tables/${tableId}/participants/${user.id}/status`)
          .set("Cookie", admin.cookie)
          .send({ status: "CONFIRMED", seat: "RESERVED" });
        players.push(user);
      }
      // p1..p6 CONFIRMED sur reserved seat, dans l'ordre de jointure

      // Le MJ reduit maxPlayers a 4 ET reservedSeats a 3 en meme temps :
      // seule 1 place libre s'ouvre pour 3 joueurs reserves en trop
      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ maxPlayers: 4, reservedSeats: 3 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.reservedSeats).toBe(3);
      expect(updateRes.body.data.maxPlayers).toBe(4);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const byId = (id: string) =>
        detail.body.data.participants.find((p: { userId: string }) => p.userId === id);

      // p1, p2, p3 (les plus anciens) gardent leur place reservee
      for (const p of players.slice(0, 3)) {
        expect(byId(p.id).status).toBe("CONFIRMED");
        expect(byId(p.id).isOnReservedSeat).toBe(true);
      }
      // p4 (le plus ancien du lot en trop) est converti en place libre
      expect(byId(players[3].id).status).toBe("CONFIRMED");
      expect(byId(players[3].id).isOnReservedSeat).toBe(false);
      // p5 et p6 (les plus recents du lot en trop) partent en liste d'attente
      expect(byId(players[4].id).status).toBe("WAITLIST");
      expect(byId(players[5].id).status).toBe("WAITLIST");
      // 6 joueurs a creer + 6 promotions : depasse regulierement les 5s par defaut
    }, 15000);

    it("updateTable reducing maxPlayers caps reservedSeats and demotes confirmed", async () => {
      // maxPlayers=6, reservedSeats=2 → openSeats=4
      const { admin, event, tableId } = await setupTableWithReserved(2, 6);

      // 4 joueurs rejoignent (places normales)
      const players = [];
      for (let i = 1; i <= 4; i++) {
        const { user, cookie } = await addTestParticipant(event.id, {
          email: `mp${i}@example.com`,
          username: `mp${i}`,
        });
        await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", cookie);
        players.push({ user, cookie });
      }

      // MJ reduit maxPlayers a 2 → newReservedSeats = min(2,2)=2, targetConfirmed=0, 4 demotions
      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ maxPlayers: 2 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.maxPlayers).toBe(2);
      expect(updateRes.body.data.reservedSeats).toBe(2);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      const confirmed = detail.body.data.participants.filter(
        (p: { status: string }) => p.status === "CONFIRMED"
      );
      expect(confirmed).toHaveLength(0);
    });

    it("updateTable reducing maxPlayers below reservedSeats caps reservedSeats", async () => {
      // maxPlayers=6, reservedSeats=4
      const { admin, event, tableId } = await setupTableWithReserved(4, 6);

      // MJ reduit maxPlayers a 2 → newReservedSeats = min(4,2) = 2
      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ maxPlayers: 2 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.reservedSeats).toBe(2);
    });

    it("listTables exposes reservedSeats", async () => {
      const { admin, event, tableId: _tableId } = await setupTableWithReserved(3, 5);

      const res = await request.get(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data[0].reservedSeats).toBe(3);
      expect(res.body.data[0].confirmedOnReserved).toBe(0);
    });

    it("getTable exposes reservedSeats and isOnReservedSeat on participants", async () => {
      // maxPlayers=3, reservedSeats=2 → openSeats=1
      const { admin, event, tableId } = await setupTableWithReserved(2, 3);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "gexp1@example.com",
        username: "gexp1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      // p1 CONFIRMED sur la place normale restante (openSeats = 3-1-2 = 0)
      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "gexp2@example.com",
        username: "gexp2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      // p2 WAITLIST (plus de place normale ouverte)

      // Promouvoir p2 → reserved seat
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);

      expect(detail.body.data.reservedSeats).toBe(2); // total fixe, inchange
      const p1d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p1.id);
      const p2d = detail.body.data.participants.find((p: { userId: string }) => p.userId === p2.id);
      expect(p1d.isOnReservedSeat).toBe(false);
      expect(p2d.isOnReservedSeat).toBe(true);
    });

    it("updateTable rejects reservedSeats that would take the GM seat (JDS)", async () => {
      const admin = await setupAdmin();
      const event = await createTestEvent(admin.cookie);
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, type: "JDS", maxPlayers: 4, reservedSeats: 0 });
      const tableId = createRes.body.data.id;

      // Le MJ (createur JDS) occupe une place : borne = maxPlayers - 1, comme a la creation
      const rejected = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ reservedSeats: 4 });
      expect(rejected.status).toBe(400);

      const accepted = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ reservedSeats: 3 });
      expect(accepted.status).toBe(200);
      expect(accepted.body.data.reservedSeats).toBe(3);
    });

    it("enabling gmIsPlayer creates an extra seat for the GM (maxPlayers +1, reservedSeats intact)", async () => {
      // JDR sans MJ joueur : reservedSeats = maxPlayers autorise a la creation
      const { admin, event, tableId } = await setupTableWithReserved(3, 3);

      // Le MJ devient joueur : une place est creee pour lui, rien d'autre ne bouge
      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ gmIsPlayer: true });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.maxPlayers).toBe(4);
      expect(updateRes.body.data.reservedSeats).toBe(3);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const gm = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === admin.user.id
      );
      expect(gm.status).toBe("CONFIRMED");
      expect(gm.isOnReservedSeat).toBe(false);
    });

    it("enabling gmIsPlayer on a full table demotes nobody", async () => {
      // maxPlayers=2, reservedSeats=0 : table pleine + 1 en attente
      const { admin, event, tableId } = await setupTableWithReserved(0, 2);

      const users = [];
      for (let i = 1; i <= 3; i++) {
        const { user, cookie } = await addTestParticipant(event.id, {
          email: `gmfull${i}@example.com`,
          username: `gmfull${i}`,
        });
        await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", cookie);
        users.push(user);
      }
      // p1, p2 CONFIRMED ; p3 WAITLIST

      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ gmIsPlayer: true });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.maxPlayers).toBe(3);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const byId = (id: string) =>
        detail.body.data.participants.find((p: { userId: string }) => p.userId === id);
      expect(byId(admin.user.id).status).toBe("CONFIRMED");
      expect(byId(users[0].id).status).toBe("CONFIRMED");
      expect(byId(users[1].id).status).toBe("CONFIRMED");
      // La place creee est celle du MJ : personne n'est promu depuis la waitlist
      expect(byId(users[2].id).status).toBe("WAITLIST");
    });

    it("disabling gmIsPlayer deletes the GM seat (maxPlayers -1, no promotion)", async () => {
      const admin = await setupAdmin();
      const event = await createTestEvent(admin.cookie);
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 3, gmIsPlayer: true });
      const tableId = createRes.body.data.id;
      // MJ CONFIRMED, 2 places restantes

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "gmoff1@example.com",
        username: "gmoff1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "gmoff2@example.com",
        username: "gmoff2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      const { user: p3, cookie: c3 } = await addTestParticipant(event.id, {
        email: "gmoff3@example.com",
        username: "gmoff3",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c3);
      // MJ + p1 + p2 CONFIRMED (3/3), p3 WAITLIST

      const updateRes = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ gmIsPlayer: false });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.maxPlayers).toBe(2);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const byId = (id: string) =>
        detail.body.data.participants.find((p: { userId: string }) => p.userId === id);
      // Le MJ et sa place sont partis ensemble : ni retrogradation ni promotion
      expect(byId(admin.user.id)).toBeUndefined();
      expect(byId(p1.id).status).toBe("CONFIRMED");
      expect(byId(p2.id).status).toBe("CONFIRMED");
      expect(byId(p3.id).status).toBe("WAITLIST");
    });

    it("rejects enabling gmIsPlayer when the table is already at 20 players", async () => {
      const admin = await setupAdmin();
      const event = await createTestEvent(admin.cookie);
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, maxPlayers: 20 });
      const tableId = createRes.body.data.id;

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie)
        .send({ gmIsPlayer: true });

      expect(res.status).toBe(400);
    });

    it("rejects promotion to CONFIRMED without an explicit seat", async () => {
      const { admin, event, tableId } = await setupTableWithReserved(1, 3);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "noseat1@example.com",
        username: "noseat1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED" });

      expect(res.status).toBe(400);
    });

    it("rejects demoting a player who is already on the waitlist", async () => {
      // maxPlayers=1 : p2 arrive en WAITLIST
      const { admin, event, tableId } = await setupTableWithReserved(0, 1);

      const { cookie: c1 } = await addTestParticipant(event.id, {
        email: "rewl1@example.com",
        username: "rewl1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      const { user: p2, cookie: c2 } = await addTestParticipant(event.id, {
        email: "rewl2@example.com",
        username: "rewl2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p2.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      expect(res.status).toBe(409);
    });

    it("rejects assigning the GM to a reserved seat", async () => {
      const admin = await setupAdmin();
      const event = await createTestEvent(admin.cookie);
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, type: "JDS", maxPlayers: 4, reservedSeats: 2 });
      const tableId = createRes.body.data.id;

      const res = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${admin.user.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "CONFIRMED", seat: "RESERVED" });

      expect(res.status).toBe(400);
    });

    it("refuses to waitlist or kick the GM seated at their own table", async () => {
      const admin = await setupAdmin();
      const event = await createTestEvent(admin.cookie);
      const createRes = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, type: "JDS", maxPlayers: 4 });
      const tableId = createRes.body.data.id;

      const demote = await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${admin.user.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });
      expect(demote.status).toBe(400);

      const kick = await request
        .delete(`/api/events/${event.id}/tables/${tableId}/participants/${admin.user.id}`)
        .set("Cookie", admin.cookie);
      expect(kick.status).toBe(400);

      // Le MJ est toujours confirme a sa table
      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const gm = detail.body.data.participants.find(
        (p: { userId: string }) => p.userId === admin.user.id
      );
      expect(gm.status).toBe("CONFIRMED");
    });

    it("a demoted player goes to the back of the waitlist queue", async () => {
      // maxPlayers=2, reservedSeats=0 → 2 places normales
      const { admin, event, tableId } = await setupTableWithReserved(0, 2);

      const { user: p1, cookie: c1 } = await addTestParticipant(event.id, {
        email: "queue1@example.com",
        username: "queue1",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c1);
      const { cookie: c2 } = await addTestParticipant(event.id, {
        email: "queue2@example.com",
        username: "queue2",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c2);
      const { user: p3, cookie: c3 } = await addTestParticipant(event.id, {
        email: "queue3@example.com",
        username: "queue3",
      });
      await request.post(`/api/events/${event.id}/tables/${tableId}/join`).set("Cookie", c3);
      // p1, p2 CONFIRMED ; p3 WAITLIST

      // Le MJ retrograde p1 : il repart en fin de file, derriere p3
      await request
        .patch(`/api/events/${event.id}/tables/${tableId}/participants/${p1.id}/status`)
        .set("Cookie", admin.cookie)
        .send({ status: "WAITLIST" });

      // p2 quitte : l'auto-promotion doit prendre p3 (premier de la file), pas p1
      await request.delete(`/api/events/${event.id}/tables/${tableId}/leave`).set("Cookie", c2);

      const detail = await request
        .get(`/api/events/${event.id}/tables/${tableId}`)
        .set("Cookie", admin.cookie);
      const byId = (id: string) =>
        detail.body.data.participants.find((p: { userId: string }) => p.userId === id);
      expect(byId(p3.id).status).toBe("CONFIRMED");
      expect(byId(p1.id).status).toBe("WAITLIST");
    });
  });

  describe("Conflict detection (GET /api/events/:eventId/tables)", () => {
    // Tables qui se chevauchent : A (10-14h), B (12-16h)
    // Tables qui ne se chevauchent pas : A (10-12h), C (13-15h)
    const tableA = {
      title: "Table A",
      maxPlayers: 4,
      startDateTime: "2026-06-01T10:00:00Z",
      endDateTime: "2026-06-01T14:00:00Z",
    };
    const tableB = {
      title: "Table B",
      maxPlayers: 4,
      startDateTime: "2026-06-01T12:00:00Z",
      endDateTime: "2026-06-01T16:00:00Z",
    };
    const tableC = {
      title: "Table C",
      maxPlayers: 4,
      startDateTime: "2026-06-01T15:00:00Z",
      endDateTime: "2026-06-01T17:00:00Z",
    };

    it("should flag conflict when GM directs two overlapping tables (JDR sans gmIsPlayer)", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Admin est GM sur deux tables qui se chevauchent (pas dans participants)
      await request.post(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie).send(tableA);
      await request.post(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie).send(tableB);

      const res = await request.get(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      // Les deux tables doivent signaler un conflit pour l'admin (le GM)
      expect(res.body.data[0].currentUserConflict).toBe(true);
      expect(res.body.data[1].currentUserConflict).toBe(true);
      expect(res.body.data[0].conflictingPlayerCount).toBe(1);
      expect(res.body.data[1].conflictingPlayerCount).toBe(1);
    });

    it("should flag conflict when user is GM on one table and player on another overlapping table", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Player cree la table B (GM: player)
      const { cookie: playerCookie } = await addTestParticipant(event.id, {
        email: "gmplayer@example.com",
        username: "gmplayer",
      });

      // Admin est GM sur table A
      await request.post(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie).send(tableA);

      // Player est GM sur table B (chevauchement avec A)
      const resTB = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie)
        .send(tableB);
      const tableBId = resTB.body.data.id;

      // Admin rejoint la table B comme joueur (CONFIRMED)
      await request
        .post(`/api/events/${event.id}/tables/${tableBId}/join`)
        .set("Cookie", admin.cookie);

      const res = await request.get(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      // L'admin est GM sur A et joueur sur B : conflit sur les deux
      const tA = res.body.data.find((t: { title: string }) => t.title === "Table A");
      const tB = res.body.data.find((t: { title: string }) => t.title === "Table B");
      expect(tA.currentUserConflict).toBe(true);
      expect(tB.currentUserConflict).toBe(true);
    });

    it("should not flag conflict when GM directs two non-overlapping tables", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Admin est GM sur table A (10-14h) et table C (15-17h) : pas de chevauchement
      await request.post(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie).send(tableA);
      await request.post(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie).send(tableC);

      const res = await request.get(`/api/events/${event.id}/tables`).set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data[0].currentUserConflict).toBe(false);
      expect(res.body.data[1].currentUserConflict).toBe(false);
      expect(res.body.data[0].conflictingPlayerCount).toBe(0);
      expect(res.body.data[1].conflictingPlayerCount).toBe(0);
    });

    it("should flag conflict when player is CONFIRMED on two overlapping tables", async () => {
      const { admin, playerCookie, event } = await setupEventWithParticipant();

      // Admin cree deux tables qui se chevauchent
      const resA = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(tableA);
      const resB = await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send(tableB);

      // Player rejoint les deux tables
      await request
        .post(`/api/events/${event.id}/tables/${resA.body.data.id}/join`)
        .set("Cookie", playerCookie);
      await request
        .post(`/api/events/${event.id}/tables/${resB.body.data.id}/join`)
        .set("Cookie", playerCookie);

      const res = await request.get(`/api/events/${event.id}/tables`).set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data[0].currentUserConflict).toBe(true);
      expect(res.body.data[1].currentUserConflict).toBe(true);
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
      const { cookie: waitCookie } = await addTestParticipant(event.id, {
        email: "wait@example.com",
        username: "waiter",
      });
      await request
        .post(`/api/events/${event.id}/tables/${tableId}/join`)
        .set("Cookie", waitCookie);

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
