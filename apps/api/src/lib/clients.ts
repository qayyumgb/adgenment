import type { Client, Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "./prisma";

/**
 * Agency clients (docs/DASHBOARD_REDESIGN_PLAN.md, B1).
 *
 * Every list and analytics endpoint accepts `?clientId=`. Omitted (or "all")
 * means the whole workspace. Campaigns and metrics belong to a client through
 * their ad account; creatives and audiences carry their own nullable
 * `clientId`, where null means "shared across clients".
 */

/** Initials for the avatar mark: "Lumen Skincare" → "LS". */
export function clientMark(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Make sure the workspace has at least one client, and that ad accounts
 * don't sit unassigned when the answer is obvious:
 *  - no clients yet → create a default client named after the workspace;
 *  - exactly one client → assign any unassigned ad accounts to it.
 * With several clients, new accounts stay unassigned until a person picks.
 * Cheap enough to call on reads (two small queries when nothing changes).
 */
export async function ensureClients(workspaceId: string): Promise<Client[]> {
  let clients = await prisma.client.findMany({
    where: { workspaceId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  if (clients.length === 0) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const firstAccount = await prisma.adAccount.findFirst({
      where: { workspaceId, currency: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { currency: true },
    });
    const name = workspace?.name?.trim() || "My brand";
    const created = await prisma.client.create({
      data: {
        workspaceId,
        name,
        short: clientMark(name),
        isDefault: true,
        currency: firstAccount?.currency ?? null,
      },
    });
    clients = [created];
  }

  if (clients.length === 1) {
    await prisma.adAccount.updateMany({
      where: { workspaceId, clientId: null },
      data: { clientId: clients[0].id },
    });
  }

  return clients;
}

export class ClientScopeError extends Error {
  status = 404;
  constructor() {
    super("Client not found");
  }
}

/**
 * Read `?clientId=` and check it belongs to the workspace. Returns null for
 * "whole workspace". Throws ClientScopeError for an unknown id, so a typo
 * can't silently show all clients' data.
 */
export async function parseClientScope(req: Request, workspaceId: string): Promise<string | null> {
  const raw = req.query.clientId;
  if (typeof raw !== "string" || raw === "" || raw === "all") return null;
  const found = await prisma.client.findFirst({
    where: { id: raw, workspaceId },
    select: { id: true },
  });
  if (!found) throw new ClientScopeError();
  return found.id;
}

/** Campaign filter for a client scope (campaigns inherit via the ad account). */
export function campaignClientWhere(clientId: string | null): Prisma.CampaignWhereInput {
  return clientId ? { adAccount: { clientId } } : {};
}

/** Filter for rows with their own nullable clientId: the client's own + shared. */
export function ownedOrSharedWhere(clientId: string | null): { OR?: { clientId: string | null }[] } {
  return clientId ? { OR: [{ clientId }, { clientId: null }] } : {};
}

/**
 * Validate a `clientId` sent in a request body (creatives, audiences).
 * Returns undefined when absent (leave unchanged), null to clear (shared),
 * or the id. Throws ClientScopeError for an id outside the workspace.
 */
export async function parseBodyClientId(value: unknown, workspaceId: string): Promise<string | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new ClientScopeError();
  const found = await prisma.client.findFirst({ where: { id: value, workspaceId }, select: { id: true } });
  if (!found) throw new ClientScopeError();
  return found.id;
}
