import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { PLAN_OF, PRICE, TIER_OF, workspaceEntitlement, type Tier } from "../lib/plans";
import { notifyMembers } from "./notifications.service";

/**
 * Stripe billing (plan C11). Plans: Founder $22, Team $79, Agency $199 a
 * month, yearly = 10 months. New workspaces get a 14-day trial without a
 * card (lib/plans); choosing a plan during the trial starts a Stripe trial
 * that ends on the same day, so nothing is charged before it.
 *
 *  - Products and prices are created on first use (lookup keys
 *    `advertix_<tier>_<interval>`), so a new Stripe account needs no setup.
 *  - Checkout for a first subscription; an in-app switch (prorated) after.
 *  - The billing portal for invoices, the card and cancelling.
 *  - **Stripe is the source of truth.** A workspace's plan is always copied
 *    from what Stripe says the customer has now (`reconcileWorkspace`), never
 *    from an event's own contents (events can arrive late, twice or out of
 *    order). It is copied: when a webhook arrives; when someone looks at
 *    billing and the workspace has a Stripe customer but no running plan (so
 *    a payment shows at once even if the webhook is late, lost or not set
 *    up); before a checkout starts (never a second subscription); and once a
 *    day for every subscribed workspace (a missed cancellation).
 *  - Deleting a workspace cancels its subscription first.
 *  - **Never charged before the free trial ends.** A plan chosen during the
 *    trial starts being paid for on the trial's last day: a Stripe trial when
 *    that is more than 48 hours away (Stripe's minimum), otherwise the first
 *    billing date is set to it with nothing due today.
 *  - **Upgrades now, downgrades at renewal.** A bigger plan starts at once and
 *    only the difference for the rest of the period is charged. A smaller plan
 *    (or yearly → monthly) starts at the next renewal, through a Stripe
 *    subscription schedule: what was paid for is kept until then, with no
 *    credits or refunds to work out. `pendingPlan` shows it; choosing the
 *    current plan again undoes it.
 *  - **Tax:** checkout collects the billing address and a business tax ID.
 *    Tax itself is only calculated and added with STRIPE_TAX_ENABLED=true
 *    (needs Stripe Tax set up and a registration); prices exclude tax.
 */

export type PaidTier = Exclude<Tier, "ENTERPRISE">;
export type Interval = "month" | "year";
const TIERS: PaidTier[] = ["FOUNDER", "TEAM", "AGENCY"];
const NAME: Record<PaidTier, string> = { FOUNDER: "Founder", TEAM: "Team", AGENCY: "Agency" };
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";
const MIN_TRIAL_MS = 2 * 86_400_000 + 600_000; // Stripe needs a trial end at least 48 h away (plus the time checkout takes)
const MIN_ANCHOR_MS = 15 * 60_000; // closer to the trial's end than this: the plan simply starts now
const RANK: Record<PaidTier, number> = { FOUNDER: 0, TEAM: 1, AGENCY: 2 };
const taxOn = () => (process.env.STRIPE_TAX_ENABLED ?? "").toLowerCase() === "true";
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);
/** Set to end: Stripe marks it with the old flag or, from its portal, with only a cancel date. */
const cancelling = (sub: Stripe.Subscription) => Boolean(sub.cancel_at_period_end || sub.cancel_at);

const bad = (status: number, message: string) => Object.assign(new Error(message), { status });

let client: Stripe | null = null;
export const billingConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw bad(503, "Billing isn't set up on this server yet (STRIPE_SECRET_KEY).");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { appInfo: { name: "Advertix" } });
  return client;
}

const lookupKey = (tier: PaidTier, interval: Interval) => `advertix_${tier.toLowerCase()}_${interval}`;
const amountCents = (tier: PaidTier, interval: Interval) => PRICE[tier] * (interval === "year" ? 10 : 1) * 100;

