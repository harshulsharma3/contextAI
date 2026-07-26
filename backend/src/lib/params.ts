import type { Request } from "express";

/** Express 5 can type params as string | string[] */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
