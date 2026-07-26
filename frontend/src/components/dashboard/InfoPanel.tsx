"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ProjectStats } from "@/types";

interface InfoPanelProps {
  stats: ProjectStats;
  sourceViewerTitle?: string;
  sourceViewerText?: string;
}

export function InfoPanel({
  stats,
  sourceViewerTitle = "No source selected",
  sourceViewerText = "",
}: InfoPanelProps) {
  const [open, setOpen] = useState({
    global: true,
    individual: true,
  });

  function toggle(key: keyof typeof open) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border bg-cream px-4 py-5 panel-scroll">
      <Accordion
        title="Global"
        open={open.global}
        onToggle={() => toggle("global")}
      >
        <div className="rounded-xl border border-border bg-white p-3.5 shadow-[0_1px_2px_rgba(26,23,20,0.04)]">
          <p className="mb-2 text-[12px] font-semibold text-ink">
            Project Stats
          </p>
          <StatRow
            label="Sources Indexed"
            value={String(stats.sourcesIndexed)}
          />
          <StatRow label="Total Duration" value={stats.totalDurationLabel} />
          <StatRow
            label="Knowledge Chunks"
            value={stats.knowledgeChunks.toLocaleString()}
            last
          />
        </div>
      </Accordion>

      <Accordion
        title="Individual Chat"
        open={open.individual}
        onToggle={() => toggle("individual")}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_rgba(26,23,20,0.04)]">
          <div className="border-b border-border bg-cream-muted px-3 py-2">
            <p className="truncate text-[11px] font-semibold text-ink">
              Source Viewer
            </p>
            <p className="truncate text-[10px] text-ink-muted">
              {sourceViewerTitle}
            </p>
          </div>
          <div className="panel-scroll max-h-[220px] overflow-y-auto bg-[#faf7f2] p-3">
            <pre className="whitespace-pre-wrap font-sans text-[10px] leading-relaxed text-ink/80">
              {sourceViewerText || "Select a source to preview its content."}
            </pre>
          </div>
        </div>
      </Accordion>
    </aside>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-white/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-ink-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-ink-muted" />
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}

function StatRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className="text-[13px] font-semibold text-ink">{value}</span>
    </div>
  );
}
