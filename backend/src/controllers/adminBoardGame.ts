import { Request, Response, NextFunction } from "express";
import * as adminBoardGameService from "../services/adminBoardGame";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const search = (req.query.search as string) || undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    if (isNaN(page) || page < 1)
      return res.status(400).json({ error: { message: "Invalid page" } });
    if (isNaN(limit) || limit < 1 || limit > 100)
      return res.status(400).json({ error: { message: "Invalid limit" } });

    const result = await adminBoardGameService.listBoardGames(search, page, limit);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const game = await adminBoardGameService.updateBoardGame(
      req.params.id,
      req.body,
    );
    res.json({ data: game });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await adminBoardGameService.deleteBoardGame(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function merge(req: Request, res: Response, next: NextFunction) {
  try {
    const { targetId } = req.body;
    if (!targetId)
      return res
        .status(400)
        .json({ error: { message: "targetId is required" } });

    const result = await adminBoardGameService.mergeBoardGames(
      req.params.id,
      targetId,
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
