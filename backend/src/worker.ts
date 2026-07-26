import { Worker } from "bullmq";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { processIndexJob } from "./ingest/indexWorker.js";
import { ensureUploadRoot } from "./lib/storage.js";
import { logger } from "./lib/logger.js";
import { getRedisConnection } from "./queue/connection.js";
import { INDEX_QUEUE_NAME, type IndexJobData } from "./queue/indexQueue.js";
import { QUIZ_QUEUE_NAME, type QuizJobData } from "./queue/quizQueue.js";
import { processQuizJob } from "./quizgen/quizWorker.js";

ensureUploadRoot();

logger.info(
  { env: env.NODE_ENV, provider: env.LLM_PROVIDER },
  "Starting ContextAI workers"
);

const indexWorker = new Worker<IndexJobData>(
  INDEX_QUEUE_NAME,
  async (job) => {
    logger.info({ jobId: job.id, sourceId: job.data.sourceId }, "Index job start");
    await processIndexJob(job.data.sourceId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  }
);

const quizWorker = new Worker<QuizJobData>(
  QUIZ_QUEUE_NAME,
  async (job) => {
    logger.info({ jobId: job.id, quizId: job.data.quizId }, "Quiz job start");
    await processQuizJob(job.data.quizId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

indexWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Index job failed");
});
quizWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Quiz job failed");
});
indexWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Index job completed");
});
quizWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Quiz job completed");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  await Promise.all([indexWorker.close(), quizWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
