import type { Response } from "express";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/errors.js";
import { initSse, sendSse } from "../../lib/sse.js";
import { runRagPipeline } from "../../rag/pipeline.js";

export async function streamChat(opts: {
  res: Response;
  projectId: string;
  message: string;
  mode: "global" | "individual";
  sourceIds?: string[];
  chatId?: string;
  stream?: boolean;
}) {
  const project = await prisma.project.findUnique({
    where: { id: opts.projectId },
  });
  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

  let chatId = opts.chatId;
  if (chatId) {
    const existing = await prisma.chat.findFirst({
      where: { id: chatId, projectId: opts.projectId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Chat not found", 404);
  } else {
    const title =
      opts.message.length > 60
        ? `${opts.message.slice(0, 57)}...`
        : opts.message;
    const chat = await prisma.chat.create({
      data: {
        projectId: opts.projectId,
        title,
        mode: opts.mode,
        sources:
          opts.sourceIds && opts.sourceIds.length
            ? {
                create: opts.sourceIds.map((sourceId) => ({ sourceId })),
              }
            : undefined,
      },
    });
    chatId = chat.id;
  }

  await prisma.message.create({
    data: {
      chatId: chatId!,
      role: "user",
      content: opts.message,
    },
  });

  const useSse = opts.stream !== false;
  if (useSse) initSse(opts.res);

  let fullAnswer = "";
  let score = 0;
  let diagramWorthy = false;
  const citations: Array<{
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
  }> = [];

  for await (const event of runRagPipeline({
    projectId: opts.projectId,
    query: opts.message,
    sourceIds: opts.sourceIds,
    stream: useSse,
  })) {
    if (event.type === "status") {
      if (useSse) sendSse(opts.res, "status", event);
    } else if (event.type === "token") {
      fullAnswer += event.text;
      if (useSse) sendSse(opts.res, "token", { text: event.text });
    } else if (event.type === "citation") {
      citations.push(event.citation);
      if (useSse) {
        sendSse(opts.res, "citation", mapCitationForClient(event.citation));
      }
    } else if (event.type === "done") {
      fullAnswer = event.answer || fullAnswer;
      score = event.score;
      diagramWorthy = event.diagramWorthy;
    } else if (event.type === "error") {
      if (useSse) {
        sendSse(opts.res, "error", { message: event.message });
        opts.res.end();
      } else {
        throw new AppError("RAG_ERROR", event.message, 500);
      }
      return { chatId };
    }
  }

  const assistant = await prisma.message.create({
    data: {
      chatId: chatId!,
      role: "assistant",
      content: fullAnswer,
      score,
      diagramWorthy,
      citations: {
        create: citations.map((c) => ({
          sourceId: c.sourceId,
          chunkId: c.chunkId,
          sourceLabel: c.sourceLabel,
          locatorLabel: c.locatorLabel,
          startMs: c.startMs,
        })),
      },
    },
    include: {
      citations: {
        include: {
          chunk: true,
          source: true,
        },
      },
    },
  });

  await prisma.chat.update({
    where: { id: chatId! },
    data: { updatedAt: new Date() },
  });

  if (useSse) {
    sendSse(opts.res, "done", {
      chatId,
      messageId: assistant.id,
      score,
      diagramWorthy,
    });
    opts.res.end();
  } else {
    opts.res.json({
      chatId,
      message: {
        id: assistant.id,
        role: "assistant",
        content: fullAnswer,
        diagramWorthy,
        citations: assistant.citations.map(mapStoredCitation),
        createdAt: assistant.createdAt.toISOString(),
      },
    });
  }

  return { chatId };
}

function mapCitationForClient(c: {
  chunkId: string;
  sourceId: string;
  sourceLabel: string;
  locatorLabel: string;
  startMs: number | null;
  endMs?: number | null;
  page?: number | null;
  sourceType?: string;
  sourceUrl?: string | null;
  hasFile?: boolean;
}) {
  return {
    id: `cit_${c.chunkId}`,
    sourceId: c.sourceId,
    chunkId: c.chunkId,
    sourceLabel: c.sourceLabel,
    timestamp: c.locatorLabel,
    startMs: c.startMs ?? undefined,
    endMs: c.endMs ?? undefined,
    page: c.page ?? undefined,
    sourceType: c.sourceType,
    sourceUrl: c.sourceUrl ?? undefined,
    hasFile: c.hasFile ?? false,
  };
}

function mapStoredCitation(c: {
  id: string;
  sourceId: string;
  chunkId: string | null;
  sourceLabel: string;
  locatorLabel: string;
  startMs: number | null;
  chunk: {
    page: number | null;
    startMs: number | null;
    endMs: number | null;
  } | null;
  source: {
    type: string;
    sourceUrl: string | null;
    storageKey: string | null;
  };
}) {
  return {
    id: c.id,
    sourceId: c.sourceId,
    chunkId: c.chunkId ?? undefined,
    sourceLabel: c.sourceLabel,
    timestamp: c.locatorLabel,
    startMs: c.chunk?.startMs ?? c.startMs ?? undefined,
    endMs: c.chunk?.endMs ?? undefined,
    page: c.chunk?.page ?? undefined,
    sourceType: c.source.type,
    sourceUrl: c.source.sourceUrl ?? undefined,
    hasFile: Boolean(c.source.storageKey),
  };
}

export async function listChats(projectId: string) {
  const chats = await prisma.chat.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return chats.map((c) => ({
    id: c.id,
    title: c.title,
    preview: c.messages[0]?.content?.slice(0, 120) || "",
  }));
}

export async function getChatMessages(chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          citations: {
            include: {
              chunk: true,
              source: true,
            },
          },
        },
      },
    },
  });
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found", 404);

  return chat.messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    title: m.title ?? undefined,
    diagramWorthy: m.diagramWorthy,
    hasDiagram: Boolean(m.diagramKey),
    citations: m.citations.map(mapStoredCitation),
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function generateDiagramForMessage(messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      chat: true,
    },
  });
  if (!message) throw new AppError("NOT_FOUND", "Message not found", 404);
  if (message.role !== "assistant") {
    throw new AppError("VALIDATION_ERROR", "Only assistant messages can have diagrams", 400);
  }

  // Find the preceding user question in the same chat
  const priorUser = await prisma.message.findFirst({
    where: {
      chatId: message.chatId,
      role: "user",
      createdAt: { lt: message.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  const { generateBoardExplanationImage } = await import(
    "../../rag/boardImage.js"
  );
  const { putObject } = await import("../../lib/storage.js");

  const image = await generateBoardExplanationImage({
    query: priorUser?.content || "Explain this concept",
    answer: message.content,
  });

  const key = `diagrams/${message.chat.projectId}/${message.id}.png`;
  await putObject(key, image.data, image.mimeType);

  await prisma.message.update({
    where: { id: messageId },
    data: { diagramKey: key, diagramWorthy: true },
  });

  return {
    messageId,
    mimeType: image.mimeType,
    imageBase64: image.data.toString("base64"),
  };
}

export async function getMessageDiagram(messageId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw new AppError("NOT_FOUND", "Message not found", 404);
  if (!message.diagramKey) {
    throw new AppError("NOT_FOUND", "No diagram for this message", 404);
  }
  const { getObjectBuffer } = await import("../../lib/storage.js");
  const buffer = await getObjectBuffer(message.diagramKey);
  return {
    mimeType: "image/png",
    buffer,
  };
}
