import pdfParse from "pdf-parse";
import type { ParseResult } from "./types.js";

/**
 * Parse PDF into page-level (or large-slice) segments.
 * Prefer fewer, larger segments so the chunker produces ~50–80 embed calls
 * for a typical 50-page PDF instead of hundreds.
 */
export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  const fullText = (data.text || "").replace(/\r\n/g, "\n").trim();
  const pageCount = data.numpages || 1;

  const pages = fullText.includes("\f")
    ? fullText.split("\f")
    : splitTextIntoPages(fullText, pageCount);

  const segments: ParseResult["segments"] = [];

  pages.forEach((pageText, idx) => {
    const content = pageText.replace(/\s+/g, " ").trim();
    if (!content) return;

    // ~2800 chars ≈ 700–900 tokens — one slice per page when possible
    const sliceSize = 2800;
    const overlap = 200;

    if (content.length <= sliceSize) {
      segments.push({
        content,
        page: idx + 1,
        locatorLabel: `p.${idx + 1}`,
      });
      return;
    }

    for (let i = 0; i < content.length; i += sliceSize - overlap) {
      const slice = content.slice(i, i + sliceSize).trim();
      if (slice) {
        segments.push({
          content: slice,
          page: idx + 1,
          locatorLabel: `p.${idx + 1}`,
        });
      }
    }
  });

  return {
    segments,
    pageCount,
    title: data.info?.Title,
    fullText,
  };
}

/** When pdf-parse doesn't emit form-feeds, approximate page breaks by length. */
function splitTextIntoPages(text: string, pageCount: number): string[] {
  if (pageCount <= 1 || !text) return [text];
  const target = Math.ceil(text.length / pageCount);
  const pages: string[] = [];
  let start = 0;
  for (let p = 0; p < pageCount - 1; p++) {
    let end = Math.min(text.length, start + target);
    // Prefer break at paragraph/sentence
    const window = text.slice(end, Math.min(text.length, end + 200));
    const breakAt = window.search(/[\n.]/);
    if (breakAt >= 0) end += breakAt + 1;
    pages.push(text.slice(start, end));
    start = end;
  }
  pages.push(text.slice(start));
  return pages.filter((p) => p.trim());
}
