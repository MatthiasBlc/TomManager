import { describe, it, expect } from "vitest";
import { request, setupAdmin, createTestEvent } from "../setup/testHelpers";

describe("Validation Zod — 400 sur donnees invalides", () => {
  // ──────────────── AUTH ────────────────
  describe("POST /api/auth/login", () => {
    it("rejette un body vide", async () => {
      const res = await request.post("/api/auth/login").send({});
      expect(res.status).toBe(400);
    });

    it("rejette un identifier vide", async () => {
      const res = await request.post("/api/auth/login").send({ identifier: "", password: "abc" });
      expect(res.status).toBe(400);
    });
  });

  // ──────────────── EVENTS ────────────────
  describe("POST /api/events", () => {
    it("rejette un name manquant", async () => {
      const { cookie } = await setupAdmin();
      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({ startDateTime: new Date().toISOString(), endDateTime: new Date().toISOString() });
      expect(res.status).toBe(400);
    });

    it("rejette une date invalide", async () => {
      const { cookie } = await setupAdmin();
      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({ name: "Event", startDateTime: "not-a-date", endDateTime: "not-a-date" });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/events/:eventId", () => {
    it("rejette un eventId non-UUID", async () => {
      const { cookie } = await setupAdmin();
      const res = await request
        .patch("/api/events/not-a-uuid")
        .set("Cookie", cookie)
        .send({ name: "New name" });
      expect(res.status).toBe(400);
    });
  });

  // ──────────────── GAME TABLES ────────────────
  describe("POST /api/events/:eventId/tables", () => {
    it("rejette un title manquant", async () => {
      const { cookie } = await setupAdmin();
      const event = await createTestEvent(cookie);
      const start = new Date(event.startDateTime);
      const end = new Date(start.getTime() + 3600000);
      const res = await request.post(`/api/events/${event.id}/tables`).set("Cookie", cookie).send({
        maxPlayers: 4,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      });
      expect(res.status).toBe(400);
    });

    it("rejette maxPlayers hors limites", async () => {
      const { cookie } = await setupAdmin();
      const event = await createTestEvent(cookie);
      const start = new Date(event.startDateTime);
      const end = new Date(start.getTime() + 3600000);
      const res = await request.post(`/api/events/${event.id}/tables`).set("Cookie", cookie).send({
        title: "Table",
        maxPlayers: 99,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      });
      expect(res.status).toBe(400);
    });

    it("rejette un type invalide", async () => {
      const { cookie } = await setupAdmin();
      const event = await createTestEvent(cookie);
      const start = new Date(event.startDateTime);
      const end = new Date(start.getTime() + 3600000);
      const res = await request.post(`/api/events/${event.id}/tables`).set("Cookie", cookie).send({
        title: "Table",
        type: "INVALID",
        maxPlayers: 4,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
      });
      expect(res.status).toBe(400);
    });

    it("rejette un eventId non-UUID", async () => {
      const { cookie } = await setupAdmin();
      const res = await request
        .post("/api/events/not-a-uuid/tables")
        .set("Cookie", cookie)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/events/:eventId/tables/:tableId", () => {
    it("rejette un tableId non-UUID", async () => {
      const { cookie } = await setupAdmin();
      const event = await createTestEvent(cookie);
      const res = await request
        .patch(`/api/events/${event.id}/tables/not-a-uuid`)
        .set("Cookie", cookie)
        .send({ title: "New title" });
      expect(res.status).toBe(400);
    });
  });

  // ──────────────── BOARD GAMES ────────────────
  describe("POST /api/boardgames", () => {
    it("rejette un name manquant", async () => {
      const { cookie } = await setupAdmin();
      const res = await request
        .post("/api/boardgames")
        .set("Cookie", cookie)
        .send({ yearPublished: 2020 });
      expect(res.status).toBe(400);
    });

    it("rejette une imageUrl invalide", async () => {
      const { cookie } = await setupAdmin();
      const res = await request
        .post("/api/boardgames")
        .set("Cookie", cookie)
        .send({ name: "My Game", imageUrl: "not-a-url" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/boardgames/from-bgg", () => {
    it("rejette bggId manquant", async () => {
      const { cookie } = await setupAdmin();
      const res = await request
        .post("/api/boardgames/from-bgg")
        .set("Cookie", cookie)
        .send({ name: "Game" });
      expect(res.status).toBe(400);
    });
  });

});
