import { AppError } from "../lib/errors.js";
import type { GenerateOptions, LLMProvider, StreamChunk } from "./provider.js";

/** Stub — implement when ANTHROPIC_API_KEY is configured. */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";

  async embed(_texts: string[]): Promise<number[][]> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "Anthropic provider does not support embeddings. Use Gemini/OpenAI for embeddings or set LLM_PROVIDER=gemini.",
      501
    );
  }

  async generate(_opts: GenerateOptions): Promise<string> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "Anthropic provider not implemented yet. Set LLM_PROVIDER=gemini.",
      501
    );
  }

  async *generateStream(_opts: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "Anthropic provider not implemented yet. Set LLM_PROVIDER=gemini.",
      501
    );
  }

  async generateJSON<T>(_opts: GenerateOptions, _schemaHint?: string): Promise<T> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "Anthropic provider not implemented yet. Set LLM_PROVIDER=gemini.",
      501
    );
  }
}
