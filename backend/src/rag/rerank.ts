import { env } from "../config/env.js";
import { getLLM } from "../llm/index.js";
import type { RetrievedChunk } from "./retrieve.js";

export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topK = 5
): Promise<RetrievedChunk[]> {
  if (chunks.length <= topK) return chunks;

  const llm = getLLM();
  const catalog = chunks
    .slice(0, 20)
    .map(
      (c, i) =>
        `[${i}] score=${c.score.toFixed(3)} loc=${c.locatorLabel}\n${c.content.slice(0, 400)}`
    )
    .join("\n\n");

  const result = await llm.generateJSON<{ indices: number[] }>(
    {
      model: env.LIGHT_MODEL,
      prompt: `Rank the passages by relevance to the question. Return the top ${topK} indices (0-based) as JSON { "indices": number[] }.
Question: """${query}"""

Passages:
${catalog}`,
    },
    '{ "indices": number[] }'
  );

  const indices = (result.indices || [])
    .filter((i) => Number.isInteger(i) && i >= 0 && i < chunks.length)
    .slice(0, topK);

  if (indices.length === 0) return chunks.slice(0, topK);
  return indices.map((i) => chunks[i]!);
}
