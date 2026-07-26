import { Router } from "express";
import { z } from "zod";
import { param } from "../../lib/params.js";
import { chatRateLimit } from "../../middleware/rateLimit.js";
import { validateBody } from "../../middleware/validate.js";
import * as service from "./service.js";

export const chatRouter = Router({ mergeParams: true });
export const chatByIdRouter = Router();
export const messageByIdRouter = Router();

chatRouter.post(
  "/chat",
  chatRateLimit,
  validateBody(
    z.object({
      message: z.string().min(1).max(8000),
      mode: z.enum(["global", "individual"]).default("global"),
      sourceIds: z.array(z.string()).optional(),
      chatId: z.string().optional(),
      stream: z.boolean().optional().default(true),
    })
  ),
  async (req, res, next) => {
    try {
      await service.streamChat({
        res,
        projectId: param(req, "id"),
        message: req.body.message,
        mode: req.body.mode,
        sourceIds: req.body.sourceIds,
        chatId: req.body.chatId,
        stream: req.body.stream,
      });
    } catch (err) {
      next(err);
    }
  }
);

chatRouter.get("/chats", async (req, res, next) => {
  try {
    const chats = await service.listChats(param(req, "id"));
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

chatByIdRouter.get("/:id/messages", async (req, res, next) => {
  try {
    const messages = await service.getChatMessages(param(req, "id"));
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

messageByIdRouter.post("/:id/diagram", chatRateLimit, async (req, res, next) => {
  try {
    const result = await service.generateDiagramForMessage(param(req, "id"));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

messageByIdRouter.get("/:id/diagram", async (req, res, next) => {
  try {
    const file = await service.getMessageDiagram(param(req, "id"));
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(file.buffer);
  } catch (err) {
    next(err);
  }
});
