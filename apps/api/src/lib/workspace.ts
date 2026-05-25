import type { Workspace } from "@prisma/client";
import { prisma } from "./prisma";

export async function getUserWorkspace(
  userId: string
): Promise<Workspace | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { createdAt: "asc" } },
  });
  return membership?.workspace ?? null;
}

export async function requireWorkspace(userId: string): Promise<Workspace> {
  const workspace = await getUserWorkspace(userId);
  if (!workspace) throw new Error("NO_WORKSPACE");
  return workspace;
}

export async function getUserRoleInWorkspace(
  userId: string,
  workspaceId: string
): Promise<"OWNER" | "ADMIN" | "EDITOR" | "VIEWER" | null> {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  return m?.role ?? null;
}
