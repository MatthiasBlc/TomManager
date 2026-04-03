import { Router } from "express";
import {
  requireAuth,
  requireAdmin,
  requireEventParticipant,
  requireEventCreator,
} from "../middleware/auth";
import * as eventController from "../controllers/event";
import { validateBody, validateUUID } from "../middleware/validateBody";
import { createEventSchema, updateEventSchema } from "../schemas/event";

const router = Router();

router.post("/", requireAuth, requireAdmin, validateBody(createEventSchema), eventController.create);
router.get("/", requireAuth, eventController.list);
router.get("/:eventId", requireAuth, validateUUID("eventId"), requireEventParticipant, eventController.detail);
router.patch("/:eventId", requireAuth, validateUUID("eventId"), requireEventCreator, validateBody(updateEventSchema), eventController.update);
router.delete("/:eventId", requireAuth, validateUUID("eventId"), requireEventCreator, eventController.remove);

export default router;
