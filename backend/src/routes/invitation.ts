import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import * as invitationController from "../controllers/invitation";

const router = Router();

// POST /api/events/:eventId/invitations — create invitation (admin only)
router.post(
  "/events/:eventId/invitations",
  requireAuth,
  requireAdmin,
  invitationController.create
);

// GET /api/invitations/:token — validate token (public)
router.get("/invitations/:token", invitationController.validate);

export default router;
