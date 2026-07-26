"use client";

import { useEffect, useId, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { FlashcardGenerateConfig, Source } from "@/types";

interface GenerateFlashcardsModalProps {
  open: boolean;
  sources: Source[];
  preselectedSourceId?: string;
  /** When true (project quiz), pre-check every ready source */
  selectAllByDefault?: boolean;
  title?: string;
  onClose: () => void;
  onGenerate: (config: FlashcardGenerateConfig) => void;
}

export function GenerateFlashcardsModal({
  open,
  sources,
  preselectedSourceId,
  selectAllByDefault = false,
  title = "Generate Flashcards from Source",
  onClose,
  onGenerate,
}: GenerateFlashcardsModalProps) {
  const titleId = useId();
  const readySources = sources.filter((s) => s.status === "ready");
  const [selected, setSelected] = useState<string[]>([]);
  const [cardCount, setCardCount] = useState(20);

  useEffect(() => {
    if (!open) return;
    if (selectAllByDefault) {
      setSelected(readySources.map((s) => s.id));
    } else if (
      preselectedSourceId &&
      readySources.some((s) => s.id === preselectedSourceId)
    ) {
      setSelected([preselectedSourceId]);
    } else {
      setSelected(readySources.slice(0, 1).map((s) => s.id));
    }
    setCardCount(selectAllByDefault ? 15 : 20);
  }, [open, preselectedSourceId, selectAllByDefault]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selected.length === readySources.length) {
      setSelected([]);
    } else {
      setSelected(readySources.map((s) => s.id));
    }
  }

  function handleGenerate() {
    if (selected.length === 0) return;
    onGenerate({
      sourceIds: selected,
      cardCount,
      focus: "theory",
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-start bg-ink/35 p-6 pt-20 backdrop-blur-[1px] sm:pl-56"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-[16px] font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-cream-muted hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto px-5 py-4 panel-scroll">
          {readySources.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No indexed sources available yet.
            </p>
          ) : (
            <>
              {selectAllByDefault && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="mb-1 text-[12px] font-medium text-teal hover:underline"
                >
                  {selected.length === readySources.length
                    ? "Deselect all"
                    : "Select all sources"}
                </button>
              )}
              {readySources.map((source) => {
                const checked = selected.includes(source.id);
                const label = source.label
                  ? `${source.label}: ${source.fileName}`
                  : source.fileName;
                return (
                  <label
                    key={source.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                      checked
                        ? "border-terracotta/40 bg-cream-muted"
                        : "border-border bg-white hover:bg-cream"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(source.id)}
                      className="h-4 w-4 rounded border-border accent-terracotta"
                    />
                    <span className="truncate text-[13px] font-medium text-ink">
                      {label}
                    </span>
                  </label>
                );
              })}
            </>
          )}
        </div>

        <div className="space-y-3 border-t border-border px-5 py-4">
          <div>
            <p className="mb-2 text-[12px] font-semibold text-ink">
              AI Focus & Quantity
            </p>
            <input
              type="range"
              min={5}
              max={40}
              step={5}
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
              className="w-full accent-terracotta"
            />
            <p className="mt-2 text-[12px] text-ink-muted">
              Generate {cardCount} Key Concept cards
              {selected.length > 1
                ? ` across ${selected.length} sources`
                : ", focusing on theory"}
              .
            </p>
          </div>

          <button
            type="button"
            disabled={selected.length === 0}
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-terracotta-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            {selectAllByDefault ? "Start Project Quiz" : "Generate Flashcards"}
          </button>
        </div>
      </div>
    </div>
  );
}