/** Price ids by lookup key; creates the products and prices that don't exist yet. */
let priceCache: Map<string, string> | null = null;
async function prices() {
  if (priceCache) return priceCache;
  const s = stripe();
  const keys = TIERS.flatMap((t) => (["month", "year"] as Interval[]).map((i) => lookupKey(t, i)));
  const found = await s.prices.list({ lookup_keys: keys, active: true, limit: 20 });
  const map = new Map(found.data.map((p) => [p.lookup_key!, p.id]));
  for (const tier of TIERS) {
    for (const interval of ["month", "year"] as Interval[]) {
      const key = lookupKey(tier, interval);
      const existing = found.data.find((p) => p.lookup_key === key);
      // A price whose amount no longer matches the pricing page gets replaced (the key moves over).
      if (existing && existing.unit_amount === amountCents(tier, interval)) {
        // Stripe Tax needs to know prices exclude tax (settable once, on prices made before this was set).
        if (taxOn() && existing.tax_behavior === "unspecified") await s.prices.update(existing.id, { tax_behavior: "exclusive" });
        continue;
      }
      const product = existing
        ? (existing.product as string)
        : ((await s.products.search({ query: `metadata['advertix_tier']:'${tier}'` })).data[0]?.id ??
          (await s.products.create({ name: `Advertix ${NAME[tier]}`, metadata: { advertix_tier: tier } })).id);
      const price = await s.prices.create({
        product,
        currency: "usd",
        unit_amount: amountCents(tier, interval),
        recurring: { interval },
        tax_behavior: "exclusive",
        lookup_key: key,
        transfer_lookup_key: true,
        metadata: { advertix_tier: tier },
      });
      map.set(key, price.id);
    }
  }
  priceCache = map;
  return map;
}
async function priceId(tier: PaidTier, interval: Interval) {
  const id = (await prices()).get(lookupKey(tier, interval));
  if (!id) throw bad(500, "Couldn't find the price for that plan.");
  return id;
}

function parsePlan(input: { tier?: unknown; interval?: unknown }) {
  const tier = TIERS.find((t) => t === input.tier);
  if (!tier) throw bad(400, "Choose Founder, Team or Agency.");
  const interval: Interval = input.interval === "year" ? "year" : "month";
  return { tier, interval };
}

/** The workspace's Stripe customer (created on first use). */
async function customerFor(workspaceId: string, email: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true, stripeCustomerId: true } });
  if (ws.stripeCustomerId) return ws.stripeCustomerId;
  const c = await stripe().customers.create({ name: ws.name, email, metadata: { workspaceId } });
  await prisma.workspace.update({ where: { id: workspaceId }, data: { stripeCustomerId: c.id } });
  return c.id;
}

/* ── Actions (owners) ────────────────────────────────────────────────────── */

/** POST /billing/checkout { tier, interval } → Stripe Checkout URL (first subscription). */
export async function createCheckout(workspaceId: string, userId: string, input: { tier?: unknown; interval?: unknown }) {
  const { tier, interval } = parsePlan(input);
  // Ask Stripe first: a payment we haven't heard about yet must never lead to a second subscription.
  await reconcileWorkspace(workspaceId);
  const ent = await workspaceEntitlement(workspaceId);
  if (ent.state === "ACTIVE" || ent.state === "PAST_DUE") throw Object.assign(bad(409, "You already have a plan, so nothing new was charged. Reload this page to see it; to change it, use Switch."), { code: "ALREADY_SUBSCRIBED" });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const customer = await customerFor(workspaceId, user.email);
  // Still on the free trial: nothing is charged until the day it ends, however close that is.
  const left = ent.state === "TRIAL" && ent.trialEndsAt ? ent.trialEndsAt.getTime() - Date.now() : 0;
  const startsAt = left > MIN_ANCHOR_MS ? Math.floor(ent.trialEndsAt!.getTime() / 1000) : null;
  const start = !startsAt ? {} : left > MIN_TRIAL_MS ? { trial_end: startsAt } : { billing_cycle_anchor: startsAt, proration_behavior: "none" as const };
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: workspaceId,
    line_items: [{ price: await priceId(tier, interval), quantity: 1 }],
    subscription_data: { metadata: { workspaceId }, ...start },
    allow_promotion_codes: true,
    // For correct invoices everywhere, and so tax can be worked out the day it's switched on.
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    ...(taxOn() ? { automatic_tax: { enabled: true } } : {}),
    customer_update: { name: "auto", address: "auto" },
    success_url: `${FRONTEND_URL()}/settings?tab=billing&checkout=success`,
    cancel_url: `${FRONTEND_URL()}/settings?tab=billing&checkout=cancelled`,
  });
  return { url: session.url };
}

