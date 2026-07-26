"use client";

import Link from "next/link";
import { FolderKanban, MessageSquare, Trash2 } from "lucide-react";

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    sourcesIndexed: number;
    sourcesTotal: number;
    sourcesIndexing: number;
    totalDurationLabel: string;
    knowledgeChunks: number;
    chatCount: number;
  };
};

interface ProjectCardProps {
  project: ProjectSummary;
  onDelete?: (project: ProjectSummary) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(26,23,20,0.04)] transition-colors hover:border-teal/30">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
            <FolderKanban className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <Link
              href={`/projects/${project.id}`}
              className="block truncate text-[15px] font-semibold text-ink hover:text-teal"
            >
              {project.name}
            </Link>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Updated {formatRelative(project.updatedAt)}
            </p>
          </div>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(project)}
            className="rounded-lg p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
            aria-label={`Delete ${project.name}`}
            title="Delete project"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat
          label="Sources"
          value={`${project.stats.sourcesIndexed}${
            project.stats.sourcesTotal !== project.stats.sourcesIndexed
              ? `/${project.stats.sourcesTotal}`
              : ""
          }`}
        />
        <Stat label="Chunks" value={String(project.stats.knowledgeChunks)} />
        <Stat label="Chats" value={String(project.stats.chatCount)} />
      </div>

      {project.stats.sourcesIndexing > 0 && (
        <p className="mt-3 text-[11px] text-amber-700">
          {project.stats.sourcesIndexing} source
          {project.stats.sourcesIndexing === 1 ? "" : "s"} indexing…
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-teal px-3 py-2 text-[12px] font-semibold text-white hover:bg-teal-hover"
        >
          Open project
        </Link>
        <Link
          href={`/projects/${project.id}?chat=global`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-cream px-3 py-2 text-[12px] font-medium text-ink hover:bg-cream-muted"
          title="Project chat"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream px-2 py-2.5">
      <p className="text-[14px] font-semibold text-ink">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}
