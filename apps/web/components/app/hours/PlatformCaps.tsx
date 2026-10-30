import { cn } from "@/lib/cn";
import { PlatformBadge, type PlatformKey } from "@/components/app/ui";

/** What each platform allows for hours (guide §8, the mockup's F6 card). */
const CAPS: { p: PlatformKey; text: string; level: "Full" | "Partial" | "Varies" | "Dates only" }[] = [
  { p: "META", text: "Hourly schedule with lifetime budgets only", level: "Partial" },
  { p: "GOOGLE", text: "Ad schedules and bid adjustments by hour", level: "Full" },
  { p: "TIKTOK", text: "Dayparting by hour", level: "Full" },
  { p: "SNAPCHAT", text: "Start and end dates; hours vary by account", level: "Varies" },
  { p: "LINKEDIN", text: "Start and end dates only", level: "Dates only" },
];

export function PlatformCaps({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4", className)}>
      <span className="text-[13px] font-semibold">What each platform allows</span>
      {CAPS.map((c) => (
        <div key={c.p} className="flex items-center gap-2 text-[13px]">
          <PlatformBadge platform={c.p} size={22} />
          <span className="min-w-0 flex-1">{c.text}</span>
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2 py-px text-xs font-semibold",
              c.level === "Full" ? "bg-pos-soft text-pos" : c.level === "Dates only" ? "bg-surface-3 text-ink-2" : "bg-warn-soft text-warn"
            )}
          >
            {c.level}
          </span>
        </div>
      ))}
      <span className="text-xs text-ink-3">Advertix changes Meta hours in one click. For Google and TikTok it gives you the exact steps for now.</span>
    </div>
  );
}
