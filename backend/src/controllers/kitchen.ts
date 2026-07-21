import { Request, Response, NextFunction } from "express";
import * as kitchenService from "../services/kitchen";

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
