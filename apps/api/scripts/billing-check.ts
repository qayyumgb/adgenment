/**
 * Billing check (read-only): for every workspace with a Stripe customer,
 * what our database says, what Stripe says (subscription, a waiting plan
 * change, invoices) and what the billing page is told, plus where Stripe
 * sends webhooks. Changes nothing in Stripe; reading the page's status
 * refreshes our copy from Stripe, as opening the billing page does.
 *
 *   npx tsx scripts/billing-check.ts
 */
import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "../src/lib/prisma";
import { entitlement } from "../src/lib/plans";
import { billingStatus } from "../src/services/billing.service";

const day = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : "-");

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
    console.log(`  ours:    plan=${w.plan} ${w.planInterval ?? ""} status=${w.subscriptionStatus ?? "none"} periodEnd=${w.currentPeriodEnd?.toISOString().slice(0, 10) ?? "-"} cancelling=${w.cancelAtPeriodEnd} pending=${w.pendingPlan ? `${w.pendingPlan} ${w.pendingInterval}` : "none"} → ${ent.state}${ent.locked ? " (LOCKED)" : ""}`);
    const subs = await s.subscriptions.list({ customer: w.stripeCustomerId!, status: "all", limit: 20 });
    if (!subs.data.length) console.log("  stripe:  no subscriptions");
    for (const sub of subs.data) {
      const item = sub.items.data[0];
      const end = (item as unknown as { current_period_end?: number }).current_period_end;
      console.log(`  stripe:  ${sub.status.padEnd(9)} ${item?.price.lookup_key ?? item?.price.id} periodEnd=${day(end)} cancel_at=${day(sub.cancel_at)} cancel_at_period_end=${sub.cancel_at_period_end} schedule=${sub.schedule ? "yes" : "no"}`);
      if (sub.schedule) {
        const sc = await s.subscriptionSchedules.retrieve(typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id);
        for (const p of sc.phases) {
          const pr = await s.prices.retrieve(typeof p.items[0].price === "string" ? p.items[0].price : p.items[0].price.id);
          console.log(`           schedule: ${pr.lookup_key}  ${day(p.start_date)} → ${day(p.end_date)}`);
        }
      }
    }
    const inv = await s.invoices.list({ customer: w.stripeCustomerId!, limit: 12 });
    console.log("  invoices (newest first):");
    for (const i of inv.data) console.log(`           ${new Date(i.created * 1000).toISOString().slice(0, 16)}  ${(i.status ?? "").padEnd(5)} total $${(i.total / 100).toFixed(2)} paid $${(i.amount_paid / 100).toFixed(2)}  ${i.billing_reason}  | ${i.lines.data.map((l) => `${(l.amount / 100).toFixed(2)} ${(l.description ?? "").slice(0, 46)}`).join(" ; ")}`);
    const st = await billingStatus(w.id, { fresh: true });
    console.log(`  page:    ${st.state} ${st.tier ?? "no plan"} ${st.interval ?? ""} | ${st.cancelAtPeriodEnd ? "ends" : "renews"} ${st.renewsAt ? new Date(st.renewsAt).toISOString().slice(0, 10) : "-"} | pending ${st.pending ? `${st.pending.tier} ${st.pending.interval} on ${st.pending.at ? new Date(st.pending.at).toISOString().slice(0, 10) : "-"}` : "none"}`);
    const live = subs.data.filter((x) => ["active", "trialing", "past_due"].includes(x.status));
    if (live.length && st.state !== "ACTIVE" && st.state !== "PAST_DUE") console.log("  >>> MISMATCH: Stripe has a running subscription, the page doesn't show it.");
    if (live.length > 1) console.log(`  >>> ${live.length} running subscriptions for one workspace (charged more than once).`);
  }
}
main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
