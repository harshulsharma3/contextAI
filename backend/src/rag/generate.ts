import { getLLM } from "../llm/index.js";
import type { RetrievedChunk } from "./retrieve.js";

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const label = c.sourceLabel
        ? `${c.sourceLabel}: ${c.sourceName}`
        : c.sourceName;
      return `[${i + 1}] (${label} — ${c.locatorLabel})\n${c.content}`;
    })
    .join("\n\n");
}

export async function* generateGroundedAnswer(opts: {
  query: string;
  chunks: RetrievedChunk[];
}): AsyncIterable<string> {
  const llm = getLLM();
  const context = buildContextBlock(opts.chunks);

  const system = `You are ContextAI, a study assistant. Answer ONLY using the provided source excerpts.
If the sources do not contain enough information, say so clearly.
Cite sources inline like [1], [2] referring to the excerpt numbers.
Be clear, structured, and educational.`;

  const prompt = `Sources:
${context}

Student question: ${opts.query}

Write a grounded answer with citations.`;

  for await (const chunk of llm.generateStream({ system, prompt })) {
    yield chunk.text;
  }
}

export async function generateGroundedAnswerSync(opts: {
  query: string;
  chunks: RetrievedChunk[];
}): Promise<string> {
  const llm = getLLM();
  const context = buildContextBlock(opts.chunks);
  const system = `You are ContextAI, a study assistant. Answer ONLY using the provided source excerpts.
If the sources do not contain enough information, say so clearly.
Cite sources inline like [1], [2]. Be clear and educational.`;

  return llm.generate({
    system,
    prompt: `Sources:\n${context}\n\nStudent question: ${opts.query}\n\nWrite a grounded answer with citations.`,
  });
}
