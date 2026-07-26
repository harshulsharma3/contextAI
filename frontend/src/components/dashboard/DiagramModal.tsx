"use client";

import { useEffect, useId } from "react";
import { Download, X } from "lucide-react";

interface DiagramModalProps {
  open: boolean;
  imageUrl: string | null;
  title?: string;
  loading?: boolean;
  onClose: () => void;
}

export function DiagramModal({
  open,
  imageUrl,
  title = "Board explanation",
  loading = false,
  onClose,
}: DiagramModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-[#1a3d2e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 id={titleId} className="text-[15px] font-semibold text-[#f0ebe3]">
            {title}
          </h2>
          <div className="flex items-center gap-1">
            {imageUrl && (
              <a
                href={imageUrl}
                download="contextai-board.png"
                className="rounded-lg p-1.5 text-[#c9c2b8] hover:bg-white/10 hover:text-white"
                aria-label="Download"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#c9c2b8] hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex min-h-[280px] flex-1 items-center justify-center overflow-auto bg-[#163528] p-4">
          {loading && !imageUrl ? (
            <p className="text-[13px] text-[#c9c2b8]">
              Drawing on the chalkboard…
            </p>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Chalkboard explanation"
              className="max-h-[75vh] w-auto max-w-full rounded-lg shadow-lg"
            />
          ) : (
            <p className="text-[13px] text-[#c9c2b8]">No diagram yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
