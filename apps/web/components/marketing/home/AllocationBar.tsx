"use client";

import { useEffect, useRef } from "react";
import { SCENARIOS, allocationBus } from "./allocation";

const COLORS = ["#1877f2", "#ea4335", "#f4f3fa", "#fffc00", "#0a66c2"];
const NAMES = ["Meta", "Google", "TikTok", "Snapchat", "LinkedIn"];

/** Stacked budget bar that mirrors the hero engine's live split. */
export function AllocationBar() {
  const segs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(
    () =>
      allocationBus.subscribe((a) => {
        a.forEach((v, i) => {
          const el = segs.current[i];
          if (el) el.style.width = `${v}%`;
        });
      }),
    []
  );

  const a0 = SCENARIOS[0].a;
  return (
    <div
      role="img"
      aria-label={`Budget split: ${NAMES.map((n, i) => `${n} ${a0[i]}%`).join(", ")}`}
      className="relative flex h-14 gap-[3px] overflow-hidden rounded-2xl"
    >
      {COLORS.map((c, i) => (
        <span
          key={c}
          ref={(el) => {
            segs.current[i] = el;
          }}
          style={{ width: `${a0[i]}%`, background: c }}
        />
      ))}
    </div>
  );
}
