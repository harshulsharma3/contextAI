"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Filter, Send, Sparkles } from "lucide-react";
import type {
  ChatMessage as ChatMessageType,
  ChatMode,
  Citation,
} from "@/types";
import { ChatMessage } from "./ChatMessage";

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSend: (text: string) => void;
  isThinking?: boolean;
  chatMode: ChatMode;
  contextChips?: string[];
  activeChips?: string[];
  onToggleChip?: (chip: string) => void;
  sourceName?: string;
  onCitationClick?: (citation: Citation) => void;
  onUnderstandWithImages?: (message: ChatMessageType) => void;
  onViewDiagram?: (message: ChatMessageType) => void;
}

export function ChatPanel({
  messages,
  onSend,
  isThinking = false,
  chatMode,
  contextChips = [],
  activeChips = [],
  onToggleChip,
  sourceName,
  onCitationClick,
  onUnderstandWithImages,
  onViewDiagram,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isThinking) return;
    onSend(text);
    setInput("");
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-cream">
      <div className="px-6 pt-5 pb-3">
        <h2 className="text-[15px] font-semibold text-ink">
          {chatMode === "global"
            ? "Project AI Learning Assistant"
            : `Chat with ${sourceName ?? "Source"}`}
        </h2>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          {chatMode === "global"
            ? "Answers grounded across all sources in this project"
            : "Answers grounded only in the selected source"}
        </p>
      </div>

      <div className="panel-scroll flex-1 space-y-4 overflow-y-auto px-6 pb-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onCitationClick={onCitationClick}
            onUnderstandWithImages={onUnderstandWithImages}
            onViewDiagram={onViewDiagram}
          />
        ))}
        {isThinking && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta text-white">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
            <div className="rounded-2xl rounded-tl-md border border-border bg-cream-muted px-4 py-3 text-[13px] text-ink-muted">
              Searching your sources…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-cream px-6 py-4">
        {chatMode === "global" && contextChips.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {contextChips.map((chip) => {
              const active = activeChips.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onToggleChip?.(chip)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "bg-teal text-white"
                      : "border border-border bg-white text-ink-muted hover:bg-cream-muted"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-white p-1.5 shadow-sm">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-cream-muted hover:text-ink"
              aria-label="Filter sources"
            >
              <Filter className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your lecture videos..."
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-muted/70"
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terracotta text-white transition-colors hover:bg-terracotta-hover disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
