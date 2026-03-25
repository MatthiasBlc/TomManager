import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as tagController from "../controllers/tag";

const router = Router();

router.get("/", requireAuth, tagController.search);

export default router;
