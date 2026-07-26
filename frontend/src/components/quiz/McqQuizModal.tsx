"use client";

import { useEffect, useId, useState } from "react";
import {
  AlertCircle,
  Check,
  MessageSquare,
  X,
} from "lucide-react";
import type { QuizQuestion } from "@/types";

interface McqQuizModalProps {
  open: boolean;
  questions: QuizQuestion[];
  initialIndex?: number;
  reviewMode?: boolean;
  onClose: () => void;
  onDiscuss?: (question: QuizQuestion) => void;
  onQuestionsChange?: (questions: QuizQuestion[]) => void;
  onFinish?: (questions: QuizQuestion[]) => void;
}

export function McqQuizModal({
  open,
  questions: initialQuestions,
  initialIndex = 0,
  reviewMode = false,
  onClose,
  onDiscuss,
  onQuestionsChange,
  onFinish,
}: McqQuizModalProps) {
  const titleId = useId();
  const [questions, setQuestions] = useState(initialQuestions);
  const [index, setIndex] = useState(initialIndex);
  const [finishing, setFinishing] = useState(false);

  // Sync from parent only when the quiz session opens or review index changes —
  // not on every answer update (that was resetting the user back to Q1).
  useEffect(() => {
    if (!open) return;
    setQuestions(initialQuestions);
    setIndex(initialIndex);
    setFinishing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit initialQuestions
  }, [open, initialIndex, reviewMode]);

  // Keep local question state in sync when parent replaces the full set after finish/review load
  useEffect(() => {
    if (!open || !reviewMode) return;
    setQuestions(initialQuestions);
  }, [open, reviewMode, initialQuestions]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // Escape should not dismiss mid-quiz; use the close button
      if (e.key === "Escape" && reviewMode) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, reviewMode]);

  if (!open || questions.length === 0) return null;

  const question = questions[index];
  const answeredCount = questions.filter((q) => q.selectedOptionId).length;
  const remaining = questions.length - answeredCount;
  const revealed =
    reviewMode &&
    (question.status === "correct" || question.status === "incorrect");
  const correctOption = question.options.find(
    (o) => o.id === question.correctOptionId
  );

  function selectOption(optionId: string) {
    if (reviewMode || finishing) return;

    const next = questions.map((q, i) =>
      i === index
        ? {
            ...q,
            selectedOptionId: optionId,
            status: "pending" as const,
          }
        : q
    );
    setQuestions(next);
    onQuestionsChange?.(next);
  }

  function goNext() {
    if (index >= questions.length - 1) {
      if (reviewMode) {
        onClose();
        return;
      }
      setFinishing(true);
      onFinish?.(questions);
      return;
    }
    setIndex((i) => i + 1);
  }

  return (
    <div
      className="fixed inset-0 z-[58] flex items-center justify-end bg-ink/35 p-4 backdrop-blur-[1px] sm:pr-8"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[min(90vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id={titleId} className="text-[15px] font-semibold text-ink">
            {reviewMode ? "Review" : "MCQ"} Question {question.number} of{" "}
            {questions.length}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium text-ink-muted">
              {reviewMode
                ? `${answeredCount} answered`
                : `${remaining} Cards Remaining`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-cream-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[140px_minmax(0,1fr)_minmax(200px,240px)]">
          <div className="panel-scroll space-y-1.5 overflow-y-auto border-r border-border bg-cream p-3">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`w-full rounded-xl px-2.5 py-2 text-left text-[11px] font-medium transition-colors ${
                  i === index
                    ? "bg-[#e8d9c8] text-ink"
                    : "bg-white text-ink-muted hover:bg-cream-muted"
                }`}
              >
                {i === index
                  ? `Card ${q.number} of ${questions.length}`
                  : `Card ${q.number}`}
                {q.selectedOptionId && !reviewMode ? " · ✓" : ""}
              </button>
            ))}
          </div>

          <div className="panel-scroll flex flex-col overflow-y-auto p-5">
            <p className="text-[15px] leading-relaxed font-medium text-ink">
              {question.prompt}
            </p>

            <div className="mt-5 space-y-2.5">
              {question.options.map((opt) => {
                const isSelected = question.selectedOptionId === opt.id;
                const isCorrect = opt.id === question.correctOptionId;
                let styles =
                  "border-border bg-white hover:border-ink-muted/40";
                if (revealed && isCorrect) {
                  styles = "border-emerald-400 bg-emerald-50";
                } else if (revealed && isSelected && !isCorrect) {
                  styles = "border-red-300 bg-red-50";
                } else if (!revealed && isSelected) {
                  styles = "border-teal/40 bg-teal/5";
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectOption(opt.id)}
                    disabled={reviewMode}
                    className={`relative flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${styles} ${
                      reviewMode ? "cursor-default" : ""
                    }`}
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream-muted text-[12px] font-semibold text-ink">
                      {opt.label}
                    </span>
                    <span className="pr-16 text-[13px] leading-relaxed text-ink">
                      {opt.text}
                    </span>
                    {revealed && isCorrect && (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                        Correct
                      </span>
                    )}
                    {revealed && isSelected && !isCorrect && (
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        <AlertCircle className="h-3 w-3" />
                        Incorrect
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 pt-6">
              <button
                type="button"
                onClick={() => onDiscuss?.(question)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-cream px-3 py-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-cream-muted"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Discuss with ContextAI
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={finishing}
                className="rounded-xl bg-terracotta px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-terracotta-hover disabled:opacity-50"
              >
                {index >= questions.length - 1
                  ? reviewMode
                    ? "Close Review"
                    : finishing
                      ? "Submitting…"
                      : "Finish & See Score"
                  : `Continue to Question ${question.number + 1}`}
              </button>
            </div>
          </div>

          <div className="panel-scroll overflow-y-auto border-l border-border bg-cream p-4">
            <h3 className="text-[13px] font-semibold text-ink">
              {reviewMode
                ? "ContextAI Correct Answer & Feedback"
                : "Quiz Progress"}
            </h3>
            {reviewMode && revealed ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-emerald-800">
                    Correct Answer: {correctOption?.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-emerald-900/80">
                    {correctOption?.text}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    Detailed Explanation
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink/90">
                    {question.explanation}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-white px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink-muted">
                    Reference
                  </p>
                  <p className="mt-1 text-[12px] text-ink">{question.reference}</p>
                </div>
              </div>
            ) : reviewMode ? (
              <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                This question was not answered.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-border bg-white px-3 py-3">
                  <p className="text-[22px] font-bold text-ink">
                    {answeredCount}
                    <span className="text-[14px] font-medium text-ink-muted">
                      {" "}
                      / {questions.length}
                    </span>
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    answers selected
                  </p>
                </div>
                <p className="text-[12px] leading-relaxed text-ink-muted">
                  Select an answer for each question. Correct answers and
                  explanations appear after you finish the quiz.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
