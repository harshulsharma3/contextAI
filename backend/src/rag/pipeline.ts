import type { RetrievedChunk } from "./retrieve.js";
import { retrieveForQueries } from "./retrieve.js";
import { rewriteQuery } from "./rewrite.js";
import { generateHydeAndSubqueries } from "./hyde.js";
import { rerankChunks } from "./rerank.js";
import {
  generateGroundedAnswer,
  generateGroundedAnswerSync,
} from "./generate.js";
import { evaluateAnswer } from "./evaluate.js";
import { inputGuardrails, outputGuardrails } from "./guardrails.js";
import { assessDiagramWorthy } from "./diagramWorthy.js";

export type PipelineEvent =
  | { type: "status"; stage: string; attempt?: number }
  | { type: "token"; text: string }
  | {
      type: "citation";
      citation: {
        sourceId: string;
        chunkId: string;
        sourceLabel: string;
        locatorLabel: string;
        startMs: number | null;
        endMs: number | null;
        page: number | null;
        sourceType: string;
        sourceUrl: string | null;
        hasFile: boolean;
      };
    }
  | {
      type: "done";
      answer: string;
      score: number;
      chunks: RetrievedChunk[];
      diagramWorthy: boolean;
    }
  | { type: "error"; message: string };

export async function* runRagPipeline(opts: {
  projectId: string;
  query: string;
  sourceIds?: string[];
  stream?: boolean;
}): AsyncGenerator<PipelineEvent> {
  try {
    await inputGuardrails(opts.query);

    let bestAnswer = "";
    let bestScore = -1;
    let bestChunks: RetrievedChunk[] = [];

    for (let attempt = 1; attempt <= 3; attempt++) {
      yield { type: "status", stage: "rewriting", attempt };

      const rewritten = await rewriteQuery(opts.query);
      const { hyde, subQueries } = await generateHydeAndSubqueries(opts.query);

      const queries = [
        opts.query,
        rewritten.abstract,
        rewritten.concrete,
        hyde,
        ...subQueries,
      ].filter(Boolean);

      yield { type: "status", stage: "retrieving", attempt };
      const retrieved = await retrieveForQueries({
        projectId: opts.projectId,
        queries,
        sourceIds: opts.sourceIds,
      });

      if (retrieved.length === 0) {
        const msg =
          "I couldn't find relevant material in your indexed sources. Try adding more sources or rephrasing.";
        yield { type: "token", text: msg };
        yield {
          type: "done",
          answer: msg,
          score: 0,
          chunks: [],
          diagramWorthy: false,
        };
        return;
      }

      yield { type: "status", stage: "reranking", attempt };
      const top = await rerankChunks(opts.query, retrieved, 5);

      yield { type: "status", stage: "generating", attempt };

      let answer = "";
      if (opts.stream !== false && attempt === 1) {
        // Stream only the first attempt for UX; retries are sync
        for await (const token of generateGroundedAnswer({
          query: opts.query,
          chunks: top,
        })) {
          answer += token;
          yield { type: "token", text: token };
        }
      } else {
        answer = await generateGroundedAnswerSync({
          query: opts.query,
          chunks: top,
        });
        if (attempt > 1) {
          // Clear previous streamed attempt isn't possible; for retries we replace at done
          yield { type: "token", text: answer };
        }
      }

      yield { type: "status", stage: "evaluating", attempt };
      const score = await evaluateAnswer({ query: opts.query, answer });

      if (score > bestScore) {
        bestScore = score;
        bestAnswer = answer;
        bestChunks = top;
      }

      if (score >= 6) break;
      yield { type: "status", stage: "retry", attempt };
    }

    bestAnswer = await outputGuardrails(bestAnswer);

    yield { type: "status", stage: "diagram_check" };
    const diagramWorthy = await assessDiagramWorthy({
      query: opts.query,
      answer: bestAnswer,
    });

    for (const c of bestChunks) {
      const sourceLabel = c.sourceLabel
        ? `${c.sourceLabel}: ${c.sourceName}`
        : c.sourceName;
      yield {
        type: "citation",
        citation: {
          sourceId: c.sourceId,
          chunkId: c.id,
          sourceLabel,
          locatorLabel: c.locatorLabel,
          startMs: c.startMs,
          endMs: c.endMs,
          page: c.page,
          sourceType: c.sourceType,
          sourceUrl: c.sourceUrl,
          hasFile: c.hasFile,
        },
      };
    }

    yield {
      type: "done",
      answer: bestAnswer,
      score: bestScore,
      chunks: bestChunks,
      diagramWorthy,
    };
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
