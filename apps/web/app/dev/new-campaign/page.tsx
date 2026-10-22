import { notFound } from "next/navigation";
import { DevNewCampaign } from "./DevNewCampaign";

export const metadata = { title: "New campaign (dev)", robots: { index: false } };

/**
 * Dev-only: the real New campaign wizard inside the shell. Signed out, its API calls
 * fail (error states); the screenshot script answers them with demo JSON.
 */
export default function DevNewCampaignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevNewCampaign />;
}
