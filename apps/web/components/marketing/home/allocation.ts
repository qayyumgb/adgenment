/**
 * Illustrative allocation data for the Home hero engine (mockup values).
 * The engine tweens between these scenarios; the "Problem" section's
 * stacked bar listens on `allocationBus` so both show the same split.
 */
import type { PlatformKey } from "@/components/marketing/ui/PlatformMark";

export type Scenario = {
  /** % of budget per platform, in PLATFORM_ROWS order. */
  a: number[];
  /** Revenue returned by the next dollar, per platform. */
  n: number[];
  rev: number;
  title: string;
  body: string;
};

export const MONTHLY_BUDGET = 50_000;

export const PLATFORM_ROWS: { key: PlatformKey; name: string; bar: string }[] = [
  { key: "M", name: "Meta", bar: "#1877f2" },
  { key: "G", name: "Google", bar: "#ea4335" },
  { key: "T", name: "TikTok", bar: "#f4f2fa" },
  { key: "S", name: "Snapchat", bar: "#fffc00" },
  { key: "L", name: "LinkedIn", bar: "#3d8fe0" },
];

export const EVEN: Scenario = {
  a: [20, 20, 20, 20, 20],
  n: [2.9, 1.9, 3.6, 1.4, 1.6],
  rev: 171_400,
  title: "Even split: 20% everywhere",
  body: "What the same budget earns without cross-platform allocation",
};

export const SCENARIOS: Scenario[] = [
  {
    a: [34, 28, 20, 6, 12],
    n: [2.71, 2.05, 3.8, 1.62, 1.95],
    rev: 198_300,
    title: "Started from last month’s split",
    body: "Reading 23 accounts across every platform",
  },
  {
    a: [34, 22, 26, 6, 12],
    n: [2.71, 2.4, 3.42, 1.62, 1.95],
    rev: 206_100,
    title: "Moved $3,000 from Google Search to TikTok",
    body: "TikTok’s next dollar earned 2.4× more than Generic Search",
  },
  {
    a: [37, 22, 27, 3, 11],
    n: [2.58, 2.4, 3.35, 1.9, 2.02],
    rev: 212_900,
    title: "Trimmed Snapchat, added to Meta Advantage+",
    body: "Snapchat CPA rose 31% this week; Meta is still scaling",
  },
];

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** Colour for a next-dollar return on the dark engine panel. */
export const nextColor = (v: number) => (v >= 3 ? "#41d39a" : v >= 2 ? "#f4f2fa" : "#ff8a8e");

type Listener = (a: number[]) => void;
const listeners = new Set<Listener>();
let last: number[] = SCENARIOS[0].a;

export const allocationBus = {
  emit(a: number[]) {
    last = a;
    listeners.forEach((l) => l(a));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    l(last);
    return () => {
      listeners.delete(l);
    };
  },
};
