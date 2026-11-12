import { prisma } from "../lib/prisma";
import { assertClientAccess, type Access } from "../lib/access";
import { aiService } from "./ai.service";

/**
 * C19c: write the text boxes of an ad design with AI, from one of the
 * client's campaigns or a short brief. The editor sends each text box (id,
 * role, current text, length limit); the answer is applied as one undo step.
 * Customer quotes and names are never rewritten, and every text is held to
 * its limit here too, whatever the model returns.
 */

export const ROLES = ["headline", "subheading", "body", "eyebrow", "button", "price", "quote", "attribution", "text"] as const;
type Role = (typeof ROLES)[number];
export type CopyField = { id: string; role: Role; current: string; maxChars: number };

export const copyError = (status: number, message: string) => Object.assign(new Error(message), { status });

export function validFields(raw: unknown): CopyField[] {
  if (!Array.isArray(raw) || raw.length === 0) throw copyError(400, "There's no text on the design to write.");
  if (raw.length > 20) throw copyError(400, "That's more text boxes than one ad should have (20 at most).");
  return raw.map((f) => {
    const x = (f ?? {}) as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id.slice(0, 60) : "";
    const role = (ROLES as readonly string[]).includes(String(x.role)) ? (x.role as Role) : "text";
    const current = typeof x.current === "string" ? x.current.slice(0, 600) : "";
    const maxChars = Math.min(300, Math.max(4, Math.round(Number(x.maxChars) || 60)));
    if (!id) throw copyError(400, "Each text box needs an id.");
    return { id, role, current, maxChars };
  });
}

const money = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** What the ad is about: the campaign (name, objective, audience, its current ads' copy) or the brief, plus the client. */
export async function copyContext(access: Access, body: Record<string, unknown>) {
  const lines: string[] = [];
  const designId = typeof body.designId === "string" ? body.designId : null;
  const design = designId ? await prisma.design.findFirst({ where: { id: designId, workspaceId: access.workspaceId }, select: { clientId: true } }) : null;
  if (designId && !design) throw copyError(404, "Design not found");
  if (design) assertClientAccess(access, design.clientId, { allowShared: true });
  const client = design?.clientId ? await prisma.client.findFirst({ where: { id: design.clientId }, select: { name: true, vertical: true } }) : null;
  if (client) lines.push(`Brand: ${client.name}${client.vertical ? ` (${client.vertical})` : ""}`);

  const campaignId = typeof body.campaignId === "string" && body.campaignId ? body.campaignId : null;
  const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 1500) : "";
  if (campaignId) {
    const c = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: access.workspaceId },
      select: { name: true, objective: true, budget: true, budgetType: true, targeting: true, adAccount: { select: { clientId: true, currency: true } }, ads: { select: { headline: true, body: true, callToAction: true, linkUrl: true, description: true }, take: 3, orderBy: { createdAt: "desc" } } },
    });
    if (!c) throw copyError(404, "Campaign not found");
    assertClientAccess(access, c.adAccount.clientId);
    lines.push(`Campaign: ${c.name}`, `Objective: ${c.objective}`);
    const t = (c.targeting ?? {}) as Record<string, unknown>;
    const geo = (t.geo_locations as { countries?: string[] } | undefined)?.countries;
    const interests = Array.isArray(t.interests) ? (t.interests as { name?: string }[]).map((i) => i.name).filter(Boolean) : [];
    const audience = [t.age_min && t.age_max ? `ages ${t.age_min}-${t.age_max}` : "", geo?.length ? geo.join(", ") : "", interests.length ? `interests: ${interests.slice(0, 6).join(", ")}` : ""].filter(Boolean).join("; ");
    if (audience) lines.push(`Audience: ${audience}`);
    for (const a of c.ads) {
      const parts = [a.headline && `headline "${a.headline}"`, a.body && `text "${a.body}"`, a.description && `description "${a.description}"`, a.callToAction && `button ${a.callToAction}`, a.linkUrl && `link ${a.linkUrl}`].filter(Boolean);
      if (parts.length) lines.push(`Current ad: ${parts.join(", ")}`);
    }
    if (!c.ads.length) lines.push(`Budget: ${money(c.budget)} ${c.adAccount.currency ?? ""} ${c.budgetType.toLowerCase()}`);
  }
  if (brief) lines.push(`Brief: ${brief}`);
  if (!campaignId && brief.length < 10) throw copyError(400, "Pick a campaign or describe the ad in a sentence or two.");
  return lines.join("\n");
}

/** Ask the model, then hold every answer to the rules (unknown ids dropped, quotes kept, limits enforced). */
export async function writeCopy(context: string, fields: CopyField[]) {
  const { json, tokensUsed } = await aiService.writeDesignCopy(context, fields);
  let parsed: { fields?: { id?: unknown; text?: unknown }[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("AI_PARSE_ERROR");
  }
  const byId = new Map((parsed.fields ?? []).map((f) => [String(f.id), typeof f.text === "string" ? f.text.trim() : ""]));
  const out = fields.map((f) => {
    let text = f.role === "quote" || f.role === "attribution" ? f.current : byId.get(f.id) || f.current;
    if (text.length > f.maxChars) text = `${text.slice(0, f.maxChars).replace(/\s+\S*$/, "")}`.trim() || text.slice(0, f.maxChars);
    return { id: f.id, text };
  });
  return { fields: out, tokensUsed };
}
