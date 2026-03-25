import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as boardGameController from "../controllers/boardGame";

const router = Router();

router.get("/search", requireAuth, boardGameController.search);
router.get("/:boardGameId", requireAuth, boardGameController.detail);
router.post("/", requireAuth, boardGameController.create);
router.post("/from-bgg", requireAuth, boardGameController.findOrCreateBGG);

export default router;
