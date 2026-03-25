import { Router } from "express";
import {
  requireAuth,
  requireEventParticipant,
  requireTableGMOrAdmin,
} from "../middleware/auth";
import * as gameTableController from "../controllers/gameTable";

const router = Router();

// Table CRUD
router.post(
  "/:eventId/tables",
  requireAuth,
  requireEventParticipant,
  gameTableController.create
);

router.get(
  "/:eventId/tables",
  requireAuth,
  requireEventParticipant,
  gameTableController.list
);

router.get(
  "/:eventId/tables/:tableId",
  requireAuth,
  requireEventParticipant,
  gameTableController.detail
);

router.patch(
  "/:eventId/tables/:tableId",
  requireAuth,
  requireTableGMOrAdmin,
  gameTableController.update
);

router.delete(
  "/:eventId/tables/:tableId",
  requireAuth,
  requireTableGMOrAdmin,
  gameTableController.remove
);

// Table participation
router.post(
  "/:eventId/tables/:tableId/join",
  requireAuth,
  requireEventParticipant,
  gameTableController.join
);

router.delete(
  "/:eventId/tables/:tableId/leave",
  requireAuth,
  gameTableController.leave
);

router.delete(
  "/:eventId/tables/:tableId/participants/:userId",
  requireAuth,
  requireTableGMOrAdmin,
  gameTableController.kick
);

export default router;
