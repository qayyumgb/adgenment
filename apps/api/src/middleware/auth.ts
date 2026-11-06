import type { Request, Response, NextFunction } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { prisma } from "../lib/prisma";
import { trialEnd } from "../lib/plans";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type ClerkUser = Awaited<ReturnType<typeof clerk.users.getUser>>;

/**
 * The Advertix user for a Clerk id: found by id, else (C16b) relinked by
 * verified primary email, else created.
 *
 * Relinking covers a new Clerk instance (switching to production keys gives
 * everyone a new id) and a login deleted and made again: the person keeps
 * their workspaces, roles and plan instead of hitting the unique email.
 * Only a **verified** email relinks, so nobody can claim an account by
 * signing up with someone else's address.
 */
export async function userForClerkId(clerkId: string, getClerkUser: (id: string) => Promise<ClerkUser> = (id) => clerk.users.getUser(id)) {
  const found = await prisma.user.findUnique({ where: { clerkId } });
  if (found) return { user: found, displayName: found.name };

  const clerkUser = await getClerkUser(clerkId);
  const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ?? clerkUser.emailAddresses[0];
  const email = primary?.emailAddress ?? "";
  const fullName = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();
  const displayName = fullName || clerkUser.username || null;

  const existing = email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null;
  if (existing) {
    if (primary?.verification?.status !== "verified") throw new Error(`Email ${email} isn't verified, so it can't be linked to the existing account.`);
    const user = await prisma.user.update({ where: { id: existing.id }, data: { clerkId } });
    console.log(`[auth] relinked user ${existing.id} to a new Clerk id (same verified email)`);
    return { user, displayName: user.name ?? displayName };
  }

  const user = await prisma.user.create({ data: { clerkId, email, name: displayName, plan: "FREE" } });
  return { user, displayName };
}

async function loadUserFromToken(token: string) {
  const payload = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
    // 60-second tolerance for clock skew between Clerk's signing servers
    // and our API host. Without this, a laptop whose clock has drifted
    // even 6-10 seconds rejects every Clerk-issued token as "iat in the
    // future". Real-world clock skew across machines is normal; the
    // security cost of 60s is negligible since tokens already expire on
    // their own short lifetime.
    clockSkewInMs: 60_000,
  });
  const clerkId = payload.sub;
  const { user, displayName } = await userForClerkId(clerkId);

  // Auto-create a default workspace on first authenticated request so every
  // user can use the app without a separate onboarding step. Owner can rename
  // it in Settings → General.
  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  // Someone signing up from an invite joins that workspace instead (B6).
  const invited = existingMembership
    ? null
    : await prisma.invite.findFirst({ where: { email: user.email.toLowerCase(), status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } });
  if (!existingMembership && !invited) {
    const workspaceName = displayName
      ? `${displayName.split(" ")[0]}'s Workspace`
      : "My Workspace";
    const workspace = await prisma.workspace.create({
      data: { name: workspaceName, ownerId: user.id, plan: "FREE", trialEndsAt: trialEnd() },
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
  // Already verified earlier in this request (two routers share a mount path).
  if (req.dbUserId) return next();
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
    // Always log the underlying reason — production deploys still need this
    // to debug Clerk instance / key mismatches. The error type from
    // @clerk/backend already excludes sensitive token contents.
    console.error(
      "[requireAuth] verify failed:",
      err instanceof Error ? err.message : err
    );
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
