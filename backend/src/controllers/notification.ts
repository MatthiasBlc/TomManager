import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notification";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;
    const unreadOnly = req.query.unread === "true";

    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return res
        .status(400)
        .json({ error: { message: "limit must be a positive integer" } });
    }

    const result = await notificationService.getNotifications(
      req.session.userId!,
      {
        cursor,
        limit,
        unreadOnly,
      },
    );

    res.json({ data: result.data, nextCursor: result.nextCursor });
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const count = await notificationService.getUnreadCount(req.session.userId!);
    res.json({ data: { count } });
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.session.userId!,
    );
    res.json({ data: notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const count = await notificationService.markAllAsRead(req.session.userId!);
    res.json({ data: { count } });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await notificationService.deleteNotification(
      req.params.id,
      req.session.userId!,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
