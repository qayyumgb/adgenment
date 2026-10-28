import path from "path";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";
import { assertClientAccess, type Access } from "../lib/access";
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from "../lib/email";
import { clientReport, liveShareUrl, type ClientReport, type Shows } from "./portal.service";
import { localParts } from "./notifications.service";

/**
 * Scheduled client reports (plan C4b, D5). One schedule per client: at 09:00
 * workspace time, WEEKLY on the workspace's first day of the week (the 7 days
 * before) or MONTHLY on the 1st (the month before). The email carries the
 * headline numbers, a PDF (optional) and the client's live portal link when
 * it has one. It comes from "<agency> via Advertix" and replies go to whoever
 * set it up. Same numbers and the same hide-spend / revenue / campaigns
 * switches as the portal (`clientReport`).
 */

const DAY = 86_400_000;
const SEND_HOUR = 9;
const MAX_RECIPIENTS = 10;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const FONTS = path.join(__dirname, "../../assets/fonts");
export type Frequency = "WEEKLY" | "MONTHLY";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const dayLabel = (d: Date) => `${d.getUTCDate()} ${SHORT[d.getUTCMonth()]}`;

/** The period a report sent on local date `today` covers, and its key (once per period). */
export function periodFor(frequency: Frequency, today: string) {
  if (frequency === "MONTHLY") {
    const t = utc(today);
    const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
    return { key: ymd(start).slice(0, 7), start, end, label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}` };
  }
  const end = new Date(utc(today).getTime() - DAY);
  const start = new Date(end.getTime() - 6 * DAY);
  const span = start.getUTCMonth() === end.getUTCMonth() ? `${start.getUTCDate()}–${dayLabel(end)}` : `${dayLabel(start)} – ${dayLabel(end)}`;
  return { key: today, start, end, label: `Week of ${span} ${end.getUTCFullYear()}` };
}

/** Is a schedule due at `now` (09:00 or later on its day, workspace time)? */
function dueToday(frequency: Frequency, local: { date: string; weekday: number; hour: number }, weekStartsOn: number) {
  if (local.hour < SEND_HOUR) return false;
  return frequency === "MONTHLY" ? local.date.endsWith("-01") : local.weekday === weekStartsOn;
}

/** The next send, as a local date (for "Next report: Mon 2 Nov, 09:00"). */
function nextSend(frequency: Frequency, now: Date, tz: string | null, weekStartsOn: number, sentToday: boolean) {
  const local = localParts(now, tz);
  for (let i = 0; i < 40; i++) {
    const d = new Date(utc(local.date).getTime() + i * DAY);
    const isDay = frequency === "MONTHLY" ? d.getUTCDate() === 1 : d.getUTCDay() === weekStartsOn;
    if (!isDay) continue;
    if (i === 0 && (sentToday || local.hour >= 23)) continue;
    return ymd(d);
  }
  return null;
}

/* ── Content ─────────────────────────────────────────────────────────────── */

const money = (n: number | null | undefined, c: string | null) => {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c ?? "USD", maximumFractionDigits: n === 0 || n >= 100 ? 0 : 2 }).format(n);
  } catch {
    return String(Math.round(n));
  }
};
const num = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const change = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null && b > 0 ? ((a - b) / b) * 100 : null);

/** The headline numbers, in order, with their change and whether up is good. */
function headline(r: ClientReport) {
  const k = r.kpis;
  const p = r.previous;
  return [
    ...(r.shows.spend ? [{ label: "Spend", value: money(k.spend, r.currency), delta: change(k.spend, p.spend), good: null as boolean | null }] : []),
    ...(r.shows.revenue ? [{ label: "Revenue", value: money(k.revenue, r.currency), delta: change(k.revenue, p.revenue), good: true }] : []),
    ...(r.shows.spend && r.shows.revenue ? [{ label: "ROAS", value: k.roas == null ? "—" : `${k.roas.toFixed(2)}x`, delta: change(k.roas, p.roas), good: true }] : []),
    { label: "Results", value: num(k.conversions), delta: change(k.conversions, p.conversions), good: true },
    ...(r.shows.spend ? [{ label: "Cost per result", value: money(k.cpa, r.currency), delta: change(k.cpa, p.cpa), good: false }] : []),
    { label: "Clicks", value: num(k.clicks), delta: change(k.clicks, p.clicks), good: true },
    { label: "CTR", value: k.ctr == null ? "—" : `${k.ctr.toFixed(2)}%`, delta: change(k.ctr, p.ctr), good: true },
  ];
}
const deltaText = (d: number | null) => (d == null ? "" : `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}%`);
/** Green when the change is good, red when bad, grey when neither (spend). */
const deltaColor = (d: number | null, good: boolean | null) => (d == null || good === null || Math.abs(d) < 0.05 ? "#6c6980" : (d > 0) === good ? "#16794a" : "#c2410c");

function campaignColumns(r: ClientReport) {
  type Row = NonNullable<ClientReport["campaigns"]>[number];
  return [
    ...(r.shows.spend ? [{ label: "Spend", cell: (c: Row) => money(c.spend, r.currency) }] : []),
    { label: "Results", cell: (c: Row) => num(c.conversions) },
    ...(r.shows.spend ? [{ label: "Cost / result", cell: (c: Row) => money(c.cpa, r.currency) }] : []),
    ...(r.shows.spend && r.shows.revenue ? [{ label: "ROAS", cell: (c: Row) => (c.roas == null ? "—" : `${c.roas.toFixed(2)}x`) }] : []),
    { label: "CTR", cell: (c: Row) => (c.ctr == null ? "—" : `${c.ctr.toFixed(2)}%`) },
  ];
}

const sameName = (r: ClientReport) => r.agency.trim().toLowerCase() === r.client.trim().toLowerCase();
const quiet = (r: ClientReport) => !r.kpis.impressions && !r.kpis.clicks && !r.kpis.conversions && !r.kpis.spend;

/** A one- or two-page A4 PDF: headline numbers, this month's budget, campaigns. */
export function reportPdf(r: ClientReport, label: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: `${r.client} · ${label}`, Author: r.agency, Creator: "Advertix" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("R", path.join(FONTS, "Geist-Regular.ttf"));
    doc.registerFont("B", path.join(FONTS, "Geist-SemiBold.ttf"));
    const INK = "#14121f", INK2 = "#4a4760", INK3 = "#6c6980", LINE = "#e6e4ee", BRAND = "#6448f2", SOFT = "#f4f3f8";
    const L = 48, W = doc.page.width - 96;
    /** Cut text to one line of `width` at the current font, with "…". */
    const fit = (text: string, width: number) => {
      if (doc.widthOfString(text) <= width) return text;
      let t = text;
      while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
      return `${t.trimEnd()}…`;
    };
    /** The largest size ≤ `max` (≥ `min`) at which `text` fits `width` with font `font`. */
    const sizeToFit = (text: string, width: number, max: number, min: number) => {
      let s = max;
      doc.fontSize(s);
      while (s > min && doc.widthOfString(text) > width) doc.fontSize((s -= 0.5));
      return s;
    };

    doc.font("R").fontSize(10).fillColor(INK2).text(sameName(r) ? "Performance report" : `${r.agency} · performance report`, L, 48);
    doc.font("B").fontSize(22).fillColor(INK).text(r.client, L, 64, { width: W });
    doc.font("R").fontSize(10).fillColor(INK2).text(`${label}, compared with the ${r.days} days before`, L, doc.y + 4, { width: W });
    let y = doc.y + 18;

    if (quiet(r)) {
      doc.roundedRect(L, y, W, 34, 8).fill(SOFT);
      doc.font("B").fontSize(10).fillColor(INK).text("No ad activity in this period.", L + 14, y + 12);
      y += 48;
    }

    // Headline numbers: 4 a row.
    const cards = headline(r);
    const cols = 4, gap = 10, cw = (W - gap * (cols - 1)) / cols, ch = 62;
    cards.forEach((c, i) => {
      const x = L + (i % cols) * (cw + gap);
      const cy = y + Math.floor(i / cols) * (ch + gap);
      doc.roundedRect(x, cy, cw, ch, 8).lineWidth(0.8).strokeColor(LINE).stroke();
      doc.font("R").fontSize(9).fillColor(INK2).text(c.label, x + 12, cy + 11, { width: cw - 24 });
      doc.font("B");
      sizeToFit(c.value, cw - 24, 16, 10);
      doc.fillColor(INK).text(c.value, x + 12, cy + 26, { width: cw - 24, lineBreak: false });
      if (c.delta != null) doc.font("R").fontSize(8.5).fillColor(deltaColor(c.delta, c.good)).text(deltaText(c.delta), x + 12, cy + 46, { width: cw - 24 });
    });
    y += Math.ceil(cards.length / cols) * (ch + gap) + 8;

    if (r.pacing) {
      const p = r.pacing;
      const share = Math.min(1, p.spent / p.monthlyBudget);
      doc.font("B").fontSize(11).fillColor(INK).text("This month's budget", L, y);
      doc.font("R").fontSize(9.5).fillColor(INK2).text(`${money(p.spent, r.currency)} of ${money(p.monthlyBudget, r.currency)} · on pace for ${money(p.projected, r.currency)}`, L, y + 1, { width: W, align: "right" });
      doc.roundedRect(L, y + 20, W, 7, 3.5).fill(SOFT);
      if (share > 0) doc.roundedRect(L, y + 20, Math.max(7, W * share), 7, 3.5).fill(p.status === "AHEAD" ? "#c27c0e" : BRAND);
      y += 44;
    }

    const rows = r.campaigns ?? [];
    if (r.shows.campaigns) {
      const colsDef = campaignColumns(r);
      const SLOT = 64; // each number column; the name takes the rest
      const nameW = W - colsDef.length * SLOT;
      doc.font("B").fontSize(11).fillColor(INK).text("Campaigns", L, y);
      y += 20;
      const header = () => {
        doc.rect(L, y, W, 20).fill(SOFT);
        doc.font("R").fontSize(8.5).fillColor(INK2).text("Campaign", L + 8, y + 6);
        colsDef.forEach((c, i) => doc.text(c.label, L + nameW + i * SLOT, y + 6, { width: SLOT - 8, align: "right" }));
        y += 20;
      };
      header();
      if (!rows.length) {
        doc.font("R").fontSize(9.5).fillColor(INK2).text("No campaign activity in this period.", L + 8, y + 8);
        y += 28;
      }
      for (const c of rows.slice(0, 30)) {
        if (y > doc.page.height - 90) {
          doc.addPage();
          y = 48;
          header();
        }
        doc.font("R").fontSize(9.5).fillColor(INK);
        doc.text(fit(c.name, nameW - 16), L + 8, y + 7, { width: nameW - 16, lineBreak: false });
        doc.fillColor(INK);
        colsDef.forEach((col, i) => doc.text(col.cell(c), L + nameW + i * SLOT, y + 7, { width: SLOT - 8, align: "right", lineBreak: false }));
        y += 24;
        doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(LINE).stroke();
      }
      if (rows.length > 30) doc.font("R").fontSize(8.5).fillColor(INK3).text(`and ${rows.length - 30} more`, L + 8, y + 6);
    }

    // Footer on every page.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // The footer sits in the bottom margin; without this pdfkit would start a new page for it.
      doc.page.margins.bottom = 0;
      doc.font("R").fontSize(8).fillColor(INK3).text(`Shared by ${r.agency} · numbers from the ad platforms can change for a few days as they finalise · Powered by Advertix`, L, doc.page.height - 36, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}

function reportEmail(r: ClientReport, label: string, link: string | null) {
  const cards = headline(r);
  const cell = (c: (typeof cards)[number]) =>
    `<td style="padding:10px 12px;border:1px solid #e6e4ee;border-radius:8px;width:50%;vertical-align:top"><div style="font-size:12px;color:#4a4760">${escapeHtml(c.label)}</div><div style="font-size:18px;font-weight:600;color:#14121f;margin-top:2px">${escapeHtml(c.value)}</div>${c.delta != null ? `<div style="font-size:12px;color:${deltaColor(c.delta, c.good)}">${deltaText(c.delta)} vs the ${r.days} days before</div>` : ""}</td>`;
  const grid: string[] = [];
  for (let i = 0; i < cards.length; i += 2) grid.push(`<tr>${cell(cards[i])}${cards[i + 1] ? cell(cards[i + 1]) : "<td></td>"}</tr>`);
  const top = (r.campaigns ?? []).slice(0, 5);
  const cols = campaignColumns(r).slice(0, 2);
  const body = [
    `<p style="margin:0 0 14px">${escapeHtml(label)} (${dayLabel(utc(r.from))} – ${dayLabel(utc(r.to))}) for ${escapeHtml(r.client)}${quiet(r) ? ". <strong>No ad activity in this period.</strong>" : "."}</p>`,
    `<table role="presentation" cellspacing="6" cellpadding="0" style="width:100%;border-collapse:separate;margin:0 -6px">${grid.join("")}</table>`,
    r.pacing ? `<p style="margin:14px 0 0">This month's budget: <strong>${money(r.pacing.spent, r.currency)}</strong> of ${money(r.pacing.monthlyBudget, r.currency)}, on pace for ${money(r.pacing.projected, r.currency)}.</p>` : "",
    top.length
      ? `<p style="margin:18px 0 6px;font-weight:600;color:#14121f">Top campaigns</p><ul style="margin:0;padding-left:18px">${top.map((c) => `<li style="margin:0 0 4px"><strong>${escapeHtml(c.name)}</strong>: ${cols.map((col) => `${col.label.toLowerCase()} ${escapeHtml(col.cell(c))}`).join(" · ")}</li>`).join("")}</ul>`
      : "",
  ].join("");
  return emailLayout({
    heading: `${r.client}: ${label}`,
    body,
    cta: link ? { label: "View the live report", url: link } : undefined,
    footer: `Sent by ${escapeHtml(r.agency)} with Advertix. Reply to this email to reach them.`,
  });
}

