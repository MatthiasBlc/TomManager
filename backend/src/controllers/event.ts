import { Request, Response, NextFunction } from "express";
import * as eventService from "../services/event";

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
