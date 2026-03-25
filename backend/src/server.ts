import http from "http";
import app from "./app";
import env from "./config/env";
import logger from "./util/logger";
import prisma from "./util/db";
import { initSocket } from "./socket";

const server = http.createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  server.close();
});
