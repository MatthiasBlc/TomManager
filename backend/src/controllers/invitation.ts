import { Request, Response, NextFunction } from "express";
import * as invitationService from "../services/invitation";

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventId } = req.params;
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: { message: "Email is required" } });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: { message: "Invalid email format" } });
      return;
    }

    const result = await invitationService.createInvitation(
      eventId,
      email.toLowerCase(),
      req.session.userId!
    );

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function validate(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    const data = await invitationService.validateToken(token);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventId, invitationId } = req.params;
    await invitationService.revokeInvitation(invitationId, eventId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventId } = req.params;
    const invitations = await invitationService.listInvitations(eventId);
    res.json({ data: invitations });
  } catch (err) {
    next(err);
  }
}
