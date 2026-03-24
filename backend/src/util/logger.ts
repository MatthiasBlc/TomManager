import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export default logger;
