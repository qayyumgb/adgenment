import { notFound } from "next/navigation";
import { DevCampaigns } from "./DevCampaigns";

export const metadata = { title: "Campaigns (dev)", robots: { index: false } };

/**
 * Dev-only: the real Campaigns page inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevCampaignsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevCampaigns />;
}
