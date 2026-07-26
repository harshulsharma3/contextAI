import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/errors.js";
import { enqueueQuizJob } from "../../queue/quizQueue.js";

export async function createQuiz(opts: {
  projectId: string;
  sourceIds: string[];
  cardCount: number;
  focus: string;
}) {
  const project = await prisma.project.findUnique({
    where: { id: opts.projectId },
  });
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

  if (!opts.sourceIds.length) {
    throw new AppError("VALIDATION_ERROR", "At least one source is required", 400);
  }

  const ready = await prisma.source.findMany({
    where: {
      id: { in: opts.sourceIds },
      projectId: opts.projectId,
      status: "ready",
    },
  });
  if (ready.length === 0) {
    throw new AppError(
      "NO_READY_SOURCES",
      "Selected sources are not indexed yet",
      400
    );
  }

  const quiz = await prisma.quiz.create({
    data: {
      projectId: opts.projectId,
      focus: opts.focus || "theory",
      cardCount: opts.cardCount,
      status: "generating",
      progress: 0,
      progressMsg: "Queued for generation…",
      sources: {
        create: ready.map((s) => ({ sourceId: s.id })),
      },
    },
  });

  await enqueueQuizJob(quiz.id);
  return { quizId: quiz.id, status: quiz.status };
}

export async function listQuizzes(projectId: string) {
  return prisma.quiz.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      focus: true,
      cardCount: true,
      status: true,
      progress: true,
      error: true,
      createdAt: true,
    },
  });
}

/** Public quiz fetch — withholds correct answers / explanations for unstarted view */
export async function getQuizForTake(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { number: "asc" },
        include: { options: { orderBy: { label: "asc" } } },
      },
    },
  });
  if (!quiz) throw new AppError("NOT_FOUND", "Quiz not found", 404);

  return {
    id: quiz.id,
    focus: quiz.focus,
    cardCount: quiz.cardCount,
    status: quiz.status,
    progress: quiz.progress,
    progressMsg: quiz.progressMsg,
    error: quiz.error,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      number: q.number,
      prompt: q.prompt,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        text: o.text,
      })),
      // Withheld: correctOptionId, explanation, reference
      status: "unanswered" as const,
    })),
  };
}

export async function getQuizProgress(quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError("NOT_FOUND", "Quiz not found", 404);
  return {
    id: quiz.id,
    status: quiz.status,
    progress: quiz.progress,
    progressMsg: quiz.progressMsg,
    error: quiz.error,
  };
}

export async function startSession(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: true },
  });
  if (!quiz) throw new AppError("NOT_FOUND", "Quiz not found", 404);
  if (quiz.status !== "ready") {
    throw new AppError("QUIZ_NOT_READY", "Quiz is not ready yet", 400);
  }

  const session = await prisma.quizSession.create({
    data: {
      quizId,
      answers: {
        create: quiz.questions.map((q) => ({
          questionId: q.id,
        })),
      },
    },
  });

  return { sessionId: session.id };
}

export async function submitAnswer(opts: {
  sessionId: string;
  questionId: string;
  selectedOptionId: string;
  confidence?: number;
}) {
  const session = await prisma.quizSession.findUnique({
    where: { id: opts.sessionId },
    include: {
      quiz: {
        include: {
          questions: { include: { options: true } },
        },
      },
      answers: true,
    },
  });
  if (!session) throw new AppError("NOT_FOUND", "Session not found", 404);

  const question = session.quiz.questions.find((q) => q.id === opts.questionId);
  if (!question) throw new AppError("NOT_FOUND", "Question not found", 404);

  const isCorrect = question.correctOptionId === opts.selectedOptionId;

  await prisma.answer.upsert({
    where: {
      sessionId_questionId: {
        sessionId: opts.sessionId,
        questionId: opts.questionId,
      },
    },
    create: {
      sessionId: opts.sessionId,
      questionId: opts.questionId,
      selectedOptionId: opts.selectedOptionId,
      confidence: opts.confidence,
      isCorrect,
      answeredAt: new Date(),
    },
    update: {
      selectedOptionId: opts.selectedOptionId,
      confidence: opts.confidence,
      isCorrect,
      answeredAt: new Date(),
    },
  });

  // Recalculate score if all answered
  const answers = await prisma.answer.findMany({
    where: { sessionId: opts.sessionId },
  });
  const answered = answers.filter((a) => a.answeredAt);
  if (answered.length === session.quiz.questions.length) {
    const correct = answered.filter((a) => a.isCorrect).length;
    const score = Math.round((correct / answered.length) * 100);
    await prisma.quizSession.update({
      where: { id: opts.sessionId },
      data: { score, completedAt: new Date() },
    });
  }

  return {
    isCorrect,
    correctOptionId: question.correctOptionId,
    explanation: question.explanation,
    reference: question.reference,
  };
}

export async function getSessionScoreboard(sessionId: string) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { number: "asc" },
            include: { options: true },
          },
        },
      },
      answers: true,
    },
  });
  if (!session) throw new AppError("NOT_FOUND", "Session not found", 404);

  const answerByQ = new Map(session.answers.map((a) => [a.questionId, a]));

  const questions = session.quiz.questions.map((q) => {
    const ans = answerByQ.get(q.id);
    let status: "correct" | "incorrect" | "pending" | "unanswered" = "unanswered";
    if (ans?.answeredAt) {
      status = ans.isCorrect ? "correct" : "incorrect";
    } else if (ans) {
      status = "pending";
    }

    const selected = q.options.find((o) => o.id === ans?.selectedOptionId);

    return {
      id: q.id,
      number: q.number,
      prompt: q.prompt,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        text: o.text,
      })),
      correctOptionId: q.correctOptionId,
      explanation: q.explanation,
      reference: q.reference,
      selectedOptionId: ans?.selectedOptionId ?? undefined,
      selectedLabel: selected?.label,
      status,
    };
  });

  const answered = questions.filter(
    (q) => q.status === "correct" || q.status === "incorrect"
  );
  const correct = questions.filter((q) => q.status === "correct").length;
  const score =
    session.score ??
    (answered.length
      ? Math.round((correct / answered.length) * 100)
      : 0);

  return {
    sessionId: session.id,
    quizId: session.quizId,
    score,
    completedAt: session.completedAt?.toISOString() ?? null,
    questions,
  };
}
