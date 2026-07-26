# ContextAI Backend

Production Express + TypeScript RAG API and background workers for ContextAI.

Handles source ingestion, vector indexing, grounded chat (SSE), quiz generation, and optional chalkboard diagram generation.

---

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js ≥ 20, TypeScript (ESM) |
| HTTP | Express 5, Helmet, CORS, Zod validation |
| ORM / DB | Prisma 6 → PostgreSQL 16 + **pgvector** |
| Jobs | BullMQ + Redis 7 |
| LLM | Google Gemini (`@google/generative-ai`) via `LLMProvider` interface |
| Storage | Cloudflare R2 (S3 API) or local `./uploads` |
| Logging | Pino + pino-http |
| Limits | Global 120 req/min · chat/diagram 30 req/min |

---

## Architecture

```
backend/src/
├── index.ts              # HTTP API entry
├── worker.ts             # BullMQ workers entry
├── config/               # Zod-validated env
├── db/                   # Prisma client
├── modules/
│   ├── projects/         # CRUD + stats
│   ├── sources/          # Upload, list, file, chunks, reindex, delete
│   ├── chat/             # Streaming RAG chat + diagrams
│   └── quiz/             # Quiz create, progress SSE, sessions
├── ingest/               # Parse → chunk → embed (worker path)
│   └── parse/            # pdf, vtt, srt, youtube, web, text
├── rag/                  # Query pipeline (rewrite → retrieve → generate → evaluate)
├── llm/                  # Gemini provider + retry / rate-limit helpers
├── queue/                # Redis + source-index + quiz-generate queues
├── quizgen/              # Quiz worker
├── middleware/           # rateLimit, validate, errors, requestId
└── lib/                  # storage, SSE, logger, errors
```

### Processes

| Process | Command | Responsibility |
|---|---|---|
| **API** | `npm run dev` / `npm start` | REST + SSE, enqueue jobs |
| **Worker** | `npm run dev:worker` / `npm run start:worker` | Index sources, generate quizzes |

Both processes share the same env, database, Redis, and storage.

### Queues

| Queue | Concurrency | Job |
|---|---|---|
| `source-index` | 2 | Parse → chunk → embed → pgvector upsert |
| `quiz-generate` | 1 | Build MCQs from selected source chunks |

---

## Retrieval & RAG flow

### Ingest (async worker)

```
Source created (upload / URL)
  → Enqueue source-index
  → Parse by type (PDF pages, VTT/SRT cues, YouTube transcript, Readability HTML, text)
  → Chunk (~800 tokens, ~80 overlap, soft max ~80 chunks — tunable via env)
  → Embed batches (throttled for free-tier RPM)
  → Store Chunk rows with vector(768)
  → Mark Source Indexed
```

### Query (sync / SSE on API)

```
POST /api/projects/:id/chat
  → Input guardrails (empty / length / injection patterns)
  → Query rewrite + HyDE / sub-queries
  → Vector retrieve (optional sourceIds for individual mode)
  → Rerank → top-k context
  → Generate grounded answer (stream tokens on first attempt)
  → Evaluate quality (0–10); retry up to 3× if score < 6
  → Output guardrails
  → Assess diagramWorthy
  → Persist Message + Citations → SSE done
```

Citations include source id, locator (page or start/end ms), chunk id, and metadata used by the frontend deep-link modal.

### Diagrams (on demand)

```
POST /api/messages/:id/diagram
  → Build chalkboard prompt from Q&A
  → Gemini IMAGE_MODEL via :generateContent (gemini-2.5-flash-image)
  → Persist object (R2 / local) + diagramKey on Message
GET  /api/messages/:id/diagram  → binary image
```

---

## Supported source types

| Type | Input | Notes |
|---|---|---|
| `pdf` | Multipart file | Page-aware chunking |
| `vtt` / `srt` | Multipart file | Timestamped cues |
| `youtube` | URL | Transcript fetch |
| `weblink` | URL | Fetch + Mozilla Readability |
| `text` | Raw body / file | Plain text |
| `video` | — | Enum reserved; ASR not enabled (upload VTT/SRT instead) |

