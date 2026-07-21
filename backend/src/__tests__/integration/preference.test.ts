import { describe, it, expect } from "vitest";
import { request, setupAdmin, createTestUserDirectly, loginTestUser } from "../setup/testHelpers";

describe("Preferences API", () => {
  describe("GET /api/auth/me", () => {
    it("includes all preference keys defaulting to false", async () => {
      const { cookie } = await setupAdmin();

      const res = await request.get("/api/auth/me").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.user.preferences).toEqual({
        "admin.events": false,
        "admin.tables": false,
        "admin.games": false,
        "admin.kitchen": false,
        "beta.pdfExport": false,
        "beta.gameDb": false,
      });
    });
  });

  describe("PATCH /api/me/preferences", () => {
    it("requires authentication", async () => {
      const res = await request.patch("/api/me/preferences").send({ "admin.events": true });
      expect(res.status).toBe(401);
    });

    it("updates preferences for an admin and returns the full map", async () => {
      const { cookie } = await setupAdmin();

      const res = await request
        .patch("/api/me/preferences")
        .set("Cookie", cookie)
        .send({ "admin.events": true, "beta.pdfExport": true });

      expect(res.status).toBe(200);
      expect(res.body.preferences).toEqual({
        "admin.events": true,
        "admin.tables": false,
        "admin.games": false,
        "admin.kitchen": false,
        "beta.pdfExport": true,
        "beta.gameDb": false,
      });
    });

    it("persists preferences across /me calls (upsert)", async () => {
      const { cookie } = await setupAdmin();

      await request
        .patch("/api/me/preferences")
        .set("Cookie", cookie)
        .send({ "admin.tables": true });
      await request
        .patch("/api/me/preferences")
        .set("Cookie", cookie)
        .send({ "admin.tables": false, "admin.games": true });

      const res = await request.get("/api/auth/me").set("Cookie", cookie);

      expect(res.body.user.preferences["admin.tables"]).toBe(false);
      expect(res.body.user.preferences["admin.games"]).toBe(true);
    });

    it("rejects admin/beta keys for a non-admin user", async () => {
      await createTestUserDirectly();
      const { cookie } = await loginTestUser();

      const res = await request
        .patch("/api/me/preferences")
        .set("Cookie", cookie)
        .send({ "admin.events": true });

      expect(res.status).toBe(403);
    });

    it("rejects unknown preference keys", async () => {
      const { cookie } = await setupAdmin();

      const res = await request
        .patch("/api/me/preferences")
        .set("Cookie", cookie)
        .send({ "admin.unknown": true });

      expect(res.status).toBe(400);
    });

    it("rejects non-boolean values", async () => {
      const { cookie } = await setupAdmin();

      const res = await request
        .patch("/api/me/preferences")
        .set("Cookie", cookie)
        .send({ "admin.events": "yes" });

      expect(res.status).toBe(400);
    });

    it("rejects an empty body", async () => {
      const { cookie } = await setupAdmin();

      const res = await request.patch("/api/me/preferences").set("Cookie", cookie).send({});

      expect(res.status).toBe(400);
    });
  });
});
