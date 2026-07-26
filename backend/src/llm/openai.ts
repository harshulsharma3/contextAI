import { AppError } from "../lib/errors.js";
import type { GenerateOptions, LLMProvider, StreamChunk } from "./provider.js";

/** Stub — implement when OPENAI_API_KEY is configured. */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";

  async embed(_texts: string[]): Promise<number[][]> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "OpenAI provider not implemented yet. Set LLM_PROVIDER=gemini.",
      501
    );
  }

  async generate(_opts: GenerateOptions): Promise<string> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "OpenAI provider not implemented yet. Set LLM_PROVIDER=gemini.",
      501
    );
  }

  async *generateStream(_opts: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "OpenAI provider not implemented yet. Set LLM_PROVIDER=gemini.",
      501
    );
  }

  async generateJSON<T>(_opts: GenerateOptions, _schemaHint?: string): Promise<T> {
    throw new AppError(
      "LLM_NOT_IMPLEMENTED",
      "OpenAI provider not implemented yet. Set LLM_PROVIDER=gemini.",
      501
    );
  }
}
