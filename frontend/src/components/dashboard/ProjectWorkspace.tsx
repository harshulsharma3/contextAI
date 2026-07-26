"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type {
  AddSourcePayload,
  ChatMessage,
  ChatMode,
  Citation,
  FlashcardGenerateConfig,
  IndexingOptions,
  Project,
  QuizQuestion,
  Source,
  SourceType,
} from "@/types";
import {
  contextFilterChips,
  currentProject,
  mockQuizQuestions,
} from "@/lib/mock-data";
import * as api from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { SourcesPanel } from "@/components/dashboard/SourcesPanel";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { InfoPanel } from "@/components/dashboard/InfoPanel";
import { SourceLocationModal } from "@/components/dashboard/SourceLocationModal";
import { DiagramModal } from "@/components/dashboard/DiagramModal";
import { AddSourceModal } from "@/components/sources/AddSourceModal";
import {
  BulkUploadModal,
  type BulkFileItem,
} from "@/components/sources/BulkUploadModal";
import { GenerateFlashcardsModal } from "@/components/quiz/GenerateFlashcardsModal";
import { AnalysisProgressModal } from "@/components/quiz/AnalysisProgressModal";
import { McqQuizModal } from "@/components/quiz/McqQuizModal";
import { SessionScoreboardModal } from "@/components/quiz/SessionScoreboardModal";

type Thread = { messages: ChatMessage[]; chatId?: string };

function threadKeyFor(mode: ChatMode, sourceId: string | null) {
  return mode === "global" ? "global" : `src:${sourceId ?? "none"}`;
}

function freshMockQuestions(): QuizQuestion[] {
  return mockQuizQuestions.map((q) => ({
    ...q,
    selectedOptionId: undefined,
    status: "unanswered" as const,
  }));
}

interface ProjectWorkspaceProps {
  projectId: string;
}

