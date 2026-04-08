import { Request, Response, NextFunction } from "express";
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
      res
        .status(403)
        .json({ error: { message: "Only the table GM or an admin can perform this action" } });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function requireEventCreator(req: Request, res: Response, next: NextFunction) {
  try {
    const eventId = req.params.eventId;
    const userId = req.session.userId!;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      res.status(404).json({ error: { message: "Event not found" } });
      return;
    }

    if (event.createdBy === userId) {
      next();
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || user.role !== "ADMIN") {
      res
        .status(403)
        .json({ error: { message: "Only the event creator or an admin can perform this action" } });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
