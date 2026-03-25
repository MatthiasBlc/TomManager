import { Router } from "express";
import { requireAuth, requireAdmin, requireEventCreator } from "../middleware/auth";
import * as invitationController from "../controllers/invitation";

const router = Router();

// POST /api/events/:eventId/invitations — create invitation (admin only)
router.post(
  "/events/:eventId/invitations",
  requireAuth,
  requireAdmin,
  invitationController.create
);

// GET /api/events/:eventId/invitations — list invitations (event creator only)
router.get(
  "/events/:eventId/invitations",
  requireAuth,
  requireEventCreator,
  invitationController.list
);

// GET /api/invitations/:token — validate token (public)
router.get("/invitations/:token", invitationController.validate);

export default router;
