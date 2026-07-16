import { Request, Response, NextFunction } from "express";
import * as eventService from "../services/event";
import prisma from "../util/db";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, startDateTime, endDateTime, discordRoleId } = req.body;
    const event = await eventService.createEvent(
      name,
      startDateTime,
      endDateTime,
      req.session.userId!,
      discordRoleId
    );

    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session.userId!;
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    const upcoming = req.query.upcoming === "true";
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const mineOnly = req.query.mine === "true";

    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return res.status(400).json({ error: { message: "limit must be a positive integer" } });
    }

    const events = await eventService.listEvents(userId, user!.role, upcoming, limit, mineOnly);

    res.json({ data: events });
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await eventService.getEvent(req.params.eventId);
    res.json({ data: event });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, startDateTime, endDateTime, discordRoleId } = req.body;
    const event = await eventService.updateEvent(req.params.eventId, {
      name,
      startDateTime,
      endDateTime,
      discordRoleId,
    });

    res.json({ data: event });
  } catch (err) {
    next(err);
  }
}

export async function purge(req: Request, res: Response, next: NextFunction) {
  try {
    await eventService.purgeEvent(req.params.eventId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await eventService.deleteEvent(req.params.eventId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
