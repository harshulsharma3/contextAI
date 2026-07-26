/** Shared domain types — designed to map 1:1 with the future Node/TS RAG API */

export type SourceStatus = "pending" | "indexing" | "ready" | "error";

export type SourceType =
  | "vtt"
  | "srt"
  | "youtube"
  | "pdf"
  | "text"
  | "weblink"
  | "video";

export type ChatMode = "global" | "individual";

export interface Source {
  id: string;
  name: string;
  fileName: string;
  type: SourceType;
  status: SourceStatus;
  durationSeconds?: number;
  chunkCount?: number;
  createdAt: string;
  /** Optional display label prefix, e.g. "PDF:" */
  label?: string;
  /** Set when status=error (indexing / embedding failure) */
  error?: string;
  /** Original URL for youtube / weblink sources */
  sourceUrl?: string;
}

export interface Citation {
  id: string;
  sourceId: string;
  sourceLabel: string;
  /** Timestamp / locator label, e.g. "18:45" or "p.14" */
  timestamp: string;
  chunkId?: string;
  page?: number;
  startMs?: number;
  endMs?: number;
  sourceType?: SourceType | string;
  sourceUrl?: string;
  hasFile?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Optional bold title for assistant answers */
  title?: string;
  citations?: Citation[];
  createdAt: string;
  /** True when a chalkboard diagram would help */
  diagramWorthy?: boolean;
  /** Data URL or API URL once a diagram has been generated */
  diagramImageUrl?: string;
  /** True while diagram generation is in flight */
  diagramLoading?: boolean;
}

export interface ProjectStats {
  sourcesIndexed: number;
  totalDurationLabel: string;
  knowledgeChunks: number;
}

export interface RecentChat {
  id: string;
  title: string;
  preview: string;
}

export interface Project {
  id: string;
  name: string;
  stats: ProjectStats;
  sources: Source[];
  recentChats: RecentChat[];
}

export interface IndexingOptions {
  generateSummary: boolean;
  createFlashcards: boolean;
  indexForSearch: boolean;
}

export interface AddSourcePayload {
  projectId: string;
  name: string;
  type: SourceType;
  /** Local file for SRT/VTT uploads */
  file?: File;
  youtubeUrl?: string;
  options: IndexingOptions;
}

export type QuizAnswerStatus = "correct" | "incorrect" | "pending" | "unanswered";

export interface QuizOption {
  id: string;
  label: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  number: number;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
  reference: string;
  /** User's selected option, if any */
  selectedOptionId?: string;
  status: QuizAnswerStatus;
}

export interface FlashcardGenerateConfig {
  sourceIds: string[];
  cardCount: number;
  focus: string;
}
