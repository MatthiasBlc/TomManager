import { Request, Response, NextFunction } from "express";
import * as kitchenService from "../services/kitchen";
import * as kitchenPlanningService from "../services/kitchenPlanning";

export async function getKitchen(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenService.getKitchenView(req.params.eventId, req.session.userId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenService.updateConfig(
      req.params.eventId,
      req.session.userId!,
      req.body
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function addChef(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenService.addManualChef(
      req.params.eventId,
      req.session.userId!,
      req.body.userId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function removeChef(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenService.removeChef(
      req.params.eventId,
      req.session.userId!,
      req.params.userId
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function addCoursesMember(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenService.addCoursesMember(
      req.params.eventId,
      req.session.userId!,
      req.body.userId
    );
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function removeCoursesMember(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenService.removeCoursesMember(
      req.params.eventId,
      req.session.userId!,
      req.params.userId
    );
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function generate(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenPlanningService.generatePlanning(req.params.eventId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function reset(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await kitchenPlanningService.resetPlanning(req.params.eventId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
