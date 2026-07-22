import { Request, Response, NextFunction } from "express";
import * as assistantSwapService from "../services/assistantSwap";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await assistantSwapService.createAssistantSwapRequest(
      req.params.eventId,
      req.session.userId!,
      req.body.targetMealId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await assistantSwapService.listAssistantSwapRequests(
      req.params.eventId,
      req.session.userId!
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function accept(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await assistantSwapService.acceptAssistantSwapRequest(
      req.params.eventId,
      req.params.assistantSwapRequestId,
      req.session.userId!
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await assistantSwapService.cancelAssistantSwapRequest(
      req.params.eventId,
      req.params.assistantSwapRequestId,
      req.session.userId!
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
