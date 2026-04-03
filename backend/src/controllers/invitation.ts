import { Request, Response, NextFunction } from "express";
import * as invitationService from "../services/invitation";
import prisma from "../util/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventId } = req.params;
    const { identifier } = req.body;

    let email: string;

    if (EMAIL_REGEX.test(identifier.trim())) {
      email = identifier.trim().toLowerCase();
    } else {
      // Resoudre le username en email
      const user = await prisma.user.findFirst({
        where: { username: identifier.trim(), deletedAt: null },
        select: { email: true },
      });
      if (!user) {
        res.status(404).json({ error: { message: `Aucun utilisateur avec le pseudo "${identifier.trim()}"` } });
        return;
      }
      email = user.email;
    }

    const result = await invitationService.createInvitation(
      eventId,
      email,
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
