import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { discordSync } from "../controllers/adminSync";

const router = Router();

router.post("/discord/sync", requireAuth, requireAdmin, discordSync);

export default router;
