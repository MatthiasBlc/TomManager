import supertest from "supertest";
import app from "../../app";
import prisma from "../../util/db";

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

export async function createAdminUser(overrides?: {
  email?: string;
  username?: string;
  password?: string;
}) {
  const { res, ...data } = await createTestUser({
    email: overrides?.email || "admin@example.com",
    username: overrides?.username || "adminuser",
    password: overrides?.password || "Password123!",
  });

  await prisma.user.update({
    where: { id: res.body.user.id },
    data: { role: "ADMIN" },
  });

  return { res, ...data };
}

export async function loginAdminUser(
  email = "admin@example.com",
  password = "Password123!"
) {
  const res = await request.post("/api/auth/login").send({ email, password });
  const cookie = res.headers["set-cookie"];
  return { res, cookie };
}