/* ── Schedules ───────────────────────────────────────────────────────────── */

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const bad = (message: string) => Object.assign(new Error(message), { status: 400 });

type Input = { clientId?: unknown; frequency?: unknown; recipients?: unknown; showSpend?: unknown; showRevenue?: unknown; showCampaigns?: unknown; attachPdf?: unknown; active?: unknown };

function clean(input: Input) {
  const frequency: Frequency = input.frequency === "MONTHLY" ? "MONTHLY" : "WEEKLY";
  const list = Array.isArray(input.recipients) ? input.recipients : typeof input.recipients === "string" ? input.recipients.split(/[\s,;]+/) : [];
  const recipients = [...new Set(list.map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
  const wrong = recipients.filter((e) => !EMAIL.test(e) || e.length > 200);
  if (wrong.length) throw bad(`Check ${wrong.length === 1 ? "this address" : "these addresses"}: ${wrong.slice(0, 3).join(", ")}`);
  if (recipients.length > MAX_RECIPIENTS) throw bad(`Up to ${MAX_RECIPIENTS} recipients.`);
  const flag = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return { frequency, recipients, showSpend: flag(input.showSpend, true), showRevenue: flag(input.showRevenue, true), showCampaigns: flag(input.showCampaigns, true), attachPdf: flag(input.attachPdf, true), active: flag(input.active, true) };
}

async function clientFor(access: Access, clientId: unknown) {
  if (typeof clientId !== "string") throw bad("Pick a client.");
  const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId: access.workspaceId }, select: { id: true } });
  if (!c) throw Object.assign(new Error("Client not found."), { status: 404 });
  assertClientAccess(access, c.id);
  return c.id;
}

