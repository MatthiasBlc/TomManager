import http from "http";
import app from "./app";
import env from "./config/env";
import logger from "./util/logger";
import prisma from "./util/db";
import { initSocket } from "./socket";
import { initSentry } from "./util/sentry";
import { startNotificationRetentionJob } from "./services/notification";

initSentry();

const server = http.createServer(app);
initSocket(server);
startNotificationRetentionJob();

server.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
  if (!env.BGG_API_TOKEN) {
    logger.warn("BGG_API_TOKEN not configured — BGG search disabled");
  }
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  server.close();
});
