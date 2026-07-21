import { Router } from "express";
import {
  requireAuth,
  requireEventParticipant,
  requireKitchenManager,
  requireMealChefOrManager,
} from "../middleware/auth";
import * as kitchenController from "../controllers/kitchen";
import * as mealController from "../controllers/meal";
import { validateBody, validateUUID } from "../middleware/validateBody";
import {
  updateKitchenConfigSchema,
  addKitchenChefSchema,
  addKitchenCoursesMemberSchema,
  createMealSchema,
  updateMealSchema,
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

router.post(
  "/:eventId/kitchen/meals",
  requireAuth,
  validateUUID("eventId"),
  requireEventParticipant,
  validateBody(createMealSchema),
  mealController.create
);

router.patch(
  "/:eventId/kitchen/meals/:mealId",
  requireAuth,
  validateUUID("eventId", "mealId"),
  requireMealChefOrManager,
  validateBody(updateMealSchema),
  mealController.update
);

router.delete(
  "/:eventId/kitchen/meals/:mealId",
  requireAuth,
  validateUUID("eventId", "mealId"),
  requireMealChefOrManager,
  mealController.remove
);

router.post(
  "/:eventId/kitchen/meals/:mealId/assistants",
  requireAuth,
  validateUUID("eventId", "mealId"),
  requireEventParticipant,
  mealController.joinOrMove
);

router.delete(
  "/:eventId/kitchen/meals/:mealId/assistants/me",
  requireAuth,
  validateUUID("eventId", "mealId"),
  requireEventParticipant,
  mealController.leave
);

export default router;