/** GET /reports/schedule?clientId= */
export async function getSchedule(access: Access, clientId: unknown, now = new Date()) {
  const id = await clientFor(access, clientId);
  const [s, ws, link] = await Promise.all([
    prisma.reportSchedule.findUnique({ where: { clientId: id } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: access.workspaceId }, select: { timezone: true, weekStartsOn: true } }),
    liveShareUrl(id),
  ]);
  const local = localParts(now, ws.timezone);
  const sentToday = Boolean(s?.lastPeriod && s.lastPeriod === periodFor(s.frequency as Frequency, local.date).key);
  return {
    schedule: s && {
      id: s.id,
      frequency: s.frequency as Frequency,
      recipients: s.recipients,
      showSpend: s.showSpend,
      showRevenue: s.showRevenue,
      showCampaigns: s.showCampaigns,
      attachPdf: s.attachPdf,
      active: s.active,
      lastSentAt: s.lastSentAt,
      lastError: s.lastError,
      nextDate: s.active ? nextSend(s.frequency as Frequency, now, ws.timezone, ws.weekStartsOn, sentToday) : null,
    },
    hasShareLink: Boolean(link),
    timezone: ws.timezone ?? "UTC",
    weekStartsOn: ws.weekStartsOn,
    emailConfigured: emailConfigured(),
  };
}

