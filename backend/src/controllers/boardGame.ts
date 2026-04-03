import { Request, Response, NextFunction } from "express";
import * as boardGameService from "../services/boardGame";

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || "";
    const results = await boardGameService.searchBoardGames(q);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const boardGame = await boardGameService.getBoardGame(req.params.boardGameId);
    res.json({ data: boardGame });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, yearPublished, minPlayers, maxPlayers, playingTime, description, imageUrl } = req.body;
    const boardGame = await boardGameService.createBoardGame({
      name, yearPublished, minPlayers, maxPlayers, playingTime, description, imageUrl,
    });
    res.status(201).json({ data: boardGame });
  } catch (err) {
    next(err);
  }
}

export async function findOrCreateBGG(req: Request, res: Response, next: NextFunction) {
  try {
    const { bggId, name, yearPublished } = req.body;
    const boardGame = await boardGameService.findOrCreateFromBGG(bggId, name, yearPublished);
    res.status(201).json({ data: boardGame });
  } catch (err) {
    next(err);
  }
}
