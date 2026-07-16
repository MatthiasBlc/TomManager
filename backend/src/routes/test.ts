/**
 * Routes de test uniquement — montees si NODE_ENV === "test".
 * Permettent de seeder la DB pour les tests E2E sans contourner l'auth.
 */
import { Router } from "express";
import prisma from "../util/db";
import bcrypt from "bcrypt";

// Mot de passe partage pour les participants seeds. Constant cote tests : les
// fixtures E2E le connaissent, inutile donc de le renvoyer dans la reponse.
export const SEED_PARTICIPANT_PASSWORD = "PlayerPassword123!";

const router = Router();

// Double-garde runtime : meme si les routes sont montees par erreur en prod
// (ex: ENABLE_TEST_ROUTES mal configure), on refuse categoriquement en prod.
router.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).end();
    return;
  }
  next();
});

// POST /api/test/seed-admin — cree un user ADMIN directement en DB
router.post("/seed-admin", async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      res.status(400).json({ error: { message: "email, username, password requis" } });
      return;
    }

    // Nettoyer un eventuel user existant avec ce email/username (idempotent)
    await prisma.user.deleteMany({
      where: { OR: [{ email }, { username }] },
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, username, passwordHash, role: "ADMIN" },
    });

    // Les droits admin sont opt-in (toggles) : on les active pour que les
    // parcours E2E admin (creation d'event, moderation) restent possibles.
    await prisma.userPreference.createMany({
      data: ["admin.events", "admin.tables", "admin.games"].map((key) => ({
        userId: user.id,
        key,
        value: true,
      })),
    });

    res.status(201).json({ userId: user.id });
  } catch (err) {
    next(err);
  }
});

// POST /api/test/seed-participant — cree un user USER et l'ajoute comme participant a un event
router.post("/seed-participant", async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      res.status(400).json({ error: { message: "eventId requis" } });
      return;
    }

    const ts = Date.now();
    const email = `player_e2e_${ts}@test.com`;
    const username = `player_e2e_${ts}`;

    const passwordHash = await bcrypt.hash(SEED_PARTICIPANT_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    await prisma.eventParticipation.create({
      data: { eventId, userId: user.id },
    });

    // Pas de password dans la reponse : la fixture E2E connait la constante.
    res.status(201).json({ userId: user.id, email, username });
  } catch (err) {
    next(err);
  }
});

export default router;
