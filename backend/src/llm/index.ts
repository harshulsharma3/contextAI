import { env } from "../config/env.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAIProvider } from "./openai.js";
import type { LLMProvider } from "./provider.js";

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;

  switch (env.LLM_PROVIDER) {
    case "openai":
      cached = new OpenAIProvider();
      break;
    case "anthropic":
      cached = new AnthropicProvider();
      break;
    case "gemini":
    default:
      cached = new GeminiProvider();
      break;
  }

  return cached;
}

export type { LLMProvider, GenerateOptions, StreamChunk } from "./provider.js";
