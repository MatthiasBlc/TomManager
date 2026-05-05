import { Request, Response, NextFunction } from "express";
import * as boardGameService from "../services/boardGame";
import { isBggAvailable, fetchBGGThing } from "../services/bgg";

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || "";
    const results = await boardGameService.searchBoardGames(q);
    res.json({ data: results, bggAvailable: isBggAvailable() });
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
    const { name, yearPublished, minPlayers, maxPlayers, playingTime, description, imageUrl } =
      req.body;
    const boardGame = await boardGameService.createBoardGame({
      name,
      yearPublished,
      minPlayers,
      maxPlayers,
      playingTime,
      description,
      imageUrl,
    });
    res.status(201).json({ data: boardGame });
  } catch (err) {
    next(err);
  }
}

export async function findOrCreateBGG(req: Request, res: Response, next: NextFunction) {
  try {
    const { bggId, name, yearPublished, minPlayers, maxPlayers, playingTime, description, imageUrl } = req.body;
    const boardGame = await boardGameService.findOrCreateFromBGG(bggId, {
      name,
      yearPublished,
      minPlayers,
      maxPlayers,
      playingTime,
      description,
      imageUrl,
    });
    res.status(201).json({ data: boardGame });
  } catch (err) {
    next(err);
  }
}

export async function bggPreview(req: Request, res: Response, next: NextFunction) {
  try {
    const { bggId } = req.params;
    const detail = await fetchBGGThing(bggId);
    if (!detail) {
      res.status(404).json({ error: { message: "BGG game not found" } });
      return;
    }
    res.json({ data: detail });
  } catch (err) {
    next(err);
  }
}
