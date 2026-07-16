import { Request, Response, NextFunction } from "express";
import * as preferenceService from "../services/preference";

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const preferences = await preferenceService.updatePreferences(req.session.userId!, req.body);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
}
