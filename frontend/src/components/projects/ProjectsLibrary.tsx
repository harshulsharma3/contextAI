"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, FolderPlus, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  ProjectCard,
  type ProjectSummary,
} from "@/components/projects/ProjectCard";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import * as api from "@/lib/api";

export function ProjectsLibrary() {
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
      setProjects(await api.listProjects());
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-cream px-6">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-ink-muted" />
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">
              Projects
            </h1>
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
          <p className="mb-6 max-w-2xl text-[13px] text-ink-muted">
            Manage course workspaces. Inside a project you can bulk-upload
            transcripts (VTT/SRT), PDFs, and links, then use{" "}
            <strong className="font-semibold text-ink">Project Chat</strong>{" "}
            across all sources or{" "}
            <strong className="font-semibold text-ink">Individual Source Chat</strong>{" "}
            for one file.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center">
              <p className="text-[15px] font-semibold text-ink">
                Create a project to get started
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!apiOnline}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                <FolderPlus className="h-4 w-4" />
                New project
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
