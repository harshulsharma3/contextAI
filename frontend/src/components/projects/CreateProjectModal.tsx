"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
}

export function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSubmitting(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(trimmed);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create project");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-[16px] font-semibold text-ink">
              Create project
            </h2>
            <p className="mt-1 text-[12px] text-ink-muted">
              Group lectures, PDFs, and transcripts for one course or topic.
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

        <label className="block space-y-1.5">
          <span className="text-[12px] font-medium text-ink">Project name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. System Design Course"
            className="w-full rounded-xl border border-border bg-cream px-3 py-2.5 text-[14px] text-ink outline-none focus:border-terracotta/50"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-[13px] font-medium text-ink hover:bg-cream-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="rounded-xl bg-terracotta px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-terracotta-hover disabled:opacity-40"
          >
            {submitting ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}
