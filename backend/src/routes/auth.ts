import { Router } from "express";
import * as authController from "../controllers/auth";
import { authRateLimiter } from "../middleware/rateLimiter";
import { validateBody } from "../middleware/validateBody";
import { signupSchema, loginSchema } from "../schemas/auth";

const router = Router();

router.post("/signup", authRateLimiter, validateBody(signupSchema), authController.signup);
router.post("/login", authRateLimiter, validateBody(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/me", authController.me);

export default router;
