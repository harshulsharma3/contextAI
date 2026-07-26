import { prisma } from "../db/prisma.js";
import { toPgVectorLiteral } from "../ingest/embed.js";
import { getLLM } from "../llm/index.js";

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  projectId: string;
  content: string;
  locatorLabel: string;
  startMs: number | null;
  endMs: number | null;
  page: number | null;
  sourceName: string;
  sourceLabel: string | null;
  sourceType: string;
  sourceUrl: string | null;
  hasFile: boolean;
  fileName: string;
  score: number;
}

export async function vectorSearch(opts: {
  projectId: string;
  queryEmbedding: number[];
  sourceIds?: string[];
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const limit = opts.limit ?? 8;
  const vector = toPgVectorLiteral(opts.queryEmbedding);

  const sourceFilter =
    opts.sourceIds && opts.sourceIds.length > 0
      ? `AND c."sourceId" = ANY($3::text[])`
      : "";

  const params: unknown[] = [opts.projectId, vector, ...(opts.sourceIds?.length ? [opts.sourceIds] : []), limit];
  const limitIdx = opts.sourceIds?.length ? 4 : 3;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      sourceId: string;
      projectId: string;
      content: string;
      locatorLabel: string;
      startMs: number | null;
      endMs: number | null;
      page: number | null;
      sourceName: string;
      sourceLabel: string | null;
      sourceType: string;
      sourceUrl: string | null;
      hasFile: boolean;
      fileName: string;
      score: number;
    }>
  >(
    `SELECT c.id, c."sourceId", c."projectId", c.content, c."locatorLabel", c."startMs", c."endMs", c.page,
            s.name AS "sourceName", s.label AS "sourceLabel", s.type AS "sourceType",
            s."sourceUrl" AS "sourceUrl", (s."storageKey" IS NOT NULL) AS "hasFile",
            s."fileName" AS "fileName",
            1 - (c.embedding <=> $2::vector) AS score
     FROM "Chunk" c
     JOIN "Source" s ON s.id = c."sourceId"
     WHERE c."projectId" = $1
       AND c.embedding IS NOT NULL
       AND s.status = 'ready'
       ${sourceFilter}
     ORDER BY c.embedding <=> $2::vector
     LIMIT $${limitIdx}`,
    ...params
  );

  return rows.map((r) => ({
    ...r,
    hasFile: Boolean(r.hasFile),
  }));
}

export async function retrieveForQueries(opts: {
  projectId: string;
  queries: string[];
  sourceIds?: string[];
  perQueryLimit?: number;
}): Promise<RetrievedChunk[]> {
  const llm = getLLM();
  const embeddings = await llm.embed(opts.queries);
  const all: RetrievedChunk[] = [];

  for (const emb of embeddings) {
    const hits = await vectorSearch({
      projectId: opts.projectId,
      queryEmbedding: emb,
      sourceIds: opts.sourceIds,
      limit: opts.perQueryLimit ?? 6,
    });
    all.push(...hits);
  }

  // Dedupe by chunk id, keep best score
  const map = new Map<string, RetrievedChunk>();
  for (const hit of all) {
    const prev = map.get(hit.id);
    if (!prev || hit.score > prev.score) map.set(hit.id, hit);
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}