/** Which of our plans a Stripe price is. */
async function planOfPrice(priceRef: string | Stripe.Price | Stripe.DeletedPrice | null | undefined): Promise<{ tier: PaidTier; interval: Interval } | null> {
  const id = idOf(priceRef);
  if (!id) return null;
  let key = [...(await prices())].find(([, v]) => v === id)?.[0] ?? null;
  // A price from before an amount change: its own lookup key or tier note.
  if (!key) {
    const p = typeof priceRef === "object" && priceRef && "recurring" in priceRef ? priceRef : await stripe().prices.retrieve(id);
    const t = (p.metadata?.advertix_tier as PaidTier | undefined) ?? TIERS.find((x) => p.lookup_key?.startsWith(`advertix_${x.toLowerCase()}_`));
    return t && TIERS.includes(t) ? { tier: t, interval: p.recurring?.interval === "year" ? "year" : "month" } : null;
  }
  const [, t, i] = key.split("_");
  const tier = TIERS.find((x) => x.toLowerCase() === t);
  return tier ? { tier, interval: i === "year" ? "year" : "month" } : null;
}

/**
 * POST /billing/change { tier, interval }.
 *  - The plan they already have: undoes a waiting downgrade and / or a cancellation.
 *  - A bigger plan (or monthly → yearly): now, paying only the difference for the rest of the period.
 *  - A smaller plan (or yearly → monthly): at the next renewal; nothing is charged or credited now.
 *  - Before the first payment (the free trial is still running): any change is immediate and free.
 */
export async function changePlan(workspaceId: string, input: { tier?: unknown; interval?: unknown }) {
  const { tier, interval } = parsePlan(input);
  await reconcileWorkspace(workspaceId);
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!ws.stripeSubscriptionId) throw bad(409, "There's no plan to change yet. Choose one first.");
  const s = stripe();
  const sub = await s.subscriptions.retrieve(ws.stripeSubscriptionId);
  const item = sub.items.data[0];
  const price = await priceId(tier, interval);
  const current = await planOfPrice(item.price);
  const scheduleId = idOf(sub.schedule);
  // A schedule manages cancelling too, so it is always released before anything else is changed.
  const release = async () => {
    if (scheduleId) await s.subscriptionSchedules.release(scheduleId);
  };

  if (item.price.id === price) {
    if (!scheduleId && !cancelling(sub)) throw bad(409, "That's already your plan.");
    await release();
    if (cancelling(sub)) await s.subscriptions.update(sub.id, { cancel_at_period_end: false });
  } else {
    const unpaid = sub.status === "trialing" || Boolean(ws.trialEndsAt && ws.trialEndsAt.getTime() > Date.now());
    const smaller = Boolean(current) && (RANK[tier] < RANK[current!.tier] || (tier === current!.tier && current!.interval === "year" && interval === "month"));
    if (smaller && !unpaid) {
      if (cancelling(sub)) await s.subscriptions.update(sub.id, { cancel_at_period_end: false });
      const sched = scheduleId ? await s.subscriptionSchedules.retrieve(scheduleId) : await s.subscriptionSchedules.create({ from_subscription: sub.id });
      // The phase Stripe says is running (its clock, not ours).
      const cur = sched.phases.find((p) => p.start_date === sched.current_phase?.start_date) ?? sched.phases[0];
      await s.subscriptionSchedules.update(sched.id, {
        end_behavior: "release",
        proration_behavior: "none",
        metadata: { workspaceId },
        phases: [
          // What they have and paid for, to the end of this period…
          { items: [{ price: item.price.id, quantity: 1 }], start_date: cur.start_date, end_date: cur.end_date },
          // …then the plan they chose (the schedule lets go once it has started: see syncSubscription).
          { items: [{ price, quantity: 1 }], duration: { interval, interval_count: 1 } },
        ],
      });
    } else {
      await release();
      try {
        await s.subscriptions.update(sub.id, {
          items: [{ id: item.id, price }],
          // The difference for the rest of the period is charged today, on its own invoice; if the card
          // is declined nothing changes (the bigger plan is never given without the payment).
          ...(unpaid ? { proration_behavior: "none" as const } : { proration_behavior: "always_invoice" as const, payment_behavior: "error_if_incomplete" as const }),
          cancel_at_period_end: false,
          metadata: { workspaceId },
        });
      } catch (err) {
        const e = err as { type?: string; code?: string; message?: string };
        if (e.type === "StripeCardError" || e.code === "card_declined" || e.code === "payment_intent_authentication_failure" || e.code === "subscription_payment_intent_requires_action") {
          throw Object.assign(bad(402, "Your card didn't accept the payment, so your plan hasn't changed. Update the card in Manage billing and try again."), { code: "PAYMENT_FAILED" });
        }
        throw err;
      }
    }
  }
  await reconcileWorkspace(workspaceId);
  return billingStatus(workspaceId);
}

