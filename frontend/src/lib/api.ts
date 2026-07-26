import type {
  ChatMessage,
  ChatMode,
  FlashcardGenerateConfig,
  Project,
  QuizQuestion,
  Source,
  SourceType,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getApiUrl() {
  return API_URL;
}

export function isApiConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_API_URL) || true;
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new Error(message || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listProjects() {
  return request<
    Array<{
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
    }>
  >("/api/projects");
}

export async function createProject(name: string) {
  return request<{ id: string; name: string }>("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteProject(id: string) {
  return request<void>(`/api/projects/${id}`, { method: "DELETE" });
}

export async function getProject(id: string) {
  return request<Project>(`/api/projects/${id}`);
}

export async function createSource(
  projectId: string,
  payload: {
    name: string;
    type: SourceType;
    file?: File;
    url?: string;
    text?: string;
    options?: {
      generateSummary?: boolean;
      createFlashcards?: boolean;
      indexForSearch?: boolean;
    };
  }
) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("type", payload.type);
  if (payload.file) form.append("file", payload.file);
  if (payload.url) form.append("url", payload.url);
  if (payload.text) form.append("text", payload.text);
  if (payload.options) form.append("options", JSON.stringify(payload.options));

  return request<Source>(`/api/projects/${projectId}/sources`, {
    method: "POST",
    body: form,
  });
}

export async function getSource(id: string) {
  return request<Source>(`/api/sources/${id}`);
}

export async function getSourceContent(id: string) {
  return request<{ id: string; content: string; fileName: string }>(
    `/api/sources/${id}/content`
  );
}

export async function reindexSource(id: string) {
  return request<Source>(`/api/sources/${id}/reindex`, { method: "POST" });
}

export async function deleteSource(id: string) {
  return request<void>(`/api/sources/${id}`, { method: "DELETE" });
}

export function getSourceFileUrl(id: string, page?: number) {
  const base = `${API_URL}/api/sources/${id}/file`;
  if (page && page > 0) return `${base}#page=${page}&view=FitH`;
  return base;
}

export async function getSourceChunks(
  id: string,
  opts?: { focus?: string; window?: number }
) {
  const params = new URLSearchParams();
  if (opts?.focus) params.set("focus", opts.focus);
  if (opts?.window !== undefined) params.set("window", String(opts.window));
  const qs = params.toString();
  return request<{
    sourceId: string;
    name: string;
    type: string;
    sourceUrl?: string | null;
    focusChunkId: string | null;
    chunks: Array<{
      id: string;
      chunkIndex: number;
      content: string;
      page: number | null;
      startMs: number | null;
      endMs: number | null;
      locatorLabel: string;
      focused: boolean;
    }>;
  }>(`/api/sources/${id}/chunks${qs ? `?${qs}` : ""}`);
}

export async function pollSourceUntilReady(
  id: string,
  opts?: { intervalMs?: number; timeoutMs?: number; onUpdate?: (s: Source) => void }
): Promise<Source> {
  const interval = opts?.intervalMs ?? 2000;
  const timeout = opts?.timeoutMs ?? 5 * 60_000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const source = await getSource(id);
    opts?.onUpdate?.(source);
    if (source.status === "ready" || source.status === "error") return source;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Timed out waiting for source indexing");
}

export type ChatSseHandlers = {
  onStatus?: (stage: string, attempt?: number) => void;
  onToken?: (text: string) => void;
  onCitation?: (citation: {
    id: string;
    sourceId: string;
    sourceLabel: string;
    timestamp: string;
    chunkId?: string;
    page?: number;
    startMs?: number;
    endMs?: number;
    sourceType?: string;
    sourceUrl?: string;
    hasFile?: boolean;
  }) => void;
  onDone?: (data: {
    chatId: string;
    messageId: string;
    score: number;
    diagramWorthy?: boolean;
  }) => void;
  onError?: (message: string) => void;
};

/** POST + SSE reader (fetch streaming). Falls back to non-stream JSON. */
export async function sendChat(
  projectId: string,
  body: {
    message: string;
    mode: ChatMode;
    sourceIds?: string[];
    chatId?: string;
  },
  handlers: ChatSseHandlers
): Promise<{ chatId?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!res.ok) {
      throw new Error(`Chat failed (${res.status})`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream") || !res.body) {
      const json = await res.json();
      handlers.onToken?.(json.message?.content || "");
      handlers.onDone?.({
        chatId: json.chatId,
        messageId: json.message?.id,
        score: 0,
      });
      return { chatId: json.chatId };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let chatId: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (event === "status") handlers.onStatus?.(parsed.stage, parsed.attempt);
          if (event === "token") handlers.onToken?.(parsed.text || "");
          if (event === "citation") handlers.onCitation?.(parsed);
          if (event === "done") {
            chatId = parsed.chatId;
            handlers.onDone?.(parsed);
          }
          if (event === "error") handlers.onError?.(parsed.message || "Chat error");
        } catch {
          /* ignore malformed */
        }
      }
    }

    return { chatId };
  } catch (err) {
    // Non-stream fallback
    try {
      const json = await request<{
        chatId: string;
        message: ChatMessage;
      }>(`/api/projects/${projectId}/chat`, {
        method: "POST",
        body: JSON.stringify({ ...body, stream: false }),
      });
      handlers.onToken?.(json.message.content);
      for (const c of json.message.citations || []) {
        handlers.onCitation?.(c);
      }
      handlers.onDone?.({
        chatId: json.chatId,
        messageId: json.message.id,
        score: 0,
        diagramWorthy: json.message.diagramWorthy,
      });
      return { chatId: json.chatId };
    } catch (fallbackErr) {
      handlers.onError?.(
        fallbackErr instanceof Error ? fallbackErr.message : String(err)
      );
      throw fallbackErr;
    }
  }
}

