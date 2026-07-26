import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export const QUIZ_QUEUE_NAME = "quiz-generate";

export type QuizJobData = {
  quizId: string;
};

let queue: Queue<QuizJobData> | null = null;

export function getQuizQueue(): Queue<QuizJobData> {
  if (!queue) {
    queue = new Queue<QuizJobData>(QUIZ_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });
  }
  return queue;
}

export async function enqueueQuizJob(quizId: string) {
  await getQuizQueue().add(
    "generate",
    { quizId },
    { jobId: `quiz-${quizId}` }
  );
}
