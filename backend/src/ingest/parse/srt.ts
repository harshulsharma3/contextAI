import type { ParseResult } from "./types.js";
import { msToTimestamp, parseTimestampToMs } from "./types.js";

export function parseSrt(raw: string): ParseResult {
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\n+/);
  const segments: ParseResult["segments"] = [];
  let maxEnd = 0;

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startRaw, endRaw] = timeLine
      .split("-->")
      .map((s) => s.trim().split(" ")[0]!);
    const startMs = parseTimestampToMs(startRaw!);
    const endMs = parseTimestampToMs(endRaw!);
    const content = lines
      .slice(lines.indexOf(timeLine) + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!content) continue;
    segments.push({
      content,
      startMs,
      endMs,
      locatorLabel: msToTimestamp(startMs),
    });
    maxEnd = Math.max(maxEnd, endMs);
  }

  return {
    segments,
    durationSeconds: Math.ceil(maxEnd / 1000),
    fullText: segments.map((s) => s.content).join(" "),
  };
}
