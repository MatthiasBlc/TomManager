import { Request, Response, NextFunction } from "express";
import * as utensilService from "../services/utensil";

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || "";
    const utensils = await utensilService.searchUtensils(q);
    res.json({ data: utensils });
  } catch (err) {
    next(err);
  }
}
