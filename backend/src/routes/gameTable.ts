import { Router } from "express";
import {
  requireAuth,
  requireEventParticipant,
} from "../middleware/auth";
import * as gameTableController from "../controllers/gameTable";

const router = Router();

// All table routes require auth + event participation
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

export default router;
