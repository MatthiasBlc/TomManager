import rateLimit from "express-rate-limit";
import env from "../config/env";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, please try again later" } },
  skip: () => env.NODE_ENV === "test",
});
