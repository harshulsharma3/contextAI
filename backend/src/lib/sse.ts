import type { Response } from "express";

export function initSse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function sendSse(
  res: Response,
  event: string,
  data: unknown
) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function endSse(res: Response) {
  res.write("event: done\ndata: {}\n\n");
  res.end();
}
