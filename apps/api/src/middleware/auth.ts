import { Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";

export const clerkAuth = clerkMiddleware();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  clerkAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    (req as Request & { auth: typeof auth }).auth = auth;
    next();
  });
}
