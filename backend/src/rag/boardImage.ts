import { getLLM } from "../llm/index.js";
import { AppError } from "../lib/errors.js";
import type { GeneratedImage } from "../llm/provider.js";

export async function generateBoardExplanationImage(opts: {
  query: string;
  answer: string;
}): Promise<GeneratedImage> {
  const llm = getLLM();
  if (!llm.generateImage) {
    throw new AppError(
      "IMAGE_UNSUPPORTED",
      "Current LLM provider does not support image generation. Use Gemini.",
      501
    );
  }

  // Keep the prompt short — image models count input tokens against quota.
  const topic = opts.query.replace(/\s+/g, " ").trim().slice(0, 180);
  const points = opts.answer
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);

  const prompt = `Chalkboard teaching poster (single 16:9 landscape image).
Topic: ${topic}
Teach these points simply: ${points}
Style: green school chalkboard, white/yellow chalk, small clear flowchart or labeled boxes with arrows, short labels only, calm classroom look, not cluttered, no photos, no logos.`;

  return llm.generateImage(prompt);
}
