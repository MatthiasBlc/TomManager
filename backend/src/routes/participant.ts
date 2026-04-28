import { Router } from "express";
import { requireAuth, requireEventParticipant, requireEventCreator } from "../middleware/auth";
import * as participantController from "../controllers/participant";

const router = Router();

// GET /api/events/:eventId/participants
router.get(
  "/:eventId/participants",
  requireAuth,
  requireEventParticipant,
  participantController.list
);

// DELETE /api/events/:eventId/participants/me (must be before /:userId)
router.delete(
  "/:eventId/participants/me",
  requireAuth,
  requireEventParticipant,
  participantController.leave
);

// DELETE /api/events/:eventId/participants/:userId
router.delete(
  "/:eventId/participants/:userId",
  requireAuth,
  requireEventCreator,
  participantController.remove
);

export default router;
