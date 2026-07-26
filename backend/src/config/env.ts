import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  REDIS_URL: z.string().min(1),

  R2_ENDPOINT: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  /** Local fallback when R2 is not configured */
  LOCAL_UPLOAD_DIR: z.string().default("./uploads"),

  LLM_PROVIDER: z.enum(["gemini", "openai", "anthropic"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CHAT_MODEL: z.string().default("gemini-2.5-flash"),
  LIGHT_MODEL: z.string().default("gemini-2.5-flash-lite"),
  IMAGE_MODEL: z.string().default("gemini-2.5-flash-image"),
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIM: z.coerce.number().default(768),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000"),
  YT_PROXY_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = parseEnv();

export const corsOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
