import type { NextFunction, Request, Response } from "express";
import { errorEnvelope } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const { status, body } = errorEnvelope(err);
  logger.error(
    { err, requestId: req.requestId, status },
    body.error.message
  );
  res.status(status).json(body);
}
