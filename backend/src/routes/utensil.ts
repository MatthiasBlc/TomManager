import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as utensilController from "../controllers/utensil";

const router = Router();

router.get("/utensils", requireAuth, utensilController.search);

export default router;
