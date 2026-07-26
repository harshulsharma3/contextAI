import { getLLM } from "../llm/index.js";
import type { ChunkDraft } from "./chunk.js";

export async function embedChunks(chunks: ChunkDraft[]): Promise<number[][]> {
  const llm = getLLM();
  const texts = chunks.map((c) => c.content);
  return llm.embed(texts);
}

export function toPgVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
