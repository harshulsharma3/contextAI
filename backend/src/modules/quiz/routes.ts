import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { param } from "../../lib/params.js";
import { initSse, sendSse } from "../../lib/sse.js";
import { validateBody } from "../../middleware/validate.js";
import * as service from "./service.js";

export const quizRouter = Router({ mergeParams: true });
export const quizByIdRouter = Router();
export const sessionRouter = Router();

quizRouter.post(
  "/quizzes",
  validateBody(
    z.object({
      sourceIds: z.array(z.string()).min(1),
      cardCount: z.number().int().min(5).max(40).default(20),
      focus: z.string().default("theory"),
    })
  ),
  async (req, res, next) => {
    try {
      const result = await service.createQuiz({
        projectId: param(req, "id"),
        sourceIds: req.body.sourceIds,
        cardCount: req.body.cardCount,
        focus: req.body.focus,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

quizRouter.get("/quizzes", async (req, res, next) => {
  try {
    const quizzes = await service.listQuizzes(param(req, "id"));
    res.json(quizzes);
  } catch (err) {
    next(err);
  }
});

quizByIdRouter.get("/:id", async (req, res, next) => {
  try {
    const quiz = await service.getQuizForTake(param(req, "id"));
    res.json(quiz);
  } catch (err) {
    next(err);
  }
});

quizByIdRouter.get("/:id/progress", async (req, res, next) => {
  try {
    initSse(res);
    await streamQuizProgress(param(req, "id"), res);
  } catch (err) {
    next(err);
  }
});

async function streamQuizProgress(quizId: string, res: Response) {
  const started = Date.now();
  const maxMs = 5 * 60_000;

  while (Date.now() - started < maxMs) {
    const progress = await service.getQuizProgress(quizId);
    sendSse(res, "progress", progress);
    if (progress.status === "ready" || progress.status === "error") {
      sendSse(res, "done", progress);
      res.end();
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  sendSse(res, "error", { message: "Progress stream timed out" });
  res.end();
}

quizByIdRouter.post("/:id/sessions", async (req, res, next) => {
  try {
    const result = await service.startSession(param(req, "id"));
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

sessionRouter.post(
  "/:id/answers",
  validateBody(
    z.object({
      questionId: z.string(),
      selectedOptionId: z.string(),
      confidence: z.number().int().min(1).max(5).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const result = await service.submitAnswer({
        sessionId: param(req, "id"),
        questionId: req.body.questionId,
        selectedOptionId: req.body.selectedOptionId,
        confidence: req.body.confidence,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

sessionRouter.get("/:id", async (req, res, next) => {
  try {
    const scoreboard = await service.getSessionScoreboard(param(req, "id"));
    res.json(scoreboard);
  } catch (err) {
    next(err);
  }
});
