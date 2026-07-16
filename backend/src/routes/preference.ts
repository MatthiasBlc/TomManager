import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validateBody";
import { updatePreferencesSchema } from "../schemas/preference";
import * as preferenceController from "../controllers/preference";

const router = Router();

router.patch(
  "/preferences",
  requireAuth,
  validateBody(updatePreferencesSchema),
  preferenceController.update
);

export default router;
