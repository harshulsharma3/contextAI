import { Router } from "express";
import { z } from "zod";
import { param } from "../../lib/params.js";
import { validateBody } from "../../middleware/validate.js";
import * as service from "./service.js";

export const projectsRouter = Router();

projectsRouter.post(
  "/",
  validateBody(z.object({ name: z.string().min(1).max(200) })),
  async (req, res, next) => {
    try {
      const project = await service.createProject(req.body.name);
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.get("/", async (_req, res, next) => {
  try {
    const projects = await service.listProjects();
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const detail = await service.getProjectDetail(param(req, "id"));
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch(
  "/:id",
  validateBody(z.object({ name: z.string().min(1).max(200) })),
  async (req, res, next) => {
    try {
      const project = await service.updateProject(param(req, "id"), req.body.name);
      res.json(project);
    } catch (err) {
      next(err);
    }
  }
);

projectsRouter.delete("/:id", async (req, res, next) => {
  try {
    await service.deleteProject(param(req, "id"));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
