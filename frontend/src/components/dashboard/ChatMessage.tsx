"use client";

import { ImageIcon, Loader2, Sparkles } from "lucide-react";
import type { ChatMessage as ChatMessageType, Citation } from "@/types";
import { SourceChip } from "./SourceChip";

interface ChatMessageProps {
  message: ChatMessageType;
  onCitationClick?: (citation: Citation) => void;
  onUnderstandWithImages?: (message: ChatMessageType) => void;
  onViewDiagram?: (message: ChatMessageType) => void;
}

export function ChatMessage({
  message,
  onCitationClick,
  onUnderstandWithImages,
  onViewDiagram,
}: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex items-end justify-end gap-2.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-teal px-4 py-3 text-[14px] leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5c534a] text-[11px] font-medium text-white">
          H
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta text-white">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div className="max-w-[90%] rounded-2xl rounded-tl-md border border-border bg-cream-muted px-4 py-3.5 shadow-sm">
        {message.title && (
          <h4 className="mb-1.5 text-[14px] font-semibold text-ink">
            {message.title}
          </h4>
        )}
        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink/90">
          {message.content}
        </p>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.citations.map((citation) => (
              <SourceChip
                key={citation.id}
                citation={citation}
                onClick={onCitationClick}
              />
            ))}
          </div>
        )}

        {(message.diagramWorthy || message.diagramImageUrl) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.diagramImageUrl ? (
              <button
                type="button"
                onClick={() => onViewDiagram?.(message)}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1.5 text-[11px] font-semibold text-teal transition-colors hover:bg-teal/15"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                View board diagram
              </button>
            ) : (
              <button
                type="button"
                disabled={message.diagramLoading}
                onClick={() => onUnderstandWithImages?.(message)}
                className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/30 bg-terracotta/10 px-3 py-1.5 text-[11px] font-semibold text-terracotta transition-colors hover:bg-terracotta/15 disabled:opacity-60"
              >
                {message.diagramLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {message.diagramLoading
                  ? "Drawing board…"
                  : "Understand with images"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
