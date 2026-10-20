"use client";

import { useState } from "react";

type Who = "AI" | "SHARED" | "YOU";

const ROLES: { t: string; who: Who; by: string; you: string }[] = [
  { t: "Media buyer", who: "AI", by: "Decision feed and budget allocator, checked every six hours.", you: "Setting strategy and client goals." },
  { t: "Analyst", who: "AI", by: "Statistical models: response curves, anomalies, significance.", you: "Deciding which questions matter." },
  { t: "Pacing manager", who: "AI", by: "Monthly caps per client with run-out dates and cap changes.", you: "Agreeing budgets with the client." },
  { t: "Creative strategist", who: "SHARED", by: "Fatigue detection and variants drafted from proven hooks.", you: "Taste, brand voice and final approval." },
  { t: "Copywriter", who: "SHARED", by: "Claude drafts headlines and primary text per platform.", you: "Editing for voice and claims." },
  { t: "Tracking engineer", who: "AI", by: "Pixel and conversion API health alerts within the hour.", you: "Fixing the site tag when it breaks." },
  { t: "Report writer", who: "AI", by: "Weekly white-label PDF with a plain-English summary.", you: "A quick read before it sends." },
  { t: "Account manager", who: "YOU", by: "Client portal and reports make the conversations easier.", you: "The relationship. That stays human." },
  { t: "Planner", who: "AI", by: "AI Planner turns a goal and budget into draft campaigns.", you: "Choosing the goal." },
  { t: "Platform specialists ×3", who: "AI", by: "One builder that maps to Meta, Google, TikTok, Snapchat and LinkedIn.", you: "Platform policy questions." },
  { t: "Head of growth", who: "YOU", by: "Autonomy levels, guardrails and approvals keep you in charge.", you: "Every big call." },
];

const TAG: Record<Who, { bg: string; fg: string; label: string }> = {
  AI: { bg: "rgba(65,211,154,.16)", fg: "#41d39a", label: "COVERED BY ADVERTIX" },
  SHARED: { bg: "rgba(185,171,255,.18)", fg: "#c7bcff", label: "ADVERTIX + YOU" },
  YOU: { bg: "rgba(242,180,78,.16)", fg: "#f2b44e", label: "STAYS HUMAN" },
};

export function RolesExplorer() {
  const [i, setI] = useState(0);
  const r = ROLES[i];
  const tag = TAG[r.who];

  return (
    <div className="flex min-w-0 flex-[1.2_1_460px] flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Roles">
        {ROLES.map((x, j) => {
          const on = j === i;
          return (
            <button
              key={x.t}
              type="button"
              aria-pressed={on}
              onClick={() => setI(j)}
              className={`h-9 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors duration-[250ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                on ? "border-mk-ink bg-mk-ink text-white" : "border-mk-line2 bg-mk-paper2 text-mk-ink hover:bg-white"
              }`}
            >
              {x.t}
            </button>
          );
        })}
      </div>
      <div
        data-reveal="up"
        aria-live="polite"
        className="flex min-h-[180px] flex-col gap-3 rounded-[22px] bg-mk-ink p-5 text-mk-on-dark"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[17px] font-semibold">{r.t}</span>
          <span className="flex-1" />
          <span className="rounded-full px-2.5 py-[3px] font-mk-mono text-[11.5px]" style={{ background: tag.bg, color: tag.fg }}>
            {tag.label}
          </span>
        </div>
        <span className="text-[15px] text-[#d6d2e2]">{r.by}</span>
        <span className="text-sm text-mk-on-dark2">
          <span className="font-mk-mono text-[11.5px] tracking-[.06em] text-mk-lav">STILL YOU ·</span> {r.you}
        </span>
      </div>
    </div>
  );
}
