import { Router } from "express";
import * as authController from "../controllers/auth";
import * as discordAuthController from "../controllers/discordAuth";
import { authRateLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validateBody";
import { loginSchema } from "../schemas/auth";

const router = Router();

router.post("/login", authRateLimiter, validateBody(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/me", authController.me);

router.get("/discord", discordAuthController.initiateLogin);
router.get("/discord/callback", discordAuthController.handleCallback);
router.delete("/discord/link", requireAuth, discordAuthController.unlinkDiscord);

export default router;