export async function listChats(projectId: string) {
  return request<Array<{ id: string; title: string; preview: string }>>(
    `/api/projects/${projectId}/chats`
  );
}

export async function getChatMessages(chatId: string) {
  return request<ChatMessage[]>(`/api/chats/${chatId}/messages`);
}

export async function generateDiagram(messageId: string) {
  return request<{
    messageId: string;
    mimeType: string;
    imageBase64: string;
  }>(`/api/messages/${messageId}/diagram`, { method: "POST" });
}

export function getDiagramUrl(messageId: string) {
  return `${API_URL}/api/messages/${messageId}/diagram`;
}

export async function createQuiz(
  projectId: string,
  config: FlashcardGenerateConfig
) {
  return request<{ quizId: string; status: string }>(
    `/api/projects/${projectId}/quizzes`,
    {
      method: "POST",
      body: JSON.stringify(config),
    }
  );
}

export async function getQuiz(quizId: string) {
  return request<{
    id: string;
    status: string;
    progress: number;
    progressMsg?: string;
    questions: Array<{
      id: string;
      number: number;
      prompt: string;
      options: Array<{ id: string; label: string; text: string }>;
      status: string;
    }>;
  }>(`/api/quizzes/${quizId}`);
}

export async function watchQuizProgress(
  quizId: string,
  onProgress: (p: {
    status: string;
    progress: number;
    progressMsg?: string;
    error?: string;
  }) => void
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/quizzes/${quizId}/progress`, {
      headers: { Accept: "text/event-stream" },
    });
    if (!res.ok || !res.body) throw new Error("SSE unavailable");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        try {
          const parsed = JSON.parse(dataLine.slice(5).trim());
          onProgress(parsed);
          if (parsed.status === "ready" || parsed.status === "error") return;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    // Poll fallback
    const start = Date.now();
    while (Date.now() - start < 5 * 60_000) {
      const quiz = await getQuiz(quizId);
      onProgress({
        status: quiz.status,
        progress: quiz.progress,
        progressMsg: quiz.progressMsg,
      });
      if (quiz.status === "ready" || quiz.status === "error") return;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

export async function startQuizSession(quizId: string) {
  return request<{ sessionId: string }>(`/api/quizzes/${quizId}/sessions`, {
    method: "POST",
  });
}

export async function submitAnswer(
  sessionId: string,
  body: {
    questionId: string;
    selectedOptionId: string;
    confidence?: number;
  }
) {
  return request<{
    isCorrect: boolean;
    correctOptionId: string;
    explanation: string;
    reference: string;
  }>(`/api/sessions/${sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getSessionScoreboard(sessionId: string) {
  return request<{
    sessionId: string;
    score: number;
    questions: QuizQuestion[];
  }>(`/api/sessions/${sessionId}`);
}

/** Ensure a default project exists and return its id */
export async function ensureDefaultProject(
  name = "Introduction to Psychology"
): Promise<string> {
  const projects = await listProjects();
  if (projects.length > 0) return projects[0]!.id;
  const created = await createProject(name);
  return created.id;
}
