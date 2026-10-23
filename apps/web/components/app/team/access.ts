"use client";

import { useApi } from "@/hooks/useApi";
import type { Capability, WorkspaceRole } from "@/lib/api";

/**
 * The signed-in member's role and client access (B6), from `/auth/me`. The
 * API enforces the same rules (lib/access.ts); the UI uses this to disable
 * what a role can't do and say why, instead of failing on click.
 */

export const ROLE_LABEL: Record<WorkspaceRole, string> = { OWNER: "Owner", MEDIA_BUYER: "Media buyer", ANALYST: "Analyst", CLIENT_VIEWER: "Client viewer" };
export const ROLE_SUB: Record<WorkspaceRole, string> = {
  OWNER: "Everything, including team and billing",
  MEDIA_BUYER: "Runs campaigns, creatives, audiences and connections",
  ANALYST: "Sees and exports everything, changes nothing",
  CLIENT_VIEWER: "Read-only, only the clients you pick",
};

const CAPS: Record<WorkspaceRole, Capability[]> = {
  OWNER: ["view", "export", "edit", "connect", "clients", "team", "workspace"],
  MEDIA_BUYER: ["view", "export", "edit", "connect"],
  ANALYST: ["view", "export"],
  CLIENT_VIEWER: ["view", "export"],
};

/** Why a role can't do something, for disabled buttons' tooltips. */
export const cannotReason = (role: WorkspaceRole | null, cap: Capability) =>
  !role
    ? "Loading your access…"
    : cap === "edit"
      ? `${ROLE_LABEL[role]}s can view and export, but not make changes. Ask an owner for Media buyer access.`
      : cap === "connect"
        ? `${ROLE_LABEL[role]}s can't connect ad accounts.`
        : cap === "team"
          ? "Only owners can invite people and change roles."
          : cap === "clients"
            ? "Only owners can set up clients."
            : "Only owners can change this.";

export function useAccess() {
  const me = useApi((c) => c.getMe(), [], { key: "me" });
  const access = me.data?.access ?? null;
  const role = access?.role ?? null;
  return {
    role,
    /** null = all clients. */
    clientIds: access?.clientIds ?? null,
    limited: Boolean(access?.clientIds),
    loading: me.loading,
    can: (cap: Capability) => (role ? CAPS[role].includes(cap) : false),
    why: (cap: Capability) => cannotReason(role, cap),
  };
}