/**
 * Cancel everything the workspace is paying for, now (the workspace is being
 * deleted). Throws if Stripe can't be reached: better to keep the workspace
 * than to delete it and go on charging for it.
 */
export async function cancelSubscriptions(workspaceId: string) {
  if (!billingConfigured()) return 0;
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { stripeCustomerId: true } });
  if (!ws?.stripeCustomerId) return 0;
  const s = stripe();
  const subs = await s.subscriptions.list({ customer: ws.stripeCustomerId, status: "all", limit: 50 });
  const open = subs.data.filter((x) => x.status !== "canceled" && x.status !== "incomplete_expired");
  for (const sub of open) await s.subscriptions.cancel(sub.id);
  if (open.length) console.log(`[billing] workspace ${workspaceId} deleted: ${open.length} subscription(s) cancelled`);
  return open.length;
}

/** POST /billing/portal → Stripe's billing portal (invoices, card, cancel). */
let portalConfig: string | null = null;
export async function portalSession(workspaceId: string) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { stripeCustomerId: true } });
  if (!ws.stripeCustomerId) throw bad(409, "Choose a plan first; invoices and payment details appear after that.");
  const s = stripe();
  portalConfig ??= (
    await s.billingPortal.configurations.create({
      business_profile: { headline: "Advertix billing" },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ["email", "name", "address", "tax_id"] },
        subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] } },
      },
    })
  ).id;
  const session = await s.billingPortal.sessions.create({ customer: ws.stripeCustomerId, configuration: portalConfig, return_url: `${FRONTEND_URL()}/settings?tab=billing` });
  return { url: session.url };
}

/* ── Status ──────────────────────────────────────────────────────────────── */

// A workspace with a Stripe customer but no running plan is asked about at most this often.
const HEAL_EVERY_MS = 5_000;
const healedAt = new Map<string, number>();

/**
 * `fresh`: the billing page itself is asking (it has just opened, or the person is back from Stripe's
 * portal), so Stripe is asked whatever the state: a cancellation or a new card made there shows at once.
 */
