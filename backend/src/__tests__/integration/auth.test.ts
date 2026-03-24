import { describe, it, expect } from "vitest";
import { request, createTestUser } from "../setup/testHelpers";

describe("Auth API", () => {
  describe("POST /api/auth/signup", () => {
    it("should create a new user", async () => {
      const { res } = await createTestUser();
      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user.email).toBe("test@example.com");
      expect(res.body.user.username).toBe("testuser");
    });

    it("should reject duplicate email", async () => {
      await createTestUser();
      const res = await request
        .post("/api/auth/signup")
        .send({ email: "test@example.com", username: "other", password: "Password123!" });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      await createTestUser();
      const res = await request
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "Password123!" });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("test@example.com");
    });

    it("should reject invalid credentials", async () => {
      await createTestUser();
      const res = await request
        .post("/api/auth/login")
        .send({ email: "test@example.com", password: "wrong" });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return 401 when not authenticated", async () => {
      const res = await request.get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });
});
