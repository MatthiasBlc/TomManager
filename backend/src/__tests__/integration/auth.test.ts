import { describe, it, expect } from "vitest";
import { request, createTestUserDirectly, loginTestUser } from "../setup/testHelpers";

describe("Auth API", () => {
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

    it("should login normally", async () => {
      await createTestUserDirectly({ email: "user@example.com", username: "testuser" });

      const res = await request.post("/api/auth/login").send({
        identifier: "user@example.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
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
  });
});
