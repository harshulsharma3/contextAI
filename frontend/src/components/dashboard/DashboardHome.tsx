"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, LayoutDashboard, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  ProjectCard,
  type ProjectSummary,
} from "@/components/projects/ProjectCard";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import * as api from "@/lib/api";

export function DashboardHome() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    const online = await api.healthCheck();
    setApiOnline(online);
    if (!online) {
      setProjects([]);
      setLoading(false);
      return;
    }
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (err) {
      console.warn(err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = projects.reduce(
    (acc, p) => ({
      sources: acc.sources + p.stats.sourcesIndexed,
      chunks: acc.chunks + p.stats.knowledgeChunks,
      chats: acc.chats + p.stats.chatCount,
    }),
    { sources: 0, chunks: 0, chats: 0 }
  );

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-cream px-6">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-ink-muted" />
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">
              Dashboard
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                apiOnline
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {apiOnline ? "API connected" : "API offline"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!apiOnline}
            className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-terracotta-hover disabled:opacity-40"
          >
            <FolderPlus className="h-4 w-4" />
            New project
          </button>
        </header>

        <div className="panel-scroll flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">
              Your study projects
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">
              Each project holds its own sources and chats. Open a course project
              to upload lectures, chat across all files (project chat), or chat
              with a single source.
            </p>
          </div>

          {!loading && projects.length > 0 && (
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <OverviewStat label="Projects" value={String(projects.length)} />
              <OverviewStat label="Sources indexed" value={String(totals.sources)} />
              <OverviewStat label="Knowledge chunks" value={String(totals.chunks)} />
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading projects…
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
              <p className="text-[15px] font-semibold text-ink">
                No projects yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-muted">
                Create a project for a course (e.g. “System Design”), then bulk
                upload VTT/SRT transcripts, PDFs, and links inside it.
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!apiOnline}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-terracotta-hover disabled:opacity-40"
              >
                <FolderPlus className="h-4 w-4" />
                Create your first project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onDelete={async (proj) => {
                    if (
                      !confirm(
                        `Delete project “${proj.name}”? All sources and chats will be removed.`
                      )
                    )
                      return;
                    try {
                      await api.deleteProject(proj.id);
                      setProjects((prev) =>
                        prev.filter((x) => x.id !== proj.id)
                      );
                    } catch (err) {
                      alert(
                        err instanceof Error
                          ? err.message
                          : "Failed to delete project"
                      );
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (name) => {
          const created = await api.createProject(name);
          router.push(`/projects/${created.id}`);
        }}
      />
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white px-4 py-3.5">
      <p className="text-[22px] font-bold tracking-tight text-ink">{value}</p>
      <p className="text-[12px] text-ink-muted">{label}</p>
    </div>
  );
}
