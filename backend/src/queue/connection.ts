import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

let connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });
  }
  return connection;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const res = await getRedisConnection().ping();
    return res === "PONG";
  } catch {
    return false;
  }
}
