import { Request, Response, NextFunction } from "express";
import * as participantService from "../services/participant";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return res.status(400).json({ error: { message: "limit must be a positive integer" } });
    }

    const participants = await participantService.listParticipants(req.params.eventId, limit);
    res.json({ data: participants });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await participantService.removeParticipant(req.params.eventId, req.params.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function leave(req: Request, res: Response, next: NextFunction) {
  try {
    await participantService.leaveEvent(req.params.eventId, req.session.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
