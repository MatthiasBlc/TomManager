import { Router } from "express";
import {
  requireAuth,
  requireEventParticipant,
  requireTableGMOrAdmin,
} from "../middleware/auth";
import * as gameTableController from "../controllers/gameTable";
import { validateBody, validateUUID } from "../middleware/validateBody";
import {
  createTableSchema,
  updateTableSchema,
  setStatusSchema,
} from "../schemas/gameTable";

const router = Router();

// Table CRUD
router.post(
  "/:eventId/tables",
  requireAuth,
  validateUUID("eventId"),
  requireEventParticipant,
  validateBody(createTableSchema),
  gameTableController.create,
);

router.get(
  "/:eventId/tables",
  requireAuth,
  validateUUID("eventId"),
  requireEventParticipant,
  gameTableController.list,
);

router.get(
  "/:eventId/tables/:tableId",
  requireAuth,
  validateUUID("eventId", "tableId"),
  requireEventParticipant,
  gameTableController.detail,
);

router.patch(
  "/:eventId/tables/:tableId",
  requireAuth,
  validateUUID("eventId", "tableId"),
  requireTableGMOrAdmin,
  validateBody(updateTableSchema),
  gameTableController.update,
);

router.delete(
  "/:eventId/tables/:tableId",
  requireAuth,
  validateUUID("eventId", "tableId"),
  requireTableGMOrAdmin,
  gameTableController.remove,
);

// Table participation
router.post(
  "/:eventId/tables/:tableId/join",
  requireAuth,
  validateUUID("eventId", "tableId"),
  requireEventParticipant,
  gameTableController.join,
);

router.delete(
  "/:eventId/tables/:tableId/leave",
  requireAuth,
  validateUUID("eventId", "tableId"),
  gameTableController.leave,
);

router.delete(
  "/:eventId/tables/:tableId/participants/:userId",
  requireAuth,
  validateUUID("eventId", "tableId", "userId"),
  requireTableGMOrAdmin,
  gameTableController.kick,
);

router.patch(
  "/:eventId/tables/:tableId/participants/:userId/status",
  requireAuth,
  validateUUID("eventId", "tableId", "userId"),
  requireTableGMOrAdmin,
  validateBody(setStatusSchema),
  gameTableController.setStatus,
);

export default router;
