/**
 * Helpers de seed pour les tests E2E.
 * Appellent directement l'API REST (pas de Prisma direct) pour rester
 * independants du schema DB et tester le vrai flux reseau.
 */

const API = process.env.E2E_API_URL || "http://localhost:3001";

// Doit rester synchronise avec SEED_PARTICIPANT_PASSWORD dans
// backend/src/routes/test.ts — le backend ne renvoie plus le password
// en clair dans la reponse de /api/test/seed-participant.
const SEED_PARTICIPANT_PASSWORD = "PlayerPassword123!";

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

export interface ParticipantContext {
  userId: string;
  email: string;
  username: string;
  password: string;
  cookie: string;
}

/**
 * Cree un admin directement via l'API interne de seed (reservee aux tests).
 * Fallback : utilise l'endpoint /api/auth/signup si un token est fourni.
 */
export async function seedAdmin(): Promise<AdminContext> {
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const email = `admin_e2e_${uid}@test.com`;
  const username = `admin_e2e_${uid}`;
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

  if (!loginRes.ok) {
    throw new Error(`seedAdmin login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  // Extraire uniquement "name=value" — les attributs (Path, HttpOnly...) ne doivent pas etre envoyes dans le header Cookie
  const rawSetCookie = loginRes.headers.get("set-cookie") ?? "";
  const cookie = rawSetCookie.split(";")[0];
  if (!cookie) {
    throw new Error(
      `seedAdmin: aucun cookie de session renvoye par /api/auth/login (set-cookie="${rawSetCookie}")`
    );
  }

  // Attendre que la session soit persistee dans le store (race condition possible avec Prisma session store)
  for (let i = 0; i < 5; i++) {
    const verify = await fetch(`${API}/api/auth/me`, { headers: { Cookie: cookie } });
    if (verify.ok) break;
    await new Promise((r) => setTimeout(r, 100));
  }

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

/**
 * Active la preference `admin.kitchen` (responsable cuisine, opt-in) pour un admin
 * deja seede. Necessaire pour que les mutations cuisine (PATCH /kitchen, ajout
 * chef/courses, generation planning) passent le middleware requireKitchenManager.
 */
export async function enableKitchenManager(adminCookie: string): Promise<void> {
  const res = await fetch(`${API}/api/me/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ "admin.kitchen": true }),
  });
  if (!res.ok) throw new Error(`enableKitchenManager failed: ${res.status} ${await res.text()}`);
}

/**
 * Cree un participant pour un event via l'API de seed interne (reservee aux tests).
 */
export async function seedParticipant(eventId: string): Promise<ParticipantContext> {
  const res = await fetch(`${API}/api/test/seed-participant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });

  if (!res.ok) throw new Error(`seedParticipant failed: ${res.status}`);
  const data = await res.json();

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: data.email, password: SEED_PARTICIPANT_PASSWORD }),
    redirect: "manual",
  });
  if (!loginRes.ok) throw new Error(`seedParticipant login failed: ${loginRes.status}`);
  const rawSetCookie = loginRes.headers.get("set-cookie") ?? "";
  const cookie = rawSetCookie.split(";")[0];

  // Attendre que la session soit persistee
  for (let i = 0; i < 5; i++) {
    const verify = await fetch(`${API}/api/auth/me`, { headers: { Cookie: cookie } });
    if (verify.ok) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    userId: data.userId,
    email: data.email,
    username: data.username,
    password: SEED_PARTICIPANT_PASSWORD,
    cookie,
  };
}
