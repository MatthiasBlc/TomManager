import { Request, Response, NextFunction } from "express";
import * as mealSwapService from "../services/mealSwap";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealSwapService.createSwapRequest(
      req.params.eventId,
      req.session.userId!,
      req.body.targetMealId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function moveToOrphan(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealSwapService.moveToOrphanMeal(
      req.params.eventId,
      req.session.userId!,
      req.params.mealId
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealSwapService.listSwapRequests(req.params.eventId, req.session.userId!);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function accept(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealSwapService.acceptSwapRequest(
      req.params.eventId,
      req.params.swapRequestId,
      req.session.userId!
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealSwapService.rejectSwapRequest(
      req.params.eventId,
      req.params.swapRequestId,
      req.session.userId!
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await mealSwapService.cancelSwapRequest(
      req.params.eventId,
      req.params.swapRequestId,
      req.session.userId!
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
