import { env } from "../config/env.js";
import { getLLM } from "../llm/index.js";

export async function evaluateAnswer(opts: {
  query: string;
  answer: string;
}): Promise<number> {
  const llm = getLLM();
  const result = await llm.generateJSON<{ score: number }>(
    {
      model: env.LIGHT_MODEL,
      prompt: `Score the answer from 0-10 for groundedness, relevance, and clarity given the question.
Question: """${opts.query}"""
Answer: """${opts.answer}"""
Return JSON { "score": number }.`,
    },
    '{ "score": number }'
  );
  const score = Number(result.score);
  if (Number.isNaN(score)) return 5;
  return Math.max(0, Math.min(10, score));
}
