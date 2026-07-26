import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string; statusText?: string };
  if (e.status === 429) return true;
  const msg = `${e.message ?? ""} ${e.statusText ?? ""}`.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted")
  );
}

/** True when Google reports free-tier quota is fully exhausted (retries won't help). */
export function isHardQuotaExhausted(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("limit: 0") ||
    (msg.includes("free_tier") && msg.includes("quota exceeded")) ||
    msg.includes("check your plan and billing")
  );
}

export function friendlyLlmError(err: unknown, label = ""): string {
  if (isRateLimitError(err)) {
    const lower = label.toLowerCase();
    if (lower.includes("image") || lower.includes("diagram")) {
      return (
        "Gemini image generation quota exceeded. Free-tier image limits are often 0 or very low — " +
        "enable billing in Google AI Studio, wait for the daily reset, or switch IMAGE_MODEL " +
        "(e.g. gemini-2.5-flash-image). See https://ai.google.dev/gemini-api/docs/rate-limits"
      );
    }
    if (lower.includes("embed")) {
      return (
        "Embedding rate limit / quota exceeded for the Gemini API. Wait a few minutes and try again, " +
        "or enable billing for higher limits. Tip: smaller documents index with fewer API calls."
      );
    }
    return (
      "Gemini API rate limit / quota exceeded. Wait a few minutes and try again, " +
      "or enable billing for higher limits: https://ai.google.dev/gemini-api/docs/rate-limits"
    );
  }
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Retry with exponential backoff. Rate-limit (429) waits much longer.
 * Hard quota exhaustion (limit: 0 / billing required) fails immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts: { attempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const attempts = opts.attempts ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 800;
  let last: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const rateLimited = isRateLimitError(err);
      const hardQuota = rateLimited && isHardQuotaExhausted(err);

      if (hardQuota) {
        logger.warn(
          {
            label,
            attempt: i + 1,
            err: err instanceof Error ? err.message : String(err),
          },
          "Hard quota exhausted — not retrying"
        );
        break;
      }

      const delay = rateLimited
        ? Math.min(60_000, 5_000 * Math.pow(2, i)) // 5s, 10s, 20s, 40s, 60s
        : Math.min(15_000, baseDelayMs * Math.pow(2, i));

      logger.warn(
        {
          label,
          attempt: i + 1,
          attempts,
          delayMs: delay,
          rateLimited,
          err: err instanceof Error ? err.message : String(err),
        },
        rateLimited
          ? "Rate limited — backing off before retry"
          : "LLM call failed, retrying"
      );

      if (i < attempts - 1) await sleep(delay);
    }
  }

  if (isRateLimitError(last)) {
    throw new AppError("RATE_LIMITED", friendlyLlmError(last, label), 429, {
      cause: last instanceof Error ? last.message : String(last),
    });
  }
  throw last;
}

export const embedConfig = {
  /** Keep small to stay under free-tier RPM */
  batchSize: Number(process.env.EMBED_BATCH_SIZE || 4),
  /** Pause between embedding batches (ms) */
  batchDelayMs: Number(process.env.EMBED_BATCH_DELAY_MS || 1500),
  /** Soft cap on chunks per source to limit API calls */
  maxChunks: Number(process.env.EMBED_MAX_CHUNKS || 80),
  targetTokens: Number(process.env.CHUNK_TARGET_TOKENS || 800),
  overlapTokens: Number(process.env.CHUNK_OVERLAP_TOKENS || 80),
};

// Ensure env is loaded (side-effect) so process.env overrides work after dotenv
void env;
