import { env } from "../config/env.js";
import { getLLM } from "../llm/index.js";

export async function rewriteQuery(query: string): Promise<{
  abstract: string;
  concrete: string;
}> {
  const llm = getLLM();
  const result = await llm.generateJSON<{ abstract: string; concrete: string }>(
    {
      model: env.LIGHT_MODEL,
      prompt: `Rewrite the user question for retrieval.
User question: """${query}"""
Return JSON with:
- abstract: a more conceptual/high-level version
- concrete: a more specific/keyword-rich version`,
    },
    '{ "abstract": string, "concrete": string }'
  );
  return {
    abstract: result.abstract || query,
    concrete: result.concrete || query,
  };
}
