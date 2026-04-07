import rateLimit from "express-rate-limit";
import env from "../config/env";

const skipInTest = () => env.NODE_ENV === "test" || process.env.ENABLE_TEST_ROUTES === "true";

// Auth : 10 tentatives / 15 min
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, please try again later" } },
  skip: skipInTest,
});

// Global API : 100 req / min par IP
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many requests, please slow down" } },
  skip: skipInTest,
});

// Ecritures (POST/PATCH/DELETE) : 30 req / min par IP
export const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { message: "Too many write requests, please slow down" } },
  skip: (req) => skipInTest() || !["POST", "PATCH", "DELETE"].includes(req.method),
});
