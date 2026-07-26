# ContextAI Frontend

Next.js App Router UI for ContextAI — project dashboard, source management, grounded chat with citations, MCQ quizzes, and chalkboard diagram viewing.

Talks exclusively to the ContextAI backend over HTTP/SSE. When the API is unreachable, the app falls back to **mock mode** so the layout remains reviewable.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) |
| UI | React 19, TypeScript, **Tailwind CSS 4**, Lucide icons |
| API client | `src/lib/api.ts` — `fetch` + SSE reader |
| Deploy | **Vercel** (recommended) |

---

## Features (UI)

| Area | Behavior |
|---|---|
| **Dashboard** | Project cards, create / open / delete, API connection badge |
| **Projects library** | Browse all projects |
| **Workspace** | Collapsible sidebar, sources panel, chat, project stats |
| **Sources** | Add PDF / VTT / SRT / YouTube / web / text; bulk upload; delete; status (pending → indexed) |
| **Chat modes** | **Project Chat** (global) vs **Individual Source Chat** |
| **Citations** | Click → PDF page / YouTube timestamp / transcript chunk modal |
| **Quiz** | Multi-select sources → generate → take MCQ → finish → scoreboard |
| **Diagrams** | “Understand with images” → chalkboard modal (generate + view) |

---

## Project structure

```
frontend/
├── src/
│   ├── app/                      # App Router pages
│   │   ├── page.tsx              # Dashboard (/)
│   │   ├── projects/
│   │   │   ├── page.tsx          # Projects library
│   │   │   └── [id]/page.tsx     # Project workspace
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── dashboard/            # Workspace, chat, sources, diagram, citations
│   │   ├── projects/             # Library, cards, create modal
│   │   └── ...                   # Quiz modals, sidebar, etc.
│   ├── lib/
│   │   ├── api.ts                # Typed API + SSE chat
│   │   └── mock-data.ts          # Offline fallback
│   └── types/                    # Shared domain types
├── .env.local.example
├── package.json
└── README.md
```

### Routes

| Path | Screen |
|---|---|
| `/` | Dashboard home — projects overview |
| `/projects` | Projects library |
| `/projects/[id]` | Full project workspace (sources + chat + quiz) |

---

## How the UI talks to the API

```
Browser
  → NEXT_PUBLIC_API_URL (e.g. http://localhost:4000)
  → REST: projects, sources, quizzes, sessions, diagrams
  → SSE:  POST /api/projects/:id/chat  (token stream + done)
  → SSE:  GET  /api/quizzes/:id/progress
```

- `healthCheck()` on load sets **API connected** vs **Mock mode**.  
- Chat prefers streaming; on failure it falls back to non-stream JSON.  
- Diagram images may be shown as `data:` URLs from the generate response, or fetched via `GET /api/messages/:id/diagram`.

Domain types in `src/types` mirror backend payloads (`Source`, `ChatMessage`, `Citation`, quiz models, etc.).

---

## Local setup

### Prerequisites

- Node.js **20+**
- Backend running on port **4000** (API **and** worker) — see [../backend/README.md](../backend/README.md)

### 1. Configure env

```bash
cd frontend
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 2. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Confirm the header / badge shows **API connected**.

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Next.js dev server (`:3000`) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend origin, no trailing slash. Local: `http://localhost:4000`. Prod: `https://<your-api-host>` |

Only this public variable is required. Secrets stay on the backend.

Example file: [`.env.local.example`](.env.local.example)

---

## Working with the product (UI flow)

1. **Create a project** from the dashboard.  
2. Open the project → **Add sources** (or bulk upload). Wait until sources are **Indexed** (worker must be running).  
3. Chat in **Project Chat**, or select a source for **Individual Source Chat**.  
4. Click citation chips to open the source location modal.  
5. Use **Project Quiz** → select sources → take the quiz → **Finish & See Score**.  
6. On diagram-worthy answers, click **Understand with images** to generate / view a board diagram.  

---

## Deploy (Vercel)

1. Import the monorepo in Vercel.  
2. Set **Root Directory** to `frontend`.  
3. Framework preset: Next.js (auto).  
4. Environment variable:

   ```
   NEXT_PUBLIC_API_URL=https://<your-backend-host>
   ```

5. Deploy.  
6. On the backend, set:

   ```
   CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
   ```

   (comma-separate additional preview URLs if needed.)

### Production checklist

- [ ] Backend `/health` and `/health/ready` return OK  
- [ ] Worker is running (indexing + quizzes)  
- [ ] `NEXT_PUBLIC_API_URL` points at HTTPS API  
- [ ] Backend CORS includes the Vercel origin  
- [ ] UI badge shows **API connected**  

Full stack deploy guide: [../backend/DEPLOY.md](../backend/DEPLOY.md)

---

## Architecture notes

- **Client-heavy workspace** — project state, threads, and modals live in React; the API is the source of truth for persistence.  
- **Thread model** — UI keeps separate threads for `global` vs `src:<id>` so mode switches do not mix histories.  
- **Graceful degradation** — mock data powers empty/offline demos without crashing the app.  
- **No server secrets in Next** — all LLM keys and DB URLs remain on the Express backend.  

---

## Related docs

- [Root README](../README.md) — architecture, retrieval flow, monorepo quick start  
- [Backend README](../backend/README.md) — API, env vars, workers  
- [Deploy guide](../backend/DEPLOY.md) — Vercel + Render/Railway + Neon + R2  
