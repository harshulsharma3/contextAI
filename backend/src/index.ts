import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsOrigins, env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { ensureUploadRoot, storageMode } from "./lib/storage.js";
import { logger } from "./lib/logger.js";
import { authContext } from "./middleware/authContext.js";
import { errorHandler } from "./middleware/error.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { pingRedis } from "./queue/connection.js";
import { chatByIdRouter, chatRouter, messageByIdRouter } from "./modules/chat/routes.js";
import { projectsRouter } from "./modules/projects/routes.js";
import {
  quizByIdRouter,
  quizRouter,
  sessionRouter,
} from "./modules/quiz/routes.js";
import {
  sourceByIdRouter,
  sourcesRouter,
} from "./modules/sources/routes.js";

ensureUploadRoot();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || corsOrigins.includes(origin) || corsOrigins.includes("*")) {
        cb(null, true);
        return;
      }
      cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(authContext);
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/health" },
  })
);
app.use(apiRateLimit);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "contextai-api", storage: storageMode });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisOk = await pingRedis();
    if (!redisOk) {
      res.status(503).json({ ok: false, db: true, redis: false });
      return;
    }
    res.json({ ok: true, db: true, redis: true });
  } catch (err) {
    res.status(503).json({
      ok: false,
      db: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.use("/api/projects", projectsRouter);
app.use("/api/projects/:id/sources", sourcesRouter);
app.use("/api/projects/:id", chatRouter);
app.use("/api/projects/:id", quizRouter);
app.use("/api/sources", sourceByIdRouter);
app.use("/api/chats", chatByIdRouter);
app.use("/api/messages", messageByIdRouter);
app.use("/api/quizzes", quizByIdRouter);
app.use("/api/sessions", sessionRouter);

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, storage: storageMode },
    "ContextAI API listening"
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
