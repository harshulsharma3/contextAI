import type { NextFunction, Request, Response } from "express";

/** Seam for future auth — currently single-tenant. */
export interface AuthContext {
  userId: string | null;
  isAuthenticated: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
      requestId: string;
    }
  }
}

export function authContext(req: Request, _res: Response, next: NextFunction) {
  req.auth = {
    userId: null,
    isAuthenticated: false,
  };
  next();
}
