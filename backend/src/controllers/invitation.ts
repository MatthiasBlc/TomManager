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
        res
          .status(404)
          .json({ error: { message: `Aucun utilisateur avec le pseudo "${identifier.trim()}"` } });
        return;
      }
      email = user.email;
    }

    const result = await invitationService.createInvitation(eventId, email, req.session.userId!);

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
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const cursor = req.query.cursor as string | undefined;

    if (limit !== undefined && (isNaN(limit) || limit < 1)) {
      return res.status(400).json({ error: { message: "limit must be a positive integer" } });
    }

    const result = await invitationService.listInvitations(eventId, { limit, cursor });
    res.json({ data: result.data, nextCursor: result.nextCursor });
  } catch (err) {
    next(err);
  }
}
