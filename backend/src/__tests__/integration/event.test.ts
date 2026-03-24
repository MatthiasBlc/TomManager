import { describe, it, expect } from "vitest";
import {
  request,
  createTestUser,
  loginTestUser,
  createAdminUser,
  loginAdminUser,
} from "../setup/testHelpers";
import prisma from "../../util/db";

describe("Event API", () => {
  describe("POST /api/events", () => {
    it("should create an event as admin", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "Test Event",
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data.name).toBe("Test Event");
    });

    it("should auto-add creator as participant", async () => {
      await createAdminUser();
      const { cookie, res: loginRes } = await loginAdminUser();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "Test Event",
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.participations).toHaveLength(1);
      expect(res.body.data.participations[0].userId).toBe(loginRes.body.user.id);
    });

    it("should reject non-admin user", async () => {
      await createTestUser();
      const { cookie } = await loginTestUser();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "Test Event",
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated request", async () => {
      const res = await request.post("/api/events").send({
        name: "Test Event",
        startDateTime: "2026-06-01T10:00:00Z",
        endDateTime: "2026-06-01T18:00:00Z",
      });

      expect(res.status).toBe(401);
    });

    it("should reject empty name", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "",
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      expect(res.status).toBe(400);
    });

    it("should reject name over 100 characters", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "a".repeat(101),
          startDateTime: "2026-06-01T10:00:00Z",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      expect(res.status).toBe(400);
    });

    it("should reject endDateTime before startDateTime", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "Test Event",
          startDateTime: "2026-06-01T18:00:00Z",
          endDateTime: "2026-06-01T10:00:00Z",
        });

      expect(res.status).toBe(400);
    });

    it("should reject invalid dates", async () => {
      await createAdminUser();
      const { cookie } = await loginAdminUser();

      const res = await request
        .post("/api/events")
        .set("Cookie", cookie)
        .send({
          name: "Test Event",
          startDateTime: "not-a-date",
          endDateTime: "2026-06-01T18:00:00Z",
        });

      expect(res.status).toBe(400);
    });
  });
});
