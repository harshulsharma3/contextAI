import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { param } from "../../lib/params.js";
import * as service from "./service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const sourcesRouter = Router({ mergeParams: true });
export const sourceByIdRouter = Router();

const sourceTypeSchema = z.enum([
  "vtt",
  "srt",
  "youtube",
  "pdf",
  "text",
  "weblink",
  "video",
]);

sourcesRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const projectId = param(req, "id");
    const body = req.body || {};
    const parsedType = sourceTypeSchema.safeParse(body.type);
    if (!parsedType.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid or missing type", 400);
    }

    let options:
      | {
          generateSummary?: boolean;
          createFlashcards?: boolean;
          indexForSearch?: boolean;
        }
      | undefined;

    if (typeof body.options === "string") {
      try {
        options = JSON.parse(body.options);
      } catch {
        options = undefined;
      }
    } else if (typeof body.options === "object") {
      options = body.options;
    }

    const source = await service.createSource({
      projectId,
      name: body.name || req.file?.originalname || "Untitled source",
      type: parsedType.data,
      file: req.file,
      url: body.url || body.youtubeUrl,
      text: body.text,
      options,
    });
    res.status(201).json(source);
  } catch (err) {
    next(err);
  }
});

sourcesRouter.get("/", async (req, res, next) => {
  try {
    const sources = await service.listSources(param(req, "id"));
    res.json(sources);
  } catch (err) {
    next(err);
  }
});

sourceByIdRouter.get("/:id", async (req, res, next) => {
  try {
    const source = await service.getSource(param(req, "id"));
    res.json(source);
  } catch (err) {
    next(err);
  }
});

sourceByIdRouter.get("/:id/content", async (req, res, next) => {
  try {
    const content = await service.getSourceContent(param(req, "id"));
    res.json(content);
  } catch (err) {
    next(err);
  }
});

sourceByIdRouter.get("/:id/file", async (req, res, next) => {
  try {
    const file = await service.getSourceFile(param(req, "id"));
    res.removeHeader("X-Frame-Options");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.fileName.replace(/"/g, "")}"`
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(file.buffer);
  } catch (err) {
    next(err);
  }
});

sourceByIdRouter.get("/:id/chunks", async (req, res, next) => {
  try {
    const focus =
      typeof req.query.focus === "string" ? req.query.focus : undefined;
    const windowRaw =
      typeof req.query.window === "string"
        ? Number.parseInt(req.query.window, 10)
        : undefined;
    const window =
      windowRaw !== undefined && Number.isFinite(windowRaw)
        ? windowRaw
        : undefined;
    const chunks = await service.getSourceChunks(param(req, "id"), {
      focusChunkId: focus,
      window,
    });
    res.json(chunks);
  } catch (err) {
    next(err);
  }
});

sourceByIdRouter.delete("/:id", async (req, res, next) => {
  try {
    await service.deleteSource(param(req, "id"));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

sourceByIdRouter.post("/:id/reindex", async (req, res, next) => {
  try {
    const source = await service.retryIndexSource(param(req, "id"));
    res.json(source);
  } catch (err) {
    next(err);
  }
});
