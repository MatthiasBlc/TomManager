import { Request, Response, NextFunction } from "express";
import * as tagService from "../services/tag";

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || "";
    const tags = await tagService.searchTags(q);
    res.json({ data: tags });
  } catch (err) {
    next(err);
  }
}
