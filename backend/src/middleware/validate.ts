import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../lib/errors.js";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new AppError("VALIDATION_ERROR", "Invalid request body", 400, result.error.flatten())
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        new AppError("VALIDATION_ERROR", "Invalid query params", 400, result.error.flatten())
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).query = result.data;
    next();
  };
}
