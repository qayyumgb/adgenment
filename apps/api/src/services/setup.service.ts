import { prisma } from "../lib/prisma";
import { preferences } from "./notifications.service";

/**
 * Getting started (plan C11): what a workspace should do to get value from
 * Advertix, each step worked out from real data so it ticks itself off. Its
 * own page (/setup), linked from the sidebar (with a ✓ once done) until hidden.
 *
 *  - One client picked: its own steps follow that client (its ad accounts,
 *    monthly budget, report links); "Add your clients" drops out.
 *  - All clients (agencies): those steps count every client ("1 of 2 clients
 *    done · still to do: Lumen") and only tick when all are done; a list
 *    shows each client's own progress.
 *  - One-client workspaces: the workspace's steps.
 * Team, AI check and briefing are workspace-wide everywhere. Everything comes
 * from a handful of grouped queries, so it stays quick with many clients.
 */

export type SetupStepId = "connect" | "clients" | "budget" | "ai" | "team" | "share" | "briefing";
const OPTIONAL: SetupStepId[] = ["clients", "briefing"];
type Fact = "connected" | "budget" | "shared";

const names = (list: string[]) => (list.length <= 3 ? list.join(", ") : `${list.slice(0, 3).join(", ")} and ${list.length - 3} more`);

export async function setupChecklist(workspaceId: string, userId: string, clientId: string | null = null) {
  const [ws, accounts, clients, suggestions, members, invites, shares, schedules, me] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { setupDismissedAt: true, setupSkipped: true, lastInsightGeneratedAt: true } }),
    prisma.adAccount.findMany({ where: { workspaceId, archivedAt: null, isActive: true }, select: { lastSyncedAt: true, clientId: true } }),
    prisma.client.findMany({ where: { workspaceId }, select: { id: true, name: true, monthlyBudget: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.suggestion.count({ where: { workspaceId, ...(clientId ? { clientId } : {}) } }),
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.invite.count({ where: { workspaceId, status: "PENDING" } }),
    prisma.clientShare.findMany({ where: { workspaceId }, select: { clientId: true }, distinct: ["clientId"] }),
    prisma.reportSchedule.findMany({ where: { workspaceId }, select: { clientId: true } }),
    prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true, notifications: true } }),
  ]);
  const client = clientId ? clients.find((c) => c.id === clientId) ?? null : null;
  if (clientId && !client) throw Object.assign(new Error("Client not found."), { status: 404 });

  // What each client has done, in one pass.
  const facts = new Map(clients.map((c) => [c.id, { connected: false, connecting: false, budget: c.monthlyBudget != null && Number(c.monthlyBudget) > 0, shared: false }]));
  for (const a of accounts) {
    const f = a.clientId ? facts.get(a.clientId) : undefined;
    if (!f) continue;
    f.connecting = true;
    if (a.lastSyncedAt) f.connected = true;
  }
  for (const r of [...shares, ...schedules]) {
    const f = facts.get(r.clientId);
    if (f) f.shared = true;
  }
  const multi = !client && clients.length > 1;
  const unassigned = client ? 0 : accounts.filter((a) => !a.clientId).length;
  const anySynced = accounts.some((a) => a.lastSyncedAt);
  /** A client step: for one client, every client (agencies), or the workspace (one client). */
  const clientFact = (fact: Fact) => {
    if (client) return { done: facts.get(client.id)![fact], missing: [] as string[] };
    if (!multi) return { done: fact === "connected" ? anySynced : [...facts.values()].some((f) => f[fact]), missing: [] as string[] };
    const missing = clients.filter((c) => !facts.get(c.id)![fact]).map((c) => c.name);
    return { done: missing.length === 0, missing };
  };
  const progressNote = (missing: string[]) => (multi ? (missing.length ? `${clients.length - missing.length} of ${clients.length} clients done · still to do: ${names(missing)}.` : `All ${clients.length} clients done.`) : "");

  const briefingOn = me ? preferences(me.role, me.notifications).find((p) => p.id === "MORNING_BRIEFING")?.email === true : false;
  const aiDone = suggestions > 0 || Boolean(ws.lastInsightGeneratedAt); // a check that found nothing still counts
  const teamDone = members > 1 || invites > 0;
  const skipped = new Set(ws.setupSkipped);
  const connect = clientFact("connected");
  const budget = clientFact("budget");
  const share = clientFact("shared");
  const connecting = client ? facts.get(client.id)!.connecting && !connect.done : accounts.length > 0 && !anySynced;

  const all: { id: SetupStepId; title: string; body: string; done: boolean; href: string; cta: string }[] = [
    {
      id: "connect",
      title: client ? `Connect an ad account for ${client.name}` : multi ? "Connect an ad account for each client" : "Connect an ad account",
      body: connecting
        ? "Connected. The first sync is running; spend and results appear in a few minutes."
        : multi
          ? `${progressNote(connect.missing)} Connect new accounts, or assign existing ones to a client in Connections.`
          : client
            ? `Connect ${client.name}'s ad account, or assign an existing one to ${client.name} in Connections.`
            : "Meta, Google Ads, TikTok or LinkedIn. Advertix syncs spend and results every hour.",
      done: connect.done,
      href: "/connections",
      cta: accounts.length ? "Open Connections" : "Connect",
    },
    {
      id: "clients",
      title: "Add your clients",
      body: unassigned ? `${unassigned} ad account${unassigned === 1 ? " isn't" : "s aren't"} assigned to a client yet.` : "For agencies: one client per brand, so every page, report and rule can work per client.",
      done: clients.length > 1 && unassigned === 0,
      href: unassigned ? "/connections?filter=unassigned" : "/settings?tab=clients",
      cta: unassigned ? "Assign accounts" : "Add clients",
    },
    {
      id: "budget",
      title: client ? `Set a monthly budget for ${client.name}` : multi ? "Set each client's monthly budget" : "Set a monthly budget",
      body: `${multi ? `${progressNote(budget.missing)} ` : ""}Pacing tells you when spend will run over or under, and the monthly-cap safety rule can step in.`,
      done: budget.done,
      href: "/budgets",
      cta: "Set a budget",
    },
    {
      id: "ai",
      title: "Run your first AI check",
      body: "Advertix reads your campaigns and suggests budget moves and fixes, each with the numbers behind it.",
      done: aiDone,
      href: "/dashboard#suggestions",
      cta: "Check now",
    },
    {
      id: "team",
      title: "Invite your team",
      body: "Media buyers, analysts or client viewers. Roles decide what each person can change and which clients they see.",
      done: teamDone,
      href: "/settings?tab=team",
      cta: "Invite",
    },
    {
      id: "share",
      title: client ? `Share a report with ${client.name}` : multi ? "Share a report with each client" : "Share a report with a client",
      body: `${multi ? `${progressNote(share.missing)} ` : ""}A read-only link with no login, or a weekly email with a PDF.`,
      done: share.done,
      href: "/analytics",
      cta: "Open Analytics",
    },
    {
      id: "briefing",
      title: "Get the morning briefing",
      body: "One email at 08:00 with the top decisions, what changed overnight and yesterday's spend.",
      done: briefingOn,
      href: "/settings?tab=notifications",
      cta: "Turn it on",
    },
  ];
  const steps = all
    // Picking a client: "Add your clients" is a workspace step.
    .filter((s) => !(client && s.id === "clients"))
    .map((s) => ({ ...s, optional: OPTIONAL.includes(s.id), skipped: !s.done && skipped.has(s.id) }));
  const complete = steps.filter((s) => s.done || s.skipped).length;

  // All clients (agencies): each client's own progress, as if picked (6 steps).
  const shared = Number(aiDone) + Number(teamDone) + Number(briefingOn || skipped.has("briefing"));
  const perClient = multi
    ? clients.map((c) => {
        const f = facts.get(c.id)!;
        return { id: c.id, name: c.name, complete: Number(f.connected) + Number(f.budget) + Number(f.shared) + shared, total: 6 };
      })
    : [];

  return {
    client: client ? { id: client.id, name: client.name } : null,
    steps,
    complete,
    total: steps.length,
    clients: perClient,
    dismissed: Boolean(ws.setupDismissedAt),
    /** Keep the sidebar link (with a ✓ once done) until it is hidden from the page. */
    show: !ws.setupDismissedAt,
    done: complete === steps.length,
  };
}

/** Skip (or un-skip) an optional step. */
export async function skipSetupStep(workspaceId: string, step: unknown, skip: boolean) {
  if (!OPTIONAL.includes(step as SetupStepId)) throw Object.assign(new Error("Only optional steps can be skipped."), { status: 400 });
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { setupSkipped: true } });
  const next = new Set(ws.setupSkipped);
  if (skip) next.add(step as string);
  else next.delete(step as string);
  await prisma.workspace.update({ where: { id: workspaceId }, data: { setupSkipped: [...next] } });
}

export async function dismissSetup(workspaceId: string, dismissed: boolean) {
  await prisma.workspace.update({ where: { id: workspaceId }, data: { setupDismissedAt: dismissed ? new Date() : null } });
}
