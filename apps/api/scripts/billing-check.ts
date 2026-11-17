/**
 * Billing check (read-only): for every workspace with a Stripe customer,
 * what our database says next to what Stripe says, plus where Stripe sends
 * webhooks. Changes nothing.
 *
 *   npx tsx scripts/billing-check.ts
 */
import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "../src/lib/prisma";
import { entitlement } from "../src/lib/plans";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY isn't set");
  console.log(`Stripe key: ${key.startsWith("sk_test") ? "TEST mode" : key.startsWith("sk_live") ? "LIVE mode" : "unknown kind"} | webhook secret ${process.env.STRIPE_WEBHOOK_SECRET ? "set" : "MISSING"}`);
  const s = new Stripe(key);

  const hooks = await s.webhookEndpoints.list({ limit: 20 });
  console.log(`\nWebhook endpoints registered in Stripe: ${hooks.data.length}`);
  for (const h of hooks.data) console.log(`  ${h.status}  ${h.url}  events: ${h.enabled_events.join(", ").slice(0, 160)}`);

  const rows = await prisma.workspace.findMany({ where: { stripeCustomerId: { not: null } }, orderBy: { createdAt: "desc" }, take: 20 });
  console.log(`\nWorkspaces with a Stripe customer: ${rows.length}`);
  for (const w of rows) {
    const ent = entitlement(w);
    console.log(`\n- ${w.name} (${w.id})`);
    console.log(`  ours:   plan=${w.plan} status=${w.subscriptionStatus ?? "none"} sub=${w.stripeSubscriptionId ? "yes" : "none"} trialEndsAt=${w.trialEndsAt?.toISOString().slice(0, 10) ?? "none"} → ${ent.state}${ent.locked ? " (LOCKED)" : ""}`);
    const subs = await s.subscriptions.list({ customer: w.stripeCustomerId!, status: "all", limit: 20 });
    if (!subs.data.length) console.log("  stripe: no subscriptions");
    for (const sub of subs.data) {
      const item = sub.items.data[0];
      console.log(`  stripe: ${sub.status.padEnd(10)} ${item?.price.lookup_key ?? item?.price.id} created ${new Date(sub.created * 1000).toISOString().slice(0, 16)} cancelAtPeriodEnd=${sub.cancel_at_period_end}`);
    }
    const live = subs.data.filter((x) => ["active", "trialing", "past_due"].includes(x.status));
    if (live.length && ent.state !== "ACTIVE" && ent.state !== "PAST_DUE") console.log("  >>> MISMATCH: Stripe has a running subscription, our database doesn't know.");
    if (live.length > 1) console.log(`  >>> ${live.length} running subscriptions for one workspace (charged more than once).`);
  }
}
main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
