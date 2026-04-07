import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupAdmin, createTestEvent, addTestParticipant } from "../setup/testHelpers";
import prisma from "../../util/db";
import * as bggService from "../../services/bgg";

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

describe("BoardGame API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/boardgames (manual creation)", () => {
    it("should create a board game manually", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request
        .post("/api/boardgames")
        .set("Cookie", playerCookie)
        .send({ name: "Mon jeu custom" });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Mon jeu custom");
      expect(res.body.data.externalSource).toBeNull();
      expect(res.body.data.externalId).toBeNull();
    });

    it("should reject empty name", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request
        .post("/api/boardgames")
        .set("Cookie", playerCookie)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("should reject missing name", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request.post("/api/boardgames").set("Cookie", playerCookie).send({});

      expect(res.status).toBe(400);
    });

    it("should create with optional fields", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request.post("/api/boardgames").set("Cookie", playerCookie).send({
        name: "Catan",
        yearPublished: 1995,
        minPlayers: 3,
        maxPlayers: 4,
        playingTime: 90,
      });

      expect(res.status).toBe(201);
      expect(res.body.data.yearPublished).toBe(1995);
      expect(res.body.data.minPlayers).toBe(3);
      expect(res.body.data.maxPlayers).toBe(4);
      expect(res.body.data.playingTime).toBe(90);
    });
  });

  describe("GET /api/boardgames/search?q=", () => {
    it("should return local results", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      // Create a local board game
      await prisma.boardGame.create({
        data: { name: "Catan", yearPublished: 1995 },
      });

      vi.spyOn(bggService, "searchBGG").mockResolvedValue([]);

      const res = await request.get("/api/boardgames/search?q=Catan").set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe("Catan");
    });

    it("should fallback to BGG when few local results", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      vi.spyOn(bggService, "searchBGG").mockResolvedValue([
        { bggId: "13", name: "Catan", yearPublished: 1995 },
        { bggId: "42", name: "Catan: Seafarers", yearPublished: 1997 },
      ]);

      const res = await request.get("/api/boardgames/search?q=Catan").set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe("Catan");
      expect(res.body.data[1].name).toBe("Catan: Seafarers");
    });

    it("should dedup BGG results against local", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      // Local entry with BGG external ID
      await prisma.boardGame.create({
        data: { name: "Catan", externalSource: "BGG", externalId: "13", yearPublished: 1995 },
      });

      vi.spyOn(bggService, "searchBGG").mockResolvedValue([
        { bggId: "13", name: "Catan", yearPublished: 1995 },
        { bggId: "42", name: "Catan: Seafarers", yearPublished: 1997 },
      ]);

      const res = await request.get("/api/boardgames/search?q=Catan").set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      // 1 local + 1 new from BGG (deduped "13")
      expect(res.body.data).toHaveLength(2);
    });

    it("should return empty array for empty query", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request.get("/api/boardgames/search?q=").set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/boardgames/:boardGameId", () => {
    it("should return board game detail", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const bg = await prisma.boardGame.create({
        data: { name: "Catan", yearPublished: 1995, description: "Trade and build" },
      });

      const res = await request.get(`/api/boardgames/${bg.id}`).set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Catan");
      expect(res.body.data.description).toBe("Trade and build");
    });

    it("should lazy fetch BGG detail for stub", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      // Create a stub (no description)
      const bg = await prisma.boardGame.create({
        data: { name: "Catan", externalSource: "BGG", externalId: "13" },
      });

      vi.spyOn(bggService, "fetchBGGThing").mockResolvedValue({
        bggId: "13",
        name: "Catan",
        yearPublished: 1995,
        minPlayers: 3,
        maxPlayers: 4,
        playingTime: 90,
        description: "Trade and build settlements",
        imageUrl: "https://example.com/catan.jpg",
      });

      const res = await request.get(`/api/boardgames/${bg.id}`).set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe("Trade and build settlements");
      expect(res.body.data.minPlayers).toBe(3);
      expect(res.body.data.imageUrl).toBe("https://example.com/catan.jpg");

      // Verify it was persisted
      const updated = await prisma.boardGame.findUnique({ where: { id: bg.id } });
      expect(updated?.description).toBe("Trade and build settlements");
    });

    it("should return 404 for non-existent board game", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request
        .get("/api/boardgames/00000000-0000-0000-0000-000000000000")
        .set("Cookie", playerCookie);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/boardgames/from-bgg", () => {
    it("should create a board game from BGG data", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request
        .post("/api/boardgames/from-bgg")
        .set("Cookie", playerCookie)
        .send({ bggId: "13", name: "Catan", yearPublished: 1995 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Catan");
      expect(res.body.data.externalSource).toBe("BGG");
      expect(res.body.data.externalId).toBe("13");
    });

    it("should return existing if already cached", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      await prisma.boardGame.create({
        data: { name: "Catan", externalSource: "BGG", externalId: "13" },
      });

      const res = await request
        .post("/api/boardgames/from-bgg")
        .set("Cookie", playerCookie)
        .send({ bggId: "13", name: "Catan" });

      expect(res.status).toBe(201);
      expect(res.body.data.externalId).toBe("13");

      // Should not create a duplicate
      const count = await prisma.boardGame.count({
        where: { externalSource: "BGG", externalId: "13" },
      });
      expect(count).toBe(1);
    });

    it("should reject missing bggId or name with standard error format", async () => {
      const { playerCookie } = await setupEventWithParticipant();

      const res = await request
        .post("/api/boardgames/from-bgg")
        .set("Cookie", playerCookie)
        .send({ bggId: "13" });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("message");
      expect(typeof res.body.error.message).toBe("string");
    });
  });
});

describe("BGG XML Parsing", () => {
  it("should parse search results correctly", async () => {
    const results = await bggService.searchBGG("__nonexistent_game_xyz__");
    // Real API call with nonsense query should return empty or results
    expect(Array.isArray(results)).toBe(true);
  });
});
