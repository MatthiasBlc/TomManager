import { Router } from "express";
import * as authController from "../controllers/auth";
import { authRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/signup", authRateLimiter, authController.signup);
router.post("/login", authRateLimiter, authController.login);
router.post("/logout", authController.logout);
router.get("/me", authController.me);

export default router;
