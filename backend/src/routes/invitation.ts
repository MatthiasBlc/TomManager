import { Router } from "express";
import { requireAuth, requireAdmin, requireEventCreator } from "../middleware/auth";
import * as invitationController from "../controllers/invitation";
import { validateBody, validateUUID } from "../middleware/validateBody";
import { createInvitationSchema } from "../schemas/invitation";

const router = Router();

// POST /api/events/:eventId/invitations — create invitation (admin only)
router.post(
  "/events/:eventId/invitations",
  requireAuth,
  validateUUID("eventId"),
  requireAdmin,
  validateBody(createInvitationSchema),
  invitationController.create
);

// GET /api/events/:eventId/invitations — list invitations (event creator only)
router.get(
  "/events/:eventId/invitations",
  requireAuth,
  validateUUID("eventId"),
  requireEventCreator,
  invitationController.list
);

// DELETE /api/events/:eventId/invitations/:invitationId — revoke invitation (event creator only)
router.delete(
  "/events/:eventId/invitations/:invitationId",
  requireAuth,
  validateUUID("eventId", "invitationId"),
  requireEventCreator,
  invitationController.revoke
);

// GET /api/invitations/:token — validate token (public)
router.get("/invitations/:token", invitationController.validate);

export default router;
