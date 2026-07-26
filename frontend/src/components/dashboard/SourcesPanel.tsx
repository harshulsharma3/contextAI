"use client";

import {
  FileText,
  FolderUp,
  Layers,
  Link2,
  Play,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Source, SourceType } from "@/types";
import { SourceCard } from "./SourceCard";

interface SourcesPanelProps {
  sources: Source[];
  onAddSourceType: (type: SourceType) => void;
  onBulkUpload?: () => void;
  onProjectQuiz?: () => void;
  onFlashcardQuiz: (source: Source) => void;
  onChatWithSource: (source: Source) => void;
  onRetryIndex?: (source: Source) => void;
  onDeleteSource?: (source: Source) => void;
}

const addButtons: {
  type: SourceType;
  label: string;
  icon: LucideIcon;
}[] = [
  { type: "pdf", label: "PDF", icon: FileText },
  { type: "youtube", label: "YouTube Link", icon: Play },
  { type: "text", label: "Text", icon: Type },
  { type: "vtt", label: "VTT Transcript", icon: FileText },
];

export function SourcesPanel({
  sources,
  onAddSourceType,
  onBulkUpload,
  onProjectQuiz,
  onFlashcardQuiz,
  onChatWithSource,
  onRetryIndex,
  onDeleteSource,
}: SourcesPanelProps) {
  const readyCount = sources.filter((s) => s.status === "ready").length;

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-border bg-cream">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-ink">
            Sources (Indexing/Indexed)
          </h2>
          {onProjectQuiz && (
            <button
              type="button"
              disabled={readyCount === 0}
              onClick={onProjectQuiz}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-semibold text-ink transition-colors hover:bg-cream-muted disabled:cursor-not-allowed disabled:opacity-40"
              title="Quiz across project sources"
            >
              <Layers className="h-3 w-3 text-terracotta" />
              Project Quiz
            </button>
          )}
        </div>
        <p className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Add New Source
        </p>

        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <div className="col-span-2 grid grid-cols-2 gap-2">
            {addButtons.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => onAddSourceType(type)}
                className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-2 py-3 text-center shadow-[0_1px_2px_rgba(26,23,20,0.04)] transition-colors hover:border-teal/30 hover:bg-cream-muted"
              >
                <Icon
                  className={`h-4 w-4 ${
                    type === "youtube" ? "text-[#FF0000]" : "text-ink-muted"
                  }`}
                  strokeWidth={1.75}
                />
                <span className="text-[11px] font-medium leading-tight text-ink">
                  {label}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onAddSourceType("weblink")}
            className="flex min-h-[152px] w-[72px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-white px-2 py-3 shadow-[0_1px_2px_rgba(26,23,20,0.04)] transition-colors hover:border-teal/30 hover:bg-cream-muted"
          >
            <Link2 className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
            <span className="text-center text-[11px] font-medium leading-tight text-ink">
              Web
              <br />
              Link
            </span>
            <Video className="h-3.5 w-3.5 text-ink-muted/50" strokeWidth={1.75} />
          </button>
        </div>

        {onBulkUpload && (
          <button
            type="button"
            onClick={onBulkUpload}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white px-3 py-2.5 text-[12px] font-medium text-ink transition-colors hover:border-teal/40 hover:bg-cream-muted"
          >
            <FolderUp className="h-4 w-4 text-teal" strokeWidth={1.75} />
            Bulk upload folder (PDF / VTT / SRT)
          </button>
        )}
      </div>

      <div className="panel-scroll flex-1 space-y-2 overflow-y-auto px-5 pb-5">
        {sources.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white px-3 py-6 text-center text-[12px] text-ink-muted">
            No sources yet. Add one above or bulk-upload a course folder.
          </p>
        ) : (
          sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onFlashcardQuiz={onFlashcardQuiz}
              onChatWithSource={onChatWithSource}
              onRetryIndex={onRetryIndex}
              onDelete={onDeleteSource}
            />
          ))
        )}
      </div>
    </section>
  );
}
