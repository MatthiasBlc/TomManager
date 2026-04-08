import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // Sentry desactive si pas de DSN configure

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    // Ne pas envoyer les erreurs en dev/test sauf si DSN explicitement set
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.2,
  });
}

export { Sentry };
