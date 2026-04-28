import { PrismaClient } from "@prisma/client";
import logger from "./logger";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? [{ emit: "event", level: "query" }] : [],
});

// Log des requetes SQL en dev (desactive en test et prod)
if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, "Prisma query");
  });
}

export default prisma;
