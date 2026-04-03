/**
 * Helpers de seed pour les tests E2E.
 * Appellent directement l'API REST (pas de Prisma direct) pour rester
 * independants du schema DB et tester le vrai flux reseau.
 */

const API = process.env.E2E_API_URL || "http://localhost:3001";

export interface AdminContext {
  cookie: string;
  userId: string;
  username: string;
  email: string;
  password: string;
}

export interface EventContext {
  id: string;
  name: string;
  startDateTime: string;
  endDateTime: string;
}

export interface InvitationContext {
  token: string;
  inviteLink: string;
}

/**
 * Cree un admin directement via l'API interne de seed (reservee aux tests).
 * Fallback : utilise l'endpoint /api/auth/signup si un token est fourni.
 */
export async function seedAdmin(): Promise<AdminContext> {
  const email = `admin_e2e_${Date.now()}@test.com`;
  const username = `admin_e2e_${Date.now()}`;
  const password = "AdminPassword123!";

  // Endpoint de seed interne (disponible uniquement en NODE_ENV=test)
  const res = await fetch(`${API}/api/test/seed-admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });

  if (!res.ok) {
    throw new Error(`seed-admin failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();

  // Login pour obtenir le cookie de session
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
    redirect: "manual",
  });

  const cookie = loginRes.headers.get("set-cookie") ?? "";

  return { cookie, userId: data.userId, username, email, password };
}

export async function seedEvent(adminCookie: string): Promise<EventContext> {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(22, 0, 0, 0);

  const res = await fetch(`${API}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      name: `E2E Event ${Date.now()}`,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
    }),
  });

  if (!res.ok) throw new Error(`seedEvent failed: ${res.status}`);
  const data = await res.json();
  return data.data;
}

export async function seedInvitation(
  adminCookie: string,
  eventId: string,
  email: string
): Promise<InvitationContext> {
  const res = await fetch(`${API}/api/events/${eventId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ identifier: email }),
  });

  if (!res.ok) throw new Error(`seedInvitation failed: ${res.status}`);
  const data = await res.json();
  return { token: data.data.invitation.token, inviteLink: data.data.inviteLink };
}
