import { notFound } from "next/navigation";
import { DevOverview } from "./DevOverview";

export const metadata = { title: "Overview (dev)", robots: { index: false } };

/**
 * Dev-only: the real Overview page inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevOverviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevOverview />;
}