/** PUT /reports/schedule — create or change the client's schedule. */
export async function saveSchedule(access: Access, userId: string, input: Input) {
  const clientId = await clientFor(access, input.clientId);
  const data = clean(input);
  if (data.active && !data.recipients.length) throw bad("Add at least one recipient.");
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  await prisma.reportSchedule.upsert({
    where: { clientId },
    create: { workspaceId: access.workspaceId, clientId, createdById: userId, replyTo: me?.email ?? null, ...data },
    update: { ...data, replyTo: me?.email ?? undefined, lastError: null },
  });
  return getSchedule(access, clientId);
}

/** Build and send one report. `to` overrides the recipients (test sends). */
async function send(opts: { workspaceId: string; clientId: string; frequency: Frequency; shows: Shows; attachPdf: boolean; to: string[]; replyTo: string | null; now: Date; test?: boolean }) {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: opts.workspaceId }, select: { timezone: true } });
  const local = localParts(opts.now, ws.timezone);
  const period = periodFor(opts.frequency, local.date);
  const report = await clientReport({ workspaceId: opts.workspaceId, clientId: opts.clientId, shows: opts.shows, start: period.start, end: period.end, pacingAt: opts.frequency === "WEEKLY" ? opts.now : null });
  const link = await liveShareUrl(opts.clientId);
  const attachments = opts.attachPdf ? [{ filename: `${report.client.replace(/[^\w\- ]+/g, "").trim() || "report"} - ${period.label}.pdf`, content: await reportPdf(report, period.label) }] : [];
  const subject = `${opts.test ? "[Test] " : ""}${report.client}: ${period.label}`;
  const r = await sendEmail(opts.to, subject, reportEmail(report, period.label, link), { fromName: report.agency, replyTo: opts.replyTo ?? undefined, attachments });
  return { ...r, period };
}

