import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { getLLM } from "../llm/index.js";
import { logger } from "../lib/logger.js";

type GeneratedMcq = {
  prompt: string;
  options: { label: string; text: string }[];
  correctLabel: string;
  explanation: string;
  reference?: string;
  chunkId?: string;
};

export async function processQuizJob(quizId: string): Promise<void> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { sources: true },
  });
  if (!quiz) {
    logger.warn({ quizId }, "Quiz not found");
    return;
  }

  await prisma.quiz.update({
    where: { id: quizId },
    data: {
      status: "generating",
      progress: 5,
      progressMsg: "Gathering source material…",
      error: null,
    },
  });

  try {
    const sourceIds = quiz.sources.map((s) => s.sourceId);
    const chunks = await prisma.chunk.findMany({
      where: { sourceId: { in: sourceIds } },
      include: { source: true },
      take: 40,
      orderBy: { chunkIndex: "asc" },
    });

    if (chunks.length === 0) {
      throw new Error("No chunks available from selected sources");
    }

    await prisma.quiz.update({
      where: { id: quizId },
      data: { progress: 25, progressMsg: "Extracting key concepts…" },
    });

    // Sample representative chunks
    const step = Math.max(1, Math.floor(chunks.length / Math.min(12, chunks.length)));
    const sample = chunks.filter((_, i) => i % step === 0).slice(0, 12);

    const context = sample
      .map((c, i) => {
        const label = c.source.label
          ? `${c.source.label}: ${c.source.name}`
          : c.source.name;
        return `[chunk ${i}] id=${c.id} (${label} — ${c.locatorLabel})\n${c.content.slice(0, 600)}`;
      })
      .join("\n\n");

    await prisma.quiz.update({
      where: { id: quizId },
      data: {
        progress: 45,
        progressMsg: `Generating ${quiz.cardCount} MCQ cards focusing on ${quiz.focus}…`,
      },
    });

    const llm = getLLM();
    const result = await llm.generateJSON<{ questions: GeneratedMcq[] }>(
      {
        model: env.CHAT_MODEL,
        temperature: 0.4,
        maxTokens: 8192,
        prompt: `You are an expert educator. Create ${quiz.cardCount} multiple-choice questions focusing on "${quiz.focus}" from the source excerpts below.

Rules:
- Exactly 4 options labeled A, B, C, D
- One correct answer
- Plausible distractors
- Include a short explanation and a reference like "Source — locator"
- Optionally include chunkId from the excerpts

Excerpts:
${context}

Return JSON: { "questions": [ { "prompt", "options": [{"label","text"}], "correctLabel", "explanation", "reference", "chunkId"? } ] }`,
      },
      '{ "questions": GeneratedMcq[] }'
    );

    await prisma.quiz.update({
      where: { id: quizId },
      data: { progress: 75, progressMsg: "Saving quiz questions…" },
    });

    // Clear any previous questions
    await prisma.question.deleteMany({ where: { quizId } });

    const questions = (result.questions || []).slice(0, quiz.cardCount);
    if (questions.length === 0) {
      throw new Error("LLM returned no questions");
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      const options = q.options?.length
        ? q.options
        : [
            { label: "A", text: "Option A" },
            { label: "B", text: "Option B" },
            { label: "C", text: "Option C" },
            { label: "D", text: "Option D" },
          ];

      const correctLabel = (q.correctLabel || "A").toUpperCase();
      // Create question with temporary correctOptionId, then update after options
      const question = await prisma.question.create({
        data: {
          quizId,
          number: i + 1,
          prompt: q.prompt,
          correctOptionId: "pending",
          explanation: q.explanation || "",
          reference:
            q.reference ||
            sample[0]?.locatorLabel ||
            "Indexed source",
          chunkId: q.chunkId && sample.find((c) => c.id === q.chunkId)
            ? q.chunkId
            : sample[0]?.id,
          sourceId: sample[0]?.sourceId,
          options: {
            create: options.map((o) => ({
              label: o.label.toUpperCase(),
              text: o.text,
            })),
          },
        },
        include: { options: true },
      });

      const correct =
        question.options.find((o) => o.label === correctLabel) ||
        question.options[0]!;

      await prisma.question.update({
        where: { id: question.id },
        data: { correctOptionId: correct.id },
      });
    }

    await prisma.quiz.update({
      where: { id: quizId },
      data: {
        status: "ready",
        progress: 100,
        progressMsg: "Quiz ready",
        cardCount: questions.length,
        error: null,
      },
    });

    logger.info({ quizId, count: questions.length }, "Quiz generated");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, quizId }, "Quiz generation failed");
    await prisma.quiz.update({
      where: { id: quizId },
      data: {
        status: "error",
        progress: 100,
        progressMsg: "Generation failed",
        error: message,
      },
    });
    throw err;
  }
}
