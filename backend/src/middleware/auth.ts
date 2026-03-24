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
