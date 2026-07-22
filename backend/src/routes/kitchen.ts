import { Router } from "express";
import {
  requireAuth,
  requireEventParticipant,
  requireKitchenManager,
  requireMealChefOrManager,
} from "../middleware/auth";
import * as kitchenController from "../controllers/kitchen";
import * as mealController from "../controllers/meal";
import * as mealSwapController from "../controllers/mealSwap";
import { validateBody, validateUUID } from "../middleware/validateBody";
import {
  updateKitchenConfigSchema,
  addKitchenChefSchema,
  addKitchenCoursesMemberSchema,
  updateMealSchema,
  createSwapRequestSchema,
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
  "/:eventId/kitchen/generate",
  requireAuth,
  validateUUID("eventId"),
  requireKitchenManager,
  kitchenController.generate
);

// Reinitialise le planning (supprime tous les repas de l'event, rosters conserves) :
// fait reapparaitre "Generer" a la place de "Reinitialiser" cote UI.
router.post(
  "/:eventId/kitchen/reset",
  requireAuth,
  validateUUID("eventId"),
  requireKitchenManager,
  kitchenController.reset
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

// Un chef du roster reclame un creneau orphelin de la grille (le controle roster est
// fait dans le service ; requireMealChefOrManager bloquerait un non-owner ici).
router.post(
  "/:eventId/kitchen/meals/:mealId/claim",
  requireAuth,
  validateUUID("eventId", "mealId"),
  requireEventParticipant,
  mealController.claim
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

// Le manager assigne/retire un equipier tiers sur un creneau (Admin Chef point 5),
// via les memes regles metier que l'auto-inscription (joinOrMoveMeal/leaveMeal).
router.post(
  "/:eventId/kitchen/meals/:mealId/assistants/:userId",
  requireAuth,
  validateUUID("eventId", "mealId", "userId"),
  requireKitchenManager,
  mealController.assignAssistant
);

router.delete(
  "/:eventId/kitchen/meals/:mealId/assistants/:userId",
  requireAuth,
  validateUUID("eventId", "mealId", "userId"),
  requireKitchenManager,
  mealController.removeAssistant
);

// Echange de creneau entre deux chefs (confirmation mutuelle). Le controle fin (etre
// le bon chef) est fait dans le service.
router.get(
  "/:eventId/kitchen/swaps",
  requireAuth,
  validateUUID("eventId"),
  requireEventParticipant,
  mealSwapController.list
);

router.post(
  "/:eventId/kitchen/swaps",
  requireAuth,
  validateUUID("eventId"),
  requireEventParticipant,
  validateBody(createSwapRequestSchema),
  mealSwapController.create
);

router.post(
  "/:eventId/kitchen/swaps/:swapRequestId/accept",
  requireAuth,
  validateUUID("eventId", "swapRequestId"),
  requireEventParticipant,
  mealSwapController.accept
);

router.post(
  "/:eventId/kitchen/swaps/:swapRequestId/reject",
  requireAuth,
  validateUUID("eventId", "swapRequestId"),
  requireEventParticipant,
  mealSwapController.reject
);

router.post(
  "/:eventId/kitchen/swaps/:swapRequestId/cancel",
  requireAuth,
  validateUUID("eventId", "swapRequestId"),
  requireEventParticipant,
  mealSwapController.cancel
);

export default router;
