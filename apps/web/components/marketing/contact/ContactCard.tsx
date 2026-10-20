"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SegmentedControl } from "@/components/marketing/ui/SegmentedControl";
import { SUPPORT_EMAIL } from "@/lib/marketing/nav";

type Mode = "demo" | "msg";

/** Cal.com event path, e.g. "advertix/demo". When unset, demo mode falls back to a request form. */
const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK;

const TOPICS = ["Question", "Billing", "Bug report", "Partnership"];
const SPENDS = ["Under $10k", "$10k–$50k", "$50k–$250k", "$250k+"];
// Preferred-time options per weekday position (mockup slots).
const SLOTS = [
  ["09:00", "09:30", "11:00", "14:00", "15:30"],
  ["10:00", "13:30", "16:00"],
  ["09:00", "11:30", "14:00", "16:30"],
  ["10:30", "15:00"],
  ["09:30", "12:00", "14:30", "16:00"],
  ["11:00", "13:00"],
];

type Day = { w: string; n: number; label: string };

/** The next six weekdays, starting tomorrow. */
function nextWeekdays(): Day[] {
  const out: Day[] = [];
  const d = new Date();
  while (out.length < 6) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    out.push({
      w: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      n: d.getDate(),
      label: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return out;
}

const input =
  "h-12 rounded-[14px] border-[1.5px] border-mk-line2 bg-mk-paper px-3.5 text-mk-ink outline-none transition-shadow placeholder:text-mk-ink3 focus:border-mk-brand focus:shadow-[0_0_0_3px_rgb(var(--mk-soft))]";

function Chip({ on, onClick, children, mono }: { on: boolean; onClick: () => void; children: ReactNode; mono?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border-[1.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
        mono ? "h-[42px] font-mk-mono text-[13.5px]" : "h-[38px] px-3.5 text-sm"
      } ${on ? "border-mk-ink bg-mk-ink text-white" : "border-mk-line2 text-mk-ink hover:bg-mk-s2"}`}
    >
      {children}
    </button>
  );
}

export function ContactCard() {
  const [mode, setMode] = useState<Mode>("demo");
  const [days, setDays] = useState<Day[]>([]);
  const [tz, setTz] = useState("");
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", email: "", company: "", website: "" });
  const [spend, setSpend] = useState<string | null>(null);
  const [topic, setTopic] = useState("Question");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const sentRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Client-only: dates and timezone would mismatch between server and browser.
  useEffect(() => {
    setDays(nextWeekdays());
    try {
      setTz(
        new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
          .formatToParts(new Date())
          .find((p) => p.type === "timeZoneName")?.value ?? ""
      );
    } catch {
      /* keep blank */
    }
    if (window.location.hash === "#msg") setMode("msg");
  }, []);

  useEffect(() => {
    if (status === "sent") sentRef.current?.focus();
  }, [status]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
  const usingCal = mode === "demo" && !!CAL_LINK;
  const canSend = mode === "demo" ? !!slot && emailOk : emailOk && msg.trim().length > 3;
  const reason =
    mode === "demo"
      ? !slot
        ? "Pick a time to continue"
        : !emailOk
          ? "Add your work email to continue"
          : ""
      : !emailOk
        ? "Add your email to continue"
        : msg.trim().length <= 3
          ? "Write a short message to continue"
          : "";

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: mode === "demo" ? "demo" : "message",
          name: f.name,
          email: f.email,
          company: f.company,
          website: f.website,
          spend,
          topic,
          message: msg,
          day: days[day]?.label,
          slot: slot ? `${slot}${tz ? ` ${tz}` : ""}` : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "We couldn’t send that. Please try again.");
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t send that. Please try again.");
      setStatus("error");
    }
  }

  const reset = () => {
    setStatus("idle");
    setSlot(null);
    setMsg("");
  };

  const pad = "px-[clamp(18px,3vw,28px)]";

  return (
    <div
      id="demo"
      data-reveal="up"
      className="min-w-0 flex-[1.15_1_460px] scroll-mt-[90px] overflow-hidden rounded-[28px] border border-mk-hair bg-mk-paper2 shadow-[0_40px_80px_-40px_rgba(40,30,80,.35)]"
    >
      <div className="m-3.5">
        <SegmentedControl
          label="How would you like to get in touch?"
          tone="paper"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setStatus("idle");
            setError("");
          }}
          options={[
            { value: "demo", label: "Book a demo" },
            { value: "msg", label: "Send a message" },
          ]}
          className="flex w-full !p-[5px]"
          itemClassName="flex-1 justify-center !h-10 !text-sm"
        />
      </div>

      {status === "sent" ? (
        <div
          ref={sentRef}
          tabIndex={-1}
          role="status"
          className={`flex flex-col items-start gap-3 pb-[clamp(24px,4vw,36px)] pt-2 outline-none ${pad}`}
        >
          <span aria-hidden="true" className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#e5f4ec] text-[22px] font-bold text-mk-pos">
            ✓
          </span>
          <span className="text-[clamp(24px,3vw,32px)] font-medium leading-[1.1] tracking-[-0.03em]">
            {mode === "demo" ? `Request received: ${days[day]?.label}, ${slot}` : "Message sent"}
          </span>
          <span className="text-mk-ink2">
            {mode === "demo"
              ? `We’ll confirm the time by email at ${f.email}. Have one ad-account login handy and we’ll connect it together.`
              : `We’ll reply to ${f.email} within one working day.`}
          </span>
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-full border-[1.5px] border-mk-line2 px-[18px] font-semibold text-mk-ink hover:bg-mk-s2"
          >
            Start over
          </button>
        </div>
      ) : usingCal ? (
        <div className={`pb-[clamp(20px,3vw,28px)] pt-1 ${pad}`}>
          <iframe
            title="Book a 20-minute Advertix demo"
            src={`https://cal.com/${CAL_LINK}?embed=true&theme=light&layout=month_view`}
            className="h-[640px] w-full rounded-2xl border border-mk-hair bg-white"
            loading="lazy"
          />
        </div>
      ) : (
        <form onSubmit={submit} noValidate className={`flex flex-col gap-[18px] pb-[clamp(20px,3vw,28px)] pt-1 ${pad}`}>
          {/* Honeypot — hidden from people, tempting to bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
            </label>
          </div>

          {mode === "demo" ? (
            <>
              <div className="flex flex-col gap-2.5">
                <span id={`${id}-when`} className="font-mk-mono text-xs tracking-[.06em] text-mk-ink3">
                  PICK A TIME · 20 MIN{tz ? ` · ${tz}` : ""}
                </span>
                <div role="radiogroup" aria-labelledby={`${id}-when`} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
                  {days.map((d, i) => {
                    const on = i === day;
                    return (
                      <button
                        key={d.label}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={d.label}
                        onClick={() => {
                          setDay(i);
                          setSlot(null);
                        }}
                        className={`flex w-16 flex-none flex-col items-center rounded-2xl border-[1.5px] py-2.5 leading-[1.2] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                          on ? "border-mk-ink bg-mk-ink text-white" : "border-mk-line2 text-mk-ink hover:bg-mk-s2"
                        }`}
                      >
                        <span className="font-mk-mono text-[11px]">{d.w}</span>
                        <span className="text-[22px] font-medium">{d.n}</span>
                      </button>
                    );
                  })}
                </div>
                <div role="radiogroup" aria-label="Time" className="grid grid-cols-[repeat(auto-fill,minmax(86px,1fr))] gap-1.5">
                  {days.length > 0 &&
                    SLOTS[day].map((t) => (
                      <Chip key={t} mono on={t === slot} onClick={() => setSlot(t)}>
                        {t}
                      </Chip>
                    ))}
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
                <Field id={`${id}-name`} label="Name">
                  <input id={`${id}-name`} className={input} value={f.name} onChange={set("name")} placeholder="Sara Reyes" autoComplete="name" />
                </Field>
                <Field id={`${id}-email`} label="Work email">
                  <input
                    id={`${id}-email`}
                    type="email"
                    required
                    className={input}
                    value={f.email}
                    onChange={set("email")}
                    placeholder="sara@agency.com"
                    autoComplete="email"
                  />
                </Field>
                <Field id={`${id}-company`} label="Company">
                  <input
                    id={`${id}-company`}
                    className={input}
                    value={f.company}
                    onChange={set("company")}
                    placeholder="Halden & Pike"
                    autoComplete="organization"
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <span id={`${id}-spend`} className="text-[13px] text-mk-ink2">
                  Monthly ad spend
                </span>
                <div role="radiogroup" aria-labelledby={`${id}-spend`} className="flex flex-wrap gap-1.5">
                  {SPENDS.map((s) => (
                    <Chip key={s} on={s === spend} onClick={() => setSpend(s === spend ? null : s)}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div role="radiogroup" aria-label="Topic" className="flex flex-wrap gap-1.5">
                {TOPICS.map((t) => (
                  <Chip key={t} on={t === topic} onClick={() => setTopic(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
                <Field id={`${id}-mname`} label="Name">
                  <input id={`${id}-mname`} className={input} value={f.name} onChange={set("name")} placeholder="Your name" autoComplete="name" />
                </Field>
                <Field id={`${id}-memail`} label="Email">
                  <input
                    id={`${id}-memail`}
                    type="email"
                    required
                    className={input}
                    value={f.email}
                    onChange={set("email")}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </Field>
              </div>
              <Field id={`${id}-msg`} label="Message">
                <textarea
                  id={`${id}-msg`}
                  required
                  rows={5}
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="What can we help with?"
                  className={`${input} h-auto resize-y py-3.5`}
                />
              </Field>
            </>
          )}

          {status === "error" && (
            <p role="alert" className="m-0 rounded-xl bg-[#fbe9e9] px-3.5 py-2.5 text-sm text-mk-neg">
              {error}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline">
                Email us instead
              </a>
            </p>
          )}

          <button
            type="submit"
            disabled={!canSend || status === "sending"}
            aria-describedby={reason ? `${id}-reason` : undefined}
            className="flex h-14 items-center justify-between rounded-full bg-mk-ink px-[22px] text-base font-semibold text-white transition-opacity enabled:hover:bg-[#2a2733] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand"
          >
            {status === "sending"
              ? "Sending…"
              : mode === "demo"
                ? slot
                  ? `Request ${days[day]?.label} · ${slot}`
                  : "Pick a time to request"
                : "Send message"}
            <span aria-hidden="true">→</span>
          </button>
          <span id={`${id}-reason`} className="-mt-2 text-[13px] text-mk-ink3">
            {reason
              ? `${reason}.`
              : mode === "demo"
                ? "We’ll confirm the exact time by email."
                : "We reply within one working day."}{" "}
            By sending, you agree to our{" "}
            <Link href="/privacy" className="underline hover:text-mk-ink">
              Privacy Policy
            </Link>
            .
          </span>
        </form>
      )}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-mk-ink2">
        {label}
      </label>
      {children}
    </div>
  );
}
