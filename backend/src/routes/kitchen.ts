import { Router } from "express";
import { requireAuth, requireEventParticipant, requireKitchenManager } from "../middleware/auth";
import * as kitchenController from "../controllers/kitchen";
import { validateBody, validateUUID } from "../middleware/validateBody";
import {
  updateKitchenConfigSchema,
  addKitchenChefSchema,
  addKitchenCoursesMemberSchema,
} from "../schemas/kitchen";

const router = Router();

router.get(
  "/:eventId/kitchen",
  requireAuth,
  validateUUID("eventId"),
  requireEventParticipant,
  kitchenController.getKitchen
);

router.patch(
  "/:eventId/kitchen",
  requireAuth,
  validateUUID("eventId"),
  requireKitchenManager,
  validateBody(updateKitchenConfigSchema),
  kitchenController.updateConfig
);

router.post(
  "/:eventId/kitchen/chefs",
  requireAuth,
  validateUUID("eventId"),
  requireKitchenManager,
  validateBody(addKitchenChefSchema),
  kitchenController.addChef
);

router.delete(
  "/:eventId/kitchen/chefs/:userId",
  requireAuth,
  validateUUID("eventId", "userId"),
  requireKitchenManager,
  kitchenController.removeChef
);

router.post(
  "/:eventId/kitchen/courses",
  requireAuth,
  validateUUID("eventId"),
  requireKitchenManager,
  validateBody(addKitchenCoursesMemberSchema),
  kitchenController.addCoursesMember
);

router.delete(
  "/:eventId/kitchen/courses/:userId",
  requireAuth,
  validateUUID("eventId", "userId"),
  requireKitchenManager,
  kitchenController.removeCoursesMember
);

export default router;
