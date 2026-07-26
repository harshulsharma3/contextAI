"use client";

import { MapPin } from "lucide-react";
import type { Citation } from "@/types";

interface SourceChipProps {
  citation: Citation;
  onClick?: (citation: Citation) => void;
}

export function SourceChip({ citation, onClick }: SourceChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(citation)}
      className={`inline-flex items-center gap-1.5 rounded-full bg-teal px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-teal-hover ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
      title={onClick ? "Open source at this location" : undefined}
    >
      <MapPin className="h-3 w-3" strokeWidth={2.25} />
      {citation.sourceLabel} — {citation.timestamp}
    </button>
  );
}
