import supertest from "supertest";
import app from "../../app";
import prisma from "../../util/db";

export const request = supertest(app);

/**
 * Creates a user directly in the DB (bypasses invitation flow).
 * Use this for test setup where you need a user without going through the API.
 */
export async function createTestUserDirectly(overrides?: {
  email?: string;
  username?: string;
  password?: string;
  role?: "USER" | "ADMIN";
}) {
  const bcrypt = await import("bcrypt");
  const email = overrides?.email || "test@example.com";
  const username = overrides?.username || "testuser";
  const password = overrides?.password || "Password123!";
  const role = overrides?.role || "USER";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, username, passwordHash, role },
  });

  return {
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
    email,
    username,
    password,
  };
}

/**
 * Creates an admin user directly in DB and logs them in.
 * Returns cookie for authenticated requests.
 */
export async function setupAdmin(overrides?: {
  email?: string;
  username?: string;
  password?: string;
}) {
  const email = overrides?.email || "admin@example.com";
  const username = overrides?.username || "adminuser";
  const password = overrides?.password || "Password123!";

  const { user } = await createTestUserDirectly({ email, username, password, role: "ADMIN" });

  const res = await request
    .post("/api/auth/login")
    .send({ identifier: email, password });
  const cookie = res.headers["set-cookie"];

  return { user, cookie, email, username, password };
}

/**
 * Creates an event and returns it. Requires an admin cookie.
 */
export async function createTestEvent(
  cookie: string | string[],
  overrides?: { name?: string; startDateTime?: string; endDateTime?: string }
) {
  const res = await request
    .post("/api/events")
    .set("Cookie", cookie)
    .send({
      name: overrides?.name || "Test Event",
      startDateTime: overrides?.startDateTime || "2026-06-01T10:00:00Z",
      endDateTime: overrides?.endDateTime || "2026-06-01T18:00:00Z",
    });
  return res.body.data;
}

/**
 * Creates an invitation and returns the token. Requires an admin cookie and an eventId.
 */
export async function createTestInvitation(
  cookie: string | string[],
  eventId: string,
  email: string
) {
  const res = await request
    .post(`/api/events/${eventId}/invitations`)
    .set("Cookie", cookie)
    .send({ email });
  return res.body.data;
}

/**
 * Full flow: creates admin, event, invitation, and signs up a user via the invitation.
 */
export async function signupViaInvitation(overrides?: {
  email?: string;
  username?: string;
  password?: string;
}) {
  const email = overrides?.email || "invited@example.com";
  const username = overrides?.username || "inviteduser";
  const password = overrides?.password || "Password123!";

  const { cookie: adminCookie } = await setupAdmin();
  const event = await createTestEvent(adminCookie);
  const invitation = await createTestInvitation(adminCookie, event.id, email);

  const res = await request.post("/api/auth/signup").send({
    email,
    username,
    password,
    invitationToken: invitation.invitation.token,
  });

  return { res, event, email, username, password, adminCookie };
}

// Legacy helpers kept for backward compatibility during transition
export async function createTestUser(overrides?: {
  email?: string;
  username?: string;
  password?: string;
}) {
  return createTestUserDirectly(overrides);
}

export async function createAdminUser(overrides?: {
  email?: string;
  username?: string;
  password?: string;
}) {
  return createTestUserDirectly({
    email: overrides?.email || "admin@example.com",
    username: overrides?.username || "adminuser",
    password: overrides?.password || "Password123!",
    role: "ADMIN",
  });
}

export async function loginTestUser(
  identifier = "test@example.com",
  password = "Password123!"
) {
  const res = await request.post("/api/auth/login").send({ identifier, password });
  const cookie = res.headers["set-cookie"];
  return { res, cookie };
}

export async function loginAdminUser(
  identifier = "admin@example.com",
  password = "Password123!"
) {
  const res = await request.post("/api/auth/login").send({ identifier, password });
  const cookie = res.headers["set-cookie"];
  return { res, cookie };
}
