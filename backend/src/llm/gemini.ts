import {
  GoogleGenerativeAI,
  TaskType,
} from "@google/generative-ai";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import type {
  GenerateOptions,
  LLMProvider,
  StreamChunk,
} from "./provider.js";
import { embedConfig, sleep, withRetry } from "./retry.js";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey = env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new AppError("LLM_CONFIG", "GEMINI_API_KEY is required", 500);
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const model = this.client.getGenerativeModel({
      model: env.EMBEDDING_MODEL,
    });

    const batchSize = Math.max(1, embedConfig.batchSize);
    const out: number[][] = [];
    const totalBatches = Math.ceil(texts.length / batchSize);

    logger.info(
      {
        texts: texts.length,
        batchSize,
        totalBatches,
        delayMs: embedConfig.batchDelayMs,
      },
      "Starting throttled embedding"
    );

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batch = texts.slice(i, i + batchSize);

      // Truncate oversized texts to reduce payload / token burn
      const sanitized = batch.map((t) =>
        t.length > 8000 ? t.slice(0, 8000) : t
      );

      const result = await withRetry(
        () =>
          model.batchEmbedContents({
            requests: sanitized.map((text) => ({
              content: { role: "user", parts: [{ text }] },
              taskType: TaskType.RETRIEVAL_DOCUMENT,
            })),
          }),
        `embed-batch-${batchIndex}/${totalBatches}`,
        { attempts: 5, baseDelayMs: 1000 }
      );

      for (const emb of result.embeddings) {
        const values = emb.values.slice(0, env.EMBEDDING_DIM);
        while (values.length < env.EMBEDDING_DIM) values.push(0);
        out.push(values);
      }

      // Throttle between batches (skip after last)
      if (i + batchSize < texts.length) {
        await sleep(embedConfig.batchDelayMs);
      }
    }

    return out;
  }

  async generate(opts: GenerateOptions): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: opts.model ?? env.CHAT_MODEL,
      systemInstruction: opts.system,
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxTokens ?? 2048,
      },
    });

    const result = await withRetry(
      () => model.generateContent(opts.prompt),
      "generate",
      { attempts: 4 }
    );
    return result.response.text();
  }

  async *generateStream(opts: GenerateOptions): AsyncIterable<StreamChunk> {
    const model = this.client.getGenerativeModel({
      model: opts.model ?? env.CHAT_MODEL,
      systemInstruction: opts.system,
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxTokens ?? 2048,
      },
    });

    const stream = await model.generateContentStream(opts.prompt);
    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) yield { text };
    }
  }

  async generateJSON<T>(opts: GenerateOptions, schemaHint?: string): Promise<T> {
    const prompt = `${opts.prompt}

Respond with ONLY valid JSON${schemaHint ? ` matching this shape: ${schemaHint}` : ""}. No markdown fences.`;
    const raw = await this.generate({
      ...opts,
      prompt,
      model: opts.model ?? env.LIGHT_MODEL,
      temperature: opts.temperature ?? 0.1,
    });

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new AppError("LLM_JSON_PARSE", "Failed to parse LLM JSON response", 502, {
        raw: cleaned.slice(0, 500),
      });
    }
  }

  async generateImage(prompt: string): Promise<{ mimeType: string; data: Buffer }> {
    const model = env.IMAGE_MODEL;
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError("LLM_CONFIG", "GEMINI_API_KEY is required for images", 500);
    }

    logger.info({ model }, "Generating board image");

    // Imagen (imagen-*) uses :predict. Gemini image models use :generateContent.
    if (model.startsWith("imagen-")) {
      return this.generateImagenImage(model, apiKey, prompt);
    }
    return this.generateGeminiNativeImage(model, apiKey, prompt);
  }

  /** Imagen 4 family — REST :predict. */
  private async generateImagenImage(
    model: string,
    apiKey: string,
    prompt: string
  ): Promise<{ mimeType: string; data: Buffer }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict?key=${apiKey}`;

    const result = await withRetry(
      async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "16:9",
              outputOptions: { mimeType: "image/png" },
            },
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          const err = new Error(
            `Image gen failed (${res.status}): ${body.slice(0, 600)}`
          );
          (err as Error & { status?: number }).status = res.status;
          throw err;
        }
        return res.json() as Promise<{
          predictions?: Array<{
            bytesBase64Encoded?: string;
            mimeType?: string;
          }>;
          error?: { message?: string };
        }>;
      },
      "generateImage-imagen",
      { attempts: 2, baseDelayMs: 2000 }
    );

    if (result.error?.message) {
      throw new AppError("IMAGE_GEN_FAILED", result.error.message, 502);
    }

    const pred = result.predictions?.[0];
    if (pred?.bytesBase64Encoded) {
      return {
        mimeType: pred.mimeType || "image/png",
        data: Buffer.from(pred.bytesBase64Encoded, "base64"),
      };
    }

    throw new AppError(
      "IMAGE_GEN_EMPTY",
      `Imagen model "${model}" returned no image.`,
      502
    );
  }

  /**
   * Gemini native image models (e.g. gemini-2.5-flash-image) — :generateContent
   * with responseModalities IMAGE (and TEXT+IMAGE fallback).
   */
  private async generateGeminiNativeImage(
    model: string,
    apiKey: string,
    prompt: string
  ): Promise<{ mimeType: string; data: Buffer }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

    type ImageGenResponse = {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
        finishReason?: string;
      }>;
      error?: { message?: string; code?: number };
    };

    const callGenerateContent = async (
      modalities: Array<"IMAGE" | "TEXT">
    ): Promise<ImageGenResponse> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: modalities,
            temperature: 0.35,
            imageConfig: { aspectRatio: "16:9" },
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        const err = new Error(
          `Image gen failed (${res.status}): ${body.slice(0, 600)}`
        );
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      return res.json() as Promise<ImageGenResponse>;
    };

    const extractImage = (
      result: ImageGenResponse
    ): { mimeType: string; data: Buffer } | null => {
      if (result.error?.message) {
        throw new AppError("IMAGE_GEN_FAILED", result.error.message, 502);
      }
      for (const part of result.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          return {
            mimeType: part.inlineData.mimeType || "image/png",
            data: Buffer.from(part.inlineData.data, "base64"),
          };
        }
      }
      return null;
    };

    const primary = await withRetry(
      () => callGenerateContent(["IMAGE"]),
      "generateImage",
      { attempts: 2, baseDelayMs: 2000 }
    );
    const fromPrimary = extractImage(primary);
    if (fromPrimary) return fromPrimary;

    logger.info({ model }, "No image in IMAGE-only response; retrying with TEXT+IMAGE");
    const fallback = await withRetry(
      () => callGenerateContent(["TEXT", "IMAGE"]),
      "generateImage-fallback",
      { attempts: 1 }
    );
    const fromFallback = extractImage(fallback);
    if (fromFallback) return fromFallback;

    throw new AppError(
      "IMAGE_GEN_EMPTY",
      `Image model "${model}" returned no image via :generateContent. Check IMAGE_MODEL=gemini-2.5-flash-image and API quota.`,
      502
    );
  }
}
