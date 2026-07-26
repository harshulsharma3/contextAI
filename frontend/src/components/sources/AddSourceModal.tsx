"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, FileUp, Link2, Type, Upload, Video, X } from "lucide-react";
import type { AddSourcePayload, IndexingOptions, SourceType } from "@/types";

interface AddSourceModalProps {
  open: boolean;
  projectName: string;
  initialType?: SourceType;
  onClose: () => void;
  onProcess: (payload: Omit<AddSourcePayload, "projectId">) => void;
}

const STEPS = ["Choose Source", "Configure", "AI Analysis", "Complete"] as const;

const typeCopy: Partial<
  Record<SourceType, { title: string; hint: string; accept?: string }>
> = {
  vtt: {
    title: "Upload Transcript (VTT/SRT)",
    hint: "Drag and drop or click to browse. Supports .vtt and .srt files.",
    accept: ".vtt,.srt,text/vtt,application/x-subrip",
  },
  srt: {
    title: "Upload Transcript (VTT/SRT)",
    hint: "Drag and drop or click to browse. Supports .vtt and .srt files.",
    accept: ".vtt,.srt,text/vtt,application/x-subrip",
  },
  pdf: {
    title: "Upload PDF",
    hint: "Drag and drop or click to browse lecture PDFs and readings.",
    accept: ".pdf,application/pdf",
  },
  text: {
    title: "Paste or upload text",
    hint: "Add notes, excerpts, or plain-text study material.",
    accept: ".txt,text/plain",
  },
  youtube: {
    title: "YouTube lecture",
    hint: "Paste a YouTube URL — captions will be indexed when available.",
  },
  weblink: {
    title: "Web link",
    hint: "Paste an article or course page URL to index.",
  },
};

