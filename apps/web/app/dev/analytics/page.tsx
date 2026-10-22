import { notFound } from "next/navigation";
import { DevAnalytics } from "./DevAnalytics";

export const metadata = { title: "Analytics (dev)", robots: { index: false } };

/**
 * Dev-only: the real Analytics page inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevAnalyticsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevAnalytics />;
}
