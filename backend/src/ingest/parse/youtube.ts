import { YoutubeTranscript } from "youtube-transcript";
import type { ParseResult } from "./types.js";
import { msToTimestamp } from "./types.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1]!;
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1]!;
  } catch {
    return null;
  }
  return null;
}

async function fetchOEmbed(url: string): Promise<{ title?: string }> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return {};
    const data = (await res.json()) as { title?: string };
    return { title: data.title };
  } catch {
    return {};
  }
}

export async function parseYoutube(url: string): Promise<ParseResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new AppError("INVALID_YOUTUBE_URL", "Could not parse YouTube video id", 400);
  }

  // Optional proxy via env (for cloud IP rate limits) — library uses fetch under the hood
  if (env.YT_PROXY_URL) {
    // Best-effort: set global dispatcher isn't available here; document for ops.
  }

  let items: { text: string; offset: number; duration: number }[];
  try {
    items = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (err) {
    throw new AppError(
      "YOUTUBE_NO_CAPTIONS",
      "Could not fetch captions for this YouTube video. Captions may be disabled.",
      422,
      { cause: err instanceof Error ? err.message : String(err) }
    );
  }

  if (!items.length) {
    throw new AppError(
      "YOUTUBE_NO_CAPTIONS",
      "No captions found for this YouTube video",
      422
    );
  }

  const meta = await fetchOEmbed(url);
  let maxEnd = 0;
  const segments = items
    .map((item) => {
      // InnerTube path returns ms; classic XML path returns seconds (float)
      const isSeconds =
        !Number.isInteger(item.offset) ||
        (!Number.isInteger(item.duration) && item.duration < 120);
      const startMs = Math.round(
        isSeconds ? item.offset * 1000 : item.offset
      );
      const endMs = Math.round(
        startMs + (isSeconds ? item.duration * 1000 : item.duration)
      );
      maxEnd = Math.max(maxEnd, endMs);
      return {
        content: item.text.replace(/\s+/g, " ").trim(),
        startMs,
        endMs,
        locatorLabel: msToTimestamp(startMs),
      };
    })
    .filter((s) => s.content);

  return {
    segments,
    durationSeconds: Math.ceil(maxEnd / 1000),
    title: meta.title,
    fullText: segments.map((s) => s.content).join(" "),
  };
}