export async function billingStatus(workspaceId: string, opts: { fresh?: boolean } = {}) {
  let ent = await workspaceEntitlement(workspaceId);
  // Paid but not showing (the webhook is late, lost or not set up)? Ask Stripe directly.
  if (billingConfigured() && ent.hasCustomer && (opts.fresh || ent.state !== "ACTIVE") && Date.now() - (healedAt.get(workspaceId) ?? 0) > HEAL_EVERY_MS) {
    healedAt.set(workspaceId, Date.now());
    try {
      if (await reconcileWorkspace(workspaceId)) ent = await workspaceEntitlement(workspaceId);
    } catch (err) {
      console.error("[billing] couldn't check Stripe:", err instanceof Error ? err.message : err);
    }
  }
  return {
    configured: billingConfigured(),
    state: ent.state,
    locked: ent.locked,
    features: ent.features,
    tier: ent.tier,
    interval: ent.interval,
    trialEndsAt: ent.trialEndsAt,
    trialDaysLeft: ent.trialDaysLeft,
    renewsAt: ent.renewsAt,
    /** A smaller plan waiting for the renewal date. */
    pending: (ent.state === "ACTIVE" || ent.state === "PAST_DUE") && ent.ws.pendingPlan && TIER_OF[ent.ws.pendingPlan] ? { tier: TIER_OF[ent.ws.pendingPlan]!, interval: ent.ws.pendingInterval === "year" ? "year" : "month", at: ent.renewsAt } : null,
    cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
    hasCustomer: ent.hasCustomer,
    limits: { clients: Number.isFinite(ent.limits.clients) ? ent.limits.clients : null, seats: Number.isFinite(ent.limits.seats) ? ent.limits.seats : null, credits: ent.limits.credits },
  };
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */

const RUNNING = ["active", "trialing", "past_due"];

/** The workspace a subscription (or a customer) belongs to. */
async function workspaceOf(customer: string, workspaceId?: string | null) {
  return (
    (workspaceId ? await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true } }) : null) ??
    (await prisma.workspace.findFirst({ where: { stripeCustomerId: customer }, select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true } }))
  );
}

/**
 * Copy what Stripe says the workspace has now. Returns true when a
 * subscription was copied.
 *
 * - A running subscription (active, trialing, past due) wins; the newest if
 *   there is more than one (which is reported loudly: someone was charged twice).
 * - With none running, only the subscription the workspace points at is
 *   copied (so its end is recorded). Anything else is left alone: an old
 *   cancelled subscription must never wipe a plan set by hand.
 */
export async function reconcileWorkspace(workspaceId: string): Promise<boolean> {
  if (!billingConfigured()) return false;
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true } });
  if (!ws?.stripeCustomerId) return false;
  const subs = (await stripe().subscriptions.list({ customer: ws.stripeCustomerId, status: "all", limit: 50 })).data.sort((a, b) => b.created - a.created);
  const running = subs.filter((x) => RUNNING.includes(x.status));
  if (running.length > 1) console.error(`[billing] ATTENTION: workspace ${ws.id} has ${running.length} running subscriptions (${running.map((x) => x.id).join(", ")}). Cancel and refund the extra one in Stripe.`);
  const pick = running[0] ?? subs.find((x) => x.id === ws.stripeSubscriptionId);
  if (!pick) return false;
  await syncSubscription(pick, ws.id);
  return true;
}

