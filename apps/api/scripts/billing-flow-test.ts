/**
 * Billing flows, end to end, against Stripe TEST mode (refuses a live key).
 * Uses temporary workspaces in the local database and Stripe test clocks to
 * move time to the renewal; removes everything it made.
 *
 *   npx tsx scripts/billing-flow-test.ts
 *
 * Checks: an upgrade is immediate and charges only the difference; a downgrade
 * waits for the renewal and is then charged at the new price; "keep my plan"
 * undoes a waiting downgrade; cancelling works again after the downgrade has
 * happened; a plan chosen late in the trial has nothing due today; deleting
 * cancels the subscription.
 */
import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "../src/lib/prisma";
import { billingStatus, cancelSubscriptions, changePlan, createCheckout, reconcileWorkspace } from "../src/services/billing.service";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
};

async function main() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test")) throw new Error("This test only runs with a Stripe TEST key.");
  const s = new Stripe(key);
  const owner = await prisma.user.findFirst({ select: { id: true } });
  if (!owner) throw new Error("The local database has no user to own the test workspaces.");
  const made: string[] = [];
  const clocks: string[] = [];
  const customers: string[] = [];
  const stamp = Date.now().toString(36);
  const workspace = async (data: Record<string, unknown>) => {
    const w = await prisma.workspace.create({ data: { name: `billing-test-${stamp}-${made.length}`, slug: `billing-test-${stamp}-${made.length}`, ownerId: owner.id, ...data } as never });
    made.push(w.id);
    return w;
  };

  try {
    const priceList = await s.prices.list({ lookup_keys: ["advertix_founder_month", "advertix_team_month"], active: true });
    const founder = priceList.data.find((p) => p.lookup_key === "advertix_founder_month")!;

    /* ── 1. Upgrade, downgrade, keep, renewal ── */
    console.log("\nPlan changes");
    const now = Math.floor(Date.now() / 1000);
    const clock = await s.testHelpers.testClocks.create({ frozen_time: now, name: `advertix-flow-${stamp}` });
    clocks.push(clock.id);
    const cust = await s.customers.create({ name: `billing-test-${stamp}`, test_clock: clock.id, payment_method: "pm_card_visa", invoice_settings: { default_payment_method: "pm_card_visa" } });
    const w = await workspace({ stripeCustomerId: cust.id, trialEndsAt: new Date(Date.now() - 86_400_000) });
    await s.subscriptions.create({ customer: cust.id, items: [{ price: founder.id }], metadata: { workspaceId: w.id } });
    await reconcileWorkspace(w.id);
    let st = await billingStatus(w.id);
    check("a paid subscription shows as the plan", st.state === "ACTIVE" && st.tier === "FOUNDER", `${st.state} ${st.tier}`);

    st = await changePlan(w.id, { tier: "TEAM", interval: "month" });
    let invoices = await s.invoices.list({ customer: cust.id, limit: 10 });
    const upgradeCharge = invoices.data.reduce((sum, i) => sum + i.amount_paid, 0) / 100;
    check("upgrade is immediate", st.tier === "TEAM" && !st.pending, `${st.tier}`);
    const preview = await s.invoices.createPreview({ customer: cust.id, subscription: (await prisma.workspace.findUniqueOrThrow({ where: { id: w.id } })).stripeSubscriptionId! });
    check("upgrade charges only the difference, today (Founder $22 + difference ≤ $57; next invoice is plain Team $79)", upgradeCharge > 22 && upgradeCharge <= 79.05 && preview.amount_due === 7900, `paid so far $${upgradeCharge.toFixed(2)}, next invoice $${(preview.amount_due / 100).toFixed(2)}`);

    st = await changePlan(w.id, { tier: "FOUNDER", interval: "month" });
    check("downgrade waits for the renewal", st.tier === "TEAM" && st.pending?.tier === "FOUNDER", `now ${st.tier}, pending ${st.pending?.tier ?? "none"} on ${String(st.pending?.at).slice(0, 10)}`);

    st = await changePlan(w.id, { tier: "TEAM", interval: "month" });
    const subId = (await prisma.workspace.findUniqueOrThrow({ where: { id: w.id } })).stripeSubscriptionId!;
    check("keeping the current plan undoes the downgrade", st.tier === "TEAM" && !st.pending && !(await s.subscriptions.retrieve(subId)).schedule);

    try {
      await changePlan(w.id, { tier: "TEAM", interval: "month" });
      check("choosing the plan you already have is refused", false);
    } catch (e) {
      check("choosing the plan you already have is refused", (e as { status?: number }).status === 409);
    }

    st = await changePlan(w.id, { tier: "FOUNDER", interval: "month" });
    const renewal = Math.floor(new Date(st.pending!.at as unknown as string).getTime() / 1000);
    await s.testHelpers.testClocks.advance(clock.id, { frozen_time: renewal + 3600 });
    for (let i = 0; i < 60; i++) {
      if ((await s.testHelpers.testClocks.retrieve(clock.id)).status === "ready") break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    await reconcileWorkspace(w.id);
    st = await billingStatus(w.id);
    invoices = await s.invoices.list({ customer: cust.id, limit: 10 });
    const last = invoices.data[0];
    const sub = await s.subscriptions.retrieve(subId);
    check("after the renewal the plan is the smaller one", st.tier === "FOUNDER" && !st.pending, `${st.tier}`);
    check("the renewal charged the smaller plan's price, nothing else", last.amount_paid === 2200 && last.status === "paid", `$${(last.amount_paid / 100).toFixed(2)} ${last.status}`);
    check("the schedule let go, so cancelling works the normal way", !sub.schedule);
    await s.subscriptions.update(subId, { cancel_at_period_end: true });
    await reconcileWorkspace(w.id);
    st = await billingStatus(w.id);
    check("cancel at period end shows as cancelling, plan kept until then", st.cancelAtPeriodEnd && st.state === "ACTIVE");
    st = await changePlan(w.id, { tier: "FOUNDER", interval: "month" });
    check("choosing the plan again undoes the cancellation", !st.cancelAtPeriodEnd);

    // Stripe's portal cancels with a date, not the flag.
    await s.subscriptions.update(subId, { cancel_at: Math.floor(new Date((await billingStatus(w.id)).renewsAt as unknown as string).getTime() / 1000) });
    await reconcileWorkspace(w.id);
    st = await billingStatus(w.id);
    check("a cancellation made in Stripe's portal (a cancel date) shows as cancelling", st.cancelAtPeriodEnd && st.state === "ACTIVE");
    st = await changePlan(w.id, { tier: "FOUNDER", interval: "month" });
    check("and choosing the plan again undoes that too", !st.cancelAtPeriodEnd && !(await s.subscriptions.retrieve(subId)).cancel_at);

    const cancelled = await cancelSubscriptions(w.id);
    await reconcileWorkspace(w.id);
    st = await billingStatus(w.id);
    check("deleting a workspace cancels what it pays for", cancelled === 1 && st.state === "EXPIRED", `${cancelled} cancelled, now ${st.state}`);

    /* ── 2. Choosing a plan during the trial ── */
    console.log("\nFirst charge date");
    for (const [label, hours, kind] of [["20 hours of trial left", 20, "billing date"], ["5 days of trial left", 120, "Stripe trial"], ["trial over", -24, "charged now"]] as const) {
      const t = await workspace({ trialEndsAt: new Date(Date.now() + hours * 3_600_000) });
      await createCheckout(t.id, owner.id, { tier: "FOUNDER", interval: "month" });
      const cid = (await prisma.workspace.findUniqueOrThrow({ where: { id: t.id } })).stripeCustomerId!;
      customers.push(cid);
      const session = (await s.checkout.sessions.list({ customer: cid, limit: 1 })).data[0];
      const due = session.amount_total ?? -1;
      check(`${label}: ${hours > 0 ? "nothing due today" : "the first month is due today"} (${kind})`, hours > 0 ? due === 0 : due === 2200, `due today $${(due / 100).toFixed(2)}`);
      await s.checkout.sessions.expire(session.id).catch(() => undefined);
    }
  } finally {
    for (const id of clocks) await s.testHelpers.testClocks.del(id).catch(() => undefined);
    for (const id of customers) await s.customers.del(id).catch(() => undefined);
    await prisma.workspace.deleteMany({ where: { id: { in: made } } });
  }
  console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
  if (failed) process.exitCode = 1;
}
main()
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
