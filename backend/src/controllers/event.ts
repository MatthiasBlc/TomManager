import { Request, Response, NextFunction } from "express";
import * as eventService from "../services/event";
import prisma from "../util/db";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, startDateTime, endDateTime } = req.body;
    const event = await eventService.createEvent(
      name,
      startDateTime,
      endDateTime,
      req.session.userId!
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
    const events = await eventService.listEvents(userId, user!.role, upcoming);

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
    const { name, startDateTime, endDateTime } = req.body;
    const event = await eventService.updateEvent(req.params.eventId, {
      name,
      startDateTime,
      endDateTime,
    });

    res.json({ data: event });
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
