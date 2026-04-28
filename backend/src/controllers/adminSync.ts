import { Request, Response, NextFunction } from "express";
import { syncAll } from "../services/adminSync";

export async function discordSync(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncAll();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
