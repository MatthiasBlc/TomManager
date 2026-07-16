import { Request, Response, NextFunction } from "express";
import { HttpError } from "http-errors";
import logger from "../util/logger";
import { Sentry } from "../util/sentry";

export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  // Code stable optionnel (createError(status, msg, { code })) : le front mappe
  // ce code vers un message francais ; `message` reste en anglais pour logs/tests
  const code = typeof err.code === "string" ? err.code : undefined;

  if (status >= 500) {
    logger.error({ err }, "Server error");
    Sentry.withScope((scope) => {
      scope.setTag("requestId", (req as { id?: string }).id ?? "unknown");
      if ((req.session as { userId?: string })?.userId) {
        scope.setUser({ id: (req.session as { userId?: string }).userId });
      }
      Sentry.captureException(err);
    });
  }

  res.status(status).json({
    error: {
      message,
      status,
      ...(code ? { code } : {}),
    },
  });
}
