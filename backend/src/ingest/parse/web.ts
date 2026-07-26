import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { AppError } from "../../lib/errors.js";
import type { ParseResult } from "./types.js";
import { parseText } from "./text.js";

const MIN_TEXT_LENGTH = 200;

export async function parseWebLink(url: string): Promise<ParseResult> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ContextAIBot/1.0; +https://contextai.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new AppError(
        "WEB_FETCH_FAILED",
        `Failed to fetch URL (HTTP ${res.status})`,
        422
      );
    }
    html = await res.text();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      "WEB_FETCH_FAILED",
      "Failed to fetch or parse web page",
      422,
      { cause: err instanceof Error ? err.message : String(err) }
    );
  }

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const text = (article?.textContent || "").replace(/\s+/g, " ").trim();
  if (text.length < MIN_TEXT_LENGTH) {
    throw new AppError(
      "WEB_CONTENT_TOO_SHORT",
      "Extracted too little text. The page may be JavaScript-rendered, paywalled, or login-gated.",
      422
    );
  }

  const result = parseText(text, article?.title || undefined);
  return result;
}