/** POST /reports/schedule/test — what the next report would look like, to me only. */
export async function sendTest(access: Access, userId: string, input: Input, now = new Date()) {
  const clientId = await clientFor(access, input.clientId);
  const data = clean(input);
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const r = await send({ workspaceId: access.workspaceId, clientId, frequency: data.frequency, shows: data, attachPdf: data.attachPdf, to: [me.email], replyTo: me.email, now, test: true });
  if (!r.ok) throw Object.assign(new Error(r.error ?? "The email didn't send."), { status: 502 });
  return { sentTo: me.email };
}

/** One pass: send every schedule that is due and hasn't gone out for this period. */
export async function runScheduledReports(now = new Date()) {
  const schedules = await prisma.reportSchedule.findMany({ where: { active: true }, include: { workspace: { select: { timezone: true, weekStartsOn: true } } } });
  let sent = 0;
  for (const s of schedules) {
    const local = localParts(now, s.workspace.timezone);
    const frequency = s.frequency as Frequency;
    if (!s.recipients.length || !dueToday(frequency, local, s.workspace.weekStartsOn)) continue;
    const key = periodFor(frequency, local.date).key;
    if (s.lastPeriod === key) continue;
    // Claim the period first so two runs can't both send it.
    const claimed = await prisma.reportSchedule.updateMany({ where: { id: s.id, OR: [{ lastPeriod: null }, { lastPeriod: { not: key } }] }, data: { lastPeriod: key } });
    if (!claimed.count) continue;
    try {
      const r = await send({ workspaceId: s.workspaceId, clientId: s.clientId, frequency, shows: s, attachPdf: s.attachPdf, to: s.recipients, replyTo: s.replyTo, now });
      await prisma.reportSchedule.update({ where: { id: s.id }, data: r.ok ? { lastSentAt: now, lastError: null } : { lastError: r.error } });
      if (r.ok) sent++;
    } catch (err) {
      await prisma.reportSchedule.update({ where: { id: s.id }, data: { lastError: err instanceof Error ? err.message.slice(0, 300) : "Report failed" } });
    }
  }
  return sent;
}

let handle: NodeJS.Timeout | null = null;
let running = false;

/** Hourly check for due reports. Disable with SCHEDULED_REPORTS_ENABLED=false; nothing is sent without RESEND_API_KEY. */
export function startReportScheduler() {
  if ((process.env.SCHEDULED_REPORTS_ENABLED ?? "true").toLowerCase() === "false" || handle) return;
  const tick = async () => {
    if (running || !emailConfigured()) return;
    running = true;
    try {
      await runScheduledReports();
    } catch (err) {
      console.error("[reports]", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };
  setTimeout(() => {
    void tick();
    handle = setInterval(() => void tick(), 60 * 60_000);
  }, 300_000);
  console.log("[reports] scheduled client reports checked hourly");
}
