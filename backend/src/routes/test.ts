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

export default router;
