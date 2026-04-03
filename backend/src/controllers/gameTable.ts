import { Request, Response, NextFunction } from "express";
import * as gameTableService from "../services/gameTable";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, type, gmIsPlayer, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, tags } = req.body;
    const table = await gameTableService.createTable(
      req.params.eventId,
      req.session.userId!,
      { title, type, gmIsPlayer, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, tags }
    );
    res.status(201).json({ data: table });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return res.status(400).json({ error: { message: "limit must be a positive integer" } });
    }

    const tables = await gameTableService.listTables(
      req.params.eventId,
      req.session.userId!,
      limit
    );
    res.json({ data: tables });
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const table = await gameTableService.getTable(req.params.tableId);
    res.json({ data: table });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, gmIsPlayer, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, tags } = req.body;
    const table = await gameTableService.updateTable(req.params.tableId, {
      title, gmIsPlayer, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, tags,
    }, req.session.userId!);
    res.json({ data: table });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await gameTableService.deleteTable(req.params.tableId, req.session.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function join(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await gameTableService.joinTable(
      req.params.tableId,
      req.session.userId!
    );
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function leave(req: Request, res: Response, next: NextFunction) {
  try {
    await gameTableService.leaveTable(
      req.params.tableId,
      req.session.userId!
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function kick(req: Request, res: Response, next: NextFunction) {
  try {
    await gameTableService.kickPlayer(
      req.params.tableId,
      req.params.userId
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
