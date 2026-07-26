import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { getLLM } from "../llm/index.js";

const INJECTION_PATTERNS = [
  /ignore (all|previous|above) instructions/i,
  /system prompt/i,
  /jailbreak/i,
  /dan mode/i,
];

export async function inputGuardrails(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new AppError("EMPTY_QUERY", "Message cannot be empty", 400);
  }
  if (trimmed.length > 8000) {
    throw new AppError("QUERY_TOO_LONG", "Message is too long", 400);
  }
  for (const re of INJECTION_PATTERNS) {
    if (re.test(trimmed)) {
      throw new AppError(
        "UNSAFE_INPUT",
        "Your message was blocked by safety checks.",
        400
      );
    }
  }
}

export async function outputGuardrails(answer: string): Promise<string> {
  // Light pass — strip accidental system leakage
  let cleaned = answer.trim();
  if (/^as an ai language model/i.test(cleaned)) {
    cleaned = cleaned.replace(/^as an ai language model[^.]*\.\s*/i, "");
  }

  // Optional LLM check for egregious issues
  if (cleaned.length > 50) {
    try {
      const llm = getLLM();
      const result = await llm.generateJSON<{ safe: boolean; reason?: string }>(
        {
          model: env.LIGHT_MODEL,
          prompt: `Is this educational answer safe to show a student (no hate, self-harm instructions, or prompt leaks or internal private DB data)? Return { "safe": boolean, "reason"?: string }.
Answer: """${cleaned.slice(0, 2000)}"""`,
        },
        '{ "safe": boolean, "reason"?: string }'
      );
      if (result.safe === false) {
        throw new AppError(
          "UNSAFE_OUTPUT",
          result.reason || "Answer blocked by safety checks",
          400
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Don't fail the whole request if light model check fails
    }
  }

  return cleaned;
}