/** Copy a subscription onto its workspace. Callers pass the one Stripe says is current (see reconcileWorkspace). */
export async function syncSubscription(sub: Stripe.Subscription, workspaceId?: string) {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const ws = await workspaceOf(customer, workspaceId ?? sub.metadata?.workspaceId);
  if (!ws) return console.warn(`[billing] no workspace for subscription ${sub.id}`);
  // The end of a subscription the workspace has already moved on from changes nothing.
  if ((sub.status === "canceled" || sub.status === "incomplete_expired") && ws.stripeSubscriptionId && ws.stripeSubscriptionId !== sub.id) return;
  const item = sub.items.data[0];
  const tierMeta = item?.price.metadata?.advertix_tier as PaidTier | undefined;
  const tier = tierMeta && TIERS.includes(tierMeta) ? tierMeta : TIERS.find((t) => item?.price.lookup_key?.startsWith(`advertix_${t.toLowerCase()}_`));
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
  // Newer API versions keep the period on the item.
  const start = (item as unknown as { current_period_start?: number })?.current_period_start ?? (sub as unknown as { current_period_start?: number }).current_period_start;
  const end = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;

  // A downgrade waiting for the renewal (a schedule with a later phase). Once it has happened the schedule
  // has nothing left to do: it is released, so cancelling and changing work the ordinary way again.
  let pending: { tier: PaidTier; interval: Interval } | null = null;
  const scheduleId = idOf(sub.schedule);
  if (scheduleId && !ended) {
    try {
      const sched = await stripe().subscriptionSchedules.retrieve(scheduleId);
      // A phase after the one Stripe says is running (its clock, not ours).
      const next = sched.current_phase ? sched.phases.find((p) => p.start_date >= sched.current_phase!.end_date) : sched.phases.find((p) => p.start_date > Math.floor(Date.now() / 1000));
      if (next) {
        const to = await planOfPrice(next.items[0]?.price);
        if (to && idOf(next.items[0]?.price) !== item?.price.id) pending = to;
      } else if (sched.status === "active") await stripe().subscriptionSchedules.release(scheduleId);
    } catch (err) {
      console.error(`[billing] schedule ${scheduleId}:`, err instanceof Error ? err.message : err);
    }
  }
  await prisma.workspace.update({
    where: { id: ws.id },
    data: ended
      ? { plan: "FREE", stripeSubscriptionId: null, subscriptionStatus: sub.status, cancelAtPeriodEnd: false, currentPeriodStart: null, currentPeriodEnd: null, stripeCustomerId: customer, pendingPlan: null, pendingInterval: null }
      : {
          pendingPlan: pending ? PLAN_OF[pending.tier] : null,
          pendingInterval: pending?.interval ?? null,
          plan: tier ? PLAN_OF[tier] : undefined,
          stripeCustomerId: customer,
          stripeSubscriptionId: sub.id,
          subscriptionStatus: sub.status,
          planInterval: item?.price.recurring?.interval ?? null,
          currentPeriodStart: start ? new Date(start * 1000) : null,
          // Set to end: the day it ends is what the page shows ("ends on").
          currentPeriodEnd: sub.cancel_at ? new Date(sub.cancel_at * 1000) : end ? new Date(end * 1000) : null,
          cancelAtPeriodEnd: cancelling(sub),
        },
  });
}

/** Plan emails go to every owner, whatever their email preferences (C15): a lock stops their safety rules. */
async function emailOwners(workspaceId: string, key: string, subject: string, line: string) {
  return notifyMembers(workspaceId, (m) => m.role === "OWNER", "USAGE", { key, clientId: null, line }, subject, "About your Advertix plan:", { label: "Open billing", path: "/settings?tab=billing" }, { always: true }).catch((err) => {
    console.error("[billing] email:", err instanceof Error ? err.message : err);
    return 0;
  });
}

/** The rollout email (C15, scripts/start-trials.ts): paid plans are starting and the workspace has a fresh trial. Sent once per trial. */
export function announceTrial(workspaceId: string, endsAt: Date) {
  const when = endsAt.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  return emailOwners(
    workspaceId,
    `trial-start:${endsAt.toISOString().slice(0, 10)}`,
    "Your 14-day Advertix trial has started",
    `Advertix is moving to paid plans. Your workspace has a free trial with <strong>every feature</strong> until ${when}. Choose a plan any time in Billing; you're only charged when the trial ends. Nothing changes until then. We've also updated our <a href="${FRONTEND_URL()}/privacy">Privacy Policy</a> with how long we keep a workspace that stays locked after its trial.`
  );
}

