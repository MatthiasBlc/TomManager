import { Request, Response, NextFunction } from "express";
import * as eventBoardGameService from "../services/eventBoardGame";
import prisma from "../util/db";

export async function add(req: Request, res: Response, next: NextFunction) {
  try {
    const { boardGameId } = req.body;
    if (!boardGameId) {
      return res.status(400).json({ error: "boardGameId is required" });
    }
    const entry = await eventBoardGameService.addToEvent(
      req.params.eventId,
      boardGameId,
      req.session.userId!
    );
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const entries = await eventBoardGameService.listByEvent(req.params.eventId);
    res.json({ data: entries });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId! } });
    await eventBoardGameService.removeFromEvent(
      req.params.id,
      req.session.userId!,
      user?.role || "USER"
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
