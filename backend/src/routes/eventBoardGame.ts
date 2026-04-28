import { Router } from "express";
import { requireAuth, requireEventParticipant } from "../middleware/auth";
import * as eventBoardGameController from "../controllers/eventBoardGame";

const router = Router();

router.post(
  "/:eventId/boardgames",
  requireAuth,
  requireEventParticipant,
  eventBoardGameController.add
);

router.get(
  "/:eventId/boardgames",
  requireAuth,
  requireEventParticipant,
  eventBoardGameController.list
);

router.delete(
  "/:eventId/boardgames/:id",
  requireAuth,
  requireEventParticipant,
  eventBoardGameController.remove
);

export default router;
