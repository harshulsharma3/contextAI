import { SourceType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/errors.js";
import { deleteObject, getObjectBuffer, putObject } from "../../lib/storage.js";
import { enqueueIndexJob } from "../../queue/indexQueue.js";
import { mapSource } from "../projects/service.js";

const LABEL_FOR: Partial<Record<SourceType, string>> = {
  pdf: "PDF",
  youtube: "YouTube Link",
  weblink: "Web Link",
  text: "Text",
  vtt: "VTT",
  srt: "SRT",
  video: "Video",
};

export async function createSource(opts: {
  projectId: string;
  name: string;
  type: SourceType;
  file?: Express.Multer.File;
  url?: string;
  text?: string;
  options?: {
    generateSummary?: boolean;
    createFlashcards?: boolean;
    indexForSearch?: boolean;
  };
}) {
  const project = await prisma.project.findUnique({
    where: { id: opts.projectId },
  });
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

  if (opts.type === "video") {
    // Accept but will fail in worker with clear message — or fail early:
    throw new AppError(
      "ASR_NOT_ENABLED",
      "Audio/video ASR is not enabled yet. Upload a transcript (VTT/SRT) instead.",
      422
    );
  }

  let storageKey: string | undefined;
  let mimeType: string | undefined;
  let fileName = opts.name;
  let textContent: string | undefined;
  let sourceUrl: string | undefined;

  if (opts.file) {
    fileName = opts.file.originalname;
    mimeType = opts.file.mimetype;
    storageKey = `projects/${opts.projectId}/${Date.now()}_${opts.file.originalname}`;
    await putObject(storageKey, opts.file.buffer, mimeType);
  } else if (opts.type === "youtube" || opts.type === "weblink") {
    if (!opts.url) throw new AppError("VALIDATION_ERROR", "url is required", 400);
    sourceUrl = opts.url;
    fileName = opts.name || opts.url;
  } else if (opts.type === "text") {
    if (!opts.text && !opts.file) {
      throw new AppError("VALIDATION_ERROR", "text content is required", 400);
    }
    textContent = opts.text;
    if (opts.text) {
      storageKey = `projects/${opts.projectId}/${Date.now()}_notes.txt`;
      await putObject(storageKey, opts.text, "text/plain");
    }
    fileName = opts.name || "notes.txt";
  } else if (!opts.file) {
    throw new AppError("VALIDATION_ERROR", "file is required for this source type", 400);
  }

  const source = await prisma.source.create({
    data: {
      projectId: opts.projectId,
      name: opts.name,
      fileName,
      type: opts.type,
      label: LABEL_FOR[opts.type],
      status: "pending",
      sourceUrl,
      storageKey,
      mimeType,
      textContent,
    },
  });

  if (opts.options?.indexForSearch !== false) {
    await enqueueIndexJob(source.id);
  } else {
    await prisma.source.update({
      where: { id: source.id },
      data: {
        status: "error",
        error: "indexForSearch was disabled",
      },
    });
  }

  return mapSource(source);
}

export async function listSources(projectId: string) {
  const sources = await prisma.source.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return sources.map(mapSource);
}

export async function getSource(id: string) {
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);
  return mapSource(source);
}

export async function getSourceContent(id: string) {
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);
  return {
    id: source.id,
    name: source.name,
    fileName: source.fileName,
    content: source.textContent || "",
    status: source.status,
  };
}

export async function deleteSource(id: string) {
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);
  if (source.storageKey) await deleteObject(source.storageKey);
  await prisma.source.delete({ where: { id } });
}

export async function getSourceFile(id: string) {
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);
  if (!source.storageKey) {
    throw new AppError("NO_FILE", "This source has no stored file", 404);
  }

  const buffer = await getObjectBuffer(source.storageKey);
  return {
    buffer,
    mimeType: source.mimeType || "application/octet-stream",
    fileName: source.fileName,
  };
}

export async function getSourceChunks(
  id: string,
  opts?: { focusChunkId?: string; window?: number }
) {
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);

  const window = Math.min(Math.max(opts?.window ?? 2, 0), 10);
  const chunks = await prisma.chunk.findMany({
    where: { sourceId: id },
    orderBy: { chunkIndex: "asc" },
    select: {
      id: true,
      chunkIndex: true,
      content: true,
      page: true,
      startMs: true,
      endMs: true,
      locatorLabel: true,
    },
  });

  if (!chunks.length) {
    return {
      sourceId: source.id,
      name: source.name,
      type: source.type,
      sourceUrl: source.sourceUrl,
      focusChunkId: opts?.focusChunkId ?? null,
      chunks: [],
    };
  }

  let focusIndex = 0;
  if (opts?.focusChunkId) {
    const found = chunks.findIndex((c) => c.id === opts.focusChunkId);
    if (found >= 0) focusIndex = found;
  }

  const start = Math.max(0, focusIndex - window);
  const end = Math.min(chunks.length, focusIndex + window + 1);
  const slice = chunks.slice(start, end);

  return {
    sourceId: source.id,
    name: source.name,
    type: source.type,
    sourceUrl: source.sourceUrl,
    focusChunkId: chunks[focusIndex]?.id ?? null,
    chunks: slice.map((c) => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      page: c.page,
      startMs: c.startMs,
      endMs: c.endMs,
      locatorLabel: c.locatorLabel,
      focused: c.id === chunks[focusIndex]?.id,
    })),
  };
}

export async function retryIndexSource(id: string) {
  const source = await prisma.source.findUnique({ where: { id } });
  if (!source) throw new AppError("NOT_FOUND", "Source not found", 404);

  await prisma.source.update({
    where: { id },
    data: { status: "pending", error: null },
  });
  await enqueueIndexJob(id);

  const updated = await prisma.source.findUniqueOrThrow({ where: { id } });
  return mapSource(updated);
}
