import pino from "pino";

const level =
  process.env.NODE_ENV === "test"
    ? "silent"
    : process.env.NODE_ENV === "production"
    ? "warn"
    : "debug";

const logger = pino({
  level,
  // Redaction des donnees sensibles dans les logs
  redact: {
    paths: [
      "body.password",
      "body.invitationToken",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export default logger;
