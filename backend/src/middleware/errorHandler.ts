import { Request, Response, NextFunction } from "express";
import { HttpError } from "http-errors";
import logger from "../util/logger";

export function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  if (status >= 500) {
    logger.error({ err }, "Server error");
  }

  res.status(status).json({
    error: {
      message,
      status,
    },
  });
}
