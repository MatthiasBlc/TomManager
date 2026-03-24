import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import * as eventController from "../controllers/event";

const router = Router();

router.post("/", requireAuth, requireAdmin, eventController.create);

export default router;
