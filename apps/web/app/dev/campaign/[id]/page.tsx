import { notFound } from "next/navigation";
import { DevCampaign } from "./DevCampaign";

export const metadata = { title: "Campaign (dev)", robots: { index: false } };

/**
 * Dev-only: the real Campaign detail page inside the shell. Signed out, its API
 * calls fail; the screenshot script answers them with demo JSON.
 */
export default function DevCampaignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevCampaign />;
}