---

## API surface

Base URL (local): `http://localhost:4000`

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness + storage mode (`r2` \| `local`) |
| `GET` | `/health/ready` | Postgres + Redis readiness (503 if unhealthy) |

### Projects — `/api/projects`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create project |
| `GET` | `/` | List projects (with stats) |
| `GET` | `/:id` | Project detail |
| `PATCH` | `/:id` | Update |
| `DELETE` | `/:id` | Delete |

### Sources — `/api/projects/:id/sources` · `/api/sources`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/:id/sources` | Upload / add source (multipart, 50MB) |
| `GET` | `/api/projects/:id/sources` | List sources |
| `GET` | `/api/sources/:id` | Source detail |
| `GET` | `/api/sources/:id/file` | Inline file (PDF) |
| `GET` | `/api/sources/:id/chunks` | Chunk window (transcript focus) |
| `GET` | `/api/sources/:id/content` | Content payload |
| `POST` | `/api/sources/:id/reindex` | Re-queue indexing |
| `DELETE` | `/api/sources/:id` | Delete source |

### Chat — `/api/projects/:id` · `/api/chats` · `/api/messages`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/:id/chat` | Chat (SSE default; JSON fallback). Body: `message`, `mode` (`global` \| `individual`), `sourceIds?`, `chatId?`, `stream?` |
| `GET` | `/api/projects/:id/chats` | List chats |
| `GET` | `/api/chats/:id/messages` | Messages + citations |
| `POST` | `/api/messages/:id/diagram` | Generate board diagram |
| `GET` | `/api/messages/:id/diagram` | Fetch diagram bytes |

### Quiz — `/api/projects/:id` · `/api/quizzes` · `/api/sessions`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/projects/:id/quizzes` | Enqueue quiz generation |
| `GET` | `/api/projects/:id/quizzes` | List quizzes |
| `GET` | `/api/quizzes/:id` | Quiz detail |
| `GET` | `/api/quizzes/:id/progress` | SSE generation progress |
| `POST` | `/api/quizzes/:id/sessions` | Start session |
| `POST` | `/api/sessions/:id/answers` | Submit answers |
| `GET` | `/api/sessions/:id` | Scoreboard |

---

## Local setup

### Prerequisites

- Node.js **20+**
- Docker Desktop
- Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Start Postgres + Redis

```bash
cd backend
docker compose up -d
docker compose ps    # postgres + redis healthy
```

Defaults (also in `.env.example`):

- Postgres: `postgresql://contextai:contextai@localhost:5432/contextai`
- Redis: `redis://localhost:6379`

### 2. Configure environment

```bash
cp .env.example .env
```

Set at minimum:

```env
GEMINI_API_KEY=your_key_here
```

### 3. Install & database

```bash
npm install
npx prisma generate
npx prisma migrate deploy
# First-time / schema iterate alternative:
# npx prisma db push
```

Ensure the `vector` extension exists (docker image includes it; on Neon run `CREATE EXTENSION IF NOT EXISTS vector;`).

### 4. Run API + worker

```bash
# Terminal A
npm run dev

# Terminal B
npm run dev:worker
```

- API: http://localhost:4000  
- Health: http://localhost:4000/health  
- Ready: http://localhost:4000/health/ready  

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | API with hot reload (`tsx watch`) |
| `npm run dev:worker` | Worker with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled API |
| `npm run start:worker` | Run compiled worker |
| `npm run lint` | `tsc --noEmit` |
| `npm run prisma:studio` | Prisma Studio |

---

## Environment variables

Copy from [`.env.example`](.env.example).

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres URL (use pooled + `?pgbouncer=true` on Neon) |
| `REDIS_URL` | Redis URL for BullMQ |
| `GEMINI_API_KEY` | Google Gemini API key |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins (e.g. `http://localhost:3000`) |

