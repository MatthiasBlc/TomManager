import { Request, Response, NextFunction } from "express";
import * as gameTableService from "../services/gameTable";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, tags } = req.body;
    const table = await gameTableService.createTable(
      req.params.eventId,
      req.session.userId!,
      { title, pitch, triggers, comments, maxPlayers, startDateTime, endDateTime, tags }
    );
    res.status(201).json({ data: table });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const tables = await gameTableService.listTables(
      req.params.eventId,
      req.session.userId!
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
