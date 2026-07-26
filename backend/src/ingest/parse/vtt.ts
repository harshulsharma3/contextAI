import type { ParseResult } from "./types.js";
import { msToTimestamp, parseTimestampToMs } from "./types.js";

export function parseVtt(raw: string): ParseResult {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const segments: ParseResult["segments"] = [];
  let i = 0;
  let maxEnd = 0;

  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (line.includes("-->")) {
      const [startRaw, endRaw] = line.split("-->").map((s) => s.trim().split(" ")[0]!);
      const startMs = parseTimestampToMs(startRaw!);
      const endMs = parseTimestampToMs(endRaw!);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i]!.trim() !== "") {
        textLines.push(lines[i]!.trim());
        i++;
      }
      const content = textLines.join(" ").replace(/<[^>]+>/g, "").trim();
      if (content) {
        segments.push({
          content,
          startMs,
          endMs,
          locatorLabel: msToTimestamp(startMs),
        });
        maxEnd = Math.max(maxEnd, endMs);
      }
    }
    i++;
  }

  return {
    segments,
    durationSeconds: Math.ceil(maxEnd / 1000),
    fullText: segments.map((s) => s.content).join(" "),
  };
}
