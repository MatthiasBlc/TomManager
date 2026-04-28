import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as boardGameController from "../controllers/boardGame";
import { validateBody, validateUUID } from "../middleware/validateBody";
import { createBoardGameSchema, fromBggSchema } from "../schemas/boardGame";

const router = Router();

router.get("/search", requireAuth, boardGameController.search);
router.get(
  "/:boardGameId",
  requireAuth,
  validateUUID("boardGameId"),
  boardGameController.detail,
);
router.post(
  "/",
  requireAuth,
  validateBody(createBoardGameSchema),
  boardGameController.create,
);
router.post(
  "/from-bgg",
  requireAuth,
  validateBody(fromBggSchema),
  boardGameController.findOrCreateBGG,
);

export default router;
