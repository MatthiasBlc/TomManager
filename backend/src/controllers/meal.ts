import { Request, Response, NextFunction } from "express";
import * as mealService from "../services/meal";

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealService.updateMeal(
      req.params.eventId,
      req.params.mealId,
      req.session.userId!,
      req.body
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await mealService.deleteMeal(req.params.eventId, req.params.mealId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function claim(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealService.claimMeal(
      req.params.eventId,
      req.params.mealId,
      req.session.userId!
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function joinOrMove(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealService.joinOrMoveMeal(
      req.params.eventId,
      req.params.mealId,
      req.session.userId!
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function leave(req: Request, res: Response, next: NextFunction) {
  try {
    await mealService.leaveMeal(req.params.eventId, req.params.mealId, req.session.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Le manager assigne/retire un equipier tiers sur un creneau (Admin Chef point 5),
// en reutilisant les memes regles que l'auto-inscription (capacite, exclusivite de
// role, un seul repas par personne sur l'event).
export async function assignAssistant(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealService.joinOrMoveMeal(
      req.params.eventId,
      req.params.mealId,
      req.params.userId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function removeAssistant(req: Request, res: Response, next: NextFunction) {
  try {
    await mealService.leaveMeal(req.params.eventId, req.params.mealId, req.params.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
