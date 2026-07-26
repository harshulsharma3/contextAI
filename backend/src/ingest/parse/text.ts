import type { ParseResult } from "./types.js";

export function parseText(raw: string, title?: string): ParseResult {
  const cleaned = raw.replace(/\r\n/g, "\n").trim();
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  const segments = paragraphs.map((content, idx) => ({
    content,
    locatorLabel: `§${idx + 1}`,
  }));

  return {
    segments:
      segments.length > 0
        ? segments
        : cleaned
          ? [{ content: cleaned, locatorLabel: "§1" }]
          : [],
    title,
    fullText: cleaned,
  };
}