export function ProjectWorkspace({ projectId: routeProjectId }: ProjectWorkspaceProps) {
  const searchParams = useSearchParams();
  const [project, setProject] = useState<Project>({
    id: routeProjectId,
    name: "Loading…",
    stats: {
      sourcesIndexed: 0,
      totalDurationLabel: "0m",
      knowledgeChunks: 0,
    },
    sources: [],
    recentChats: [],
  });
  const [projectId, setProjectId] = useState<string | null>(routeProjectId);
  const [apiOnline, setApiOnline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, Thread>>({
    global: { messages: [] },
  });
  const [chatMode, setChatMode] = useState<ChatMode>(
    searchParams.get("chat") === "individual" ? "individual" : "global"
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [viewerText, setViewerText] = useState("");
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [diagramModal, setDiagramModal] = useState<{
    open: boolean;
    imageUrl: string | null;
    loading: boolean;
  }>({ open: false, imageUrl: null, loading: false });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSourceType, setAddSourceType] = useState<SourceType>("vtt");
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const [flashModalOpen, setFlashModalOpen] = useState(false);
  const [flashPreselect, setFlashPreselect] = useState<string | undefined>();
  const [flashSelectAll, setFlashSelectAll] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisMsg, setAnalysisMsg] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizReviewMode, setQuizReviewMode] = useState(false);
  const [quizQuestions, setQuizQuestions] =
    useState<QuizQuestion[]>(mockQuizQuestions);
  const [quizIndex, setQuizIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [scoreboardTab, setScoreboardTab] = useState(-1);
  const [sessionScore, setSessionScore] = useState<number | undefined>();

  const selectedSource =
    project.sources.find((s) => s.id === selectedSourceId) ??
    (chatMode === "individual"
      ? project.sources.find((s) => s.status === "ready") ?? null
      : null);

  const threadKey = threadKeyFor(chatMode, selectedSource?.id ?? null);
  const activeThread = threads[threadKey] ?? { messages: [] };
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  // Bootstrap: load the project from the route
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setThreads({ global: { messages: [] } });
      setSelectedSourceId(null);
      setViewerText("");
      setProjectId(routeProjectId);

      const online = await api.healthCheck();
      if (cancelled) return;
      setApiOnline(online);
      if (!online) {
        setProject({ ...currentProject, id: routeProjectId });
        return;
      }

      try {
        const detail = await api.getProject(routeProjectId);
        if (cancelled) return;
        setProject(detail);
        setProjectId(detail.id);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load project"
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeProjectId]);

  // Load source viewer content when selection changes
  useEffect(() => {
    if (!selectedSource) {
      setViewerText("");
      return;
    }
    if (!apiOnline) {
      setViewerText("");
      return;
    }
    let cancelled = false;
    api
      .getSourceContent(selectedSource.id)
      .then((c) => {
        if (!cancelled) setViewerText(c.content || "");
      })
      .catch(() => {
        if (!cancelled) setViewerText("");
      });
    return () => {
      cancelled = true;
    };
  }, [apiOnline, selectedSource?.id]);

  const refreshProject = useCallback(async () => {
    if (!projectId || !apiOnline) return;
    const detail = await api.getProject(projectId);
    setProject(detail);
  }, [projectId, apiOnline]);

  const updateThread = useCallback(
    (key: string, updater: (prev: Thread) => Thread) => {
      setThreads((prev) => {
        const current = prev[key] ?? { messages: [] };
        return { ...prev, [key]: updater(current) };
      });
    },
    []
  );

  const handleSend = useCallback(
    async (text: string) => {
      const key = threadKeyFor(chatMode, selectedSource?.id ?? null);
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      updateThread(key, (t) => ({
        ...t,
        messages: [...t.messages, userMsg],
      }));
      setIsThinking(true);

      if (!apiOnline || !projectId) {
        window.setTimeout(() => {
          const reply: ChatMessage = {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            title: "Based on your indexed sources",
            content:
              "API offline — start the backend (`npm run dev` in backend/) and set NEXT_PUBLIC_API_URL.",
            createdAt: new Date().toISOString(),
          };
          updateThread(key, (t) => ({
            ...t,
            messages: [...t.messages, reply],
          }));
          setIsThinking(false);
        }, 600);
        return;
      }

      const sourceIds =
        chatMode === "individual" && selectedSource
          ? [selectedSource.id]
          : undefined;

      let assistantContent = "";
      const citations: ChatMessage["citations"] = [];
      const assistantId = `msg_${Date.now() + 1}`;
      const chatId = threadsRef.current[key]?.chatId;

      updateThread(key, (t) => ({
        ...t,
        messages: [
          ...t.messages,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
          },
        ],
      }));

      try {
        await api.sendChat(
          projectId,
          {
            message: text,
            mode: chatMode,
            sourceIds,
            chatId,
          },
          {
            onToken: (t) => {
              assistantContent += t;
              updateThread(key, (thread) => ({
                ...thread,
                messages: thread.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: assistantContent }
                    : m
                ),
              }));
            },
            onCitation: (c) => {
              citations.push(c);
              updateThread(key, (thread) => ({
                ...thread,
                messages: thread.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, citations: [...citations] }
                    : m
                ),
              }));
            },
            onDone: (data) => {
              updateThread(key, (thread) => ({
                ...thread,
                chatId: data.chatId || thread.chatId,
                messages: thread.messages.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        id: data.messageId || m.id,
                        diagramWorthy: Boolean(data.diagramWorthy),
                      }
                    : m
                ),
              }));
              setIsThinking(false);
              void refreshProject();
            },
            onError: (message) => {
              updateThread(key, (thread) => ({
                ...thread,
                messages: thread.messages.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: m.content || `Error: ${message}`,
                      }
                    : m
                ),
              }));
              setIsThinking(false);
            },
          }
        );
      } catch (err) {
        updateThread(key, (thread) => ({
          ...thread,
          messages: thread.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    (err instanceof Error ? err.message : "Chat failed"),
                }
              : m
          ),
        }));
        setIsThinking(false);
      }
    },
    [
      apiOnline,
      projectId,
      chatMode,
      selectedSource,
      refreshProject,
      updateThread,
    ]
  );

  const handleProcessSource = useCallback(
    async (payload: Omit<AddSourcePayload, "projectId">) => {
      if (!apiOnline || !projectId) {
        const ext =
          payload.type === "pdf"
            ? "pdf"
            : payload.type === "youtube"
              ? "url"
              : payload.type === "text"
                ? "txt"
                : payload.type === "weblink"
                  ? "link"
                  : payload.type === "srt"
                    ? "srt"
                    : "vtt";
        const newSource: Source = {
          id: `src_${Date.now()}`,
          name: payload.name,
          fileName:
            payload.file?.name ??
            `${payload.name.replace(/\s+/g, "_")}.${ext}`,
          type: payload.type,
          label:
            payload.type === "pdf"
              ? "PDF"
              : payload.type === "youtube"
                ? "YouTube Link"
                : payload.type === "weblink"
                  ? "Web Link"
                  : payload.type === "text"
                    ? "Text"
                    : payload.type.toUpperCase(),
          status: "indexing",
          chunkCount: 0,
          createdAt: new Date().toISOString(),
        };
        setProject((prev) => ({
          ...prev,
          sources: [newSource, ...prev.sources],
        }));
        window.setTimeout(() => {
          setProject((prev) => ({
            ...prev,
            sources: prev.sources.map((s) =>
              s.id === newSource.id
                ? { ...s, status: "ready", chunkCount: 96 }
                : s
            ),
            stats: {
              ...prev.stats,
              sourcesIndexed: prev.stats.sourcesIndexed + 1,
              knowledgeChunks: prev.stats.knowledgeChunks + 96,
            },
          }));
        }, 2200);
        return;
      }

      try {
        const source = await api.createSource(projectId, {
          name: payload.name,
          type: payload.type,
          file: payload.file,
          url: payload.youtubeUrl,
          options: payload.options,
        });
        setProject((prev) => ({
          ...prev,
          sources: [source, ...prev.sources],
        }));

        void api
          .pollSourceUntilReady(source.id, {
            onUpdate: (s) => {
              setProject((prev) => ({
                ...prev,
                sources: prev.sources.map((x) => (x.id === s.id ? s : x)),
              }));
            },
          })
          .then(() => refreshProject());
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Failed to add source");
      }
    },
    [apiOnline, projectId, refreshProject]
  );

  const openAddModal = useCallback((type: SourceType) => {
    setAddSourceType(type);
    setAddModalOpen(true);
  }, []);

  const handleBulkUpload = useCallback(
    async (items: BulkFileItem[], options: IndexingOptions) => {
      for (const item of items) {
        await handleProcessSource({
          name: item.name,
          type: item.type,
          file: item.file,
          options,
        });
      }
    },
    [handleProcessSource]
  );

  const handleFlashcardQuiz = useCallback((source: Source) => {
    setFlashPreselect(source.id);
    setFlashSelectAll(false);
    setFlashModalOpen(true);
  }, []);

  const handleProjectQuiz = useCallback(() => {
    setFlashPreselect(undefined);
    setFlashSelectAll(true);
    setFlashModalOpen(true);
  }, []);

  const handleUnderstandWithImages = useCallback(
    async (message: ChatMessage) => {
      if (!apiOnline || message.diagramLoading) return;
      const key = threadKeyFor(chatMode, selectedSource?.id ?? null);

      updateThread(key, (thread) => ({
        ...thread,
        messages: thread.messages.map((m) =>
          m.id === message.id ? { ...m, diagramLoading: true } : m
        ),
      }));
      setDiagramModal({ open: true, imageUrl: null, loading: true });

      try {
        const result = await api.generateDiagram(message.id);
        const url = `data:${result.mimeType};base64,${result.imageBase64}`;
        updateThread(key, (thread) => ({
          ...thread,
          messages: thread.messages.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  diagramLoading: false,
                  diagramImageUrl: url,
                  diagramWorthy: true,
                }
              : m
          ),
        }));
        setDiagramModal({ open: true, imageUrl: url, loading: false });
      } catch (err) {
        updateThread(key, (thread) => ({
          ...thread,
          messages: thread.messages.map((m) =>
            m.id === message.id ? { ...m, diagramLoading: false } : m
          ),
        }));
        setDiagramModal({ open: false, imageUrl: null, loading: false });
        alert(
          err instanceof Error ? err.message : "Failed to generate diagram"
        );
      }
    },
    [apiOnline, chatMode, selectedSource?.id, updateThread]
  );

  const handleViewDiagram = useCallback((message: ChatMessage) => {
    if (!message.diagramImageUrl) return;
    setDiagramModal({
      open: true,
      imageUrl: message.diagramImageUrl,
      loading: false,
    });
  }, []);

  const handleChatWithSource = useCallback((source: Source) => {
    setSelectedSourceId(source.id);
    setChatMode("individual");
    setThreads((prev) => {
      const key = `src:${source.id}`;
      if (prev[key]) return prev;
      return { ...prev, [key]: { messages: [] } };
    });
  }, []);

  const handleDeleteSource = useCallback(
    async (source: Source) => {
      if (!apiOnline || !projectId) {
        setProject((prev) => ({
          ...prev,
          sources: prev.sources.filter((s) => s.id !== source.id),
          stats: {
            ...prev.stats,
            sourcesIndexed: Math.max(
              0,
              prev.stats.sourcesIndexed - (source.status === "ready" ? 1 : 0)
            ),
            knowledgeChunks: Math.max(
              0,
              prev.stats.knowledgeChunks - (source.chunkCount || 0)
            ),
          },
        }));
      } else {
        try {
          await api.deleteSource(source.id);
          setProject((prev) => ({
            ...prev,
            sources: prev.sources.filter((s) => s.id !== source.id),
          }));
          void refreshProject();
        } catch (err) {
          alert(err instanceof Error ? err.message : "Failed to delete source");
          return;
        }
      }

      setThreads((prev) => {
        const next = { ...prev };
        delete next[`src:${source.id}`];
        return next;
      });
      if (selectedSourceId === source.id) {
        setSelectedSourceId(null);
        if (chatMode === "individual") setChatMode("global");
      }
    },
    [apiOnline, projectId, refreshProject, selectedSourceId, chatMode]
  );

  const handleGenerateFlashcards = useCallback(
    async (config: FlashcardGenerateConfig) => {
      setFlashModalOpen(false);
      const source = project.sources.find((s) =>
        config.sourceIds.includes(s.id)
      );
      setAnalysisMsg(
        `ContextAI analysis: Extracting concepts from ${source?.fileName ?? "selected sources"}...`
      );
      setAnalysisProgress(5);
      setAnalysisOpen(true);

      if (!apiOnline || !projectId) {
        let progress = 8;
        const timer = window.setInterval(() => {
          progress = Math.min(progress + 18, 100);
          setAnalysisProgress(progress);
          if (progress >= 100) {
            window.clearInterval(timer);
            window.setTimeout(() => {
              setAnalysisOpen(false);
              setQuizQuestions(freshMockQuestions());
              setQuizIndex(0);
              setSessionId(null);
              setQuizReviewMode(false);
              setQuizOpen(true);
            }, 400);
          }
        }, 350);
        return;
      }

      try {
        const { quizId } = await api.createQuiz(projectId, config);
        await api.watchQuizProgress(quizId, (p) => {
          setAnalysisProgress(p.progress || 0);
          if (p.progressMsg) setAnalysisMsg(p.progressMsg);
          if (p.status === "error") {
            setAnalysisOpen(false);
            alert(p.error || "Quiz generation failed");
          }
        });

        const quiz = await api.getQuiz(quizId);
        const session = await api.startQuizSession(quizId);
        setSessionId(session.sessionId);

        setQuizQuestions(
          quiz.questions.map((q) => ({
            id: q.id,
            number: q.number,
            prompt: q.prompt,
            options: q.options,
            correctOptionId: "",
            explanation: "",
            reference: "",
            status: "unanswered",
          }))
        );
        setAnalysisOpen(false);
        setQuizIndex(0);
        setQuizReviewMode(false);
        setQuizOpen(true);
      } catch (err) {
        setAnalysisOpen(false);
        alert(err instanceof Error ? err.message : "Quiz generation failed");
      }
    },
    [apiOnline, projectId, project.sources]
  );

  const handleDiscuss = useCallback(
    (question: QuizQuestion) => {
      setQuizOpen(false);
      setChatMode("global");
      void handleSend(
        `Can you explain more about this quiz question: "${question.prompt}"`
      );
    },
    [handleSend]
  );

  const handleFinishQuiz = useCallback(
    async (questions: QuizQuestion[]) => {
      setQuizQuestions(questions);

      if (!sessionId || !apiOnline) {
        const graded = questions.map((q) => {
          if (!q.selectedOptionId) {
            return { ...q, status: "unanswered" as const };
          }
          const isCorrect = q.selectedOptionId === q.correctOptionId;
          return {
            ...q,
            status: (isCorrect ? "correct" : "incorrect") as QuizQuestion["status"],
          };
        });
        const answered = graded.filter(
          (q) => q.status === "correct" || q.status === "incorrect"
        );
        const correct = graded.filter((q) => q.status === "correct").length;
        setQuizQuestions(graded);
        setSessionScore(
          answered.length
            ? Math.round((correct / answered.length) * 100)
            : 0
        );
        setQuizOpen(false);
        setScoreboardTab(-1);
        setScoreboardOpen(true);
        return;
      }

      try {
        for (const q of questions) {
          if (!q.selectedOptionId) continue;
          await api.submitAnswer(sessionId, {
            questionId: q.id,
            selectedOptionId: q.selectedOptionId,
          });
        }
        const board = await api.getSessionScoreboard(sessionId);
        setQuizQuestions(board.questions);
        setSessionScore(board.score);
        setQuizOpen(false);
        setScoreboardTab(-1);
        setScoreboardOpen(true);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to submit quiz");
      }
    },
    [sessionId, apiOnline]
  );

  useEffect(() => {
    if (chatMode === "individual" && !selectedSourceId) {
      const ready = project.sources.find((s) => s.status === "ready");
      if (ready) setSelectedSourceId(ready.id);
    }
  }, [chatMode, selectedSourceId, project.sources]);

  const contextChips = useMemo(
    () =>
      project.sources
        .filter((s) => s.status === "ready")
        .slice(0, 6)
        .map((s) => (s.label ? `${s.label}: ${s.name}` : s.name)) ||
      contextFilterChips,
    [project.sources]
  );

  if (loadError) {
    return (
      <div className="flex h-screen overflow-hidden bg-cream">
        <Sidebar />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[16px] font-semibold text-ink">Project not found</p>
          <p className="text-[13px] text-ink-muted">{loadError}</p>
          <Link
            href="/projects"
            className="mt-2 rounded-xl bg-teal px-4 py-2 text-[13px] font-semibold text-white"
          >
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-cream px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/projects"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-cream-muted hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Projects
            </Link>
            <span className="text-border">/</span>
            <h1 className="truncate text-[18px] font-semibold tracking-tight text-ink">
              {project.name}
            </h1>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                apiOnline
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {apiOnline ? "API connected" : "Mock mode"}
            </span>
          </div>

          <div className="flex shrink-0 rounded-full bg-cream-muted p-1">
            <button
              type="button"
              onClick={() => setChatMode("global")}
              className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                chatMode === "global"
                  ? "bg-teal text-white shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Project Chat
            </button>
            <button
              type="button"
              onClick={() => setChatMode("individual")}
              className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                chatMode === "individual"
                  ? "bg-teal text-white shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Individual Source Chat
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(220px,260px)]">
          <SourcesPanel
            sources={project.sources}
            onAddSourceType={openAddModal}
            onBulkUpload={() => setBulkModalOpen(true)}
            onProjectQuiz={handleProjectQuiz}
            onFlashcardQuiz={handleFlashcardQuiz}
            onChatWithSource={handleChatWithSource}
            onDeleteSource={handleDeleteSource}
            onRetryIndex={async (source) => {
              if (!apiOnline) return;
              try {
                const updated = await api.reindexSource(source.id);
                setProject((prev) => ({
                  ...prev,
                  sources: prev.sources.map((s) =>
                    s.id === updated.id ? updated : s
                  ),
                }));
                void api
                  .pollSourceUntilReady(updated.id, {
                    onUpdate: (s) => {
                      setProject((prev) => ({
                        ...prev,
                        sources: prev.sources.map((x) =>
                          x.id === s.id ? s : x
                        ),
                      }));
                    },
                  })
                  .then(() => refreshProject());
              } catch (err) {
                alert(
                  err instanceof Error ? err.message : "Failed to retry indexing"
                );
              }
            }}
          />
          <ChatPanel
            messages={activeThread.messages}
            onSend={handleSend}
            isThinking={isThinking}
            chatMode={chatMode}
            contextChips={
              contextChips.length ? contextChips : contextFilterChips
            }
            activeChips={activeChips}
            onToggleChip={(chip) =>
              setActiveChips((prev) =>
                prev.includes(chip)
                  ? prev.filter((c) => c !== chip)
                  : [...prev, chip]
              )
            }
            sourceName={selectedSource?.name}
            onCitationClick={setActiveCitation}
            onUnderstandWithImages={handleUnderstandWithImages}
            onViewDiagram={handleViewDiagram}
          />
          <InfoPanel
            stats={project.stats}
            sourceViewerTitle={
              selectedSource
                ? selectedSource.label
                  ? `${selectedSource.label}: ${selectedSource.fileName}`
                  : selectedSource.fileName
                : "No source selected"
            }
            sourceViewerText={viewerText}
          />
        </div>
      </div>

      <AddSourceModal
        open={addModalOpen}
        projectName={project.name || "Project"}
        initialType={addSourceType}
        onClose={() => setAddModalOpen(false)}
        onProcess={handleProcessSource}
      />

      <BulkUploadModal
        open={bulkModalOpen}
        projectName={project.name || "Project"}
        onClose={() => setBulkModalOpen(false)}
        onUpload={handleBulkUpload}
      />

      <GenerateFlashcardsModal
        open={flashModalOpen}
        sources={project.sources}
        preselectedSourceId={flashPreselect}
        selectAllByDefault={flashSelectAll}
        title={
          flashSelectAll
            ? "Project Quiz — pick sources"
            : "Generate Flashcards from Source"
        }
        onClose={() => setFlashModalOpen(false)}
        onGenerate={handleGenerateFlashcards}
      />

      <AnalysisProgressModal
        open={analysisOpen}
        message={analysisMsg}
        progress={analysisProgress}
      />

      <McqQuizModal
        open={quizOpen}
        questions={quizQuestions}
        initialIndex={quizIndex}
        reviewMode={quizReviewMode}
        onClose={() => setQuizOpen(false)}
        onDiscuss={handleDiscuss}
        onQuestionsChange={setQuizQuestions}
        onFinish={handleFinishQuiz}
      />

      <SessionScoreboardModal
        open={scoreboardOpen}
        questions={quizQuestions}
        score={sessionScore}
        activeIndex={scoreboardTab}
        onClose={() => setScoreboardOpen(false)}
        onSelectQuestion={(i) => {
          setScoreboardTab(i);
          if (i >= 0) {
            setScoreboardOpen(false);
            setQuizIndex(i);
            setQuizReviewMode(true);
            setQuizOpen(true);
          }
        }}
      />

      <SourceLocationModal
        open={Boolean(activeCitation)}
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      <DiagramModal
        open={diagramModal.open}
        imageUrl={diagramModal.imageUrl}
        loading={diagramModal.loading}
        onClose={() =>
          setDiagramModal({ open: false, imageUrl: null, loading: false })
        }
      />
    </div>
  );
}
