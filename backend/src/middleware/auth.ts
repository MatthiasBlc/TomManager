import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import prisma from "../util/db";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: { message: "Authentication required" } });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.session.userId, deletedAt: null },
    });

    if (!user || user.role !== "ADMIN") {
      res.status(403).json({ error: { message: "Admin access required" } });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function requireEventParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.session.userId!;

    const participation = await prisma.eventParticipation.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!participation) {
      // Allow ADMIN access even without participation
      const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
      });
      if (!user || user.role !== "ADMIN") {
        res.status(403).json({ error: { message: "Event participation required" } });
        return;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function requireTableGMOrAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const tableId = req.params.tableId;
    const userId = req.session.userId!;

    const table = await prisma.gameTable.findUnique({
      where: { id: tableId },
    });

    if (!table) {
      res.status(404).json({ error: { message: "Table not found" } });
      return;
    }

    if (table.createdBy === userId) {
      next();
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || user.role !== "ADMIN") {
      res.status(403).json({
        error: {
          message: "Only the table GM or an admin can perform this action",
        },
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

// Verifie ADMIN + preference admin.kitchen ; leve un createError sinon (a catcher par l'appelant).
export async function assertKitchenManager(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user || user.role !== "ADMIN") {
    throw createError(403, "Admin access required", { code: "ADMIN_REQUIRED" });
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: "admin.kitchen" } },
  });
  if (!pref?.value) {
    throw createError(403, "Kitchen manager preference required", {
      code: "KITCHEN_MANAGER_REQUIRED",
    });
  }
}

// Responsable cuisine : ADMIN ayant active la preference admin.kitchen (opt-in profil).
export async function requireKitchenManager(req: Request, res: Response, next: NextFunction) {
  try {
    await assertKitchenManager(req.session.userId!);
    next();
  } catch (err) {
    next(err);
  }
}

// Chef proprietaire du repas ou responsable cuisine.
export async function requireMealChefOrManager(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session.userId!;
    const meal = await prisma.meal.findUnique({ where: { id: req.params.mealId } });
    if (!meal) {
      throw createError(404, "Meal not found", { code: "MEAL_NOT_FOUND" });
    }

    if (meal.chefUserId === userId) {
      next();
      return;
    }

    await assertKitchenManager(userId);
    next();
  } catch (err) {
    next(err);
  }
}

// Verifie ADMIN + preference admin.events ; leve un createError sinon (a catcher par l'appelant).
// Etre le createur de l'event ne donne aucun droit particulier : createur ou non, un
// admin doit avoir active admin.events pour gerer un event (aligne sur assertKitchenManager).
export async function assertEventManager(userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user || user.role !== "ADMIN") {
    throw createError(403, "Admin access required", { code: "ADMIN_REQUIRED" });
  }

  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId, key: "admin.events" } },
  });
  if (!pref?.value) {
    throw createError(403, "Event manager preference required", {
      code: "EVENT_MANAGER_REQUIRED",
    });
  }
}

// Gestion des events : ADMIN ayant active la preference admin.events (opt-in profil).
export async function requireEventManager(req: Request, res: Response, next: NextFunction) {
  try {
    await assertEventManager(req.session.userId!);
    next();
  } catch (err) {
    next(err);
  }
}
