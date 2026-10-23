import { notFound } from "next/navigation";
import { DevPlanner } from "./DevPlanner";

export const metadata = { title: "AI Planner (dev)", robots: { index: false } };

/**
 * Dev-only: the real AI Planner page inside the shell. Signed out, its API
 * calls fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevPlannerPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevPlanner />;
}
