import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import pinoHttp from "pino-http";
import prisma from "./util/db";
import logger from "./util/logger";
import env from "./config/env";
import apiRouter from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { globalRateLimiter, writeRateLimiter } from "./middleware/rateLimiter";

const app = express();

// Security
app.use(helmet());

// Logging avec request ID
if (env.NODE_ENV !== "test") {
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => {
        // Utilise le header X-Request-ID si present (ex: Traefik), sinon genere un ID
        const existing = req.headers["x-request-id"];
        if (existing) return Array.isArray(existing) ? existing[0] : existing;
        return crypto.randomUUID();
      },
      // Propager le request ID dans le header de reponse
      customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} - ${res.statusCode}`,
    })
  );
}

// Body parsing
app.use(express.json());

// CORS
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Trust proxy (for Traefik)
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Sessions
export const sessionMiddleware = session({
  name: "connect.sid",
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60 * 60 * 1000, // 1h
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
  },
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
  }),
});
app.use(sessionMiddleware);

// Health check
app.get("/health", async (_req, res) => {
  let db: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    // DB inaccessible
  }
  res.json({
    status: "ok",
    version: "0.1.0",
    uptime: Math.floor(process.uptime()),
    db,
  });
});

// Readiness probe (Portainer / orchestrateur)
app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not ready", db: "error" });
  }
});

// API routes
app.use("/api", globalRateLimiter, writeRateLimiter, apiRouter);

// Error handler
app.use(errorHandler);

export default app;
