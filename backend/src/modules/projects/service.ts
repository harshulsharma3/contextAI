import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/errors.js";

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return "0h";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export async function createProject(name: string) {
  return prisma.project.create({ data: { name } });
}

export async function listProjects() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      sources: {
        select: {
          status: true,
          durationSeconds: true,
          chunkCount: true,
        },
      },
      _count: { select: { chats: true } },
    },
  });

  return projects.map((p) => {
    const ready = p.sources.filter((s) => s.status === "ready");
    const indexing = p.sources.filter(
      (s) => s.status === "indexing" || s.status === "pending"
    ).length;
    const totalDuration = ready.reduce(
      (sum, s) => sum + (s.durationSeconds || 0),
      0
    );
    const knowledgeChunks = ready.reduce(
      (sum, s) => sum + (s.chunkCount || 0),
      0
    );
    return {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      stats: {
        sourcesIndexed: ready.length,
        sourcesTotal: p.sources.length,
        sourcesIndexing: indexing,
        totalDurationLabel: formatDuration(totalDuration),
        knowledgeChunks,
        chatCount: p._count.chats,
      },
    };
  });
}

export async function getProjectDetail(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      sources: { orderBy: { createdAt: "desc" } },
      chats: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!project) throw new AppError("NOT_FOUND", "Project not found", 404);

  const readySources = project.sources.filter((s) => s.status === "ready");
  const totalDuration = readySources.reduce(
    (sum, s) => sum + (s.durationSeconds || 0),
    0
  );
  const knowledgeChunks = readySources.reduce(
    (sum, s) => sum + (s.chunkCount || 0),
    0
  );

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    stats: {
      sourcesIndexed: readySources.length,
      totalDurationLabel: formatDuration(totalDuration),
      knowledgeChunks,
    },
    sources: project.sources.map(mapSource),
    recentChats: project.chats.map((c) => ({
      id: c.id,
      title: c.title,
      preview: c.messages[0]?.content?.slice(0, 120) || "",
    })),
  };
}

export function mapSource(s: {
  id: string;
  name: string;
  fileName: string;
  type: string;
  label: string | null;
  status: string;
  durationSeconds: number | null;
  chunkCount: number;
  createdAt: Date;
  error: string | null;
  sourceUrl?: string | null;
}) {
  return {
    id: s.id,
    name: s.name,
    fileName: s.fileName,
    type: s.type,
    label: s.label ?? undefined,
    status: s.status,
    durationSeconds: s.durationSeconds ?? undefined,
    chunkCount: s.chunkCount,
    createdAt: s.createdAt.toISOString(),
    error: s.error ?? undefined,
    sourceUrl: s.sourceUrl ?? undefined,
  };
}

export async function updateProject(id: string, name: string) {
  try {
    return await prisma.project.update({ where: { id }, data: { name } });
  } catch {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }
}

export async function deleteProject(id: string) {
  try {
    await prisma.project.delete({ where: { id } });
  } catch {
    throw new AppError("NOT_FOUND", "Project not found", 404);
  }
}
