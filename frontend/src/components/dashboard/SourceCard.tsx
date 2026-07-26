"use client";

import {
  AlertCircle,
  Check,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { Source } from "@/types";

interface SourceCardProps {
  source: Source;
  onFlashcardQuiz?: (source: Source) => void;
  onChatWithSource?: (source: Source) => void;
  onRetryIndex?: (source: Source) => void;
  onDelete?: (source: Source) => void;
}

const typeIcon: Record<string, LucideIcon> = {
  pdf: FileText,
  youtube: Layers,
  video: Layers,
  vtt: FileText,
  srt: FileText,
  text: FileText,
  weblink: FileText,
};

export function SourceCard({
  source,
  onFlashcardQuiz,
  onChatWithSource,
  onRetryIndex,
  onDelete,
}: SourceCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isReady = source.status === "ready";
  const isIndexing = source.status === "indexing" || source.status === "pending";
  const isError = source.status === "error";
  const Icon = typeIcon[source.type] ?? FileText;
  const displayName = source.label
    ? `${source.label}: ${source.fileName}`
    : source.fileName;

  return (
    <div
      className={`rounded-xl border bg-white px-3 py-3 shadow-[0_1px_2px_rgba(26,23,20,0.04)] ${
        isError ? "border-red-200" : "border-border"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          {isIndexing ? (
            <Loader2 className="h-4 w-4 animate-spin text-ink-muted" />
          ) : isReady ? (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          ) : isError ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : (
            <Icon className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">
            {displayName}
          </p>
          {isError && source.error && (
            <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-red-600">
              {source.error}
            </p>
          )}
          {isIndexing && (
            <p className="mt-0.5 text-[11px] text-ink-muted">Indexing…</p>
          )}
        </div>

        {onDelete && (
          <div className="shrink-0">
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete(source);
                  }}
                  className="rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-ink-muted hover:bg-cream-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg p-1 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={`Delete ${displayName}`}
                title="Delete source"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2 pl-6">
        {isError ? (
          <button
            type="button"
            onClick={() => onRetryIndex?.(source)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Retry indexing
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!isReady}
              onClick={() => onFlashcardQuiz?.(source)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-cream px-2 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-cream-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Layers className="h-3 w-3" strokeWidth={2} />
              Flashcard Quiz
            </button>
            <button
              type="button"
              disabled={!isReady}
              onClick={() => onChatWithSource?.(source)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-cream px-2 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-cream-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MessageSquare className="h-3 w-3" strokeWidth={2} />
              Chat with Source
            </button>
          </>
        )}
      </div>
    </div>
  );
}
