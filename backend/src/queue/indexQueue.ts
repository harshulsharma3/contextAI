import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const INDEX_QUEUE_NAME = "source-index";

export type IndexJobData = {
  sourceId: string;
};

let queue: Queue<IndexJobData> | null = null;

export function getIndexQueue(): Queue<IndexJobData> {
  if (!queue) {
    queue = new Queue<IndexJobData>(INDEX_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        // Fewer attempts; rate-limit failures become UnrecoverableError
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return queue;
}

export async function enqueueIndexJob(sourceId: string) {
  const q = getIndexQueue();
  const jobId = `index-${sourceId}`;

  // Allow re-index after a previous failure/completion
  const existing = await q.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
    } else if (state === "active" || state === "waiting" || state === "delayed") {
      return; // already queued
    }
  }

  await q.add("index", { sourceId }, { jobId });
}
