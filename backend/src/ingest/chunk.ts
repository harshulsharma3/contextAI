import type { LocatedSegment } from "./parse/types.js";
import { embedConfig } from "../llm/retry.js";

export interface ChunkDraft {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  startMs?: number;
  endMs?: number;
  page?: number;
  locatorLabel: string;
}

function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).length * 1.3));
}

/**
 * Merge located segments into overlapping windows of ~targetTokens.
 * Optionally caps total chunks by raising target size (fewer embed API calls).
 */
export function chunkSegments(
  segments: LocatedSegment[],
  opts: {
    targetTokens?: number;
    overlapTokens?: number;
    maxChunks?: number;
  } = {}
): ChunkDraft[] {
  let targetTokens = opts.targetTokens ?? embedConfig.targetTokens;
  const overlapTokens = opts.overlapTokens ?? embedConfig.overlapTokens;
  const maxChunks = opts.maxChunks ?? embedConfig.maxChunks;

  if (segments.length === 0) return [];

  const build = (target: number): ChunkDraft[] => {
    const chunks: ChunkDraft[] = [];
    let buf: LocatedSegment[] = [];
    let bufTokens = 0;

    const flush = () => {
      if (buf.length === 0) return;
      const content = buf.map((s) => s.content).join(" ").trim();
      if (!content) {
        buf = [];
        bufTokens = 0;
        return;
      }
      const first = buf[0]!;
      const last = buf[buf.length - 1]!;
      chunks.push({
        chunkIndex: chunks.length,
        content,
        tokenCount: approxTokens(content),
        startMs: first.startMs,
        endMs: last.endMs,
        page: first.page,
        locatorLabel: first.locatorLabel,
      });

      let kept: LocatedSegment[] = [];
      let keptTokens = 0;
      for (let i = buf.length - 1; i >= 0; i--) {
        const t = approxTokens(buf[i]!.content);
        if (keptTokens + t > overlapTokens && kept.length > 0) break;
        kept.unshift(buf[i]!);
        keptTokens += t;
      }
      buf = kept;
      bufTokens = keptTokens;
    };

    for (const seg of segments) {
      const t = approxTokens(seg.content);
      // If a single segment is huge, split by words
      if (t > target * 1.5) {
        if (buf.length) flush();
        const words = seg.content.split(/\s+/);
        let part: string[] = [];
        let partTokens = 0;
        for (const w of words) {
          part.push(w);
          partTokens += 1.3;
          if (partTokens >= target) {
            const content = part.join(" ");
            chunks.push({
              chunkIndex: chunks.length,
              content,
              tokenCount: approxTokens(content),
              startMs: seg.startMs,
              endMs: seg.endMs,
              page: seg.page,
              locatorLabel: seg.locatorLabel,
            });
            // small overlap
            part = part.slice(-Math.floor(overlapTokens / 1.3));
            partTokens = part.length * 1.3;
          }
        }
        if (part.length) {
          const content = part.join(" ");
          chunks.push({
            chunkIndex: chunks.length,
            content,
            tokenCount: approxTokens(content),
            startMs: seg.startMs,
            endMs: seg.endMs,
            page: seg.page,
            locatorLabel: seg.locatorLabel,
          });
        }
        buf = [];
        bufTokens = 0;
        continue;
      }

      if (bufTokens + t > target && buf.length > 0) flush();
      buf.push(seg);
      bufTokens += t;
    }
    flush();
    return chunks;
  };

  let chunks = build(targetTokens);

  // If still too many chunks, coarsen until under cap (or target gets huge)
  while (chunks.length > maxChunks && targetTokens < 2500) {
    targetTokens = Math.floor(targetTokens * 1.35);
    chunks = build(targetTokens);
  }

  // Hard cap: merge adjacent leftover chunks
  if (chunks.length > maxChunks) {
    const merged: ChunkDraft[] = [];
    const groupSize = Math.ceil(chunks.length / maxChunks);
    for (let i = 0; i < chunks.length; i += groupSize) {
      const group = chunks.slice(i, i + groupSize);
      const first = group[0]!;
      const last = group[group.length - 1]!;
      const content = group.map((c) => c.content).join(" ");
      merged.push({
        chunkIndex: merged.length,
        content,
        tokenCount: approxTokens(content),
        startMs: first.startMs,
        endMs: last.endMs,
        page: first.page,
        locatorLabel: first.locatorLabel,
      });
    }
    chunks = merged;
  }

  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}
