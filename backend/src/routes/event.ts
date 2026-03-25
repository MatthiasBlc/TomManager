import { Router } from "express";
import {
  requireAuth,
  requireAdmin,
  requireEventParticipant,
  requireEventCreator,
} from "../middleware/auth";
import * as eventController from "../controllers/event";

const router = Router();

router.post("/", requireAuth, requireAdmin, eventController.create);
router.get("/", requireAuth, eventController.list);
router.get("/:eventId", requireAuth, requireEventParticipant, eventController.detail);
router.patch("/:eventId", requireAuth, requireEventCreator, eventController.update);
router.delete("/:eventId", requireAuth, requireEventCreator, eventController.remove);

export default router;
