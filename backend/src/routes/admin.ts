import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { discordSync } from "../controllers/adminSync";
import * as adminBoardGame from "../controllers/adminBoardGame";
import { validateBody, validateUUID } from "../middleware/validateBody";
import { updateBoardGameAdminSchema, mergeSchema } from "../schemas/boardGame";

const router = Router();

router.post("/discord/sync", requireAuth, requireAdmin, discordSync);

router.get("/boardgames", requireAuth, requireAdmin, adminBoardGame.list);
router.patch(
  "/boardgames/:id",
  requireAuth,
  requireAdmin,
  validateUUID("id"),
  validateBody(updateBoardGameAdminSchema),
  adminBoardGame.update
);
router.delete(
  "/boardgames/:id",
  requireAuth,
  requireAdmin,
  validateUUID("id"),
  adminBoardGame.remove
);
router.post(
  "/boardgames/:id/merge",
  requireAuth,
  requireAdmin,
  validateUUID("id"),
  validateBody(mergeSchema),
  adminBoardGame.merge
);

export default router;
