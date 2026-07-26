"use client";

import { useEffect, useId } from "react";
import { X } from "lucide-react";
import type { QuizQuestion } from "@/types";

interface SessionScoreboardModalProps {
  open: boolean;
  questions: QuizQuestion[];
  onClose: () => void;
  onSelectQuestion: (index: number) => void;
  /** -1 = results tab */
  activeIndex: number;
  score?: number;
}

export function SessionScoreboardModal({
  open,
  questions,
  onClose,
  onSelectQuestion,
  activeIndex,
  score: scoreProp,
}: SessionScoreboardModalProps) {
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

  const answered = questions.filter(
    (q) => q.status === "correct" || q.status === "incorrect"
  );
  const correct = questions.filter((q) => q.status === "correct").length;
  const score =
    scoreProp ??
    (answered.length === 0
      ? 0
      : Math.round((correct / answered.length) * 100));

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center bg-ink/30 p-4 pt-16 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[16px] font-semibold text-ink">
              Session Scoreboard
            </h2>
            <p className="mt-2 text-[28px] font-bold tracking-tight text-ink">
              Overall Score: {score}%
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {correct} correct out of {questions.length} questions
              {answered.length < questions.length
                ? ` (${questions.length - answered.length} unanswered)`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-cream-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="panel-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {questions.map((q, i) => {
            const selected = q.options.find((o) => o.id === q.selectedOptionId);
            const correctOpt = q.options.find(
              (o) => o.id === q.correctOptionId
            );
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelectQuestion(i)}
                className="w-full rounded-xl border border-border bg-cream/50 px-3.5 py-3 text-left transition-colors hover:bg-cream-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-ink">
                    Q{q.number}. {q.prompt}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      q.status === "correct"
                        ? "bg-emerald-100 text-emerald-800"
                        : q.status === "incorrect"
                          ? "bg-red-100 text-red-700"
                          : "bg-cream-muted text-ink-muted"
                    }`}
                  >
                    {statusLabel(q)}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-[12px] text-ink-muted">
                  <p>
                    Your answer:{" "}
                    <span className="font-medium text-ink">
                      {selected
                        ? `${selected.label}. ${selected.text}`
                        : "—"}
                    </span>
                  </p>
                  <p>
                    Correct:{" "}
                    <span className="font-medium text-ink">
                      {correctOpt
                        ? `${correctOpt.label}. ${correctOpt.text}`
                        : "—"}
                    </span>
                  </p>
                  {q.explanation && (
                    <p className="line-clamp-2 text-ink/80">{q.explanation}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-border bg-cream px-4 py-3">
          <button
            type="button"
            onClick={() => onSelectQuestion(-1)}
            className={`shrink-0 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
              activeIndex === -1
                ? "bg-[#e8d9c8] text-ink"
                : "bg-white text-ink-muted hover:bg-cream-muted"
            }`}
          >
            Results & Explanations
          </button>
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectQuestion(i)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
                activeIndex === i
                  ? "bg-[#e8d9c8] text-ink"
                  : "bg-white text-ink-muted hover:bg-cream-muted"
              }`}
            >
              Q{q.number}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function statusLabel(q: QuizQuestion): string {
  if (q.status === "correct") {
    const opt = q.options.find((o) => o.id === q.selectedOptionId);
    return `Correct (${opt?.label ?? "?"})`;
  }
  if (q.status === "incorrect") {
    const opt = q.options.find((o) => o.id === q.selectedOptionId);
    return `Incorrect (${opt?.label ?? "?"})`;
  }
  if (q.status === "pending") return "Pending";
  return "Unanswered";
}
