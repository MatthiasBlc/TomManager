/**
 * Routes de test uniquement — montees si NODE_ENV === "test".
 * Permettent de seeder la DB pour les tests E2E sans contourner l'auth.
 */
import { Router } from "express";
import prisma from "../util/db";
import bcrypt from "bcrypt";

const router = Router();

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
    const password = "PlayerPassword123!";

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
    });

    await prisma.eventParticipation.create({
      data: { eventId, userId: user.id },
    });

    res.status(201).json({ userId: user.id, email, username, password });
  } catch (err) {
    next(err);
  }
});

export default router;
