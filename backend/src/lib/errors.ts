export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorEnvelope(err: unknown) {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
    };
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
  };
}
