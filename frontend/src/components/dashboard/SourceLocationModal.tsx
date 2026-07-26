"use client";

import { useEffect, useId, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import type { Citation } from "@/types";
import * as api from "@/lib/api";

interface SourceLocationModalProps {
  open: boolean;
  citation: Citation | null;
  onClose: () => void;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1]!;
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1]!;
  } catch {
    return null;
  }
  return null;
}

function textFragmentUrl(baseUrl: string, text: string): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
  if (!words) return baseUrl;
  return `${baseUrl}#:~:text=${encodeURIComponent(words)}`;
}

export function SourceLocationModal({
  open,
  citation,
  onClose,
}: SourceLocationModalProps) {
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<
    Array<{
      id: string;
      content: string;
      locatorLabel: string;
      focused: boolean;
    }>
  >([]);

  const sourceType = (() => {
    const raw = (citation?.sourceType || "").toLowerCase();
    if (raw) return raw;
    if (!citation) return "";
    if (citation.page != null || /^p\.\d+/i.test(citation.timestamp)) return "pdf";
    if (citation.sourceUrl && /youtu/.test(citation.sourceUrl)) return "youtube";
    if (/^\d+:\d+/.test(citation.timestamp)) return "vtt";
    return "text";
  })();

  useEffect(() => {
    if (!open || !citation) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, citation]);

  useEffect(() => {
    if (!open || !citation) return;
    const needsChunks =
      sourceType !== "pdf" && sourceType !== "youtube";

    if (!needsChunks) {
      setChunks([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getSourceChunks(citation.sourceId, {
        focus: citation.chunkId,
        window: 2,
      })
      .then((res) => {
        if (cancelled) return;
        setChunks(res.chunks);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load source");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, citation, sourceType]);

  if (!open || !citation) return null;

  const pdfUrl = api.getSourceFileUrl(citation.sourceId, citation.page);
  const startSec =
    citation.startMs !== undefined
      ? Math.max(0, Math.floor(citation.startMs / 1000))
      : undefined;
  const videoId = citation.sourceUrl
    ? extractVideoId(citation.sourceUrl)
    : null;
  const youtubeEmbed = videoId
    ? `https://www.youtube.com/embed/${videoId}?start=${startSec ?? 0}&autoplay=1`
    : null;
  const youtubeWatch = citation.sourceUrl
    ? `${citation.sourceUrl}${citation.sourceUrl.includes("?") ? "&" : "?"}t=${startSec ?? 0}s`
    : null;

  const openExternal =
    sourceType === "pdf"
      ? pdfUrl
      : sourceType === "youtube" && youtubeWatch
        ? youtubeWatch
        : sourceType === "weblink" && citation.sourceUrl
          ? textFragmentUrl(
              citation.sourceUrl,
              chunks.find((c) => c.focused)?.content || ""
            )
          : citation.hasFile
            ? pdfUrl
            : null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[min(92vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-[15px] font-semibold text-ink">
              {citation.sourceLabel}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              Location: {citation.timestamp}
              {citation.page ? ` · page ${citation.page}` : ""}
              {startSec !== undefined ? ` · ${formatClock(startSec)}` : ""}
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

        <div className="min-h-0 flex-1 bg-cream">
          {sourceType === "pdf" ? (
            <iframe
              title={citation.sourceLabel}
              src={pdfUrl}
              className="h-full w-full border-0"
            />
          ) : sourceType === "youtube" && youtubeEmbed ? (
            <iframe
              title={citation.sourceLabel}
              src={youtubeEmbed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading source…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-red-600">
              {error}
            </div>
          ) : (
            <div className="panel-scroll h-full space-y-3 overflow-y-auto p-5">
              {chunks.length === 0 ? (
                <p className="text-[13px] text-ink-muted">
                  No chunk content available for this citation.
                </p>
              ) : (
                chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`rounded-xl border px-4 py-3 ${
                      chunk.focused
                        ? "border-teal bg-teal/5 shadow-sm"
                        : "border-border bg-white"
                    }`}
                  >
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      {chunk.locatorLabel}
                      {chunk.focused ? " · cited" : ""}
                    </p>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90">
                      {chunk.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-white px-5 py-3">
          <p className="text-[11px] text-ink-muted">
            Jump to the exact location in the original source
          </p>
          {openExternal && (
            <a
              href={openExternal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-cream px-3 py-2 text-[12px] font-medium text-ink transition-colors hover:bg-cream-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
