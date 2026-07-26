export interface GenerateOptions {
  model?: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamChunk {
  text: string;
}

export interface GeneratedImage {
  mimeType: string;
  data: Buffer;
}

export interface LLMProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
  generate(opts: GenerateOptions): Promise<string>;
  generateStream(opts: GenerateOptions): AsyncIterable<StreamChunk>;
  generateJSON<T>(opts: GenerateOptions, schemaHint?: string): Promise<T>;
  generateImage?(prompt: string): Promise<GeneratedImage>;
}