/** POST /billing/webhook — raw body; verified with STRIPE_WEBHOOK_SECRET. */
export async function handleWebhook(raw: Buffer, signature: string | undefined) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw bad(503, "STRIPE_WEBHOOK_SECRET isn't set.");
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature ?? "", secret);
  } catch {
    throw bad(400, "Invalid Stripe signature.");
  }
  // An event only says "something changed for this customer": what the workspace gets is read from Stripe now,
  // so a late, repeated or out-of-order event can never put an old state back.
  const refresh = async (customer: string | null | undefined, workspaceId?: string | null) => {
    if (!customer) return;
    const ws = await workspaceOf(customer, workspaceId);
    if (!ws) return console.warn(`[billing] ${event.type}: no workspace for customer ${customer}`);
    if (!ws.stripeCustomerId) await prisma.workspace.update({ where: { id: ws.id }, data: { stripeCustomerId: customer } });
    await reconcileWorkspace(ws.id);
  };
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") await refresh(idOf(session.customer), session.client_reference_id);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      await refresh(idOf(sub.customer), sub.metadata?.workspaceId);
      break;
    }
    // A waiting downgrade set, changed, undone or carried out.
    case "subscription_schedule.updated":
    case "subscription_schedule.released":
    case "subscription_schedule.completed":
    case "subscription_schedule.canceled": {
      const sched = event.data.object as Stripe.SubscriptionSchedule;
      await refresh(idOf(sched.customer), sched.metadata?.workspaceId);
      break;
    }
    // A payment going through is what ends "past due".
    case "invoice.paid":
      await refresh(idOf((event.data.object as Stripe.Invoice).customer));
      break;
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      const ws = customer ? await prisma.workspace.findFirst({ where: { stripeCustomerId: customer }, select: { id: true } }) : null;
      if (ws) {
        await reconcileWorkspace(ws.id);
        await emailOwners(ws.id, `payment-failed:${inv.id}`, "A payment for Advertix didn't go through", "Stripe couldn't charge your card. It will retry; update the card in Billing to keep your plan.");
      }
      break;
    }
    default:
      break;
  }
  return { received: true, type: event.type };
}

/* ── Daily check against Stripe ──────────────────────────────────────────── */

/**
 * Every workspace with a Stripe customer, compared with Stripe once a day: a
 * webhook that never arrived (a cancellation, a failed renewal, a payment)
 * is caught within a day instead of never.
 */
export async function billingReconcileTick() {
  if (!billingConfigured()) return { checked: 0, failed: 0 };
  const rows = await prisma.workspace.findMany({ where: { stripeCustomerId: { not: null } }, select: { id: true } });
  let failed = 0;
  for (const w of rows) {
    try {
      await reconcileWorkspace(w.id);
    } catch (err) {
      failed++;
      console.error(`[billing] daily check of ${w.id}:`, err instanceof Error ? err.message : err);
    }
  }
  if (rows.length) console.log(`[billing] daily check: ${rows.length} workspace(s)${failed ? `, ${failed} failed` : ""}`);
  return { checked: rows.length, failed };
}

let reconcileHandle: NodeJS.Timeout | null = null;
/** Timer fallback (when the job queue isn't running): once a day. Disable with BILLING_RECONCILE_ENABLED=false. */
export function startBillingReconcileScheduler() {
  if (reconcileHandle) return;
  reconcileHandle = setInterval(() => void billingReconcileTick().catch((e) => console.error("[billing] daily check", e)), 86_400_000);
}

/* ── Trial reminders (hourly alerts job) ─────────────────────────────────── */

/** Email owners 3 days before the free trial ends and when it has ended (once each). */
export async function trialReminders(workspaceId: string, now = new Date()) {
  const ent = await workspaceEntitlement(workspaceId, now);
  if (!ent.trialEndsAt) return;
  const day = ent.trialEndsAt.toISOString().slice(0, 10);
  const when = ent.trialEndsAt.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  if (ent.state === "TRIAL" && ent.trialDaysLeft <= 3) {
    await emailOwners(
      workspaceId,
      `trial:${day}:soon`,
      `Your Advertix trial ends in ${ent.trialDaysLeft} day${ent.trialDaysLeft === 1 ? "" : "s"}`,
      `Your free trial ends on ${when}. Choose a plan to keep using Advertix; you won't be charged before then. If the trial ends without a plan, the workspace locks: syncing, AI and reports stop, and so do your <strong>safety rules and spend caps</strong>. Your ads keep running on the platforms and your data is kept.`
    );
  } else if (ent.state === "EXPIRED" && now.getTime() - ent.trialEndsAt.getTime() < 7 * 86_400_000) {
    await emailOwners(
      workspaceId,
      `trial:${day}:ended`,
      "Your Advertix trial has ended",
      "Your free trial ended, so the workspace is locked: syncing, AI, reports, safety rules and spend caps have stopped. Your ads keep running on the platforms and your data is safe. Choose a plan to pick up exactly where you left off."
    );
  }
}

