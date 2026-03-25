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
      expect(res.body.data.tags.map((t: { name: string }) => t.name).sort()).toEqual(["dnd", "horror"]);
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
      expect(res.body.data.tags.map((t: { name: string }) => t.name).sort()).toEqual(["dnd", "horror"]);
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

      const res = await request
        .get(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie);

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

      const res = await request
        .get(`/api/events/${event.id}/tables`)
        .set("Cookie", playerCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
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

describe("Tag API", () => {
  describe("GET /api/tags?q=", () => {
    it("should return matching tags", async () => {
      const { admin, event } = await setupEventWithParticipant();

      // Create a table with tags first
      await request
        .post(`/api/events/${event.id}/tables`)
        .set("Cookie", admin.cookie)
        .send({ ...validTableData, tags: ["dnd", "horror", "dark-fantasy"] });

      const res = await request
        .get("/api/tags?q=d")
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.map((t: { name: string }) => t.name)).toContain("dnd");
      expect(res.body.data.map((t: { name: string }) => t.name)).toContain("dark-fantasy");
    });

    it("should return empty array for no match", async () => {
      const { admin } = await setupEventWithParticipant();

      const res = await request
        .get("/api/tags?q=zzz")
        .set("Cookie", admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it("should require authentication", async () => {
      const res = await request.get("/api/tags?q=d");
      expect(res.status).toBe(401);
    });
  });
});
