# ContextAI

**Production-grade RAG study assistant** — index lecture materials, chat with grounded citations, generate MCQ quizzes, and visualize concepts with chalkboard-style diagrams.

ContextAI turns PDFs, transcripts, YouTube lectures, and web pages into a searchable knowledge base. Answers are generated only from your sources, with clickable citations that jump to the exact PDF page or video timestamp.

---

## Features

| Capability | Description |
|---|---|
| **Multi-source ingestion** | PDF, VTT/SRT transcripts, YouTube URLs, web links, plain text — plus bulk upload |
| **Grounded chat** | Streaming SSE answers with citation chips; global (all sources) or individual (scoped) threads |
| **Citation deep-links** | Open the exact PDF page, YouTube timestamp, or transcript chunk from a citation |
| **Project quiz** | Async MCQ generation from selected sources, progress streaming, scored sessions |
| **Understand with images** | Optional chalkboard diagrams via Gemini image models when an answer is diagram-worthy |
| **Projects workspace** | Dashboard, project library, per-project sources / chat / stats |

---

## Monorepo layout

```
ContextAI/
├── frontend/          # Next.js 16 (App Router) — Vercel
├── backend/           # Express 5 + Prisma + BullMQ RAG API — Render / Railway
│   ├── src/           # API, workers, RAG, ingest, LLM
│   ├── prisma/        # Schema + migrations (pgvector)
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── render.yaml
│   └── DEPLOY.md
└── README.md          # You are here
```

| Package | Docs |
|---|---|
| Backend API & workers | [backend/README.md](backend/README.md) |
| Frontend UI | [frontend/README.md](frontend/README.md) |
| Production deploy | [backend/DEPLOY.md](backend/DEPLOY.md) |

---

## Architecture

```
┌─────────────────┐     HTTPS / SSE      ┌──────────────────────┐
│  Next.js UI     │ ◄──────────────────► │  Express API         │
│  (Vercel)       │   NEXT_PUBLIC_API_URL│  :4000               │
└─────────────────┘                      └──────────┬───────────┘
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     ▼                              ▼                              ▼
              ┌─────────────┐              ┌──────────────┐              ┌─────────────────┐
              │ Neon /      │              │ Redis        │              │ R2 or ./uploads │
              │ Postgres +  │              │ (BullMQ)     │              │ (files / images)│
              │ pgvector    │              └──────┬───────┘              └─────────────────┘
              └─────────────┘                     │
                                                  ▼
                                         ┌─────────────────┐
                                         │ Worker process  │
                                         │ source-index    │
                                         │ quiz-generate   │
                                         └─────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │ Gemini API      │
                                         │ chat / embed /  │
                                         │ image           │
                                         └─────────────────┘
```

### Retrieval flow (query path)

```
User question
    → Input guardrails
    → Query rewrite + HyDE / sub-queries
    → Vector retrieve (pgvector, optional source filter)
    → Rerank (top-k)
    → Grounded generate (SSE tokens)
    → Evaluate (score 0–10; retry if below threshold)
    → Output guardrails
    → Diagram-worthy assessment
    → Persist message + citations
```

### Ingest flow (worker)

```
Upload / URL
    → Parse (PDF · VTT/SRT · YouTube · web · text)
    → Chunk (~800 tokens, overlap ~80, soft cap ~80 chunks)
    → Embed (gemini-embedding-001, 768-d)
    → Upsert into Postgres pgvector (HNSW)
    → Source status → Indexed
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Lucide |
| Backend | Node.js ≥20, Express 5, TypeScript, Zod, Helmet, Pino |
| Data | PostgreSQL 16 + **pgvector**, Prisma 6 |
| Jobs | Redis 7, BullMQ |
| LLM | Google Gemini (`gemini-2.5-flash`, embeddings, `gemini-2.5-flash-image`) |
| Storage | Cloudflare R2 (prod) or local `./uploads` (dev) |
| Deploy | Frontend → **Vercel** · API + worker → **Render / Railway** · DB → **Neon** · Redis → **Upstash** |

---

## Quick start (local)

**Prerequisites:** Node.js 20+, Docker Desktop, a [Gemini API key](https://aistudio.google.com/apikey).

### 1. Infrastructure

```bash
cd backend
docker compose up -d          # Postgres (pgvector) + Redis
```

### 2. Backend API

```bash
cd backend
cp .env.example .env          # set GEMINI_API_KEY
npm install
npx prisma generate
npx prisma migrate deploy     # or: npx prisma db push
npm run dev                   # http://localhost:4000
```

### 3. Backend worker (separate terminal)

```bash
cd backend
npm run dev:worker            # indexing + quiz jobs
```

### 4. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                        # http://localhost:3000
```

When the API is reachable, the UI badge shows **API connected**. If the API is down, the UI falls back to mock mode for layout preview.

### Verify

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
```

---

## Environment variables (overview)

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection (pooled in prod) |
| `DIRECT_URL` | Prod | Direct URL for Prisma migrations |
| `REDIS_URL` | Yes | BullMQ / Redis |
| `GEMINI_API_KEY` | Yes | Gemini chat, embeddings, images |
| `CORS_ALLOWED_ORIGINS` | Yes | e.g. `http://localhost:3000` |
| `LLM_PROVIDER` | No | Default `gemini` |
| `CHAT_MODEL` / `LIGHT_MODEL` / `IMAGE_MODEL` / `EMBEDDING_MODEL` | No | Model overrides |
| `R2_*` | No | Cloudflare R2; omit for local uploads |
| `EMBED_*` / `CHUNK_*` | No | Free-tier-friendly ingest throttles |

Full list: [backend/.env.example](backend/.env.example) · [backend/README.md](backend/README.md#environment-variables)

### Frontend (`frontend/.env.local`)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL (`http://localhost:4000`) |

---

## Deploy (production)

| Piece | Service | Notes |
|---|---|---|
| UI | **Vercel** | Root directory `frontend`; set `NEXT_PUBLIC_API_URL` |
| API | **Render** / **Railway** | `node dist/index.js` · health `/health` |
| Worker | **Render** worker / second Railway service | `node dist/worker.js` |
| Database | **Neon** | Enable `vector` extension; set `DATABASE_URL` + `DIRECT_URL` |
| Redis | **Upstash** | TLS `REDIS_URL` |
| Files | **Cloudflare R2** | Or ephemeral local disk (not recommended in prod) |

Blueprint: [`backend/render.yaml`](backend/render.yaml)  
Step-by-step: [`backend/DEPLOY.md`](backend/DEPLOY.md)

After deploy:

```bash
curl https://<api-host>/health
curl https://<api-host>/health/ready
```

Set backend `CORS_ALLOWED_ORIGINS` to your Vercel URL(s).

---

## Typical workflow

1. Create a **project** from the dashboard  
2. **Add sources** (PDF / VTT / YouTube / bulk) — wait until status is **Indexed**  
3. Chat in **Project Chat** (all sources) or **Individual Source Chat**  
4. Click citations to open the exact location  
5. Run a **Project Quiz** over selected sources  
6. Use **Understand with images** when offered on diagram-worthy answers  

---

## License

Private / proprietary unless otherwise stated.
