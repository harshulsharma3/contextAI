"use client";

import { Suspense, use } from "react";
import { ProjectWorkspace } from "@/components/dashboard/ProjectWorkspace";

function ProjectWorkspaceLoader({ id }: { id: string }) {
  return <ProjectWorkspace projectId={id} />;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-cream text-[13px] text-ink-muted">
          Loading project…
        </div>
      }
    >
      <ProjectWorkspaceLoader id={id} />
    </Suspense>
  );
}
