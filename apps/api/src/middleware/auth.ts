import type { Request, Response, NextFunction } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { prisma } from "../lib/prisma";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function loadUserFromToken(token: string) {
  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  const clerkId = payload.sub;

  let user = await prisma.user.findUnique({ where: { clerkId } });
  let displayName: string | null = user?.name ?? null;

  if (!user) {
    const clerkUser = await clerk.users.getUser(clerkId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const fullName =
      `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();
    displayName = fullName || clerkUser.username || null;
    user = await prisma.user.create({
      data: {
        clerkId,
        email,
        name: displayName,
        plan: "FREE",
      },
    });
  }

  // Auto-create a default workspace on first authenticated request so every
  // user can use the app without a separate onboarding step. Owner can rename
  // it in Settings → General.
  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!existingMembership) {
    const workspaceName = displayName
      ? `${displayName.split(" ")[0]}'s Workspace`
      : "My Workspace";
    const workspace = await prisma.workspace.create({
      data: { name: workspaceName, ownerId: user.id, plan: "FREE" },
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
    });
  }

  return { clerkId, user };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization header" });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ error: "Missing authorization header" });
    }

    const { clerkId, user } = await loadUserFromToken(token);

    req.userId = clerkId;
    req.clerkId = clerkId;
    req.user = user;
    req.dbUserId = user.id;

    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[requireAuth] verify failed:", err);
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      req.user = null;
      return next();
    }
    const { clerkId, user } = await loadUserFromToken(token);
    req.userId = clerkId;
    req.clerkId = clerkId;
    req.user = user;
    req.dbUserId = user.id;
    next();
  } catch {
    req.user = null;
    next();
  }
}