export function AddSourceModal({
  open,
  projectName,
  initialType = "vtt",
  onClose,
  onProcess,
}: AddSourceModalProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType>(initialType);
  const [file, setFile] = useState<File | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [options, setOptions] = useState<IndexingOptions>({
    generateSummary: true,
    createFlashcards: false,
    indexForSearch: true,
  });

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSourceType(initialType);
    setFile(null);
    setUrlValue("");
    setTextValue("");
    setSourceName("");
    setOptions({
      generateSummary: true,
      createFlashcards: false,
      indexForSearch: true,
    });
  }, [open, initialType]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const acceptFile = useCallback(
    (next: File | null) => {
      if (!next) return;
      const lower = next.name.toLowerCase();
      if (sourceType === "pdf" && !lower.endsWith(".pdf")) return;
      if (
        (sourceType === "vtt" || sourceType === "srt") &&
        !lower.endsWith(".vtt") &&
        !lower.endsWith(".srt")
      )
        return;
      if (sourceType === "text" && !lower.endsWith(".txt")) return;

      setFile(next);
      setUrlValue("");
      setSourceName(next.name.replace(/\.[^.]+$/i, "").replace(/[_-]/g, " "));
      setStep(1);
    },
    [sourceType]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  }

  function handleProcess() {
    const needsFile = sourceType === "pdf" || sourceType === "vtt" || sourceType === "srt";
    const needsUrl = sourceType === "youtube" || sourceType === "weblink";
    const needsText = sourceType === "text";

    if (needsFile && !file) return;
    if (needsUrl && !urlValue.trim()) return;
    if (needsText && !file && !textValue.trim()) return;
    if (!options.indexForSearch) return;

    const resolvedType: SourceType =
      file && (sourceType === "vtt" || sourceType === "srt")
        ? file.name.toLowerCase().endsWith(".srt")
          ? "srt"
          : "vtt"
        : sourceType;

    onProcess({
      name:
        sourceName.trim() ||
        file?.name ||
        (needsUrl ? "Untitled link" : "Untitled source"),
      type: resolvedType,
      file: file ?? undefined,
      youtubeUrl: needsUrl ? urlValue.trim() : undefined,
      options,
    });
    onClose();
  }

  if (!open) return null;

  const copy = typeCopy[sourceType] ?? typeCopy.vtt!;
  const isUploadType =
    sourceType === "pdf" ||
    sourceType === "vtt" ||
    sourceType === "srt" ||
    sourceType === "text";
  const isUrlType = sourceType === "youtube" || sourceType === "weblink";

  const canProcess =
    Boolean(sourceName.trim()) &&
    options.indexForSearch &&
    ((isUploadType && (Boolean(file) || (sourceType === "text" && textValue.trim()))) ||
      (isUrlType && Boolean(urlValue.trim())));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <h2 id={titleId} className="text-[17px] font-semibold text-ink">
              Add New Source: {projectName}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">{copy.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-cream-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border bg-cream px-6 py-3">
          {STEPS.map((label, i) => {
            const index = i + 1;
            const hasInput = Boolean(file || urlValue || textValue);
            const done = index < step || (index === 1 && hasInput);
            const active =
              index === step || (step === 1 && index === 2 && hasInput);
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done
                      ? "bg-teal text-white"
                      : active
                        ? "bg-terracotta text-white"
                        : "bg-border text-ink-muted"
                  }`}
                >
                  {done && index < 2 ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    index
                  )}
                </div>
                <span
                  className={`text-[12px] ${
                    active || done ? "font-medium text-ink" : "text-ink-muted"
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="mx-1 h-px w-6 bg-border sm:w-10" />
                )}
              </div>
            );
          })}
        </div>

        <div className="panel-scroll grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Choose Source
            </h3>

            {isUploadType && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                    dragOver
                      ? "border-terracotta bg-terracotta/5"
                      : file
                        ? "border-teal bg-teal/5"
                        : "border-border bg-cream hover:border-ink-muted/40"
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
                    {file ? (
                      <FileUp className="h-5 w-5 text-teal" />
                    ) : sourceType === "text" ? (
                      <Type className="h-5 w-5 text-ink-muted" />
                    ) : (
                      <Upload className="h-5 w-5 text-ink-muted" />
                    )}
                  </div>
                  {file ? (
                    <>
                      <p className="text-[13px] font-medium text-ink">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-ink-muted">
                        Ready to configure · click to replace
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] font-medium text-ink">
                        {copy.title}
                      </p>
                      <p className="max-w-[220px] text-[11px] leading-relaxed text-ink-muted">
                        {copy.hint}
                      </p>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={copy.accept}
                  className="hidden"
                  onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
                />
              </>
            )}

            {sourceType === "text" && (
              <textarea
                value={textValue}
                onChange={(e) => {
                  setTextValue(e.target.value);
                  if (e.target.value && !sourceName) {
                    setSourceName("Pasted study notes");
                  }
                }}
                rows={5}
                placeholder="Or paste text notes here…"
                className="w-full resize-none rounded-xl border border-border bg-cream px-3 py-2.5 text-[13px] text-ink outline-none focus:border-terracotta/50"
              />
            )}

            {isUrlType && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-cream px-3 py-2.5 focus-within:border-terracotta/50">
                  {sourceType === "youtube" ? (
                    <Video className="h-4 w-4 shrink-0 text-[#FF0000]" />
                  ) : (
                    <Link2 className="h-4 w-4 shrink-0 text-ink-muted" />
                  )}
                  <input
                    type="url"
                    value={urlValue}
                    onChange={(e) => {
                      setUrlValue(e.target.value);
                      if (e.target.value && !sourceName) {
                        setSourceName(
                          sourceType === "youtube"
                            ? "YouTube lecture"
                            : "Web article"
                        );
                      }
                    }}
                    placeholder={
                      sourceType === "youtube"
                        ? "Paste YouTube Video Link..."
                        : "Paste web URL..."
                    }
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted/70"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Configure
            </h3>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-ink">
                Source Name
              </span>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Lecture 15 — Motivation"
                className="w-full rounded-xl border border-border bg-cream px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-terracotta/50"
              />
            </label>

            <div className="space-y-3 rounded-2xl border border-border bg-cream p-4">
              <p className="text-[12px] font-medium text-ink">
                Indexing Options
              </p>
              <ToggleRow
                label="Generate AI Summary"
                description="Create a concise overview of this source"
                checked={options.generateSummary}
                onChange={(v) =>
                  setOptions((o) => ({ ...o, generateSummary: v }))
                }
              />
              <ToggleRow
                label="Create Flashcards"
                description="Generate study flashcards from key points"
                checked={options.createFlashcards}
                onChange={(v) =>
                  setOptions((o) => ({ ...o, createFlashcards: v }))
                }
              />
              <ToggleRow
                label="Index for Semantic Search"
                description="Embed chunks into the vector DB for RAG chat"
                checked={options.indexForSearch}
                onChange={(v) =>
                  setOptions((o) => ({ ...o, indexForSearch: v }))
                }
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-cream px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-cream-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canProcess}
            onClick={handleProcess}
            className="rounded-xl bg-terracotta px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-terracotta-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Process Source
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="text-[11px] text-ink-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? "bg-terracotta" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