### Strongly recommended in production

| Variable | Description |
|---|---|
| `DIRECT_URL` | Non-pooled Postgres URL for migrations |
| `R2_ENDPOINT` | Cloudflare R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret |
| `R2_BUCKET` | Bucket name |

If R2 vars are unset, files are stored under `LOCAL_UPLOAD_DIR` (default `./uploads`).

### LLM & models

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` \| `openai` \| `anthropic` (Gemini fully wired) |
| `CHAT_MODEL` | `gemini-2.5-flash` | Main chat / RAG generate |
| `LIGHT_MODEL` | `gemini-2.5-flash-lite` | JSON / light tasks |
| `IMAGE_MODEL` | `gemini-2.5-flash-image` | Board diagrams (`:generateContent`) |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Embeddings |
| `EMBEDDING_DIM` | `768` | Vector dimension (must match schema) |

### Ingest throttles (free-tier friendly)

| Variable | Default | Description |
|---|---|---|
| `EMBED_BATCH_SIZE` | `4` | Texts per embed batch |
| `EMBED_BATCH_DELAY_MS` | `1500` | Pause between batches |
| `EMBED_MAX_CHUNKS` | `80` | Soft cap per source |
| `CHUNK_TARGET_TOKENS` | `800` | Chunk size target |
| `CHUNK_OVERLAP_TOKENS` | `80` | Overlap |

### Optional

| Variable | Description |
|---|---|
| `PORT` | Default `4000` |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `LOG_LEVEL` | Pino level (default `info`) |
| `YT_PROXY_URL` | Optional YouTube proxy |
| `SENTRY_DSN` | Reserved for error tracking |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | For future providers |

---

## Data model (Prisma, high level)

- **Project** → Sources, Chats, Quizzes, Chunks  
- **Source** — type, status, storage key / URL, pages or duration, chunkCount  
- **Chunk** — text, locators (`page`, `startMs`/`endMs`), `vector(768)`  
- **Chat** — `global` \| `individual` + optional ChatSource links  
- **Message** + **Citation** — answer, score, `diagramWorthy`, `diagramKey`  
- **Quiz** → Questions / Options · **QuizSession** → Answers  

---

## Deploy

See **[DEPLOY.md](DEPLOY.md)** for Neon, Upstash, R2, Render, Railway, and Vercel wiring.

| Artifact | Use |
|---|---|
| [`Dockerfile`](Dockerfile) | Multi-stage Node 20 Alpine image (API default CMD) |
| [`render.yaml`](render.yaml) | Render Blueprint: web (`contextai-api`) + worker (`contextai-worker`) |

**Minimal production checklist**

1. Neon with `vector` extension · set `DATABASE_URL` + `DIRECT_URL`  
2. Upstash Redis · set `REDIS_URL`  
3. Gemini key · set `GEMINI_API_KEY`  
4. R2 bucket · set `R2_*`  
5. Deploy API + worker with identical env (except start command)  
6. `CORS_ALLOWED_ORIGINS` = your Vercel URL(s)  
7. Verify `/health` and `/health/ready`  

```bash
# Build locally (mirrors CI)
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
node dist/index.js          # API
node dist/worker.js         # Worker (second process)
```

---

## Operational notes

- **Always run the worker** in local and prod — without it, sources stay pending and quizzes never finish.  
- **SSE**: prefer a non-sleeping host plan for reliable streaming; the client also supports a non-stream JSON fallback.  
- **Image generation** depends on Gemini image quota for `IMAGE_MODEL`; free-tier Nano Banana limits are often `0/0` until billing is enabled.  
- **Rate limits**: Gemini 429s are retried with backoff; hard quota exhaustion (`limit: 0`) fails fast with a clear error.  

---

## Related docs

- [Root README](../README.md) — product overview & monorepo quick start  
- [Frontend README](../frontend/README.md) — UI setup & deploy  
- [DEPLOY.md](DEPLOY.md) — production services walkthrough  
