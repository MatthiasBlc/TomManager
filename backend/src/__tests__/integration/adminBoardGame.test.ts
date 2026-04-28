import { describe, it, expect } from "vitest";
import {
  request,
  setupAdmin,
  createTestEvent,
  addTestParticipant,
} from "../setup/testHelpers";
import prisma from "../../util/db";

async function createBoardGame(name = "Catan") {
  return prisma.boardGame.create({ data: { name } });
}

async function setupWithParticipant() {
  const admin = await setupAdmin();
  const event = await createTestEvent(admin.cookie);
  const { user, cookie: playerCookie } = await addTestParticipant(event.id, {
    email: "player@example.com",
    username: "player1",
  });
  return { admin, event, playerCookie, playerId: user.id };
}

describe("Admin BoardGame API", () => {
  describe("GET /api/admin/boardgames", () => {
    it("should return paginated list for admin", async () => {
      const { admin } = await setupWithParticipant();
      await createBoardGame("Wingspan");
      await createBoardGame("Pandemic");

      const res = await request
        .get("/api/admin/boardgames")
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.games).toBeDefined();
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.games[0]._count).toBeDefined();
    });

    it("should filter by search term", async () => {
      const { admin } = await setupWithParticipant();
      await createBoardGame("Splendor");
      await createBoardGame("Agricola");

      const res = await request
        .get("/api/admin/boardgames?search=splendor")
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(
        res.body.data.games.some(
          (g: { name: string }) => g.name === "Splendor",
        ),
      ).toBe(true);
      expect(
        res.body.data.games.some(
          (g: { name: string }) => g.name === "Agricola",
        ),
      ).toBe(false);
    });

    it("should reject non-admin", async () => {
      const { playerCookie } = await setupWithParticipant();

      const res = await request
        .get("/api/admin/boardgames")
        .set("Cookie", playerCookie);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/admin/boardgames/:id", () => {
    it("should update a board game", async () => {
      const { admin } = await setupWithParticipant();
      const bg = await createBoardGame("Catan");

      const res = await request
        .patch(`/api/admin/boardgames/${bg.id}`)
        .set("Cookie", admin.cookie)
        .send({ name: "Catan 2", maxPlayers: 6 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Catan 2");
      expect(res.body.data.maxPlayers).toBe(6);
    });

    it("should return 404 for unknown id", async () => {
      const { admin } = await setupWithParticipant();

      const res = await request
        .patch(
          "/api/admin/boardgames/00000000-0000-0000-0000-000000000000",
        )
        .set("Cookie", admin.cookie)
        .send({ name: "Ghost" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/boardgames/:id", () => {
    it("should delete a board game with no relations", async () => {
      const { admin } = await setupWithParticipant();
      const bg = await createBoardGame("Deleted game");

      const res = await request
        .delete(`/api/admin/boardgames/${bg.id}`)
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(204);
      const gone = await prisma.boardGame.findUnique({ where: { id: bg.id } });
      expect(gone).toBeNull();
    });

    it("should cascade-delete EventBoardGame entries and SET NULL on GameTable", async () => {
      const { admin, event, playerCookie, playerId } =
        await setupWithParticipant();
      const bg = await createBoardGame("Cascade test");

      // Add to event
      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: bg.id });

      // Link a table
      const table = await prisma.gameTable.create({
        data: {
          eventId: event.id,
          createdBy: playerId,
          title: "Cascade table",
          type: "JDS",
          boardGameId: bg.id,
          maxPlayers: 4,
          startDateTime: new Date("2026-06-01T10:00:00Z"),
          endDateTime: new Date("2026-06-01T12:00:00Z"),
        },
      });

      const res = await request
        .delete(`/api/admin/boardgames/${bg.id}`)
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(204);

      // EventBoardGame entries deleted
      const ebg = await prisma.eventBoardGame.findMany({
        where: { boardGameId: bg.id },
      });
      expect(ebg).toHaveLength(0);

      // GameTable.boardGameId set to null
      const updatedTable = await prisma.gameTable.findUnique({
        where: { id: table.id },
      });
      expect(updatedTable?.boardGameId).toBeNull();
    });

    it("should return 404 for unknown id", async () => {
      const { admin } = await setupWithParticipant();

      const res = await request
        .delete("/api/admin/boardgames/00000000-0000-0000-0000-000000000000")
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/admin/boardgames/:id/merge", () => {
    it("should merge source into target and delete source", async () => {
      const { admin } = await setupWithParticipant();
      const source = await createBoardGame("Source game");
      const target = await createBoardGame("Target game");

      const res = await request
        .post(`/api/admin/boardgames/${source.id}/merge`)
        .set("Cookie", admin.cookie)
        .send({ targetId: target.id });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(target.id);

      const gone = await prisma.boardGame.findUnique({
        where: { id: source.id },
      });
      expect(gone).toBeNull();
    });

    it("should re-link EventBoardGame and GameTable to target", async () => {
      const { admin, event, playerCookie, playerId } =
        await setupWithParticipant();
      const source = await createBoardGame("Source");
      const target = await createBoardGame("Target");

      // Add source to event
      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: source.id });

      // Link a table to source
      const table = await prisma.gameTable.create({
        data: {
          eventId: event.id,
          createdBy: playerId,
          title: "Merge table",
          type: "JDS",
          boardGameId: source.id,
          maxPlayers: 4,
          startDateTime: new Date("2026-06-01T10:00:00Z"),
          endDateTime: new Date("2026-06-01T12:00:00Z"),
        },
      });

      await request
        .post(`/api/admin/boardgames/${source.id}/merge`)
        .set("Cookie", admin.cookie)
        .send({ targetId: target.id });

      // EventBoardGame re-linked
      const ebg = await prisma.eventBoardGame.findFirst({
        where: { boardGameId: target.id, eventId: event.id },
      });
      expect(ebg).not.toBeNull();

      // GameTable re-linked
      const updatedTable = await prisma.gameTable.findUnique({
        where: { id: table.id },
      });
      expect(updatedTable?.boardGameId).toBe(target.id);
    });

    it("should handle duplicate EventBoardGame on merge without error", async () => {
      const { admin, event, playerCookie } = await setupWithParticipant();
      const source = await createBoardGame("Source dup");
      const target = await createBoardGame("Target dup");

      // Same user brings both source and target
      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: source.id });
      await request
        .post(`/api/events/${event.id}/boardgames`)
        .set("Cookie", playerCookie)
        .send({ boardGameId: target.id });

      const res = await request
        .post(`/api/admin/boardgames/${source.id}/merge`)
        .set("Cookie", admin.cookie)
        .send({ targetId: target.id });

      expect(res.status).toBe(200);

      // Source deleted; only 1 entry for target remains
      const entries = await prisma.eventBoardGame.findMany({
        where: { eventId: event.id, boardGameId: target.id },
      });
      expect(entries).toHaveLength(1);
    });

    it("should reject merging a game into itself", async () => {
      const { admin } = await setupWithParticipant();
      const bg = await createBoardGame("Self");

      const res = await request
        .post(`/api/admin/boardgames/${bg.id}/merge`)
        .set("Cookie", admin.cookie)
        .send({ targetId: bg.id });

      expect(res.status).toBe(400);
    });

    it("should reject invalid targetId", async () => {
      const { admin } = await setupWithParticipant();
      const bg = await createBoardGame("Bad merge");

      const res = await request
        .post(`/api/admin/boardgames/${bg.id}/merge`)
        .set("Cookie", admin.cookie)
        .send({ targetId: "not-a-uuid" });

      expect(res.status).toBe(400);
    });

    it("should apply fieldPicks — source fields overwrite target when picked", async () => {
      const { admin } = await setupWithParticipant();
      const source = await prisma.boardGame.create({
        data: { name: "Source Name", yearPublished: 2020, playingTime: 90 },
      });
      const target = await prisma.boardGame.create({
        data: { name: "Target Name", yearPublished: 2021, playingTime: null },
      });

      const res = await request
        .post(`/api/admin/boardgames/${source.id}/merge`)
        .set("Cookie", admin.cookie)
        .send({
          targetId: target.id,
          fieldPicks: {
            name: "source",
            yearPublished: "target",
            playingTime: "source",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Source Name");
      expect(res.body.data.yearPublished).toBe(2021);
      expect(res.body.data.playingTime).toBe(90);

      const gone = await prisma.boardGame.findUnique({ where: { id: source.id } });
      expect(gone).toBeNull();
    });

    it("should preserve target fields when no fieldPicks provided", async () => {
      const { admin } = await setupWithParticipant();
      const source = await prisma.boardGame.create({
        data: { name: "Source Only", yearPublished: 2019 },
      });
      const target = await prisma.boardGame.create({
        data: { name: "Target Kept", yearPublished: 2022 },
      });

      const res = await request
        .post(`/api/admin/boardgames/${source.id}/merge`)
        .set("Cookie", admin.cookie)
        .send({ targetId: target.id });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Target Kept");
      expect(res.body.data.yearPublished).toBe(2022);
    });
  });
});
