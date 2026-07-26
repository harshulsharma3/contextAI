# Deploying ContextAI

## Architecture

| Piece | Host | Notes |
|-------|------|-------|
| Frontend (`frontend/`) | **Vercel** | Set `NEXT_PUBLIC_API_URL` |
| API web (`backend/` → `node dist/index.js`) | **Render** or **Railway** | See `backend/render.yaml` |
| Worker (`backend/` → `node dist/worker.js`) | **Render** worker / **Railway** service | Same env as API |
| Postgres + pgvector | **Neon** | Enable `vector` extension |
| Redis | **Upstash** | TLS URL for BullMQ |
| Object storage | **Cloudflare R2** | Optional; falls back to local `./uploads` |

## 1. Neon

1. Create a project, copy the **pooled** connection string → `DATABASE_URL` (append `?pgbouncer=true` if not present).
2. Copy the **direct** (non-pooler) URL → `DIRECT_URL`.
3. In SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`

## 2. Upstash

Create a Redis database → copy `REDIS_URL` (rediss://…).

## 3. Cloudflare R2 (recommended for prod)

Create a bucket + API token with Object Read/Write. Set:

- `R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

## 4. Gemini

Create an API key → `GEMINI_API_KEY`. Keep `LLM_PROVIDER=gemini`.

## 5. Render (or Railway)

### Render Blueprint

Use `backend/render.yaml` (web + worker). Set all env vars from `backend/.env.example`.

Build: `npm ci && npx prisma generate && npm run build`  
Release (web): `npx prisma migrate deploy`  
Start web: `node dist/index.js`  
Start worker: `node dist/worker.js`

**SSE tip:** Render free tier sleeps; use Starter+ for reliable streaming. Chat has a non-SSE fallback.

### Railway alternative

- Deploy two services from `backend/` (web + worker) using the Dockerfile or Nixpacks.
- Attach Railway Postgres (install pgvector) + Redis, or keep Neon/Upstash.

## 6. Vercel frontend

1. Root directory: `frontend`
2. Env: `NEXT_PUBLIC_API_URL=https://<your-api-host>`
3. Deploy

Set backend `CORS_ALLOWED_ORIGINS` to your Vercel URL(s), comma-separated.

## 7. Verify

```bash
curl https://<api>/health
curl https://<api>/health/ready
```

Then open the Vercel app — badge should show **API connected**. Upload a VTT/PDF, wait for Indexed, ask a question (SSE tokens), generate a quiz.
