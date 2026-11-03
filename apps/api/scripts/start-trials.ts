/**
 * Plan C15 rollout: give existing workspaces a fresh 14-day trial before the
 * lock goes live, so nobody is locked out on deploy day.
 *
 *   npx tsx --env-file=.env scripts/start-trials.ts                 # dry run: lists every workspace
 *   npx tsx --env-file=.env scripts/start-trials.ts --apply         # start the trials
 *   npx tsx --env-file=.env scripts/start-trials.ts --apply --email # …and email the owners
 *
 * Per workspace (ids from the dry run):
 *   --comp <id>=AGENCY   set a plan by hand, never billed (your own workspace,
 *                        the Meta App Review account, friendly agencies).
 *                        FOUNDER | TEAM | AGENCY | ENTERPRISE.
 *   --trial <id>         put a comped workspace back on the free plan with a fresh trial.
 *
 * Who gets a trial with --apply: every workspace without a live Stripe
 * subscription and without a hand-set plan. Paid and comped workspaces are
 * listed and left alone. Safe to run more than once (a workspace whose trial
 * ends later than the new one keeps it; emails go once per trial).
 */
import { PrismaClient, type PlanType } from "@prisma/client";
import { PLAN_OF, TIER_OF, trialEnd, type Tier } from "../src/lib/plans";

const prisma = new PrismaClient();
const LIVE = ["active", "trialing", "past_due"];

function args() {
  const a = process.argv.slice(2);
  const many = (flag: string) => a.flatMap((v, i) => (a[i - 1] === flag ? [v] : []));
  return {
    apply: a.includes("--apply"),
    email: a.includes("--email"),
    comp: many("--comp").map((v) => {
      const [id, tier] = v.split("=");
      if (!id || !["FOUNDER", "TEAM", "AGENCY", "ENTERPRISE"].includes(tier)) throw new Error(`--comp ${v}: use <workspaceId>=FOUNDER|TEAM|AGENCY|ENTERPRISE`);
      return { id, plan: (tier === "ENTERPRISE" ? "ENTERPRISE" : PLAN_OF[tier as Exclude<Tier, "ENTERPRISE">]) as PlanType };
    }),
    trial: many("--trial"),
  };
}

async function main() {
  const opt = args();
  const now = new Date();
  const ends = trialEnd(now);
  if (opt.email && !process.env.RESEND_API_KEY) throw new Error("--email needs RESEND_API_KEY.");

  for (const c of opt.comp) {
    const ws = await prisma.workspace.findUnique({ where: { id: c.id } });
    if (!ws) throw new Error(`--comp: no workspace ${c.id}`);
    if (ws.subscriptionStatus && LIVE.includes(ws.subscriptionStatus)) throw new Error(`--comp: ${ws.name} has a live Stripe subscription; change it in Stripe instead.`);
    if (opt.apply) await prisma.workspace.update({ where: { id: c.id }, data: { plan: c.plan, subscriptionStatus: null } });
    console.log(`${opt.apply ? "Comped" : "Would comp"} ${ws.name} (${c.id}) on ${c.plan}`);
  }
  for (const id of opt.trial) {
    const ws = await prisma.workspace.findUnique({ where: { id } });
    if (!ws) throw new Error(`--trial: no workspace ${id}`);
    if (ws.subscriptionStatus && LIVE.includes(ws.subscriptionStatus)) throw new Error(`--trial: ${ws.name} has a live Stripe subscription.`);
    if (opt.apply) await prisma.workspace.update({ where: { id }, data: { plan: "FREE", subscriptionStatus: null } });
    console.log(`${opt.apply ? "Moved" : "Would move"} ${ws.name} (${id}) to the free plan`);
  }

  const all = await prisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, plan: true, subscriptionStatus: true, trialEndsAt: true, owner: { select: { email: true } } },
  });
  const rows: string[][] = [];
  const started: { id: string; ends: Date }[] = [];
  for (const w of all) {
    const comped = Boolean(TIER_OF[w.plan]) && !w.subscriptionStatus;
    const paid = Boolean(w.subscriptionStatus && LIVE.includes(w.subscriptionStatus));
    let what: string;
    if (paid) what = `paid (${w.plan}, ${w.subscriptionStatus})`;
    else if (comped) what = `comped (${w.plan}) — kept`;
    else if (w.trialEndsAt && w.trialEndsAt >= ends) what = `on trial until ${w.trialEndsAt.toISOString().slice(0, 10)} — kept`;
    else {
      what = `${opt.apply ? "trial started" : "will start a trial"} until ${ends.toISOString().slice(0, 10)}${w.trialEndsAt ? ` (was ${w.trialEndsAt.toISOString().slice(0, 10)})` : ""}`;
      started.push({ id: w.id, ends });
    }
    rows.push([w.id, w.name.slice(0, 28), w.owner?.email ?? "—", what]);
  }
  if (opt.apply && started.length) {
    await prisma.workspace.updateMany({ where: { id: { in: started.map((s) => s.id) } }, data: { trialEndsAt: ends } });
  }
  const width = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) console.log(r.map((c, i) => (i < 3 ? c.padEnd(width[i]) : c)).join("  "));
  console.log(`\n${all.length} workspaces · ${started.length} ${opt.apply ? "given" : "to get"} a fresh trial${opt.apply ? "" : " (dry run: add --apply)"}`);

  if (opt.apply && opt.email && started.length) {
    const { announceTrial } = await import("../src/services/billing.service");
    let sent = 0;
    for (const s of started) sent += (await announceTrial(s.id, s.ends)) ?? 0;
    console.log(`Emailed the owners of ${started.length} workspace(s) (${sent} sent).`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
