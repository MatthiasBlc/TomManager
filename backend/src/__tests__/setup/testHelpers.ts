import supertest from "supertest";
import app from "../../app";

export const request = supertest(app);

export async function createTestUser(overrides?: {
  email?: string;
  username?: string;
  password?: string;
}) {
  const data = {
    email: overrides?.email || "test@example.com",
    username: overrides?.username || "testuser",
    password: overrides?.password || "Password123!",
  };

  const res = await request.post("/api/auth/signup").send(data);
  return { res, ...data };
}

export async function loginTestUser(email = "test@example.com", password = "Password123!") {
  const res = await request.post("/api/auth/login").send({ email, password });
  const cookie = res.headers["set-cookie"];
  return { res, cookie };
}
