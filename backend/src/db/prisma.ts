import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger.js";

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? [{ emit: "event", level: "query" }, "warn", "error"]
      : ["warn", "error"],
});

prisma.$on("query" as never, (e: { query: string; duration: number }) => {
  if (process.env.LOG_SQL === "1") {
    logger.debug({ query: e.query, duration: e.duration }, "prisma query");
  }
});
