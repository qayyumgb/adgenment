import type { Request, Response, NextFunction } from "express";

type ExtendedError = Error & {
  status?: number;
  statusCode?: number;
  code?: string;
};

export function errorHandler(
  err: ExtendedError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error:`, err.message);
  if (process.env.NODE_ENV !== "production" && err.stack) {
    console.error(err.stack);
  }

  // Prisma errors
  if (err.code === "P2002") {
    return res.status(409).json({ error: "Resource already exists" });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Resource not found" });
  }

  // Custom domain errors
  if (err.message === "NO_WORKSPACE") {
    return res.status(404).json({
      error: "No workspace found. Complete onboarding first.",
    });
  }
  if (err.message === "AI_PARSE_ERROR") {
    return res.status(500).json({
      error: "AI response could not be parsed. Please try again.",
    });
  }
  if (err.message === "AI_API_ERROR") {
    return res.status(503).json({
      error: "AI service temporarily unavailable.",
    });
  }

  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({
    error: err.message ?? "Internal server error",
    ...(process.env.NODE_ENV === "development" && err.stack
      ? { stack: err.stack }
      : {}),
  });
}
