"use client";

import { useState } from "react";
import { Send, Check, AlertCircle, Loader2 } from "lucide-react";

const TOPICS = [
  "General question",
  "Support / something broken",
  "Sales / partnership",
  "Press / media",
  "Other",
];

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus("error");
      return;
    }
    setStatus("sending");

    // No backend route yet — open user's mail client with a prepared message.
    // When the contact API ships, swap this for a fetch() to /api/contact.
    const subject = `[Advertix · ${topic}] from ${name}`;
    const body = `${message}\n\n— ${name}\n${email}`;
    const mailto = `mailto:support@advertix.io?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;

    // Show the success state regardless; the mail client will take it from here.
    setTimeout(() => setStatus("sent"), 400);
  }

  if (status === "sent") {
    return (
      <div className="mt-8 rounded-2xl bg-emerald-50 p-6 ring-1 ring-emerald-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-5 w-5" strokeWidth={3} />
          </div>
          <div>
            <div className="text-base font-bold text-emerald-900">
              Message ready to send
            </div>
            <p className="text-sm text-emerald-800">
              Your email client should be open. If nothing happened, just send
              an email to{" "}
              <a
                href="mailto:support@advertix.io"
                className="font-semibold underline"
              >
                support@advertix.io
              </a>
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setName("");
            setEmail("");
            setMessage("");
          }}
          className="mt-4 text-sm font-bold text-emerald-700 underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
          />
        </Field>
      </div>

      <Field label="Topic">
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                topic === t
                  ? "border-indigo-300 bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Message" required>
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what's on your mind…"
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
        />
      </Field>

      {status === "error" && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
          <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
          Please fill in all required fields.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-xs text-slate-500">
          By submitting, you agree to our{" "}
          <a
            href="/privacy"
            className="font-semibold text-slate-700 underline"
          >
            Privacy Policy
          </a>
          .
        </p>
        <button
          type="submit"
          disabled={status === "sending"}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-600/40 disabled:translate-y-0 disabled:opacity-60"
        >
          {status === "sending" ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2.5} />
          )}
          {status === "sending" ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-indigo-600">*</span>}
      </span>
      {children}
    </label>
  );
}
