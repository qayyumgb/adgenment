import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { PLAN_OF, PRICE, workspaceEntitlement, type Tier } from "../lib/plans";
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
 *  - Webhooks keep the workspace in sync: plan, status, period, cancel-at-end.
 */

export type PaidTier = Exclude<Tier, "ENTERPRISE">;
export type Interval = "month" | "year";
const TIERS: PaidTier[] = ["FOUNDER", "TEAM", "AGENCY"];
const NAME: Record<PaidTier, string> = { FOUNDER: "Founder", TEAM: "Team", AGENCY: "Agency" };
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";
const MIN_TRIAL_MS = 2 * 86_400_000; // Stripe needs a trial end at least 48 h away

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
      if (existing && existing.unit_amount === amountCents(tier, interval)) continue;
      const product = existing
        ? (existing.product as string)
        : ((await s.products.search({ query: `metadata['advertix_tier']:'${tier}'` })).data[0]?.id ??
          (await s.products.create({ name: `Advertix ${NAME[tier]}`, metadata: { advertix_tier: tier } })).id);
      const price = await s.prices.create({
        product,
        currency: "usd",
        unit_amount: amountCents(tier, interval),
        recurring: { interval },
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
  const ent = await workspaceEntitlement(workspaceId);
  if (ent.state === "ACTIVE" || ent.state === "PAST_DUE") throw bad(409, "You already have a plan. Switch plans instead.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const customer = await customerFor(workspaceId, user.email);
  // Still on the free trial: the paid plan starts when the trial would have ended.
  const trialEnd = ent.state === "TRIAL" && ent.trialEndsAt && ent.trialEndsAt.getTime() - Date.now() > MIN_TRIAL_MS ? Math.floor(ent.trialEndsAt.getTime() / 1000) : undefined;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: workspaceId,
    line_items: [{ price: await priceId(tier, interval), quantity: 1 }],
    subscription_data: { metadata: { workspaceId }, ...(trialEnd ? { trial_end: trialEnd } : {}) },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_update: { name: "auto", address: "auto" },
    success_url: `${FRONTEND_URL()}/settings?tab=billing&checkout=success`,
    cancel_url: `${FRONTEND_URL()}/settings?tab=billing&checkout=cancelled`,
  });
  return { url: session.url };
}

/** POST /billing/change { tier, interval } — switch the existing subscription (prorated). */
export async function changePlan(workspaceId: string, input: { tier?: unknown; interval?: unknown }) {
  const { tier, interval } = parsePlan(input);
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (!ws.stripeSubscriptionId) throw bad(409, "There's no plan to change yet. Choose one first.");
  const s = stripe();
  const sub = await s.subscriptions.retrieve(ws.stripeSubscriptionId);
  const item = sub.items.data[0];
  const price = await priceId(tier, interval);
  if (item?.price.id === price && !sub.cancel_at_period_end) throw bad(409, "That's already your plan.");
  const updated = await s.subscriptions.update(sub.id, {
    items: [{ id: item.id, price }],
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: { workspaceId },
  });
  await syncSubscription(updated);
  return billingStatus(workspaceId);
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

export async function billingStatus(workspaceId: string) {
  const ent = await workspaceEntitlement(workspaceId);
  return {
    configured: billingConfigured(),
    state: ent.state,
    tier: ent.tier,
    interval: ent.interval,
    trialEndsAt: ent.trialEndsAt,
    trialDaysLeft: ent.trialDaysLeft,
    renewsAt: ent.renewsAt,
    cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
    hasCustomer: ent.hasCustomer,
    limits: { clients: Number.isFinite(ent.limits.clients) ? ent.limits.clients : null, seats: Number.isFinite(ent.limits.seats) ? ent.limits.seats : null, credits: ent.limits.credits },
  };
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */

/** Copy a subscription onto its workspace. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const ws =
    (sub.metadata?.workspaceId && (await prisma.workspace.findUnique({ where: { id: sub.metadata.workspaceId }, select: { id: true } }))) ||
    (await prisma.workspace.findFirst({ where: { stripeCustomerId: customer }, select: { id: true } }));
  if (!ws) return console.warn(`[billing] no workspace for subscription ${sub.id}`);
  const item = sub.items.data[0];
  const tierMeta = item?.price.metadata?.advertix_tier as PaidTier | undefined;
  const tier = tierMeta && TIERS.includes(tierMeta) ? tierMeta : TIERS.find((t) => item?.price.lookup_key?.startsWith(`advertix_${t.toLowerCase()}_`));
  const ended = sub.status === "canceled" || sub.status === "incomplete_expired";
  // Newer API versions keep the period on the item.
  const start = (item as unknown as { current_period_start?: number })?.current_period_start ?? (sub as unknown as { current_period_start?: number }).current_period_start;
  const end = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  await prisma.workspace.update({
    where: { id: ws.id },
    data: ended
      ? { plan: "FREE", stripeSubscriptionId: null, subscriptionStatus: sub.status, cancelAtPeriodEnd: false, currentPeriodStart: null, currentPeriodEnd: null, stripeCustomerId: customer }
      : {
          plan: tier ? PLAN_OF[tier] : undefined,
          stripeCustomerId: customer,
          stripeSubscriptionId: sub.id,
          subscriptionStatus: sub.status,
          planInterval: item?.price.recurring?.interval ?? null,
          currentPeriodStart: start ? new Date(start * 1000) : null,
          currentPeriodEnd: end ? new Date(end * 1000) : null,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        },
  });
}

async function emailOwners(workspaceId: string, key: string, subject: string, line: string) {
  await notifyMembers(workspaceId, (m) => m.role === "OWNER", "USAGE", { key, clientId: null, line }, subject, "About your Advertix plan:", { label: "Open billing", path: "/settings?tab=billing" }).catch((err) =>
    console.error("[billing] email:", err instanceof Error ? err.message : err)
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
  const s = stripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        await syncSubscription(await s.subscriptions.retrieve(typeof session.subscription === "string" ? session.subscription : session.subscription.id));
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const customer = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      const ws = customer ? await prisma.workspace.findFirst({ where: { stripeCustomerId: customer }, select: { id: true } }) : null;
      if (ws) await emailOwners(ws.id, `payment-failed:${inv.id}`, "A payment for Advertix didn't go through", "Stripe couldn't charge your card. It will retry; update the card in Billing to keep your plan.");
      break;
    }
    default:
      break;
  }
  return { received: true, type: event.type };
}

/* ── Trial reminders (hourly alerts job) ─────────────────────────────────── */

/** Email owners 3 days before the free trial ends and when it has ended (once each). */
export async function trialReminders(workspaceId: string, now = new Date()) {
  const ent = await workspaceEntitlement(workspaceId, now);
  if (!ent.trialEndsAt) return;
  const day = ent.trialEndsAt.toISOString().slice(0, 10);
  const when = ent.trialEndsAt.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  if (ent.state === "TRIAL" && ent.trialDaysLeft <= 3) {
    await emailOwners(workspaceId, `trial:${day}:soon`, `Your Advertix trial ends in ${ent.trialDaysLeft} day${ent.trialDaysLeft === 1 ? "" : "s"}`, `Your free trial ends on ${when}. Choose a plan to keep your AI, automation and reports running; you won't be charged before then.`);
  } else if (ent.state === "EXPIRED" && now.getTime() - ent.trialEndsAt.getTime() < 7 * 86_400_000) {
    await emailOwners(workspaceId, `trial:${day}:ended`, "Your Advertix trial has ended", "Your free trial ended. Your data is safe and syncing continues; choose a plan to turn the AI and the rest back on.");
  }
}

