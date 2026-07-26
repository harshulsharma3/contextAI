"use client";

import { Loader2 } from "lucide-react";

interface AnalysisProgressModalProps {
  open: boolean;
  message: string;
  progress: number;
}

export function AnalysisProgressModal({
  open,
  message,
  progress,
}: AnalysisProgressModalProps) {
  if (!open) return null;

  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-white px-5 py-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-teal" />
          <p className="text-[13px] leading-relaxed text-ink">{message}</p>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-teal transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
