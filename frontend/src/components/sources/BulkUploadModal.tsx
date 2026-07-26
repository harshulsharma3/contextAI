"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileUp, Upload, X } from "lucide-react";
import type { IndexingOptions, SourceType } from "@/types";

export type BulkFileItem = {
  file: File;
  name: string;
  type: SourceType;
};

interface BulkUploadModalProps {
  open: boolean;
  projectName: string;
  onClose: () => void;
  onUpload: (items: BulkFileItem[], options: IndexingOptions) => void;
}

function detectType(file: File): SourceType | null {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".vtt")) return "vtt";
  if (lower.endsWith(".srt")) return "srt";
  if (lower.endsWith(".txt")) return "text";
  return null;
}

function displayName(file: File): string {
  return file.name.replace(/\.[^.]+$/i, "").replace(/[_-]/g, " ");
}

export function BulkUploadModal({
  open,
  projectName,
  onClose,
  onUpload,
}: BulkUploadModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BulkFileItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [options, setOptions] = useState<IndexingOptions>({
    generateSummary: false,
    createFlashcards: false,
    indexForSearch: true,
  });

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setOptions({
      generateSummary: false,
      createFlashcards: false,
      indexForSearch: true,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const next: BulkFileItem[] = [];
    for (const file of Array.from(list)) {
      const type = detectType(file);
      if (!type) continue;
      next.push({ file, name: displayName(file), type });
    }
    if (!next.length) {
      alert("Only PDF, VTT, SRT, and TXT files are supported for bulk upload.");
      return;
    }
    setItems((prev) => {
      const existing = new Set(prev.map((p) => p.file.name + p.file.size));
      const merged = [...prev];
      for (const item of next) {
        const key = item.file.name + item.file.size;
        if (!existing.has(key)) merged.push(item);
      }
      return merged;
    });
  }

  function handleSubmit() {
    if (!items.length || !options.indexForSearch) return;
    onUpload(items, options);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[16px] font-semibold text-ink">
              Bulk upload — {projectName}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              Select many lecture transcripts or PDFs at once (e.g. a full course
              folder of VTT/SRT files).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="panel-scroll flex-1 space-y-4 overflow-y-auto p-5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 transition-colors ${
              dragOver
                ? "border-terracotta bg-terracotta/5"
                : "border-border bg-cream hover:border-ink-muted/40"
            }`}
          >
            <Upload className="h-6 w-6 text-ink-muted" />
            <p className="text-[13px] font-medium text-ink">
              Drop files here or click to browse
            </p>
            <p className="text-[11px] text-ink-muted">
              PDF · VTT · SRT · TXT — multi-select supported
            </p>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.vtt,.srt,.txt,application/pdf,text/vtt,application/x-subrip,text/plain"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-ink">
                {items.length} file{items.length === 1 ? "" : "s"} ready
              </p>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-cream p-2">
                {items.map((item, i) => (
                  <li
                    key={`${item.file.name}-${item.file.size}-${i}`}
                    className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2"
                  >
                    <FileUp className="h-3.5 w-3.5 shrink-0 text-teal" />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                      {item.file.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-cream-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-muted">
                      {item.type}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-cream px-5 py-4">
          <p className="text-[11px] text-ink-muted">
            Files are indexed into this project for chat & quizzes
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-white px-4 py-2.5 text-[13px] font-medium text-ink hover:bg-cream-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!items.length}
              onClick={handleSubmit}
              className="rounded-xl bg-terracotta px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-terracotta-hover disabled:opacity-40"
            >
              Upload {items.length || ""} source{items.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
