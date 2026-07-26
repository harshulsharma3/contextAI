import { env } from "../config/env.js";
import { getLLM } from "../llm/index.js";

export async function generateHydeAndSubqueries(query: string): Promise<{
  hyde: string;
  subQueries: string[];
}> {
  const llm = getLLM();
  const result = await llm.generateJSON<{ hyde: string; subQueries: string[] }>(
    {
      model: env.LIGHT_MODEL,
      prompt: `For RAG retrieval, given the user question, produce:
1) hyde: a short hypothetical answer paragraph that might appear in lecture notes
2) subQueries: 2-3 short sub-questions
User question: """${query}"""`,
    },
    '{ "hyde": string, "subQueries": string[] }'
  );
  return {
    hyde: result.hyde || query,
    subQueries: (result.subQueries || []).filter(Boolean).slice(0, 3),
  };
}
