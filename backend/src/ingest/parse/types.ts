export interface LocatedSegment {
  content: string;
  startMs?: number;
  endMs?: number;
  page?: number;
  locatorLabel: string;
}

export interface ParseResult {
  segments: LocatedSegment[];
  durationSeconds?: number;
  pageCount?: number;
  title?: string;
  fullText: string;
}

export function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimestampToMs(ts: string): number {
  // Supports 00:01:23.456 or 01:23.456 or 01:23
  const clean = ts.trim().replace(",", ".");
  const parts = clean.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return (
      (parseInt(h!, 10) * 3600 + parseInt(m!, 10) * 60 + parseFloat(s!)) * 1000
    );
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return (parseInt(m!, 10) * 60 + parseFloat(s!)) * 1000;
  }
  return 0;
}
