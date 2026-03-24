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

const app = express();

// Security
app.use(helmet());

// Logging
if (env.NODE_ENV !== "test") {
  app.use(pinoHttp({ logger }));
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
app.use(
  session({
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
  })
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api", apiRouter);

// Error handler
app.use(errorHandler);

export default app;
