import { SourceType } from "@prisma/client";
import { UnrecoverableError } from "bullmq";
import { prisma } from "../db/prisma.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { getObjectBuffer } from "../lib/storage.js";
import {
  friendlyLlmError,
  isRateLimitError,
} from "../llm/retry.js";
import { chunkSegments } from "./chunk.js";
import { embedChunks, toPgVectorLiteral } from "./embed.js";
import { parsePdf } from "./parse/pdf.js";
import { parseSrt } from "./parse/srt.js";
import { parseText } from "./parse/text.js";
import type { ParseResult } from "./parse/types.js";
import { parseVtt } from "./parse/vtt.js";
import { parseWebLink } from "./parse/web.js";
import { parseYoutube } from "./parse/youtube.js";

async function parseSource(source: {
  id: string;
  type: SourceType;
  storageKey: string | null;
  sourceUrl: string | null;
  textContent: string | null;
  fileName: string;
}): Promise<ParseResult> {
  switch (source.type) {
    case "pdf": {
      if (!source.storageKey) throw new AppError("NO_FILE", "Missing PDF file");
      const buf = await getObjectBuffer(source.storageKey);
      return parsePdf(buf);
    }
    case "vtt": {
      if (!source.storageKey) throw new AppError("NO_FILE", "Missing VTT file");
      const buf = await getObjectBuffer(source.storageKey);
      return parseVtt(buf.toString("utf8"));
    }
    case "srt": {
      if (!source.storageKey) throw new AppError("NO_FILE", "Missing SRT file");
      const buf = await getObjectBuffer(source.storageKey);
      return parseSrt(buf.toString("utf8"));
    }
    case "youtube": {
      if (!source.sourceUrl) throw new AppError("NO_URL", "Missing YouTube URL");
      return parseYoutube(source.sourceUrl);
    }
    case "weblink": {
      if (!source.sourceUrl) throw new AppError("NO_URL", "Missing web URL");
      return parseWebLink(source.sourceUrl);
    }
    case "text": {
      const text =
        source.textContent ||
        (source.storageKey
          ? (await getObjectBuffer(source.storageKey)).toString("utf8")
          : "");
      if (!text.trim()) throw new AppError("NO_TEXT", "Empty text source");
      return parseText(text);
    }
    case "video":
      throw new AppError(
        "ASR_NOT_ENABLED",
        "Audio/video ASR is not enabled yet. Upload a VTT/SRT transcript instead.",
        422
      );
    default:
      throw new AppError(
        "UNSUPPORTED_TYPE",
        `Unsupported source type: ${source.type}`
      );
  }
}

export async function processIndexJob(sourceId: string): Promise<void> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) {
    logger.warn({ sourceId }, "Source not found for index job");
    return;
  }

  await prisma.source.update({
    where: { id: sourceId },
    data: { status: "indexing", error: null },
  });

  try {
    const parsed = await parseSource(source);
    const drafts = chunkSegments(parsed.segments);

    if (drafts.length === 0) {
      throw new AppError("EMPTY_CONTENT", "No content extracted to index", 422);
    }

    logger.info(
      {
        sourceId,
        type: source.type,
        segments: parsed.segments.length,
        chunks: drafts.length,
        pages: parsed.pageCount,
      },
      "Parsed source — starting embeddings"
    );

    await prisma.chunk.deleteMany({ where: { sourceId } });

    const embeddings = await embedChunks(drafts);

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i]!;
      const emb = embeddings[i]!;
      const id = `chk_${sourceId}_${i}_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Chunk" (id, "sourceId", "projectId", "chunkIndex", content, "tokenCount", "startMs", "endMs", page, "locatorLabel", embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector)`,
        id,
        sourceId,
        source.projectId,
        d.chunkIndex,
        d.content,
        d.tokenCount,
        d.startMs ?? null,
        d.endMs ?? null,
        d.page ?? null,
        d.locatorLabel,
        toPgVectorLiteral(emb)
      );
    }

    await prisma.source.update({
      where: { id: sourceId },
      data: {
        status: "ready",
        chunkCount: drafts.length,
        durationSeconds: parsed.durationSeconds ?? source.durationSeconds,
        pageCount: parsed.pageCount ?? source.pageCount,
        textContent: parsed.fullText.slice(0, 100_000),
        name: source.name || parsed.title || source.fileName,
        error: null,
      },
    });

    logger.info(
      { sourceId, chunks: drafts.length },
      "Source indexed successfully"
    );
  } catch (err) {
    const message = friendlyLlmError(err);
    const rateLimited =
      isRateLimitError(err) ||
      (err instanceof AppError && err.code === "RATE_LIMITED");

    logger.error({ err, sourceId, rateLimited }, "Index job failed");

    await prisma.source.update({
      where: { id: sourceId },
      data: { status: "error", error: message },
    });

    // Don't burn quota with BullMQ rapid retries on rate limits / validation
    if (
      rateLimited ||
      (err instanceof AppError &&
        ["EMPTY_CONTENT", "ASR_NOT_ENABLED", "NO_FILE", "NO_URL", "NO_TEXT"].includes(
          err.code
        ))
    ) {
      throw new UnrecoverableError(message);
    }

    throw err instanceof Error ? err : new Error(message);
  }
}
